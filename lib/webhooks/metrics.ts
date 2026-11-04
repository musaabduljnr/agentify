export interface WebhookStatsRow {
  total_attempts?: number | null;
  successful_attempts?: number | null;
  failed_attempts?: number | null;
  failed_deliveries?: number | null;
  exhausted_deliveries?: number | null;
  pending_deliveries?: number | null;
  avg_duration_ms?: number | null;
  last_24h_attempts?: number | null;
}

export function calculateWebhookStats(row: WebhookStatsRow) {
  const totalAttempts = Number(row.total_attempts ?? 0);
  const successfulAttempts = Number(row.successful_attempts ?? 0);
  return {
    totalAttempts,
    successfulAttempts,
    failedAttempts: Number(row.failed_attempts ?? 0),
    failedDeliveries: Number(row.failed_deliveries ?? 0),
    exhaustedDeliveries: Number(row.exhausted_deliveries ?? 0),
    pendingDeliveries: Number(row.pending_deliveries ?? 0),
    successRate: totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0,
    avgDurationMs: Math.round(Number(row.avg_duration_ms ?? 0)),
    last24hAttempts: Number(row.last_24h_attempts ?? 0),
  };
}
