/**
 * Environment variable validation.
 *
 * Call validateEnv() once at startup, such as in next.config.ts.
 * In development: logs warnings.
 * In production: throws hard errors so the build/server fails fast.
 */

type EnvSpec = {
  key: string;
  required: boolean;
  description: string;
  serverOnly?: boolean;
};

const ENV_SPECS: EnvSpec[] = [
  {
    key: "NEXT_PUBLIC_APP_URL",
    required: false,
    description: "Public base URL of the application, such as https://agentify.co (Optional: falls back to database platform.app_url)",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    description: "Supabase project URL",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anon/public key",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    serverOnly: true,
    description: "Supabase service role key - server-side only, never expose to client",
  },
  {
    key: "GEMINI_API_KEY",
    required: false,
    serverOnly: true,
    description: "Gemini API key - server-side only (Optional: falls back to database ai.gemini_api_key)",
  },
  {
    key: "OPENROUTER_API_KEY",
    required: false,
    serverOnly: true,
    description: "OpenRouter API key - server-side only, required only when OpenRouter is selected",
  },
  {
    key: "PAYSTACK_SECRET_KEY",
    required: false,
    serverOnly: true,
    description: "Paystack secret key - required for payment processing (Optional: falls back to database paystack.secret_key)",
  },
  {
    key: "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY",
    required: false,
    description: "Paystack public key - safe to expose to the browser (Optional: falls back to database paystack.public_key)",
  },
  {
    key: "PAYSTACK_WEBHOOK_SECRET",
    required: false,
    serverOnly: true,
    description: "Optional Paystack webhook signing secret. Falls back to PAYSTACK_SECRET_KEY.",
  },
  {
    key: "PAYSTACK_STARTER_PLAN_CODE",
    required: false,
    serverOnly: true,
    description: "Optional Paystack Starter subscription plan code. Omit for one-time checkout.",
  },
  {
    key: "PAYSTACK_GROWTH_PLAN_CODE",
    required: false,
    serverOnly: true,
    description: "Optional Paystack Growth subscription plan code. Omit for one-time checkout.",
  },
  {
    key: "RESEND_API_KEY",
    required: false,
    serverOnly: true,
    description: "Resend API key - required for transactional emails (Optional: falls back to database resend.api_key)",
  },
  {
    key: "EMAIL_FROM",
    required: false,
    description: "Verified sender address for transactional email (Optional: falls back to database email.from_email)",
  },
  {
    key: "RESEND_VERIFIED_DOMAIN",
    required: false,
    serverOnly: true,
    description: "Optional verified Resend sender domain, used to validate EMAIL_FROM in production",
  },
  {
    key: "SUPPORT_EMAIL",
    required: false,
    description: "Public support email address (Optional: falls back to database platform.support_email)",
  },
];

let validated = false;

export function validateEnv(): void {
  if (validated) return;
  validated = true;

  const missing: string[] = [];
  const warnings: string[] = [];

  for (const spec of ENV_SPECS) {
    const value = process.env[spec.key];

    if (spec.required && (!value || value.trim() === "")) {
      missing.push(`  - ${spec.key}\n    ${spec.description}`);
    } else if (!spec.required && !value) {
      warnings.push(`  - ${spec.key}: ${spec.description}`);
    }
  }

  const publicEnvKeys = Object.keys(process.env).filter((key) =>
    key.startsWith("NEXT_PUBLIC_")
  );
  const exposedSecretKeys = publicEnvKeys.filter((key) =>
    /(SECRET|SERVICE_ROLE|PRIVATE|TOKEN|API_KEY)$/i.test(key)
  );

  if (exposedSecretKeys.length > 0) {
    const message = [
      "",
      "Agentify startup failed - server secrets must not use NEXT_PUBLIC_:",
      ...exposedSecretKeys.map((key) => `  - ${key}`),
      "",
    ].join("\n");

    console.error(message);
    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
  }

  if (warnings.length > 0 && process.env.NODE_ENV === "development") {
    console.warn(
      [
        "",
        "Agentify: optional env vars not configured:",
        ...warnings,
        "",
      ].join("\n")
    );
  }

  if (missing.length > 0) {
    const message = [
      "",
      "AGENTIFY - Missing required environment variables",
      "",
      "The following required environment variables are not set:",
      "",
      ...missing,
      "",
      "Add them to .env.local for local builds and to Vercel for production.",
      "",
    ].join("\n");

    console.error(message);

    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Agentify startup failed - missing required environment variables:\n${missing.join("\n")}`
      );
    }
  }
}

/** Get a required env var - throws in production if missing, warns in dev */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    const msg = `[env] Missing required environment variable: ${key}`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    }
    console.warn(msg);
    return "";
  }
  return value;
}

/** Get an optional env var with a default fallback */
export function getOptionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export function isConfiguredEnvValue(value: string | undefined | null): value is string {
  if (!value) return false;

  const normalized = value.trim();
  if (!normalized) return false;

  const lower = normalized.toLowerCase();
  const placeholderMarkers = [
    "changeme",
    "dummy",
    "example",
    "placeholder",
    "replace_me",
    "your_",
    "xxx",
  ];

  return !placeholderMarkers.some((marker) => lower.includes(marker));
}

export function getConfiguredOptionalEnv(key: string): string | null {
  const value = process.env[key];
  return isConfiguredEnvValue(value) ? value.trim() : null;
}

export function isServerOnlyEnvKey(key: string): boolean {
  return ENV_SPECS.some((spec) => spec.key === key && spec.serverOnly);
}

/** Returns true if running in a production environment */
export const isProduction = process.env.NODE_ENV === "production";

/** Returns true if running in development */
export const isDevelopment = process.env.NODE_ENV === "development";
