export type DeliveryStatus = "pending" | "processing" | "delivered" | "retrying" | "failed" | "exhausted";
export type DeliveryFilter = "all" | DeliveryStatus;
export interface DeliveryFilters {
  status?: DeliveryFilter;
  search?: string;
  eventType?: string;
  webhookId?: string;
  from?: string;
  to?: string;
}

const STATUSES: DeliveryFilter[] = [
  "all",
  "pending",
  "processing",
  "delivered",
  "retrying",
  "failed",
  "exhausted",
];

export function normalizeDeliveryFilters(filters: DeliveryFilters) {
  const input = filters ?? {};
  const status = input.status && STATUSES.includes(input.status) ? input.status : "all";
  const rawSearch = typeof input.search === "string" ? input.search : "";
  const search = rawSearch.trim().slice(0, 100).replace(/[^a-zA-Z0-9.:/\-\s]+/g, " ").trim();
  const rawEventType = typeof input.eventType === "string" ? input.eventType : "";
  const eventType = rawEventType.trim().slice(0, 80);
  const rawWebhookId = typeof input.webhookId === "string" ? input.webhookId.trim() : "";
  const date = (value: unknown, endOfDay: boolean): string | null => {
    if (typeof value !== "string" || !value) return null;
    const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parsed = new Date(isoDate
      ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
      : value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };
  const from = date(input.from, false);
  const to = date(input.to, true);
  return {
    status,
    search,
    eventType: /^[a-z][a-z0-9._-]{0,79}$/.test(eventType) ? eventType : "",
    webhookId: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawWebhookId)
      ? rawWebhookId
      : "",
    from,
    to,
  };
}
