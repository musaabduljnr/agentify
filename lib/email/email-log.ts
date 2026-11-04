import { createServiceClient } from "@/utils/supabase/service";

interface LogEmailSentInput {
  businessId: string | null | undefined;
  recipient: string;
  subject: string;
  templateName: string;
  provider: string;
  responseBody?: any;
  notificationId?: string;
  providerMessageId?: string;
}

interface LogEmailFailedInput {
  businessId: string | null | undefined;
  recipient: string;
  subject: string;
  templateName: string;
  provider: string;
  errorMessage: string;
  responseBody?: any;
  notificationId?: string;
}

interface LogEmailSkippedInput {
  notificationId: string;
  recipient: string;
  provider: string;
}

async function logNotificationDelivery(params: {
  notificationId?: string;
  recipient: string;
  provider: string;
  providerMessageId?: string;
  status: "sent" | "failed" | "skipped";
  errorMessage?: string;
}): Promise<void> {
  if (!params.notificationId) return;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("notification_deliveries").insert({
      notification_id: params.notificationId,
      channel: "email",
      recipient: params.recipient,
      provider: params.provider,
      provider_message_id: params.providerMessageId || null,
      status: params.status,
      error_message: params.errorMessage || null,
    });

    if (error) console.error("[NOTIFICATION DELIVERY LOGGING ERROR]", error.message);
  } catch (error) {
    console.error("[NOTIFICATION DELIVERY LOGGING ERROR]", error);
  }
}

/**
 * Logs a successfully sent email to the `email_logs` table.
 * Wrapped in a robust try-catch block so logging failures never break the caller.
 */
export async function logEmailSent(params: LogEmailSentInput): Promise<void> {
  const supabase = createServiceClient();
  
  try {
    const { error } = await supabase.from("email_logs").insert({
      business_id: params.businessId || null,
      recipient: params.recipient,
      subject: params.subject,
      template_name: params.templateName,
      provider: params.provider,
      status: "sent",
      response_body: params.responseBody || {},
    });

    if (error) {
      console.error(`[EMAIL LOGGING ERROR] Failed to insert 'sent' log:`, error.message);
    }
  } catch (err) {
    console.error(`[EMAIL LOGGING CRITICAL] Exception logging sent email:`, err);
  }

  await logNotificationDelivery({
    notificationId: params.notificationId,
    recipient: params.recipient,
    provider: params.provider,
    providerMessageId: params.providerMessageId,
    status: "sent",
  });
}

/**
 * Logs a failed email attempt to the `email_logs` table.
 * Wrapped in a robust try-catch block so logging failures never break the caller.
 */
export async function logEmailFailed(params: LogEmailFailedInput): Promise<void> {
  const supabase = createServiceClient();
  
  try {
    const { error } = await supabase.from("email_logs").insert({
      business_id: params.businessId || null,
      recipient: params.recipient,
      subject: params.subject,
      template_name: params.templateName,
      provider: params.provider,
      status: "failed",
      error_message: params.errorMessage,
      response_body: params.responseBody || {},
    });

    if (error) {
      console.error(`[EMAIL LOGGING ERROR] Failed to insert 'failed' log:`, error.message);
    }
  } catch (err) {
    console.error(`[EMAIL LOGGING CRITICAL] Exception logging failed email:`, err);
  }

  await logNotificationDelivery({
    notificationId: params.notificationId,
    recipient: params.recipient,
    provider: params.provider,
    status: "failed",
    errorMessage: params.errorMessage,
  });
}

export async function logEmailSkipped(params: LogEmailSkippedInput): Promise<void> {
  await logNotificationDelivery({
    notificationId: params.notificationId,
    recipient: params.recipient,
    provider: params.provider,
    status: "skipped",
  });
}
