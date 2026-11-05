import "server-only";
import { type AIProvider, type ChatParams, type ChatResponse } from "./types";
import { getChatProviderConfig } from "./config";
import { isTransientError, AIEngineError, ConfigurationError } from "./errors";
import { writeAIEngineLog } from "../logs/ai-logs";

// Simple in-memory tracker for provider health (degradation state)
const providerFailures: Record<string, number> = {};
const CONSECUTIVE_FAILURE_THRESHOLD = 3;

export async function executeWithRetryAndTimeout<T>(
  provider: string,
  operation: (signal: AbortSignal) => Promise<T>,
  options: { maxRetries?: number; timeoutMs?: number } = {}
): Promise<T> {
  const { maxRetries = 2, timeoutMs = 15000 } = options;
  let attempt = 0;
  let delay = 500; // start with 500ms delay

  while (true) {
    attempt++;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([operation(controller.signal), timeoutPromise]);

      // Reset failures on success
      providerFailures[provider] = 0;
      return result;
    } catch (error: any) {
      const isTransient = isTransientError(error);
      
      if (isTransient && attempt <= maxRetries) {
        console.warn(`[AI Engine] Attempt ${attempt} failed for provider ${provider}. Retrying in ${delay}ms... Error: ${error.message || error}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // exponential backoff
        continue;
      }

      // Track consecutive failures
      providerFailures[provider] = (providerFailures[provider] || 0) + 1;
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}

export function getProviderHealthStatus(
  provider: string,
  hasKey: boolean
): "healthy" | "degraded" | "failing" | "missing_key" {
  if (!hasKey) return "missing_key";
  const failures = providerFailures[provider] || 0;
  if (failures === 0) return "healthy";
  if (failures < CONSECUTIVE_FAILURE_THRESHOLD) return "degraded";
  return "failing";
}
