// ══════════════════════════════════════════════════════════════
// Payment Provider Configuration
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
    id: "paystack",
    name: "Paystack",
    description: "Pay with card, bank transfer, or mobile money via Paystack.",
    enabled: true,
  },
  {
    id: "flutterwave",
    name: "Flutterwave",
    description: "Pay with card, bank transfer, USSD, or mobile money via Flutterwave.",
    enabled: true,
  },
  {
    id: "manual",
    name: "Manual / Bank Transfer",
    description: "Contact sales for manual payment or bank transfer.",
    enabled: true,
  },
];

export const DEFAULT_PAYMENT_PROVIDER: PaymentProvider = "paystack";

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
