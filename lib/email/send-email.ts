import { render } from "@react-email/render";
import { TeamInvitationEmail } from "@/lib/email/templates/team-invitation-email";
import * as React from "react";
import { getResendClient } from "@/lib/email/resend";
import { getNodemailerTransporter } from "@/lib/email/nodemailer";
import { getBusinessNotificationEmail, validateEmail } from "@/lib/email/recipients";
import { logEmailSent, logEmailFailed, logEmailSkipped } from "@/lib/email/email-log";
import { createServiceClient } from "@/utils/supabase/service";
import { getConfig, getConfigWithEnvFallback, getSecretWithEnvFallback } from "@/lib/config/platform-config";

const TEMPLATE_PREF_MAP: Record<string, string> = {
  "new-lead-email": "leads",
  "booking-request-email": "booking",
  "support-request-email": "support",
  "usage-warning-email": "usage",
  "payment-success-email": "billing",
  "payment-failed-email": "billing",
};

interface SendTransactionalEmailInput {
  businessId?: string | null;
  to?: string | null;
  subject: string;
  templateName: string;
  react: React.ReactElement;
  fallbackText?: string;
  notificationId?: string;
}

async function isEmailEnabled(businessId: string, category: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("email_enabled")
    .eq("business_id", businessId)
    .eq("category", category)
    .is("user_id", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load ${category} notification preference: ${error.message}`);
  }
  return data?.email_enabled ?? true;
}

/**
 * High-level transactional email wrapper using Resend.
 * 
 * - Resolves & validates recipients (supports fallback to business support email or owner profile email)
 * - Checks business notification preferences (skips sending if disabled)
 * - Safely logs output to email_logs
 * - Catches all unhandled exceptions to prevent app disruption
 */
export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  // Check if emails are globally enabled
  const emailsEnabled = await getConfig("feature_flags", "enable_emails");
  if (emailsEnabled === "false") {
    console.log("[EMAIL SKIP] Emails are globally disabled via feature flags.");
    if (input.notificationId) {
      await logEmailSkipped({
        notificationId: input.notificationId,
        recipient: input.to?.trim() || "unresolved",
        provider: "disabled",
      });
    }
    return { success: true, skipped: true };
  }

  const dbProvider = await getConfig("email", "default_provider");
  const smtpUser = await getConfigWithEnvFallback("smtp", "username", "SMTP_USER");
  const smtpPass = await getSecretWithEnvFallback("smtp", "password", "SMTP_PASSWORD");
  const provider = dbProvider || (smtpUser && smtpPass ? "smtp" : "resend");
  const useNodemailer = provider === "smtp";
  let finalTo = input.to ? input.to.trim() : null;

  try {
    // 1. Resolve Recipient if missing
    if (!finalTo && input.businessId) {
      finalTo = await getBusinessNotificationEmail(input.businessId);
    }

    if (!finalTo || !validateEmail(finalTo)) {
      const errMsg = `Invalid or missing recipient email: '${finalTo || ""}'`;
      console.warn(`[EMAIL SKIP] ${errMsg}`);
      
      if (input.businessId) {
        await logEmailFailed({
          businessId: input.businessId,
          recipient: finalTo || "unknown",
          subject: input.subject,
          templateName: input.templateName,
          provider,
          errorMessage: errMsg,
          notificationId: input.notificationId,
        });
      }
      return { success: false, error: errMsg };
    }

    // 2. Resolve Notification Preferences
    if (input.businessId) {
      const prefColumn = TEMPLATE_PREF_MAP[input.templateName];
      if (prefColumn) {
        const isEnabled = await isEmailEnabled(input.businessId, prefColumn);

        if (!isEnabled) {
          console.log(`[EMAIL SKIP] Template '${input.templateName}' is disabled in notification preferences for business ${input.businessId}`);
          if (input.notificationId) {
            await logEmailSkipped({
              notificationId: input.notificationId,
              recipient: finalTo,
              provider,
            });
          }
          return { success: true, skipped: true };
        }
      }
    }

    // 3. Render React Email component to HTML string
    let htmlContent = "";
    try {
      htmlContent = await render(input.react);
    } catch (renderErr: any) {
      const errMsg = `React Email template render failed: ${renderErr?.message || "Unknown error"}`;
      console.error(`[EMAIL RENDER ERROR]`, renderErr);
      
      if (input.businessId) {
        await logEmailFailed({
          businessId: input.businessId,
          recipient: finalTo,
          subject: input.subject,
          templateName: input.templateName,
          provider,
          errorMessage: errMsg,
          notificationId: input.notificationId,
        });
      }
      return { success: false, error: errMsg };
    }

    const fromEmail = (await getConfigWithEnvFallback("email", "from_email", "EMAIL_FROM")) ||
      (useNodemailer ? (smtpUser || "noreply@yourdomain.com") : "noreply@yourdomain.com");
    const fromName = (await getConfig("email", "from_name")) || "";
    const sender = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
    
    const replyTo = await getConfig("email", "reply_to_email") || undefined;
    const textContent = input.fallbackText || input.subject;

    if (useNodemailer) {
      const transporter = await getNodemailerTransporter();
      if (!transporter) {
        const errMsg = "Nodemailer transporter could not be initialized (missing SMTP configs).";
        if (input.businessId) {
          await logEmailFailed({
            businessId: input.businessId,
            recipient: finalTo,
            subject: input.subject,
            templateName: input.templateName,
            provider,
            errorMessage: errMsg,
            notificationId: input.notificationId,
          });
        }
        return { success: false, error: errMsg };
      }

      try {
        const info = await transporter.sendMail({
          from: sender,
          to: finalTo,
          subject: input.subject,
          html: htmlContent,
          text: textContent,
          replyTo,
        });

        // 5. Log success to database
        if (input.businessId) {
          await logEmailSent({
            businessId: input.businessId,
            recipient: finalTo,
            subject: input.subject,
            templateName: input.templateName,
            provider,
            responseBody: { messageId: info.messageId, response: info.response },
            notificationId: input.notificationId,
            providerMessageId: info.messageId,
          });
        }

        return { success: true };
      } catch (sendError: any) {
        const errMsg = sendError.message || "Failed to deliver email through Nodemailer SMTP.";
        console.error(`[NODEMAILER SMTP ERROR]`, sendError);
        
        if (input.businessId) {
          await logEmailFailed({
            businessId: input.businessId,
            recipient: finalTo,
            subject: input.subject,
            templateName: input.templateName,
            provider,
            errorMessage: errMsg,
            responseBody: sendError,
            notificationId: input.notificationId,
          });
        }
        return { success: false, error: errMsg };
      }
    } else {
      // Send via Resend
      const resend = await getResendClient();
      if (!resend) {
        const errMsg = "Resend client could not be initialized (missing API key).";
        if (input.businessId) {
          await logEmailFailed({
            businessId: input.businessId,
            recipient: finalTo,
            subject: input.subject,
            templateName: input.templateName,
            provider,
            errorMessage: errMsg,
            notificationId: input.notificationId,
          });
        }
        return { success: false, error: errMsg };
      }

      const { data: responseData, error: sendError } = await resend.emails.send({
        from: sender!,
        to: finalTo,
        subject: input.subject,
        html: htmlContent,
        text: textContent,
        replyTo: replyTo,
      });

      if (sendError) {
        const errMsg = sendError.message || "Failed to deliver email through Resend API.";
        console.error(`[RESEND API ERROR]`, sendError);
        
        if (input.businessId) {
          await logEmailFailed({
            businessId: input.businessId,
            recipient: finalTo,
            subject: input.subject,
            templateName: input.templateName,
            provider,
            errorMessage: errMsg,
            notificationId: input.notificationId,
            responseBody: sendError,
          });
        }
        return { success: false, error: errMsg };
      }

      // 5. Log success to database
      if (input.businessId) {
        await logEmailSent({
          businessId: input.businessId,
          recipient: finalTo,
          subject: input.subject,
          templateName: input.templateName,
          provider,
          responseBody: responseData,
          notificationId: input.notificationId,
          providerMessageId: responseData?.id,
        });
      }

      return { success: true };
    }

  } catch (err: any) {
    const errMsg = err?.message || "An unexpected error occurred during email delivery flow.";
    console.error(`[EMAIL DELIVERY EXCEPTION]`, err);

    if (input.businessId && finalTo) {
      await logEmailFailed({
        businessId: input.businessId,
        recipient: finalTo,
        subject: input.subject,
        templateName: input.templateName,
        provider,
        errorMessage: errMsg,
        notificationId: input.notificationId,
      });
    }
    return { success: false, error: errMsg };
  }
}

interface SendTeamInvitationEmailInput {
  to: string;
  businessName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
  expiresAt: string;
  businessId: string;
}

export async function sendTeamInvitationEmail({
  to,
  businessName,
  inviterName,
  role,
  inviteUrl,
  expiresAt,
  businessId,
}: SendTeamInvitationEmailInput) {
  return sendTransactionalEmail({
    businessId,
    to,
    subject: `You've been invited to join ${businessName} on Agentify`,
    templateName: "team-invitation-email",
    react: React.createElement(TeamInvitationEmail, {
      businessName,
      inviterName,
      role,
      inviteUrl,
      expiresAt,
    }),
  });
}
