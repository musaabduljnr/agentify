import { render } from "@react-email/render";
import { Resend } from "resend";
import { getConfiguredOptionalEnv } from "@/lib/env";
import { logError } from "@/lib/monitoring/log-error";
import {
  BookingSupportEmail,
  LeadNotificationEmail,
  PaymentEmail,
  UsageWarningEmail,
  WelcomeEmail,
} from "@/lib/email/templates";

type EmailTemplate =
  | { type: "welcome"; props: React.ComponentProps<typeof WelcomeEmail> }
  | { type: "lead-notification"; props: React.ComponentProps<typeof LeadNotificationEmail> }
  | { type: "booking-support"; props: React.ComponentProps<typeof BookingSupportEmail> }
  | { type: "payment"; props: React.ComponentProps<typeof PaymentEmail> }
  | { type: "usage-warning"; props: React.ComponentProps<typeof UsageWarningEmail> };

type SendTransactionalEmailInput = {
  to: string | string[] | null | undefined;
  subject: string;
  template: EmailTemplate;
  businessId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

let resendClient: Resend | null = null;

function getResendClient() {
  const apiKey = getConfiguredOptionalEnv("RESEND_API_KEY");
  if (!apiKey) return null;

  resendClient ||= new Resend(apiKey);
  return resendClient;
}

function normalizeRecipients(to: SendTransactionalEmailInput["to"]): string[] {
  return (Array.isArray(to) ? to : [to]).filter((value): value is string => {
    return typeof value === "string" && value.includes("@");
  });
}

function getSender() {
  return getConfiguredOptionalEnv("EMAIL_FROM");
}

function senderDomain(sender: string) {
  const match = sender.match(/<[^@<>]+@([^<>]+)>|^[^@<>]+@([^<>]+)$/);
  return (match?.[1] || match?.[2] || "").toLowerCase();
}

function senderUsesVerifiedDomain(sender: string) {
  const verifiedDomain = getConfiguredOptionalEnv("RESEND_VERIFIED_DOMAIN");
  if (!verifiedDomain) return true;
  return senderDomain(sender) === verifiedDomain.toLowerCase();
}

async function renderTemplate(template: EmailTemplate) {
  switch (template.type) {
    case "welcome":
      return render(<WelcomeEmail {...template.props} />);
    case "lead-notification":
      return render(<LeadNotificationEmail {...template.props} />);
    case "booking-support":
      return render(<BookingSupportEmail {...template.props} />);
    case "payment":
      return render(<PaymentEmail {...template.props} />);
    case "usage-warning":
      return render(<UsageWarningEmail {...template.props} />);
  }
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput) {
  const recipients = normalizeRecipients(input.to);
  if (recipients.length === 0) return { sent: false, reason: "missing-recipient" as const };

  const sender = getSender();
  const resend = getResendClient();

  if (!sender || !resend) {
    await logError({
      source: "email-send",
      message: "Transactional email skipped because Resend is not configured.",
      businessId: input.businessId,
      userId: input.userId,
      metadata: { ...input.metadata, template: input.template.type },
    });
    return { sent: false, reason: "not-configured" as const };
  }

  if (!senderUsesVerifiedDomain(sender)) {
    await logError({
      source: "email-send",
      message: "EMAIL_FROM does not match RESEND_VERIFIED_DOMAIN.",
      businessId: input.businessId,
      userId: input.userId,
      metadata: { ...input.metadata, template: input.template.type },
    });
    return { sent: false, reason: "unverified-sender-domain" as const };
  }

  try {
    const html = await renderTemplate(input.template);
    const { error } = await resend.emails.send({
      from: sender,
      to: recipients,
      subject: input.subject,
      html,
    });

    if (error) throw new Error(error.message);
    return { sent: true as const };
  } catch (error) {
    await logError({
      source: "email-send",
      message: error instanceof Error ? error.message : "Resend email send failed.",
      businessId: input.businessId,
      userId: input.userId,
      metadata: { ...input.metadata, template: input.template.type },
    });
    return { sent: false, reason: "send-failed" as const };
  }
}

export async function sendWelcomeEmail(input: {
  to: string | null | undefined;
  name?: string | null;
  userId?: string | null;
}) {
  return sendTransactionalEmail({
    to: input.to,
    subject: "Welcome to Agentify",
    template: { type: "welcome", props: { name: input.name } },
    userId: input.userId,
  });
}

export async function sendLeadNotificationEmail(input: {
  to: string | null | undefined;
  businessId: string;
  businessName: string;
  leadName?: string | null;
  leadEmail?: string | null;
  leadPhone?: string | null;
  interest?: string | null;
}) {
  return sendTransactionalEmail({
    to: input.to,
    subject: `New lead for ${input.businessName}`,
    template: {
      type: "lead-notification",
      props: input,
    },
    businessId: input.businessId,
  });
}

export async function sendPaymentEmail(input: {
  to: string | null | undefined;
  businessId?: string | null;
  userId?: string | null;
  planName: string;
  status: "success" | "failed" | "past_due";
  amount?: string | null;
}) {
  return sendTransactionalEmail({
    to: input.to,
    subject: input.status === "success" ? "Agentify payment confirmed" : "Agentify payment needs attention",
    template: {
      type: "payment",
      props: {
        planName: input.planName,
        status: input.status,
        amount: input.amount,
      },
    },
    businessId: input.businessId,
    userId: input.userId,
  });
}

export async function sendUsageWarningEmail(input: {
  to: string | null | undefined;
  businessId: string;
  label: string;
  used: number;
  limit: number;
}) {
  return sendTransactionalEmail({
    to: input.to,
    subject: `Agentify ${input.label} usage warning`,
    template: {
      type: "usage-warning",
      props: {
        label: input.label,
        used: input.used,
        limit: input.limit,
      },
    },
    businessId: input.businessId,
  });
}
