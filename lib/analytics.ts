type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsParams = Record<string, AnalyticsValue>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;

  try {
    window.fbq?.("trackCustom", name, params);
    window.gtag?.("event", name, params);
    window.dataLayer?.push({ event: name, ...params });
  } catch {
    // Analytics must never break the product flow.
  }
}
