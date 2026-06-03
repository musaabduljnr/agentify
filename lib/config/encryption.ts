import "server-only";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY;

/**
 * Resolves the 32-byte key buffer from the environment variable CONFIG_ENCRYPTION_KEY.
 * Supports both 64-character hex strings and 44-character base64 strings.
 */
function getKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error(
      "CONFIG_ENCRYPTION_KEY is not defined in the environment variables. " +
      "Please set it to a secure 32-byte key encoded as base64 or hex."
    );
  }

  let keyBuffer: Buffer;
  
  if (ENCRYPTION_KEY.length === 64) {
    keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");
  } else {
    // Try base64
    keyBuffer = Buffer.from(ENCRYPTION_KEY, "base64");
  }

  if (keyBuffer.length !== 32) {
    throw new Error(
      `CONFIG_ENCRYPTION_KEY is invalid. It must be exactly 32 bytes (64 hex characters or 44 base64 characters). Current byte length: ${keyBuffer.length}`
    );
  }

  return keyBuffer;
}

/**
 * Encrypts a sensitive string using AES-256-GCM.
 * Returns the format: iv_hex:auth_tag_hex:encrypted_hex
 */
export function encryptSecret(value: string): string {
  if (!value) return "";
  
  const key = getKey();
  const iv = crypto.randomBytes(12); // 12-byte IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  
  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a sensitive string using AES-256-GCM.
 */
export function decryptSecret(encryptedValue: string): string {
  if (!encryptedValue) return "";
  
  const parts = encryptedValue.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format. Expected 'iv:auth_tag:ciphertext'.");
  }
  
  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Formats a sensitive value to hide secrets in the admin dashboard.
 * Example: sk_live_1234567890abcd becomes sk_live_••••••abcd
 */
export function maskSecret(value: string): string {
  if (!value) return "Not configured";
  if (value.trim() === "") return "Not configured";

  const cleanVal = value.trim();
  
  // If it's very short, just return placeholder dots
  if (cleanVal.length <= 8) {
    return "••••" + cleanVal.slice(-2);
  }

  // Check for common prefixes like sk_live_, sk_test_, key_, etc.
  const match = cleanVal.match(/^(sk_live_|sk_test_|key_|api_|live_|test_|flwsec-|FLWPUBK_)?(.+)(.{4})$/);
  if (match) {
    const prefix = match[1] || "";
    const last = match[3];
    return `${prefix}••••••${last}`;
  }

  return "••••••" + cleanVal.slice(-4);
}
