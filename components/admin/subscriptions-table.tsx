"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  adminChangeSubscriptionPlan,
  adminChangeSubscriptionStatus,
  adminUpdateSubscriptionLimits,
  adminResetSubscriptionUsage,
  adminExtendSubscriptionPeriod,
  adminUpdateSubscriptionNotes,
} from "@/lib/actions/admin-subscriptions";
import {
  Search,
  RotateCcw,
  Calendar,
  Loader2,
  Sliders,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  PlusCircle,
  HelpCircle
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
  const [providerFilter, setProviderFilter] = useState("all");
  
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Detail drawer state
  const [selectedSub, setSelectedSub] = useState<any | null>(null);

  // Form states inside the drawer
  const [notesText, setNotesText] = useState("");
  const [targetPlan, setTargetPlan] = useState("");
  const [targetStatus, setTargetStatus] = useState("");
  const [extendDays, setExtendDays] = useState<string>("7");
  const [customExtDate, setCustomExtDate] = useState("");
  
  // Custom limits state
  const [limitMsgs, setLimitMsgs] = useState<number | string>("");
  const [limitKnowledge, setLimitKnowledge] = useState<number | string>("");
  const [limitLeads, setLimitLeads] = useState<number | string>("");
  const [limitWidgets, setLimitWidgets] = useState<number | string>("");
  const [limitEmbeddings, setLimitEmbeddings] = useState<number | string>("");
  const [currentUsageInput, setCurrentUsageInput] = useState<number | string>("");

  // Search & Filter logic
  const filtered = subscriptions.filter((sub) => {
    const ownerEmail = sub.businesses?.owner?.email || "";
    const ownerName = sub.businesses?.owner?.full_name || "";
    const bizName = sub.businesses?.name || "";

    const matchesSearch = 
      bizName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ownerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ownerName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPlan = planFilter === "all" || sub.plan === planFilter;
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    const matchesProvider = providerFilter === "all" || (sub.payment_provider || "manual") === providerFilter;

    return matchesSearch && matchesPlan && matchesStatus && matchesProvider;
  });

  const triggerToast = (type: "success" | "error", msg: string) => {
    if (type === "success") {
      setSuccessMsg(msg);
      setErrorMsg(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(msg);
      setSuccessMsg(null);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const openDrawer = (sub: any) => {
    setSelectedSub(sub);
    setNotesText(sub.metadata?.admin_notes || "");
    setTargetPlan(sub.plan);
    setTargetStatus(sub.status);
    setLimitMsgs(sub.message_limit ?? "");
    setLimitKnowledge(sub.knowledge_limit ?? "");
    setLimitLeads(sub.lead_limit ?? "");
    setLimitWidgets(sub.widget_limit ?? "");
    setLimitEmbeddings(sub.embedding_limit ?? "");
    setCurrentUsageInput(sub.current_usage ?? "");
  };

  const handleSaveNotes = async () => {
    if (!selectedSub) return;
    setLoadingId("save_notes");
    try {
      const res = await adminUpdateSubscriptionNotes(selectedSub.id, notesText);
      if (res.error) throw new Error(res.error);

      if (res.subscription) {
        setSubscriptions((prev) => prev.map((s) => (s.id === selectedSub.id ? res.subscription : s)));
        setSelectedSub(res.subscription);
      }

      triggerToast("success", "Admin notes updated successfully.");
    } catch (err: any) {
      triggerToast("error", err.message || "Failed to update notes.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedSub || !targetPlan) return;
    setLoadingId("update_plan");
    try {
      const res = await adminChangeSubscriptionPlan(selectedSub.id, targetPlan as any);
      if (res.error) throw new Error(res.error);

      if (res.subscription) {
        setSubscriptions((prev) => prev.map((s) => (s.id === selectedSub.id ? res.subscription : s)));
        setSelectedSub(res.subscription);
        // Sync limits input states
        setLimitMsgs(res.subscription.message_limit ?? "");
        setLimitKnowledge(res.subscription.knowledge_limit ?? "");
        setLimitLeads(res.subscription.lead_limit ?? "");
        setLimitWidgets(res.subscription.widget_limit ?? "");
        setLimitEmbeddings(res.subscription.embedding_limit ?? "");
        setCurrentUsageInput(res.subscription.current_usage ?? "");
      }
      triggerToast("success", `Plan updated to ${targetPlan} (manual billing).`);
    } catch (err: any) {
      triggerToast("error", err.message || "Failed to update plan.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedSub || !targetStatus) return;
    setLoadingId("update_status");
    try {
      const res = await adminChangeSubscriptionStatus(selectedSub.id, targetStatus);
      if (res.error) throw new Error(res.error);

      if (res.subscription) {
        setSubscriptions((prev) => prev.map((s) => (s.id === selectedSub.id ? res.subscription : s)));
        setSelectedSub(res.subscription);
      }
      triggerToast("success", `Status updated to ${targetStatus}.`);
    } catch (err: any) {
      triggerToast("error", err.message || "Failed to update status.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleApplyLimits = async () => {
    if (!selectedSub) return;
    setLoadingId("apply_limits");
    try {
      const msgLimit = limitMsgs === "" ? null : Number(limitMsgs);
      const knowledgeLimit = limitKnowledge === "" ? null : Number(limitKnowledge);
      const leadLimit = limitLeads === "" ? null : Number(limitLeads);
      const widgetLimit = limitWidgets === "" ? null : Number(limitWidgets);
      const embeddingLimit = limitEmbeddings === "" ? null : Number(limitEmbeddings);
      const usageVal = currentUsageInput === "" ? null : Number(currentUsageInput);

      const res = await adminUpdateSubscriptionLimits(selectedSub.id, {
        message_limit: msgLimit,
        knowledge_limit: knowledgeLimit,
        lead_limit: leadLimit,
        widget_limit: widgetLimit,
        embedding_limit: embeddingLimit,
        current_usage: usageVal,
      });

      if (res.error) throw new Error(res.error);

      if (res.subscription) {
        setSubscriptions((prev) => prev.map((s) => (s.id === selectedSub.id ? res.subscription : s)));
        setSelectedSub(res.subscription);
      }
      triggerToast("success", "Custom limits override applied.");
    } catch (err: any) {
      triggerToast("error", err.message || "Failed to apply custom limits.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleResetUsage = async () => {
    if (!selectedSub) return;
    if (!confirm("Are you sure you want to reset all current usage stats back to 0 for this business?")) {
      return;
    }
    setLoadingId("reset_usage");
    try {
      const res = await adminResetSubscriptionUsage(selectedSub.id);
      if (res.error) throw new Error(res.error);

      if (res.subscription) {
        setSubscriptions((prev) => prev.map((s) => (s.id === selectedSub.id ? res.subscription : s)));
        setSelectedSub(res.subscription);
        setCurrentUsageInput(res.subscription.current_usage ?? "");
      }
      triggerToast("success", "Usage metrics reset successfully.");
    } catch (err: any) {
      triggerToast("error", err.message || "Failed to reset usage.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleExtendPeriod = async () => {
    if (!selectedSub) return;
    setLoadingId("extend_period");
    try {
      const param = extendDays === "custom" ? customExtDate : Number(extendDays);
      if (extendDays === "custom" && !customExtDate) {
        throw new Error("Please select a custom extension date.");
      }

      const res = await adminExtendSubscriptionPeriod(selectedSub.id, param);
      if (res.error) throw new Error(res.error);

      if (res.subscription) {
        setSubscriptions((prev) => prev.map((s) => (s.id === selectedSub.id ? res.subscription : s)));
        setSelectedSub(res.subscription);
      }
      triggerToast("success", "Subscription period extended.");
    } catch (err: any) {
      triggerToast("error", err.message || "Failed to extend subscription.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 relative">
      
      {/* Top Banner Feedbacks */}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-pulse">
          <AlertTriangle className="w-4 h-4" /> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {/* Dynamic Search & Double Filter controls */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-950 p-6 rounded-3xl border border-slate-800">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by business name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
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
            <option value="business">Business</option>
            <option value="enterprise">Enterprise</option>
          </select>

          {/* Status Selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
            <option value="cancelled">Cancelled</option>
            <option value="past_due">Past Due</option>
          </select>

          {/* Payment Provider Filter */}
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Providers</option>
            <option value="manual">Manual</option>
            <option value="paystack">Paystack</option>
            <option value="flutterwave">Flutterwave</option>
          </select>
        </div>
      </div>

      {/* Main Subscriptions List Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6 whitespace-nowrap">Business Name</th>
                  <th className="py-4 px-6 whitespace-nowrap">Owner / Contact</th>
                  <th className="py-4 px-6 whitespace-nowrap">Pricing Plan</th>
                  <th className="py-4 px-6 whitespace-nowrap">Status State</th>
                  <th className="py-4 px-6 whitespace-nowrap">Gateway Provider</th>
                  <th className="py-4 px-6 whitespace-nowrap">Message Quota</th>
                  <th className="py-4 px-6 whitespace-nowrap">Revenue</th>
                  <th className="py-4 px-6 whitespace-nowrap">Period Renew Date</th>
                  <th className="py-4 px-6 text-right whitespace-nowrap">Actions Panel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filtered.map((sub) => {
                  const endPeriod = sub.current_period_end
                    ? new Date(sub.current_period_end).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr key={sub.id} className="text-slate-300 hover:bg-slate-900/40 transition-colors">
                      {/* Business name (clickable to open details) */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div 
                          onClick={() => openDrawer(sub)}
                          className="cursor-pointer group flex items-center gap-1.5"
                        >
                          <p className="font-extrabold text-white text-sm group-hover:text-indigo-400 group-hover:underline">
                            {sub.businesses?.name || "Deleted Business"}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono select-all block mt-0.5 whitespace-nowrap">
                          ID: {sub.id}
                        </span>
                      </td>

                      <td className="py-4 px-6 whitespace-nowrap">
                        <p className="font-semibold text-slate-200">
                          {sub.businesses?.owner?.full_name || "—"}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {sub.businesses?.owner?.email || "—"}
                        </span>
                      </td>

                      <td className="py-4 px-6 font-bold text-white capitalize whitespace-nowrap">
                        {sub.plan.replace("_", " ")}
                      </td>

                      <td className="py-4 px-6 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider whitespace-nowrap ${
                            sub.status === "suspended" || sub.status === "cancelled" || sub.status === "inactive"
                              ? "bg-red-500/10 border-red-500/20 text-red-400"
                              : sub.status === "active" || sub.status === "trialing"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>

                      <td className="py-4 px-6 font-semibold capitalize text-slate-400 whitespace-nowrap">
                        {sub.payment_provider || "manual"}
                      </td>

                      <td className="py-4 px-6 font-bold text-white whitespace-nowrap">
                        <span className="text-indigo-400">{sub.current_usage}</span> / {sub.message_limit >= 999999999 ? "∞" : sub.message_limit}
                      </td>

                      <td className="py-4 px-6 font-bold text-white whitespace-nowrap">
                        ₦{(sub.revenue || 0).toLocaleString()}
                      </td>

                      <td className="py-4 px-6 font-medium text-slate-400 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {endPeriod}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <Button
                          onClick={() => openDrawer(sub)}
                          variant="ghost"
                          className="rounded-xl h-9 text-xs font-bold border border-slate-850 bg-slate-900/50 text-indigo-400 hover:text-indigo-300 hover:bg-slate-900"
                        >
                          <Sliders className="w-3.5 h-3.5 mr-1.5" />
                          Manage Account
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

      {/* Premium Detail Drawer using Framer Motion */}
      <AnimatePresence>
        {selectedSub && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSub(null)}
              className="fixed inset-0 bg-slate-950 z-40 cursor-pointer"
            />

            {/* Slideout Drawer Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-screen w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl z-50 overflow-y-auto flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-6 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between sticky top-0 backdrop-blur-md z-10">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white tracking-tight">
                    {selectedSub.businesses?.name || "Subscription Details"}
                  </h3>
                  <p className="text-slate-400 text-xs font-semibold">
                    Manage manual plan settings, limits, and status states
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSub(null)}
                  className="w-9 h-9 flex items-center justify-center bg-slate-900 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-6 flex-1 space-y-8 pb-24">
                
                {/* 1. Account Summary Card */}
                <div className="p-5 bg-slate-950 rounded-2xl border border-slate-850 space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Account Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-slate-500 font-medium">Owner</p>
                      <p className="text-white font-bold truncate mt-0.5">{selectedSub.businesses?.owner?.full_name || "—"}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{selectedSub.businesses?.owner?.email || "—"}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">Plan Level / Gateway</p>
                      <p className="text-white font-bold capitalize mt-0.5">{selectedSub.plan.replace("_", " ")}</p>
                      <span className="inline-block text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">
                        {selectedSub.payment_provider || "manual"} billing
                      </span>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">Billing Period End</p>
                      <p className="text-white font-bold mt-0.5">
                        {selectedSub.current_period_end ? new Date(selectedSub.current_period_end).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">Created On</p>
                      <p className="text-white font-bold mt-0.5">
                        {selectedSub.created_at ? new Date(selectedSub.created_at).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Plan Tier and Status Settings */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" /> Plan & Status Controls
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Plan Selector */}
                    <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-850 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                        Subscription Plan Tier
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={targetPlan}
                          onChange={(e) => setTargetPlan(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium focus:outline-none"
                        >
                          <option value="free_trial">Free Trial</option>
                          <option value="starter">Starter</option>
                          <option value="growth">Growth</option>
                          <option value="business">Business</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                        <Button
                          onClick={handleUpdatePlan}
                          disabled={loadingId === "update_plan"}
                          className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold px-3 py-2 rounded-xl h-auto"
                        >
                          {loadingId === "update_plan" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                        </Button>
                      </div>
                    </div>

                    {/* Status Selector */}
                    <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-850 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                        Active Status State
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={targetStatus}
                          onChange={(e) => setTargetStatus(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium focus:outline-none"
                        >
                          <option value="active">Active</option>
                          <option value="trialing">Trialing</option>
                          <option value="inactive">Inactive</option>
                          <option value="suspended">Suspended</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="past_due">Past Due</option>
                        </select>
                        <Button
                          onClick={handleUpdateStatus}
                          disabled={loadingId === "update_status"}
                          className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold px-3 py-2 rounded-xl h-auto"
                        >
                          {loadingId === "update_status" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Limit Overrides Panel */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" /> Quota Limit Overrides
                  </h4>

                  <div className="p-5 bg-slate-950/40 rounded-2xl border border-slate-850 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Message Limit */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Message Limit
                        </label>
                        <input
                          type="number"
                          value={limitMsgs}
                          onChange={(e) => setLimitMsgs(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
                        />
                      </div>
                      
                      {/* Knowledge limit */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Knowledge Limit
                        </label>
                        <input
                          type="number"
                          value={limitKnowledge}
                          onChange={(e) => setLimitKnowledge(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
                        />
                      </div>

                      {/* Lead Limit */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Lead Limit
                        </label>
                        <input
                          type="number"
                          value={limitLeads}
                          onChange={(e) => setLimitLeads(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
                        />
                      </div>

                      {/* Widget Limit */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Widget Limit
                        </label>
                        <input
                          type="number"
                          value={limitWidgets}
                          onChange={(e) => setLimitWidgets(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
                        />
                      </div>

                      {/* Embedding Limit */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Embedding Limit
                        </label>
                        <input
                          type="number"
                          value={limitEmbeddings}
                          onChange={(e) => setLimitEmbeddings(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
                        />
                      </div>

                      {/* Current Usage override */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Current Usage Counter
                        </label>
                        <input
                          type="number"
                          value={currentUsageInput}
                          onChange={(e) => setCurrentUsageInput(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={handleApplyLimits}
                        disabled={loadingId === "apply_limits"}
                        className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold rounded-xl px-4 py-2"
                      >
                        {loadingId === "apply_limits" ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        ) : null}
                        Apply Custom Limits
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 4. Billing Period Extensions & Usage Resets */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" /> Billing Period Extensions & Resets
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Period Extension */}
                    <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-850 space-y-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                        Extend Billing Cycle
                      </label>
                      <select
                        value={extendDays}
                        onChange={(e) => setExtendDays(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium focus:outline-none"
                      >
                        <option value="7">Extend by 7 Days</option>
                        <option value="14">Extend by 14 Days</option>
                        <option value="30">Extend by 30 Days</option>
                        <option value="custom">Custom End Date</option>
                      </select>

                      {extendDays === "custom" && (
                        <input
                          type="date"
                          value={customExtDate}
                          onChange={(e) => setCustomExtDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                        />
                      )}

                      <Button
                        onClick={handleExtendPeriod}
                        disabled={loadingId === "extend_period"}
                        className="w-full bg-slate-800 hover:bg-slate-705 border border-slate-700 text-xs font-bold py-2 rounded-xl h-auto mt-2"
                      >
                        {loadingId === "extend_period" ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        ) : null}
                        Apply Extension
                      </Button>
                    </div>

                    {/* Reset Usage */}
                    <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-850 flex flex-col justify-between space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                          Reset Message Usage
                        </label>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          Reset current message counters back to 0 and push the next reset date 30 days out.
                        </p>
                      </div>

                      <Button
                        onClick={handleResetUsage}
                        disabled={loadingId === "reset_usage"}
                        variant="destructive"
                        className="w-full text-xs font-bold py-2 rounded-xl h-auto"
                      >
                        {loadingId === "reset_usage" ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Reset Account Usage
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 5. Persistent Admin Notes */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" /> Platform Admin Notes
                  </h4>

                  <div className="p-5 bg-slate-950/40 rounded-2xl border border-slate-850 space-y-4">
                    <textarea
                      rows={4}
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      placeholder="Write notes about custom upgrades, extensions or enterprise agreements here..."
                      className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />

                    {selectedSub.metadata?.last_admin_action && (
                      <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl flex items-start gap-2">
                        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <div className="text-[10px] text-slate-400 leading-normal">
                          <span className="font-bold text-slate-300 capitalize">
                            Last admin action:
                          </span>{" "}
                          {selectedSub.metadata.last_admin_action.replace("_", " ")} on{" "}
                          {new Date(selectedSub.metadata.last_admin_action_at).toLocaleString()}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button
                        onClick={handleSaveNotes}
                        disabled={loadingId === "save_notes"}
                        className="bg-indigo-600 hover:bg-indigo-700 text-xs font-bold rounded-xl px-4 py-2"
                      >
                        {loadingId === "save_notes" ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        ) : null}
                        Save Action Notes
                      </Button>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
