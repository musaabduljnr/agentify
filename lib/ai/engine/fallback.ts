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
  operation: () => Promise<T>,
  options: { maxRetries?: number; timeoutMs?: number } = {}
): Promise<T> {
  const { maxRetries = 2, timeoutMs = 15000 } = options;
  let attempt = 0;
  let delay = 500; // start with 500ms delay

  while (true) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Execute the operation and race with timeout if supported by the fetch requests
      // For general promise timeout:
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Request timed out")), timeoutMs)
        ),
      ]);
      
      clearTimeout(timeoutId);
      // Reset failures on success
      providerFailures[provider] = 0;
      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
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
