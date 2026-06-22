"use client";

import { useState, useTransition } from "react";
import {
  createWebhook,
  toggleWebhook,
  deleteWebhook,
  retryWebhookDelivery,
  type WebhookDelivery,
  type WebhookRecord,
  type WebhookStats,
} from "@/lib/actions/webhooks";
import {
  Webhook, CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw,
  Plus, Trash2, ToggleLeft, ToggleRight, ExternalLink, Activity, Zap, Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_CONFIG = {
  success: { label: "Success", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-red-50 text-red-600 border-red-200", icon: XCircle },
  pending: { label: "Pending", color: "bg-blue-50 text-blue-600 border-blue-200", icon: Clock },
  retrying: { label: "Retrying", color: "bg-amber-50 text-amber-600 border-amber-200", icon: RefreshCw },
};

const AVAILABLE_EVENTS = [
  "lead.created",
  "conversation.started",
  "conversation.ended",
  "message.sent",
  "subscription.upgraded",
  "subscription.cancelled",
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
  const [activeTab, setActiveTab] = useState<"webhooks" | "deliveries">("deliveries");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "failed" | "pending">("all");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("https://");
  const [formEvents, setFormEvents] = useState<string[]>(["lead.created"]);

  function showMsg(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createWebhook(formName, formUrl, formEvents);
      if (result.error) {
        showMsg("error", result.error);
      } else {
        showMsg("success", "Webhook created successfully.");
        setShowCreateForm(false);
        setFormName(""); setFormUrl("https://"); setFormEvents(["lead.created"]);
      }
    });
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
        setDeliveries(prev => prev.map(d => d.id === deliveryId ? { ...d, status: "retrying" } : d));
        showMsg("success", "Delivery queued for retry.");
      }
    });
  }

  const filteredDeliveries = filterStatus === "all"
    ? deliveries
    : deliveries.filter(d => filterStatus === "pending" ? ["pending","retrying"].includes(d.status) : d.status === filterStatus);

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Success Rate", value: `${stats.successRate}%`, icon: Activity, color: "text-emerald-600 bg-emerald-50" },
          { label: "Failed", value: stats.failed, icon: XCircle, color: "text-red-600 bg-red-50" },
          { label: "Avg Response", value: stats.avgDurationMs ? `${stats.avgDurationMs}ms` : "—", icon: Timer, color: "text-indigo-600 bg-indigo-50" },
          { label: "Last 24h", value: stats.last24h, icon: Zap, color: "text-amber-600 bg-amber-50" },
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
            {tab === "deliveries" ? `Delivery Log (${totalDeliveries})` : "Registered Webhooks"}
          </button>
        ))}
      </div>

      {/* Delivery Log */}
      {activeTab === "deliveries" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-bold text-slate-900">Delivery Log</h3>
            <div className="flex gap-2">
              {(["all", "success", "failed", "pending"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize ${
                    filterStatus === f
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredDeliveries.length === 0 ? (
            <div className="p-16 text-center">
              <Webhook className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">No deliveries found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-5 py-4">Event</th>
                    <th className="px-5 py-4">Endpoint</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Code</th>
                    <th className="px-5 py-4">Duration</th>
                    <th className="px-5 py-4">Time</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredDeliveries.map(delivery => (
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
                        {(delivery.status === "failed" || delivery.status === "retrying") && (
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              onClick={() => setShowCreateForm(true)}
              className="h-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Webhook
            </Button>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div className="bg-white rounded-3xl border-2 border-indigo-200 shadow-sm p-7">
              <h3 className="text-base font-bold text-slate-900 mb-5">New Webhook</h3>
              <form onSubmit={handleCreateWebhook} className="space-y-4">
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
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)} className="flex-1 h-11 rounded-2xl border-2 border-slate-200 font-bold">Cancel</Button>
                  <Button type="submit" disabled={isPending || formEvents.length === 0} className="flex-1 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                    {isPending ? "Creating..." : "Create Webhook"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {webhooks.length === 0 && !showCreateForm ? (
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
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
}
