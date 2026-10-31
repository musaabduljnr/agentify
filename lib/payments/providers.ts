// ══════════════════════════════════════════════════════════════
// Payment Provider Configuration (USD Only via Bachs)
// ══════════════════════════════════════════════════════════════

import type { PaymentProvider } from "./types";

export const SUPPORTED_PAYMENT_PROVIDERS: {
  id: PaymentProvider;
  name: string;
  description: string;
  enabled: boolean;
  logo?: string;
}[] = [
  {
    id: "bachs",
    name: "Bachs",
    description: "Secure USD card payments and recurring subscription billing powered by Bachs.",
    enabled: true,
  },
  {
    id: "manual",
    name: "Manual / Enterprise Invoice",
    description: "Contact sales for manual custom enterprise invoicing.",
    enabled: true,
  },
];

export const DEFAULT_PAYMENT_PROVIDER: PaymentProvider = "bachs";

/**
 * Get provider config by ID.
 */
export function getProviderConfig(providerId: PaymentProvider) {
  return SUPPORTED_PAYMENT_PROVIDERS.find((p) => p.id === providerId) || null;
}

/**
 * Get all enabled providers.
 */
export function getEnabledProviders() {
  return SUPPORTED_PAYMENT_PROVIDERS.filter((p) => p.enabled);
}
