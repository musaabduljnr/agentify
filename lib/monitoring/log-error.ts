/**
 * Centralized error logger.
 *
 * - Development:  logs to console only.
 * - Production:   logs to console AND persists to public.error_logs table.
 *
 * IMPORTANT: Never expose stack traces or internal details to users.
 *            This is for internal observability only.
 */

export interface LogErrorOptions {
  /** Identifies the module/function that errored (e.g. "widget-chat", "paystack-webhook") */
  source: string;
  /** Human-readable error message */
  message: string;
  /** Stack trace string (optional) */
  stack?: string;
  /** Associated business ID if applicable */
  businessId?: string | null;
  /** Associated user ID if applicable */
  userId?: string | null;
  /** Any additional structured metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Log an error. Non-throwing — always safe to call in catch blocks.
 */
export async function logError(options: LogErrorOptions): Promise<void> {
  const { source, message, stack, businessId, userId, metadata } = options;

  // Always write to console
  console.error(`[${source}] ${message}`, stack ? `\n${stack}` : "");

  // Only persist to DB in production (or when DB_LOG_ERRORS=true in dev)
  const shouldPersist =
    process.env.NODE_ENV === "production" || process.env.DB_LOG_ERRORS === "true";

  if (!shouldPersist) return;

  try {
    // Lazy import to avoid bundling issues in edge/client contexts
    const { createServiceClient } = await import("@/utils/supabase/service");
    const supabase = createServiceClient();

    await supabase.from("error_logs").insert({
      source,
      message: message.slice(0, 2000), // cap to avoid oversized rows
      stack: stack ? stack.slice(0, 5000) : null,
      business_id: businessId ?? null,
      user_id: userId ?? null,
      metadata: metadata ?? {},
    });
  } catch (persistErr) {
    // Never throw from the error logger itself
    console.error("[log-error] Failed to persist error log:", persistErr);
  }
}

/**
 * Convenience wrapper — log from a caught exception.
 */
export function logErrorSync(
  err: unknown,
  source: string,
  context?: Omit<LogErrorOptions, "source" | "message" | "stack">
): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  // Fire-and-forget: don't await in synchronous contexts
  logError({ source, message, stack, ...context }).catch(() => {});
}

/**
 * Returns a user-safe error message — never exposes internals.
 */
export function getUserFriendlyError(source: string): string {
  const messages: Record<string, string> = {
    "widget-chat": "Our AI assistant is temporarily unavailable. Please try again in a moment.",
    "ai-provider": "The AI service is currently unavailable. Please try again shortly.",
    "embedding-generation": "Knowledge processing failed. Please try again.",
    "email-send": "We couldn't send the email. Please try again later.",
    "paystack-webhook": "Payment verification failed. Please contact support.",
    "payment-checkout": "Payment processing failed. Please try again or contact support.",
    "file-upload": "File upload failed. Please check the file and try again.",
    "widget-config": "Widget configuration could not be loaded.",
    default: "Something went wrong. Please try again or contact support.",
  };

  return messages[source] ?? messages.default;
}
