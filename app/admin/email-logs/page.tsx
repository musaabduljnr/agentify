"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  Loader2,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Building,
  Calendar,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { getAdminEmailLogs, getAllBusinesses } from "@/lib/actions/admin";

export default function AdminEmailLogsPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [businessFilter, setBusinessFilter] = useState("all");

  const templatesList = [
    { id: "welcome-email", label: "Welcome Email" },
    { id: "new-lead-email", label: "New Lead Capture" },
    { id: "booking-request-email", label: "Booking Request" },
    { id: "support-request-email", label: "Support Request" },
    { id: "payment-success-email", label: "Payment Success" },
    { id: "payment-failed-email", label: "Payment Failed" },
    { id: "usage-warning-email", label: "Usage Limit Alert" },
  ];

  const fetchFiltersData = async () => {
    try {
      const bData = await getAllBusinesses();
      setBusinesses(bData || []);
    } catch (err) {
      console.error("Failed to load business filters:", err);
    }
  };

  const fetchLogs = async (showToast = false) => {
    setRefreshing(true);
    try {
      const data = await getAdminEmailLogs({
        status: statusFilter,
        templateName: templateFilter,
        businessId: businessFilter,
      });
      setLogs(data || []);
      if (showToast) {
        toast.success("Logs reloaded successfully.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load transactional email logs.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // Fetch initial filters data
  useEffect(() => {
    fetchFiltersData();
  }, []);

  // Fetch logs whenever filters change
  useEffect(() => {
    fetchLogs();
  }, [statusFilter, templateFilter, businessFilter]);

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-indigo-500" />
        Loading transactional logs...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-white">Email Notification Logs</h1>
            <p className="text-sm text-slate-400">
              Audit transactional Resend delivery, check status, inspect delivery errors, and filter logs.
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 px-5 text-sm font-bold transition-all shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Logs
        </button>
      </div>

      {/* Filter panel */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
        <h3 className="mb-4 flex items-center gap-2 border-b border-slate-900 pb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Filter className="h-4 w-4 text-indigo-400" />
          Filter Audit Logs
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          {/* Status filter */}
          <label className="space-y-2">
            <span className="block font-bold text-slate-400">Delivery Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5 font-bold text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent / Success</option>
              <option value="failed">Failed / Bounced</option>
            </select>
          </label>

          {/* Template filter */}
          <label className="space-y-2">
            <span className="block font-bold text-slate-400">Email Template</span>
            <select
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5 font-bold text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Templates</option>
              {templatesList.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.label}
                </option>
              ))}
            </select>
          </label>

          {/* Business filter */}
          <label className="space-y-2">
            <span className="block font-bold text-slate-400">Business Profile</span>
            <select
              value={businessFilter}
              onChange={(e) => setBusinessFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5 font-bold text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Businesses</option>
              {businesses.map((biz) => (
                <option key={biz.id} value={biz.id}>
                  {biz.name || biz.slug || "Unnamed Business"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-4 px-6">Recipient & Business</th>
                <th className="py-4 px-6">Subject & Template</th>
                <th className="py-4 px-6">Provider</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Delivery Details / Error</th>
                <th className="py-4 px-6">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs font-semibold text-slate-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-bold">
                    No email logs found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const bizName = log.businesses?.name || "Global / System";
                  const templateLabel =
                    templatesList.find((t) => t.id === log.template_name)?.label || log.template_name;

                  return (
                    <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                      {/* Recipient */}
                      <td className="py-4 px-6 space-y-1">
                        <span className="block text-slate-200 font-bold break-all max-w-[200px]">
                          {log.recipient}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                          <Building className="h-3 w-3 text-slate-600" />
                          {bizName}
                        </span>
                      </td>

                      {/* Subject */}
                      <td className="py-4 px-6 space-y-1">
                        <span className="block text-slate-300 font-bold">{log.subject}</span>
                        <span className="inline-block rounded bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-indigo-400">
                          {templateLabel}
                        </span>
                      </td>

                      {/* Provider */}
                      <td className="py-4 px-6 capitalize text-slate-400 font-mono">
                        {log.provider || "resend"}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {log.status === "sent" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-400">
                            <CheckCircle className="h-3 w-3" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[10px] font-bold text-red-400">
                            <AlertCircle className="h-3 w-3" />
                            Failed
                          </span>
                        )}
                      </td>

                      {/* Error or Response info */}
                      <td className="py-4 px-6 max-w-[320px]">
                        {log.status === "failed" ? (
                          <p className="text-red-400 font-mono text-[11px] leading-relaxed break-words line-clamp-2">
                            {log.error_message || "Unknown SMTP delivery exception."}
                          </p>
                        ) : (
                          <span className="text-slate-500 font-mono text-[10px] block truncate">
                            ID: {log.response_body?.id || "N/A"}
                          </span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-4 px-6 text-slate-400 font-medium">
                        <span className="flex items-center gap-1 whitespace-nowrap text-[11px]">
                          <Calendar className="h-3.5 w-3.5 text-slate-600" />
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
