"use client";

import { useState } from "react";
import { updateBusinessStatus } from "@/lib/actions/admin";
import {
  Search,
  SlidersHorizontal,
  Building,
  Globe,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  Loader2,
  X,
  Info,
  Calendar,
  Layers,
  Sparkles,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface BusinessesTableProps {
  initialBusinesses: any[];
}

export function BusinessesTable({ initialBusinesses }: BusinessesTableProps) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Search & Filter Logic
  const filtered = businesses.filter((biz) => {
    const matchesSearch =
      biz.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (biz.owner?.email || "").toLowerCase().includes(searchTerm.toLowerCase());

    const subscription = biz.subscriptions?.[0] || {};
    const matchesPlan = planFilter === "all" || subscription.plan === planFilter;

    return matchesSearch && matchesPlan;
  });

  const handleStatusToggle = async (bizId: string, subscription: any) => {
    const isSuspended = subscription?.status === "suspended";
    setUpdatingId(bizId);
    setActionError(null);

    try {
      const result = await updateBusinessStatus(bizId, !isSuspended);
      if (result.error) throw new Error(result.error);

      // Update local state
      setBusinesses((prev) =>
        prev.map((b) => {
          if (b.id === bizId) {
            const updatedSubs = b.subscriptions.map((s: any) => ({
              ...s,
              status: isSuspended ? "active" : "suspended",
            }));
            return { ...b, subscriptions: updatedSubs };
          }
          return b;
        })
      );
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to update business status.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters & search top-bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-950 p-6 rounded-3xl border border-slate-800">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search business or owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex gap-2 shrink-0">
          {["all", "free_trial", "starter", "growth"].map((plan) => (
            <button
              key={plan}
              onClick={() => setPlanFilter(plan)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                planFilter === plan
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                  : "bg-slate-900 border-slate-850 text-slate-400 hover:text-white"
              }`}
            >
              {plan === "all" ? "All Plans" : plan.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium rounded-2xl">
          ⚠ {actionError}
        </div>
      )}

      {/* Businesses Grid List */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">Business Name</th>
                  <th className="py-4 px-6">Owner Account</th>
                  <th className="py-4 px-6">Website URL</th>
                  <th className="py-4 px-6">Active Plan</th>
                  <th className="py-4 px-6">Widget Config</th>
                  <th className="py-4 px-6">Onboarded</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filtered.map((biz) => {
                  const sub = biz.subscriptions?.[0] || {};
                  const isSuspended = sub.status === "suspended";
                  const widget = biz.widget_configs?.[0] || {};
                  const widgetEnabled = widget.is_enabled !== false;
                  const hostedEnabled = widget.hosted_chat_enabled !== false;
                  
                  const createdDate = new Date(biz.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <tr key={biz.id} className="text-slate-350 hover:bg-slate-900/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-white text-sm">{biz.name}</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 uppercase tracking-widest text-slate-500">
                            {biz.industry || "General"}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono select-all block mt-0.5">
                          slug: {biz.slug}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-semibold text-slate-300">{biz.owner?.full_name || "—"}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{biz.owner?.email}</p>
                      </td>
                      <td className="py-4 px-6 font-semibold">
                        {biz.website_url ? (
                          <a
                            href={biz.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 text-indigo-400 hover:underline"
                          >
                            <Globe className="w-3.5 h-3.5 shrink-0" />
                            {biz.website_url.replace(/https?:\/\/(www\.)?/, "")}
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white capitalize">
                            {sub.plan ? sub.plan.replace("_", " ") : "free_trial"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                              isSuspended
                                ? "bg-red-500/10 border-red-500/20 text-red-400"
                                : sub.status === "active"
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : "bg-slate-900 border-slate-800 text-slate-400"
                            }`}
                          >
                            {sub.status || "trialing"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                            widgetEnabled
                              ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                              : "bg-slate-900 border-slate-800 text-slate-500"
                          }`}
                        >
                          {widgetEnabled ? "enabled" : "disabled"}
                        </span>
                        <span
                          className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                            hostedEnabled
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-slate-900 border-slate-800 text-slate-500"
                          }`}
                        >
                          hosted {hostedEnabled ? "on" : "off"}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-400">
                        {biz.onboarding_completed ? (
                          <span className="text-emerald-400 font-bold uppercase tracking-wider text-[9px]">
                            Completed
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Incomplete</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        {/* Details Modal Trigger */}
                        <Button
                          onClick={() => setSelectedBusiness(biz)}
                          variant="ghost"
                          className="rounded-xl h-9 text-[10px] font-bold uppercase tracking-wider border border-slate-850 hover:bg-slate-900 hover:text-white"
                        >
                          Details
                        </Button>

                        {/* Suspension Toggle */}
                        <Button
                          onClick={() => handleStatusToggle(biz.id, sub)}
                          disabled={updatingId === biz.id}
                          variant="ghost"
                          className={`rounded-xl h-9 text-[10px] font-bold uppercase tracking-wider border hover:bg-slate-900 transition-all ${
                            isSuspended
                              ? "border-emerald-500/20 text-emerald-400 hover:border-emerald-500/40"
                              : "border-red-500/20 text-red-400 hover:border-red-500/40"
                          }`}
                        >
                          {updatingId === biz.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isSuspended ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                              Reactivate
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                              Suspend
                            </>
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
            <p className="text-sm">No businesses found matching search constraints.</p>
          </div>
        )}
      </div>

      {/* Premium Business Details Overlay Drawer Modal */}
      {selectedBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg h-full bg-slate-950 border-l border-slate-800 p-8 overflow-y-auto flex flex-col justify-between relative shadow-2xl">
            <div>
              {/* Drawer Top Controls */}
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-white">{selectedBusiness.name}</h2>
                    <p className="text-[10px] font-medium text-indigo-400 uppercase tracking-wider">
                      Business Specifications
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBusiness(null)}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Core Info Panels */}
              <div className="space-y-6">
                
                {/* Panel 1: Profile & Industry */}
                <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-850">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    Overview & Description
                  </h4>
                  <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                    <div>
                      <p className="text-slate-500 font-semibold mb-1">Industry</p>
                      <p className="text-white font-bold">{selectedBusiness.industry || "—"}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-semibold mb-1">Created At</p>
                      <p className="text-white font-bold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(selectedBusiness.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs font-semibold mb-1">Business Bio Description</p>
                    <p className="text-slate-300 text-xs leading-relaxed italic bg-slate-950 p-3 rounded-xl border border-slate-900">
                      {selectedBusiness.description || "No business description provided."}
                    </p>
                  </div>
                </div>

                {/* Panel 2: AI Assistant Configuration */}
                {selectedBusiness.assistants?.[0] ? (
                  <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-850">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      AI Assistant Settings
                    </h4>
                    <div className="text-xs space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-slate-500 font-semibold">Assistant Name</p>
                          <p className="text-white font-bold">{selectedBusiness.assistants[0].name}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-semibold">Assistant Tone</p>
                          <p className="text-indigo-400 font-bold capitalize">{selectedBusiness.assistants[0].tone}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold mb-0.5">Welcome Greeting</p>
                        <p className="text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-900 italic leading-relaxed">
                          {selectedBusiness.assistants[0].welcome_message}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-900/20 border border-dashed border-slate-800 text-center text-xs text-slate-500 rounded-2xl">
                    No custom AI Assistant configured yet.
                  </div>
                )}

                {/* Panel 3: Active Limits & Subscriptions */}
                {selectedBusiness.widget_configs?.[0] ? (
                  <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-850">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                      Hosted Chat Link
                    </h4>
                    <div className="text-xs space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-slate-500 font-semibold">Hosted Status</p>
                          <p className={selectedBusiness.widget_configs[0].hosted_chat_enabled !== false ? "text-emerald-400 font-bold" : "text-slate-500 font-bold"}>
                            {selectedBusiness.widget_configs[0].hosted_chat_enabled !== false ? "Enabled" : "Disabled"}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-semibold">Slug</p>
                          <p className="text-white font-mono">{selectedBusiness.widget_configs[0].hosted_chat_slug || selectedBusiness.slug}</p>
                        </div>
                      </div>
                      <a
                        href={`${(process.env.NEXT_PUBLIC_APP_URL || "https://agentifyhq.vercel.app").replace(/\/$/, "")}/chat/${selectedBusiness.widget_configs[0].hosted_chat_slug || selectedBusiness.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] text-indigo-300 break-all hover:border-indigo-500/40"
                      >
                        {`${(process.env.NEXT_PUBLIC_APP_URL || "https://agentifyhq.vercel.app").replace(/\/$/, "")}/chat/${selectedBusiness.widget_configs[0].hosted_chat_slug || selectedBusiness.slug}`}
                      </a>
                    </div>
                  </div>
                ) : null}

                {selectedBusiness.subscriptions?.[0] ? (
                  <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-850">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      Subscription Quota Limits
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-slate-500 font-semibold">Message Quota Limit</p>
                        <p className="text-white font-bold">
                          {selectedBusiness.subscriptions[0].current_usage} / {selectedBusiness.subscriptions[0].message_limit}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">Knowledge Limit</p>
                        <p className="text-white font-bold">{selectedBusiness.subscriptions[0].knowledge_limit || 5} sources</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">Lead Cap Quota</p>
                        <p className="text-white font-bold">{selectedBusiness.subscriptions[0].lead_limit || 50} leads</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">Active Period End</p>
                        <p className="text-white font-bold">
                          {selectedBusiness.subscriptions[0].current_period_end 
                            ? new Date(selectedBusiness.subscriptions[0].current_period_end).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

              </div>
            </div>

            {/* Close button at bottom */}
            <div className="pt-8 border-t border-slate-900 mt-6">
              <Button
                onClick={() => setSelectedBusiness(null)}
                className="w-full bg-slate-900 border border-slate-850 text-slate-300 hover:text-white rounded-2xl h-12 font-bold"
              >
                Close View
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
