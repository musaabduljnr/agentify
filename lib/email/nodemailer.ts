import nodemailer from "nodemailer";
import { getConfigWithEnvFallback, getSecretWithEnvFallback } from "@/lib/config/platform-config";

let transporter: nodemailer.Transporter | null = null;

/**
 * Initializes and retrieves the Nodemailer SMTP transporter singleton.
 */
export async function getNodemailerTransporter(): Promise<nodemailer.Transporter | null> {
  if (transporter) {
    return transporter;
  }

  const host = await getConfigWithEnvFallback("smtp", "host", "SMTP_HOST") || "smtp.gmail.com";
  const port = Number(await getConfigWithEnvFallback("smtp", "port", "SMTP_PORT")) || 465;
  const user = await getConfigWithEnvFallback("smtp", "username", "SMTP_USER");
  const pass = await getSecretWithEnvFallback("smtp", "password", "SMTP_PASSWORD");
  const secureVal = await getConfigWithEnvFallback("smtp", "secure", "SMTP_SECURE");
  const secure = secureVal === "true" || port === 465;

  if (!user || !pass) {
    const errorMsg = "SMTP username and password are not defined in database platform configurations or environment variables.";
    if (process.env.NODE_ENV === "development") {
      console.warn(`[EMAIL SERVICE DEV WARNING] ${errorMsg}`);
    } else {
      console.error(`[EMAIL SERVICE PRODUCTION ERROR] ${errorMsg} Skipping SMTP operations.`);
    }
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}
