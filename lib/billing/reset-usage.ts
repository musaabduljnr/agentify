"use server";

// ══════════════════════════════════════════════════════════════
// Monthly Usage Reset (Server-Side)
// ══════════════════════════════════════════════════════════════

/**
 * Kept for compatibility with existing cron callers. Usage is period-scoped
 * and a billing period can advance only through verified payment processing.
 */
export async function resetMonthlyUsageIfNeeded(_businessId: string): Promise<boolean> {
  void _businessId;
  return false;
}

/**
 * Expired periods remain expired until payment is verified by Bachs.
 */
export async function resetAllExpiredBusinessUsage(): Promise<number> {
  return 0;
}
