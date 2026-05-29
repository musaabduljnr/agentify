import { render } from "@react-email/render";
import { getResendClient } from "@/lib/email/resend";
import { getNodemailerTransporter } from "@/lib/email/nodemailer";
import { getBusinessNotificationEmail, validateEmail } from "@/lib/email/recipients";
import { logEmailSent, logEmailFailed } from "@/lib/email/email-log";
import { createServiceClient } from "@/utils/supabase/service";

// Maps email template names to notification preferences table columns
const TEMPLATE_PREF_MAP: Record<string, string> = {
  "new-lead-email": "email_new_leads",
  "booking-request-email": "email_booking_requests",
  "support-request-email": "email_support_requests",
  "usage-warning-email": "email_usage_warnings",
  "payment-success-email": "email_payment_updates",
  "payment-failed-email": "email_payment_updates",
};

interface SendTransactionalEmailInput {
  businessId?: string | null;
  to?: string | null;
  subject: string;
  templateName: string;
  react: React.ReactElement;
  fallbackText?: string;
}

/**
 * Fetches or initializes default notification preferences for a business.
 */
async function getOrInitializePreferences(businessId: string) {
  const supabase = createServiceClient();
  
  try {
    const { data: pref, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (pref) return pref;

    // Initialize default row if it does not exist
    const { data: newPref, error: insertErr } = await supabase
      .from("notification_preferences")
      .insert({ business_id: businessId })
      .select()
      .single();

    if (insertErr) {
      console.error(`[PREFS WARNING] Failed to initialize default notification preferences for business ${businessId}:`, insertErr.message);
      // Return fallback defaulting all to true
      return {
        email_new_leads: true,
        email_support_requests: true,
        email_booking_requests: true,
        email_usage_warnings: true,
        email_payment_updates: true,
      };
    }

    return newPref;
  } catch (err) {
    console.error(`[PREFS CRITICAL] Exception resolving preferences for business ${businessId}:`, err);
    return {
      email_new_leads: true,
      email_support_requests: true,
      email_booking_requests: true,
      email_usage_warnings: true,
      email_payment_updates: true,
    };
  }
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
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;
  const useNodemailer = !!(smtpUser && smtpPass);
  const provider = useNodemailer ? "nodemailer" : "resend";
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
        });
      }
      return { success: false, error: errMsg };
    }

    // 2. Resolve Notification Preferences
    if (input.businessId) {
      const prefColumn = TEMPLATE_PREF_MAP[input.templateName];
      if (prefColumn) {
        const prefs = await getOrInitializePreferences(input.businessId);
        const isEnabled = (prefs as any)[prefColumn] ?? true;

        if (!isEnabled) {
          console.log(`[EMAIL SKIP] Template '${input.templateName}' is disabled in notification preferences for business ${input.businessId}`);
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
        });
      }
      return { success: false, error: errMsg };
    }

    // 4. Send email via selected provider (Nodemailer vs Resend)
    const sender = process.env.EMAIL_FROM || (useNodemailer ? smtpUser : "noreply@yourdomain.com");
    const textContent = input.fallbackText || input.subject;

    if (useNodemailer) {
      const transporter = getNodemailerTransporter();
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
          });
        }
        return { success: false, error: errMsg };
      }
    } else {
      // Send via Resend
      const resend = getResendClient();
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
      });
    }
    return { success: false, error: errMsg };
  }
}
