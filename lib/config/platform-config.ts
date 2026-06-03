import "server-only";
import { createServiceClient } from "@/utils/supabase/service";
import { encryptSecret, decryptSecret } from "./encryption";

/**
 * Loads a public/non-sensitive configuration value from the database.
 */
export async function getConfig(category: string, key: string): Promise<string | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("platform_configurations")
      .select("value")
      .eq("category", category)
      .eq("key", key)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) return null;
    return data.value;
  } catch (err) {
    console.error(`Error reading config ${category}:${key}:`, err);
    return null;
  }
}

/**
 * Loads a sensitive/encrypted configuration value from the database and decrypts it.
 */
export async function getSecretConfig(category: string, key: string): Promise<string | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("platform_configurations")
      .select("encrypted_value, is_secret")
      .eq("category", category)
      .eq("key", key)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) return null;
    if (!data.is_secret || !data.encrypted_value) return null;

    return decryptSecret(data.encrypted_value);
  } catch (err) {
    console.error(`Error reading secret config ${category}:${key}:`, err);
    return null;
  }
}

/**
 * Sets a configuration value in the database. Encrypts the value if options.isSecret is true.
 */
export async function setConfig(
  category: string,
  key: string,
  value: string,
  options?: {
    isSecret?: boolean;
    description?: string;
    updatedBy?: string;
    isActive?: boolean;
  }
): Promise<void> {
  const supabase = createServiceClient();
  const isSecret = options?.isSecret ?? false;
  const isActive = options?.isActive ?? true;

  const payload: Record<string, any> = {
    category,
    key,
    is_secret: isSecret,
    is_active: isActive,
    description: options?.description ?? null,
    updated_by: options?.updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };

  if (isSecret) {
    payload.encrypted_value = encryptSecret(value);
    payload.value = null; // Ensure raw secrets are never stored in the plaintext column
  } else {
    payload.value = value;
    payload.encrypted_value = null;
  }

  const { error } = await supabase
    .from("platform_configurations")
    .upsert(payload, { onConflict: "category,key" });

  if (error) {
    throw new Error(`Failed to set platform configuration ${category}:${key} - ${error.message}`);
  }
}

/**
 * Deletes a configuration key from the database.
 */
export async function deleteConfig(category: string, key: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("platform_configurations")
    .delete()
    .eq("category", category)
    .eq("key", key);

  if (error) {
    throw new Error(`Failed to delete platform configuration ${category}:${key} - ${error.message}`);
  }
}

/**
 * Resolves configuration value using priority:
 * 1. Database configuration
 * 2. Environment variable fallback
 */
export async function getConfigWithEnvFallback(
  category: string,
  key: string,
  envName: string
): Promise<string | null> {
  const dbValue = await getConfig(category, key);
  if (dbValue !== null && dbValue !== undefined && dbValue.trim() !== "") {
    return dbValue.trim();
  }
  return process.env[envName] || null;
}

/**
 * Resolves sensitive configuration value using priority:
 * 1. Database configuration (decrypted)
 * 2. Environment variable fallback
 */
export async function getSecretWithEnvFallback(
  category: string,
  key: string,
  envName: string
): Promise<string | null> {
  const dbValue = await getSecretConfig(category, key);
  if (dbValue !== null && dbValue !== undefined && dbValue.trim() !== "") {
    return dbValue.trim();
  }
  return process.env[envName] || null;
}
