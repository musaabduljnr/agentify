import { Resend } from "resend";

let resendClient: Resend | null = null;

/**
 * Initializes and retrieves the Resend API client singleton.
 * Throws a clear error in development if the key is missing,
 * but returns null gracefully in production to avoid crashing the entire application.
 */
export function getResendClient(): Resend | null {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    const errorMsg = "RESEND_API_KEY is not defined in the environment variables.";
    if (process.env.NODE_ENV === "development") {
      throw new Error(`[EMAIL SERVICE DEV ERROR] ${errorMsg}`);
    } else {
      console.error(`[EMAIL SERVICE PRODUCTION ERROR] ${errorMsg} Skipping email operations.`);
      return null;
    }
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}
