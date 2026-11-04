"use client";

import { useState, useTransition } from "react";
import {
  createWebhook,
  toggleWebhook,
  deleteWebhook,
  retryWebhookDelivery,
  updateWebhook,
  enqueueWebhookTest,
  rotateWebhookSecret,
  getWebhookDeliveries,
  getWebhookDeliveryDetails,
  type WebhookDelivery,
  type WebhookDeliveryDetails,
  type WebhookRecord,
  type WebhookStats,
  type DeliveryFilter,
  type DeliveryFilters,
} from "@/lib/actions/webhooks";
import {
  Webhook, CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw,
  Plus, Trash2, ToggleLeft, ToggleRight, Activity, Zap, Timer, Eye, Pencil,
  KeyRound, FlaskConical
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_CONFIG = {
  delivered: { label: "Delivered", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-red-50 text-red-600 border-red-200", icon: XCircle },
  pending: { label: "Pending", color: "bg-blue-50 text-blue-600 border-blue-200", icon: Clock },
  processing: { label: "Processing", color: "bg-blue-50 text-blue-600 border-blue-200", icon: RefreshCw },
  retrying: { label: "Retrying", color: "bg-amber-50 text-amber-600 border-amber-200", icon: RefreshCw },
  exhausted: { label: "Exhausted", color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
};

const AVAILABLE_EVENTS = [
  "lead.created",
];

interface WebhookMonitorProps {
  initialWebhooks: WebhookRecord[];
  initialDeliveries: WebhookDelivery[];
  totalDeliveries: number;
  stats: WebhookStats;
}

function StatusBadge({ status }: { status: WebhookDelivery["status"] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

export function WebhookMonitor({ initialWebhooks, initialDeliveries, totalDeliveries, stats }: WebhookMonitorProps) {
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>(initialWebhooks);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>(initialDeliveries);
  const [deliveryTotal, setDeliveryTotal] = useState(totalDeliveries);
  const [activeTab, setActiveTab] = useState<"webhooks" | "deliveries">("deliveries");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filters, setFilters] = useState<DeliveryFilters>({ status: "all" });
  const [draftFilters, setDraftFilters] = useState<DeliveryFilters>({ status: "all" });
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<WebhookDeliveryDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookRecord | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{ webhookId: string; value: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("https://");
  const [formEvents, setFormEvents] = useState<string[]>(["lead.created"]);
  const [formMaxAttempts, setFormMaxAttempts] = useState(5);

  async function refreshDeliveries(nextFilters = filters, nextPage = page) {
    try {
      const result = await getWebhookDeliveries(nextFilters, nextPage);
      setDeliveries(result.data);
      setDeliveryTotal(result.total);
      setPage(result.page);
    } catch {
      showMsg("error", "Unable to refresh delivery history.");
    }
  }

  function applyFilters() {
    const next = { ...draftFilters };
    setFilters(next);
    setPage(1);
    void refreshDeliveries(next, 1);
  }

  function showWebhookHistory(webhook: WebhookRecord) {
    const nextFilters: DeliveryFilters = { status: "all", webhookId: webhook.id };
    setActiveTab("deliveries");
    setFilters(nextFilters);
    setDraftFilters(nextFilters);
    setPage(1);
    void refreshDeliveries(nextFilters, 1);
  }

  async function openDeliveryDetails(delivery: WebhookDelivery) {
    setLoadingDetails(true);
    setSelectedDetails(null);
    try {
      const details = await getWebhookDeliveryDetails(delivery.id);
      setSelectedDetails(details);
    } catch {
      showMsg("error", "Unable to load delivery attempt history.");
    } finally {
      setLoadingDetails(false);
    }
  }

  function showMsg(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createWebhook(formName, formUrl, formEvents, formMaxAttempts);
      if (result.error) {
        showMsg("error", result.error);
      } else {
        if (result.webhook) setWebhooks(prev => [result.webhook!, ...prev]);
        if (result.secret && result.webhook) setRevealedSecret({ webhookId: result.webhook.id, value: result.secret });
        showMsg("success", "Webhook created. Copy the signing secret now; it will not be shown again.");
        setShowCreateForm(false);
        setFormName(""); setFormUrl("https://"); setFormEvents(["lead.created"]); setFormMaxAttempts(5);
      }
    });
  }

  function handleUpdateWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!editingWebhook) return;
    startTransition(async () => {
      const result = await updateWebhook(editingWebhook.id, formName, formUrl, formEvents, formMaxAttempts);
      if (result.error) {
        showMsg("error", result.error);
      } else if (result.webhook) {
        setWebhooks(prev => prev.map(webhook => webhook.id === result.webhook!.id ? result.webhook! : webhook));
        setEditingWebhook(null);
        showMsg("success", "Webhook updated.");
      }
    });
  }

  function startEditing(webhook: WebhookRecord) {
    setEditingWebhook(webhook);
    setFormName(webhook.name);
    setFormUrl(webhook.target_url);
    setFormEvents(webhook.events);
    setFormMaxAttempts(webhook.max_attempts);
    setShowCreateForm(false);
  }

  function handleToggle(webhookId: string, currentActive: boolean) {
    startTransition(async () => {
      const result = await toggleWebhook(webhookId, !currentActive);
      if (result.error) {
        showMsg("error", result.error);
      } else {
        setWebhooks(prev => prev.map(w => w.id === webhookId ? { ...w, is_active: !currentActive } : w));
      }
    });
  }

  function handleDelete(webhookId: string) {
    if (!confirm("Are you sure you want to delete this webhook?")) return;
    startTransition(async () => {
      const result = await deleteWebhook(webhookId);
      if (result.error) {
        showMsg("error", result.error);
      } else {
        setWebhooks(prev => prev.filter(w => w.id !== webhookId));
        showMsg("success", "Webhook deleted.");
      }
    });
  }

  function handleRetry(deliveryId: string) {
    setRetryingId(deliveryId);
    startTransition(async () => {
      const result = await retryWebhookDelivery(deliveryId);
      setRetryingId(null);
      if (result.error) {
        showMsg("error", result.error);
      } else {
        showMsg("success", "A new delivery attempt was queued with the original event ID.");
        void refreshDeliveries();
      }
    });
  }

  function handleTest(webhookId: string) {
    setTestingId(webhookId);
    startTransition(async () => {
      const result = await enqueueWebhookTest(webhookId);
      setTestingId(null);
      if (result.error) showMsg("error", result.error);
      else {
        showMsg("success", "Test delivery queued; check the delivery log shortly.");
        setActiveTab("deliveries");
        setPage(1);
        const allFilters = { ...filters, status: "all" as const };
        setFilters(allFilters);
        setDraftFilters(allFilters);
        void refreshDeliveries(allFilters, 1);
      }
    });
  }

  function handleRotate(webhookId: string) {
    if (!confirm("Rotate this signing secret? Existing consumers must be updated immediately.")) return;
    startTransition(async () => {
      const result = await rotateWebhookSecret(webhookId);
      if (result.error) showMsg("error", result.error);
      else if (result.secret) {
        setRevealedSecret({ webhookId, value: result.secret });
        showMsg("success", "Secret rotated. Copy it now; it will not be shown again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-medium border ${
          message.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Stats Header */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: "HTTP Attempt Success (30d)", value: `${stats.successRate}%`, detail: `${stats.successfulAttempts} / ${stats.totalAttempts} completed`, icon: Activity, color: "text-emerald-600 bg-emerald-50" },
          { label: "Failed Deliveries (30d)", value: stats.failedDeliveries, detail: "Permanent failures", icon: XCircle, color: "text-red-600 bg-red-50" },
          { label: "Exhausted (30d)", value: stats.exhaustedDeliveries, detail: "Automatic retries used", icon: AlertTriangle, color: "text-amber-600 bg-amber-50" },
          { label: "Pending / Retrying", value: stats.pendingDeliveries, detail: "Awaiting delivery or retry", icon: Clock, color: "text-blue-600 bg-blue-50" },
          { label: "Avg HTTP Response (30d)", value: stats.avgDurationMs ? `${stats.avgDurationMs}ms` : "—", detail: "Completed requests", icon: Timer, color: "text-indigo-600 bg-indigo-50" },
          { label: "HTTP Requests Started (24h)", value: stats.last24hAttempts, detail: "Includes interrupted requests", icon: Zap, color: "text-sky-600 bg-sky-50" },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-slate-900">{stat.value}</div>
                <div className="text-xs text-slate-500 font-medium">{stat.label}</div>
                <div className="mt-1 text-[10px] text-slate-400">{stat.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {(["deliveries", "webhooks"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-bold transition-colors capitalize ${
              activeTab === tab
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "deliveries" ? `Delivery Log (${deliveryTotal})` : "Registered Webhooks"}
          </button>
        ))}
      </div>

      {/* Delivery Log */}
      {activeTab === "deliveries" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-bold text-slate-900">Delivery Log</h3>
            {filters.webhookId && (
              <p className="w-full text-xs text-slate-500">
                Showing recent deliveries for{" "}
                <strong>{webhooks.find(webhook => webhook.id === filters.webhookId)?.name ?? "selected webhook"}</strong>.
                {" "}Reset filters to view all endpoints.
              </p>
            )}
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <input
                value={draftFilters.search ?? ""}
                onChange={event => setDraftFilters(current => ({ ...current, search: event.target.value }))}
                onKeyDown={event => { if (event.key === "Enter") applyFilters(); }}
                placeholder="Search event or endpoint"
                aria-label="Search delivery history"
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs sm:col-span-2"
              />
              <select
                value={draftFilters.status ?? "all"}
                onChange={event => setDraftFilters(current => ({ ...current, status: event.target.value as DeliveryFilter }))}
                aria-label="Filter by delivery status"
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs"
              >
                {["all", "pending", "processing", "delivered", "retrying", "failed", "exhausted"].map(status => (
                  <option value={status} key={status}>{status === "all" ? "All statuses" : status}</option>
                ))}
              </select>
              <select
                value={draftFilters.eventType ?? ""}
                onChange={event => setDraftFilters(current => ({ ...current, eventType: event.target.value }))}
                aria-label="Filter by event type"
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs"
              >
                <option value="">All events</option>
                <option value="lead.created">lead.created</option>
                <option value="webhook.test">webhook.test</option>
              </select>
              <input
                type="date"
                value={draftFilters.from ?? ""}
                onChange={event => setDraftFilters(current => ({ ...current, from: event.target.value }))}
                aria-label="From date"
                className="h-9 rounded-xl border border-slate-200 px-2 text-xs"
              />
              <input
                type="date"
                value={draftFilters.to ?? ""}
                onChange={event => setDraftFilters(current => ({ ...current, to: event.target.value }))}
                aria-label="To date"
                className="h-9 rounded-xl border border-slate-200 px-2 text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={applyFilters} disabled={isPending} className="h-9 flex-1">Apply</Button>
                <Button size="sm" variant="outline" disabled={isPending} className="h-9" onClick={() => {
                  const reset = { status: "all" as const };
                  setDraftFilters(reset);
                  setFilters(reset);
                  setPage(1);
                  void refreshDeliveries(reset, 1);
                }}>Reset</Button>
              </div>
            </div>
          </div>

          {deliveries.length === 0 ? (
            <div className="p-16 text-center">
              <Webhook className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">No deliveries found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-5 py-4">Event</th>
                    <th className="px-5 py-4">Endpoint</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Attempts</th>
                    <th className="px-5 py-4">Last Attempt</th>
                    <th className="px-5 py-4">Code</th>
                    <th className="px-5 py-4">Duration</th>
                    <th className="px-5 py-4">Time</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {deliveries.map(delivery => (
                    <tr key={delivery.id} className="hover:bg-slate-50 transition-colors text-sm">
                      <td className="px-5 py-4">
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded-lg font-mono text-slate-700">
                          {delivery.event_type}
                        </code>
                      </td>
                      <td className="px-5 py-4 max-w-[200px]">
                        <span className="text-xs text-slate-500 truncate block">{delivery.target_url}</span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={delivery.status} />
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-slate-600">{delivery.attempt_count}</td>
                      <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">
                        {delivery.last_attempted_at
                          ? new Date(delivery.last_attempted_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-slate-600">
                        {delivery.response_code ?? "—"}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {delivery.duration_ms != null ? `${delivery.duration_ms}ms` : "—"}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(delivery.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void openDeliveryDetails(delivery)}
                            className="text-slate-600 rounded-xl h-8 text-xs font-bold"
                            aria-label="View delivery details"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Details
                          </Button>
                        {(delivery.status === "failed" || delivery.status === "exhausted") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(delivery.id)}
                            disabled={retryingId === delivery.id || isPending}
                            className="text-indigo-600 hover:bg-indigo-50 rounded-xl h-8 text-xs font-bold"
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1" />
                            Retry
                          </Button>
                        )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {deliveryTotal > 0 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Page {page} of {Math.max(1, Math.ceil(deliveryTotal / 20))} · {deliveryTotal} matching deliveries</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isPending}
                  onClick={() => { const next = page - 1; setPage(next); void refreshDeliveries(filters, next); }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= Math.ceil(deliveryTotal / 20) || isPending}
                  onClick={() => { const next = page + 1; setPage(next); void refreshDeliveries(filters, next); }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Webhooks List */}
      {activeTab === "webhooks" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{webhooks.length} webhook(s) registered</p>
            <Button
              onClick={() => {
                setEditingWebhook(null);
                setFormName("");
                setFormUrl("https://");
                setFormEvents(["lead.created"]);
                setFormMaxAttempts(5);
                setShowCreateForm(true);
              }}
              className="h-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Webhook
            </Button>
          </div>

          {(showCreateForm || editingWebhook) && (
            <div className="bg-white rounded-3xl border-2 border-indigo-200 shadow-sm p-7">
              <h3 className="text-base font-bold text-slate-900 mb-5">{editingWebhook ? "Edit Webhook" : "New Webhook"}</h3>
              <form onSubmit={editingWebhook ? handleUpdateWebhook : handleCreateWebhook} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">Name</label>
                  <input
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    required
                    placeholder="My Webhook"
                    className="w-full h-11 px-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">Target URL (HTTPS only)</label>
                  <input
                    value={formUrl}
                    onChange={e => setFormUrl(e.target.value)}
                    required
                    type="url"
                    placeholder="https://your-endpoint.com/webhook"
                    className="w-full h-11 px-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">Events to subscribe</label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_EVENTS.map(ev => (
                      <label key={ev} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formEvents.includes(ev)}
                          onChange={e => {
                            setFormEvents(prev =>
                              e.target.checked ? [...prev, ev] : prev.filter(x => x !== ev)
                            );
                          }}
                          className="accent-indigo-600 w-4 h-4"
                        />
                        <code className="text-xs text-slate-700">{ev}</code>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Only lead.created is currently emitted by a verified application workflow.
                  </p>
                </div>
                <div>
                  <label htmlFor="webhook-max-attempts" className="text-xs font-bold text-slate-700 mb-1.5 block">Maximum delivery attempts</label>
                  <select
                    id="webhook-max-attempts"
                    value={formMaxAttempts}
                    onChange={event => setFormMaxAttempts(Number(event.target.value))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  >
                    {[1, 2, 3, 4, 5].map(attempts => (
                      <option key={attempts} value={attempts}>{attempts} {attempts === 1 ? "attempt" : "attempts"}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => { setShowCreateForm(false); setEditingWebhook(null); }} className="flex-1 h-11 rounded-2xl border-2 border-slate-200 font-bold">Cancel</Button>
                  <Button type="submit" disabled={isPending || formEvents.length === 0} className="flex-1 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                    {isPending ? "Saving..." : editingWebhook ? "Save Changes" : "Create Webhook"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {revealedSecret && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="font-bold">Copy the signing secret now</div>
              <p className="text-xs mt-1">This secret is shown only once. Store it securely before leaving this page.</p>
              <code className="block mt-2 break-all rounded-lg bg-white/80 p-3 font-mono text-xs">{revealedSecret.value}</code>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setRevealedSecret(null)}>Dismiss</Button>
            </div>
          )}

          {webhooks.length === 0 && !showCreateForm && !editingWebhook ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-16 text-center">
              <Webhook className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">No webhooks configured yet.</p>
              <p className="text-xs text-slate-400 mt-1">Add a webhook to receive real-time event notifications.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map(webhook => (
                <div key={webhook.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${webhook.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900">{webhook.name}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[300px]">{webhook.target_url}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {webhook.events.map(ev => (
                          <code key={ev} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{ev}</code>
                        ))}
                        <span className="text-[10px] text-slate-500">{webhook.max_attempts} max attempts</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => showWebhookHistory(webhook)} className="h-9 rounded-xl text-xs font-bold text-slate-600">
                      <Eye className="w-4 h-4 mr-1" />History
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleTest(webhook.id)} disabled={isPending || testingId === webhook.id} className="h-9 rounded-xl text-xs font-bold text-indigo-600">
                      <FlaskConical className="w-4 h-4 mr-1" />{testingId === webhook.id ? "Queueing…" : "Test"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => startEditing(webhook)} disabled={isPending} className="h-9 rounded-xl text-xs font-bold text-slate-600">
                      <Pencil className="w-4 h-4 mr-1" />Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRotate(webhook.id)} disabled={isPending} className="h-9 rounded-xl text-xs font-bold text-slate-600">
                      <KeyRound className="w-4 h-4 mr-1" />Rotate secret
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(webhook.id, webhook.is_active)}
                      disabled={isPending}
                      className={`h-9 rounded-xl text-xs font-bold ${webhook.is_active ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                    >
                      {webhook.is_active ? <><ToggleLeft className="w-4 h-4 mr-1" />Disable</> : <><ToggleRight className="w-4 h-4 mr-1" />Enable</>}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(webhook.id)}
                      disabled={isPending}
                      className="h-9 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(loadingDetails || selectedDetails) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Delivery details">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delivery details</h3>
                {selectedDetails && <p className="mt-1 text-xs text-slate-500">{selectedDetails.delivery.event_type} · Event ID {selectedDetails.delivery.event_id}</p>}
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedDetails(null)}>Close</Button>
            </div>
            {loadingDetails && <p className="py-12 text-center text-sm text-slate-500">Loading attempt history…</p>}
            {selectedDetails && (
              <>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
                  <span>Status: <strong>{selectedDetails.delivery.status}</strong></span>
                  <span>Attempts: <strong>{selectedDetails.delivery.attempt_count}</strong></span>
                  <span>Last attempt: <strong>{selectedDetails.delivery.last_attempted_at
                    ? new Date(selectedDetails.delivery.last_attempted_at).toLocaleString()
                    : "Not started"}</strong></span>
                </div>
                {selectedDetails.delivery.error_message && (
                  <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{selectedDetails.delivery.error_message}</div>
                )}
                <section className="mt-5">
                  <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Attempt history ({selectedDetails.attempts.length})</h4>
                  {selectedDetails.attempts.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">No attempt records yet. Historical deliveries created before attempt tracking have no recoverable HTTP history.</p>
                  ) : (
                    <ol className="space-y-3">
                      {selectedDetails.attempts.map(attempt => (
                        <li key={attempt.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <strong>
                              Attempt {attempt.attempt_number}
                              {attempt.delivery_id !== selectedDetails.delivery.id ? ` · retry ${attempt.delivery_id.slice(0, 8)}` : ""}
                              {" · "}{attempt.outcome}
                            </strong>
                            <span className="text-slate-500">{new Date(attempt.started_at).toLocaleString()}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {attempt.response_code ? `HTTP ${attempt.response_code}` : "No HTTP response"}
                            {attempt.duration_ms != null ? ` · ${attempt.duration_ms}ms` : ""}
                            {attempt.completed_at ? ` · Completed ${new Date(attempt.completed_at).toLocaleString()}` : " · In progress"}
                          </div>
                          {attempt.error_message && <p className="mt-2 text-xs text-red-600">{attempt.error_message}</p>}
                          {attempt.response_body && <pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-700">{attempt.response_body}</pre>}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
                <section className="mt-5">
                  <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Redacted event payload</h4>
                  <pre className="overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(selectedDetails.delivery.payload, null, 2)}</pre>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
