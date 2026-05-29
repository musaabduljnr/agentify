"use client";

import { useState } from "react";
import {
  updateSubscriptionPlan,
  updateSubscriptionStatus,
  resetBusinessUsage,
} from "@/lib/actions/admin";
import {
  Search,
  KeyRound,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Layers,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubscriptionsTableProps {
  initialSubscriptions: any[];
}

export function SubscriptionsTable({ initialSubscriptions }: SubscriptionsTableProps) {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Filter Logic
  const filtered = subscriptions.filter((sub) => {
    const matchesSearch = (sub.businesses?.name || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesPlan = planFilter === "all" || sub.plan === planFilter;
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;

    return matchesSearch && matchesPlan && matchesStatus;
  });

  const handlePlanChange = async (subId: string, plan: "free_trial" | "starter" | "growth") => {
    setLoadingId(subId);
    setErrorMsg(null);
    try {
      const result = await updateSubscriptionPlan(subId, plan);
      if (result.error) throw new Error(result.error);

      // Local update
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, plan } : s))
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update subscription plan.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleStatusChange = async (subId: string, currentStatus: string) => {
    const targetStatus = currentStatus === "suspended" ? "active" : "suspended";
    setLoadingId(subId);
    setErrorMsg(null);
    try {
      const result = await updateSubscriptionStatus(subId, targetStatus);
      if (result.error) throw new Error(result.error);

      setSubscriptions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, status: targetStatus } : s))
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update status.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleResetUsage = async (subId: string) => {
    if (!confirm("Are you sure you want to reset the message usage count back to 0 for this business?")) {
      return;
    }
    setLoadingId(subId);
    setErrorMsg(null);
    try {
      const result = await resetBusinessUsage(subId);
      if (result.error) throw new Error(result.error);

      setSubscriptions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, current_usage: 0 } : s))
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset message usage count.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Search & Double Filter controls */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-950 p-6 rounded-3xl border border-slate-800">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search business name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Plan Selector */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Plans</option>
            <option value="free_trial">Free Trial</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
          </select>

          {/* Status Selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="past_due">Past Due</option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium rounded-2xl">
          ⚠ {errorMsg}
        </div>
      )}

      {/* Main Subscriptions List Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6 whitespace-nowrap">Business Name</th>
                  <th className="py-4 px-6 whitespace-nowrap">Pricing Plan</th>
                  <th className="py-4 px-6 whitespace-nowrap">Status State</th>
                  <th className="py-4 px-6 whitespace-nowrap">Gateway Provider</th>
                  <th className="py-4 px-6 whitespace-nowrap">Message Quota Usage</th>
                  <th className="py-4 px-6 whitespace-nowrap">Period Renew Date</th>
                  <th className="py-4 px-6 text-right whitespace-nowrap">Actions Panel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filtered.map((sub) => {
                  const isSuspended = sub.status === "suspended";
                  const endPeriod = sub.current_period_end
                    ? new Date(sub.current_period_end).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr key={sub.id} className="text-slate-350 hover:bg-slate-900/30 transition-colors">
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-white text-sm">
                            {sub.businesses?.name || "Deleted Business"}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono select-all block mt-0.5 whitespace-nowrap">
                          Sub ID: {sub.id}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-white capitalize whitespace-nowrap">
                        {sub.plan.replace("_", " ")}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider whitespace-nowrap ${
                            isSuspended
                              ? "bg-red-500/10 border-red-500/20 text-red-400"
                              : sub.status === "active"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium capitalize text-slate-400 whitespace-nowrap">
                        {sub.payment_provider || "manual"}
                      </td>
                      <td className="py-4 px-6 font-bold text-white whitespace-nowrap">
                        <span className="text-indigo-400">{sub.current_usage}</span> / {sub.message_limit}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-400 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {endPeriod}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        {/* Reset Count Button */}
                        <Button
                          onClick={() => handleResetUsage(sub.id)}
                          disabled={loadingId === sub.id}
                          variant="ghost"
                          title="Reset Message Usage Count"
                          className="rounded-xl h-9 text-[10px] font-bold border border-slate-850 hover:bg-slate-900"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>

                        {/* Upgrade drop menu */}
                        <select
                          value={sub.plan}
                          disabled={loadingId === sub.id}
                          onChange={(e) => handlePlanChange(sub.id, e.target.value as any)}
                          className="px-2 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[10px] text-white font-bold uppercase tracking-wider focus:outline-none"
                        >
                          <option value="free_trial">Trial</option>
                          <option value="starter">Starter</option>
                          <option value="growth">Growth</option>
                        </select>

                        {/* Suspension Toggle */}
                        <Button
                          onClick={() => handleStatusChange(sub.id, sub.status)}
                          disabled={loadingId === sub.id}
                          variant="ghost"
                          className={`rounded-xl h-9 text-[10px] font-bold uppercase tracking-wider border hover:bg-slate-900 ${
                            isSuspended
                              ? "border-emerald-500/20 text-emerald-400"
                              : "border-red-500/20 text-red-400"
                          }`}
                        >
                          {loadingId === sub.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isSuspended ? (
                            "Reactivate"
                          ) : (
                            "Suspend"
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500">
            <p className="text-sm">No subscription accounts matching search parameters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
