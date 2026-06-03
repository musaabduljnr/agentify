import "server-only";

export class AIEngineError extends Error {
  constructor(message: string, public provider: string, public originalError?: any) {
    super(message);
    this.name = "AIEngineError";
  }
}

export class RateLimitError extends AIEngineError {
  constructor(message: string, provider: string, originalError?: any) {
    super(message, provider, originalError);
    this.name = "RateLimitError";
  }
}

export class ConfigurationError extends AIEngineError {
  constructor(message: string, provider: string, originalError?: any) {
    super(message, provider, originalError);
    this.name = "ConfigurationError";
  }
}

export class TransientError extends AIEngineError {
  constructor(message: string, provider: string, originalError?: any) {
    super(message, provider, originalError);
    this.name = "TransientError";
  }
}

export function isTransientError(error: any): boolean {
  if (!error) return false;
  
  const searchSpace = [
    error.message,
    error.statusText,
    String(error.status),
    String(error.code),
    error.originalError?.message,
    typeof error === "string" ? error : ""
  ].join(" ").toLowerCase();

  return (
    searchSpace.includes("429") ||
    searchSpace.includes("503") ||
    searchSpace.includes("504") ||
    searchSpace.includes("timeout") ||
    searchSpace.includes("rate-limit") ||
    searchSpace.includes("rate limit") ||
    searchSpace.includes("quota") ||
    searchSpace.includes("resource_exhausted") ||
    searchSpace.includes("limit exceeded") ||
    searchSpace.includes("econnreset") ||
    searchSpace.includes("etimedout")
  );
}
