export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://agentifychat.online").replace(/\/$/, "");

export const COMPANY_LEGAL_NAME =
  process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME || "Agentify";

export const COMPANY_POSTAL_ADDRESS =
  process.env.NEXT_PUBLIC_COMPANY_POSTAL_ADDRESS || "[Postal address required]";

export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@agentifychat.online";
export const SALES_EMAIL = "sales@agentifychat.online";
export const BILLING_EMAIL = "billing@agentifychat.online";

export const WIDGET_SCRIPT_URL = `${SITE_URL}/widget.js`;
export const HOSTED_CHAT_EXAMPLE = `${SITE_URL}/chat/your-company`;
