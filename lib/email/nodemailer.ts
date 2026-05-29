import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

/**
 * Initializes and retrieves the Nodemailer SMTP transporter singleton.
 */
export function getNodemailerTransporter(): nodemailer.Transporter | null {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!user || !pass) {
    const errorMsg = "SMTP_USER and SMTP_PASSWORD are not defined in the environment variables.";
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
