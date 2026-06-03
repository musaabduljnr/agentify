import { Resend } from "resend";
import { getSecretWithEnvFallback } from "@/lib/config/platform-config";

let resendClient: Resend | null = null;

/**
 * Initializes and retrieves the Resend API client singleton.
 * Throws a clear error in development if the key is missing,
 * but returns null gracefully in production to avoid crashing the entire application.
 */
export async function getResendClient(): Promise<Resend | null> {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = await getSecretWithEnvFallback("resend", "api_key", "RESEND_API_KEY");

  if (!apiKey || apiKey.includes("your_resend_api_key")) {
    const errorMsg = "RESEND_API_KEY is not defined in database platform configurations or environment variables.";
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
