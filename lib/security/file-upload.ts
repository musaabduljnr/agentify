/**
 * File upload security validation.
 *
 * - Max file size: 10 MB
 * - Allowed MIME types: PDF, DOCX, plain text
 * - Blocks executables and dangerous types
 * - Sanitizes file names
 * - Enforces business-scoped storage paths
 */

// ── Constants ──────────────────────────────────────────────────────────────

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/plain",
]);

export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  ".pdf",
  ".docx",
  ".txt",
]);

/** MIME types that are explicitly blocked (belt-and-suspenders) */
const BLOCKED_MIME_TYPES: ReadonlySet<string> = new Set([
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sh",
  "application/x-bat",
  "application/octet-stream",
  "text/x-script.python",
  "text/x-shellscript",
  "application/x-php",
  "application/javascript",
  "text/javascript",
  "application/x-msdos-program",
]);

// ── Types ──────────────────────────────────────────────────────────────────

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// ── Validators ─────────────────────────────────────────────────────────────

/**
 * Validate a file's size, MIME type, and extension.
 * Call this before accepting any user-uploaded document.
 */
export function validateFileUpload(
  fileName: string,
  mimeType: string,
  sizeBytes: number
): FileValidationResult {
  // 1. Size check
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large. Maximum allowed size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
    };
  }

  if (sizeBytes === 0) {
    return { valid: false, error: "File is empty." };
  }

  // 2. Block known dangerous MIME types
  if (BLOCKED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return { valid: false, error: "This file type is not permitted." };
  }

  // 3. Allow-list MIME check
  if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return {
      valid: false,
      error:
        "Unsupported file type. Please upload a PDF, DOCX, or plain text file.",
    };
  }

  // 4. Extension check
  const ext = getFileExtension(fileName);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File extension "${ext}" is not allowed. Use .pdf, .docx, or .txt.`,
    };
  }

  return { valid: true };
}

// ── Sanitization ───────────────────────────────────────────────────────────

/**
 * Sanitize a file name:
 * - Remove path traversal sequences
 * - Strip special characters (keep alphanumeric, dash, underscore, dot)
 * - Truncate to 100 chars
 * - Lowercase
 */
export function sanitizeFileName(raw: string): string {
  // Remove directory traversal
  let name = raw.replace(/\.\./g, "").replace(/[/\\]/g, "");

  // Strip dangerous characters
  name = name.replace(/[^a-zA-Z0-9._\-]/g, "_");

  // Collapse multiple underscores
  name = name.replace(/_+/g, "_");

  // Truncate
  if (name.length > 100) {
    const ext = getFileExtension(name);
    name = name.slice(0, 96 - ext.length) + ext;
  }

  return name.toLowerCase();
}

/**
 * Build a safe, business-scoped storage path.
 * Format: <businessId>/<timestamp>-<sanitizedFileName>
 */
export function buildStoragePath(businessId: string, fileName: string): string {
  const sanitized = sanitizeFileName(fileName);
  const timestamp = Date.now();
  // Validate businessId is a UUID to prevent path injection
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) {
    throw new Error("Invalid businessId for storage path construction.");
  }
  return `${businessId}/${timestamp}-${sanitized}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx === -1) return "";
  return fileName.slice(idx).toLowerCase();
}
