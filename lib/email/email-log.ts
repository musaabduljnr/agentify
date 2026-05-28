import { createServiceClient } from "@/utils/supabase/service";

interface LogEmailSentInput {
  businessId: string | null | undefined;
  recipient: string;
  subject: string;
  templateName: string;
  provider: string;
  responseBody?: any;
}

interface LogEmailFailedInput {
  businessId: string | null | undefined;
  recipient: string;
  subject: string;
  templateName: string;
  provider: string;
  errorMessage: string;
  responseBody?: any;
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
}
