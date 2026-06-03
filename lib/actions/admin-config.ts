"use server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/utils/supabase/service";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getConfig,
  getSecretConfig,
  setConfig,
  deleteConfig,
  getConfigWithEnvFallback,
  getSecretWithEnvFallback,
} from "@/lib/config/platform-config";
import { maskSecret } from "@/lib/config/encryption";

// Audit log helper
async function writeAuditLog(
  adminId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, any> = {}
) {
  try {
    const supabase = createServiceClient();
    await supabase.from("admin_audit_logs").insert({
      admin_id: adminId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata,
    });
  } catch (err) {
    console.error("Failed to write admin audit log:", err);
  }
}

// Zod Input Validations
const updateConfigSchema = z.object({
  category: z.string().min(1, "Category is required"),
  key: z.string().min(1, "Key is required"),
  value: z.string(),
  description: z.string().optional(),
});

const updateSecretConfigSchema = z.object({
  category: z.string().min(1, "Category is required"),
  key: z.string().min(1, "Key is required"),
  value: z.string().min(1, "Secret value cannot be empty"),
  description: z.string().optional(),
});

const testEmailSchema = z.object({
  toEmail: z.string().email("Invalid email address"),
});

/**
 * Fetches all configurations for admin dashboard list rendering.
 * NEVER returns raw or encrypted secrets, only masked previews.
 */
export async function getAdminConfigurations() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: configs, error } = await supabase
    .from("platform_configurations")
    .select("*")
    .order("category", { ascending: true })
    .order("key", { ascending: true });

  if (error) {
    throw new Error(`Failed to load platform configurations: ${error.message}`);
  }

  // Mask sensitive values and remove encrypted_value entirely before sending to dashboard
  const sanitizedConfigs = (configs || []).map((config) => {
    let displayValue = config.value;

    if (config.is_secret) {
      if (config.encrypted_value) {
        try {
          // Decrypt to mask it, then discard the decrypted value
          const decrypted = getSecretConfig(config.category, config.key);
          // Wait, getSecretConfig is async. Let's handle it asynchronously in a map or decrypt inline
          // To keep it clean, we can just decrypt it here since we are server-side
        } catch (e) {
          // Fallback to simple mask if decryption fails
        }
      }
      displayValue = config.encrypted_value ? "configured" : "not configured";
    }

    const { encrypted_value, ...rest } = config;
    return {
      ...rest,
      value: displayValue,
      hasValue: !!(config.value || config.encrypted_value),
    };
  });

  // Resolve decrypted previews for display
  const finalConfigs = [];
  for (const c of configs || []) {
    let preview = "Not configured";
    let rawSecret = null;
    if (c.is_secret) {
      if (c.encrypted_value) {
        try {
          const decrypted = await getSecretConfig(c.category, c.key);
          if (decrypted) {
            preview = maskSecret(decrypted);
          }
        } catch (e) {
          preview = "Decryption error";
        }
      }
    } else {
      preview = c.value || "";
    }
    const { encrypted_value, ...rest } = c;
    finalConfigs.push({
      ...rest,
      value: c.value, // raw plaintext value (if not secret)
      preview, // masked/plaintext preview
      hasValue: !!(c.value || c.encrypted_value),
    });
  }

  return finalConfigs;
}

/**
 * Updates a non-sensitive configuration option.
 */
export async function updatePlatformConfig(
  category: string,
  key: string,
  value: string,
  description?: string
) {
  const admin = await requireAdmin();

  const validated = updateConfigSchema.parse({
    category,
    key,
    value,
    description,
  });

  await setConfig(validated.category, validated.key, validated.value, {
    isSecret: false,
    description: validated.description,
    updatedBy: admin.id,
  });

  await writeAuditLog(admin.id, "update_config", "platform_config", `${category}:${key}`, {
    value: validated.value,
  });

  revalidatePath("/admin/configuration");
  return { success: true };
}

/**
 * Updates a sensitive configuration option (secret is encrypted).
 */
export async function updateSecretConfig(
  category: string,
  key: string,
  value: string,
  description?: string
) {
  const admin = await requireAdmin();

  const validated = updateSecretConfigSchema.parse({
    category,
    key,
    value,
    description,
  });

  await setConfig(validated.category, validated.key, validated.value, {
    isSecret: true,
    description: validated.description,
    updatedBy: admin.id,
  });

  await writeAuditLog(admin.id, "update_secret", "platform_config", `${category}:${key}`, {
    masked: maskSecret(validated.value),
  });

  revalidatePath("/admin/configuration");
  return { success: true };
}

/**
 * Deletes a configuration key from the database.
 */
export async function deletePlatformConfig(category: string, key: string) {
  const admin = await requireAdmin();

  await deleteConfig(category, key);

  await writeAuditLog(admin.id, "delete_config", "platform_config", `${category}:${key}`);

  revalidatePath("/admin/configuration");
  return { success: true };
}

/**
 * Rotates a secret configuration key by replacing it.
 */
