export const MAX_WEBHOOK_ATTEMPTS = 5;

export function isRetryableWebhookStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function webhookRetryDelayMs(attempt: number, random = Math.random()): number {
  const base = Math.min(60 * 60_000, 60_000 * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.max(0, Math.min(1, random)) * Math.min(base * 0.25, 30_000));
  return base + jitter;
}

export function canRetryWebhook(attempt: number, maxAttempts = MAX_WEBHOOK_ATTEMPTS): boolean {
  return attempt < Math.min(maxAttempts, MAX_WEBHOOK_ATTEMPTS);
}