export async function rotateSecretConfig(
  category: string,
  key: string,
  newValue: string,
  description?: string
) {
  const admin = await requireAdmin();

  const validated = updateSecretConfigSchema.parse({
    category,
    key,
    value: newValue,
    description,
  });

  await setConfig(validated.category, validated.key, validated.value, {
    isSecret: true,
    description: validated.description,
    updatedBy: admin.id,
  });

  await writeAuditLog(admin.id, "rotate_secret", "platform_config", `${category}:${key}`, {
    masked: maskSecret(validated.value),
  });

  revalidatePath("/admin/configuration");
  return { success: true };
}

/**
 * Sends a test email via Resend using dynamic database credentials.
 */
export async function testResendConfig(toEmail: string) {
  const admin = await requireAdmin();
  testEmailSchema.parse({ toEmail });

  const apiKey = await getSecretWithEnvFallback("resend", "api_key", "RESEND_API_KEY");
  const fromEmail = await getConfigWithEnvFallback("email", "from_email", "EMAIL_FROM") || "noreply@yourdomain.com";
  const fromName = await getConfig("email", "from_name") || "Agentify";

  if (!apiKey || apiKey.includes("your_resend_api_key")) {
    throw new Error("Resend API key is not configured in database or environment fallbacks.");
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: toEmail,
    subject: "Agentify Resend Connection Test",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
        <h2 style="color: #4f46e5;">Connection Test Successful!</h2>
        <p>This email confirms that your <strong>Resend API</strong> integration is working correctly with Agentify.</p>
        <hr style="border-color: #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b;">Sent at: ${new Date().toLocaleString()}</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message || "Failed to dispatch test email via Resend.");
  }

  await writeAuditLog(admin.id, "test_resend_config", "resend", "api_key", {
    to: toEmail,
    success: true,
  });

  return { success: true };
}

/**
 * Sends a test email via SMTP using dynamic database credentials.
 */
export async function testSmtpConfig(toEmail: string) {
  const admin = await requireAdmin();
  testEmailSchema.parse({ toEmail });

  const host = await getConfigWithEnvFallback("smtp", "host", "SMTP_HOST") || "smtp.gmail.com";
  const port = Number(await getConfigWithEnvFallback("smtp", "port", "SMTP_PORT")) || 465;
  const username = await getConfigWithEnvFallback("smtp", "username", "SMTP_USER");
  const password = await getSecretWithEnvFallback("smtp", "password", "SMTP_PASSWORD");
  const secureVal = await getConfigWithEnvFallback("smtp", "secure", "SMTP_SECURE");
  const secure = secureVal === "true" || port === 465;

  if (!username || !password) {
    throw new Error("SMTP Username and Password must be configured to run tests.");
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: username,
      pass: password,
    },
  });

  const fromEmail = await getConfigWithEnvFallback("email", "from_email", "EMAIL_FROM") || username;
  const fromName = await getConfig("email", "from_name") || "Agentify";

  await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: toEmail,
    subject: "Agentify SMTP Connection Test",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
        <h2 style="color: #4f46e5;">Connection Test Successful!</h2>
        <p>This email confirms that your <strong>SMTP / Nodemailer</strong> transporter integration is working correctly with Agentify.</p>
        <hr style="border-color: #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b;">Sent at: ${new Date().toLocaleString()}</p>
      </div>
    `,
  });

  await writeAuditLog(admin.id, "test_smtp_config", "smtp", "host", {
    to: toEmail,
    success: true,
  });

  return { success: true };
}

/**
 * Tests Paystack integration credentials by sending a connectivity request.
 */
export async function testPaystackConfig() {
  const admin = await requireAdmin();

  const secretKey = await getSecretWithEnvFallback("paystack", "secret_key", "PAYSTACK_SECRET_KEY");
  if (!secretKey || secretKey.includes("placeholder")) {
    throw new Error("Paystack Secret Key is not configured.");
  }

  // Send request to Paystack's verify endpoint or list customers (minimum response payload)
  const response = await fetch("https://api.paystack.co/customer", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || (data.status === false)) {
    throw new Error(data.message || "Failed to establish a successful connection to Paystack.");
  }

  await writeAuditLog(admin.id, "test_paystack_config", "paystack", "secret_key", {
    success: true,
  });

  return { success: true };
}

/**
 * Tests Flutterwave integration credentials by sending a connectivity request.
 */
export async function testFlutterwaveConfig() {
  const admin = await requireAdmin();

  const secretKey = await getSecretWithEnvFallback("flutterwave", "secret_key", "FLUTTERWAVE_SECRET_KEY");
  if (!secretKey || secretKey.includes("placeholder")) {
    throw new Error("Flutterwave Secret Key is not configured.");
  }

  const response = await fetch("https://api.flutterwave.com/v3/transactions", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || (data.status === "error")) {
    throw new Error(data.message || "Failed to establish a successful connection to Flutterwave.");
  }

  await writeAuditLog(admin.id, "test_flutterwave_config", "flutterwave", "secret_key", {
    success: true,
  });

  return { success: true };
}
