"use client";

import { useEffect, useState, useTransition } from "react";
import { 
  getDemoBusinesses, 
  extendDemoBusiness, 
  pauseDemoBusiness, 
  archiveDemoBusiness, 
  deleteDemoBusiness 
} from "@/lib/actions/demo-generator";
import { 
  Sparkles, Search, SlidersHorizontal, Eye, Copy, ExternalLink, 
  Pause, Play, Calendar, Archive, Trash2, CheckCircle2, XCircle, 
  AlertTriangle, RefreshCw, PlusCircle, ArrowUpDown, Loader2 
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function DemosCRMPage() {
  const [demos, setDemos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [followUpStatus, setFollowUpStatus] = useState("all");
  const [converted, setConverted] = useState<string>("all");

  useEffect(() => {
    fetchDemos();
  }, [status, followUpStatus, converted]);

  const fetchDemos = async () => {
    setLoading(true);
    try {
      const convFilter = converted === "true" ? true : converted === "false" ? false : undefined;
      const data = await getDemoBusinesses({
        status: status !== "all" ? status : undefined,
        followUpStatus: followUpStatus !== "all" ? followUpStatus : undefined,
        converted: convFilter,
        search: search.trim() || undefined,
      });
      setDemos(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load demo list.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDemos();
  };

  const copyDemoLink = (slug: string) => {
    const link = `${window.location.origin}/demo/${slug}`;
    navigator.clipboard.writeText(link);
    toast.success("Demo link copied to clipboard!");
  };

  // Quick Action triggers
  const handleExtend = async (id: string) => {
    const res = await extendDemoBusiness(id);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Demo preview extended by 14 days!");
      fetchDemos();
    }
  };

  const handleTogglePause = async (id: string, isCurrentlyPaused: boolean) => {
    const res = await pauseDemoBusiness(id, !isCurrentlyPaused);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(isCurrentlyPaused ? "Demo reactivated successfully!" : "Demo assistant paused.");
      fetchDemos();
    }
  };

  const handleArchive = async (id: string) => {
    const res = await archiveDemoBusiness(id);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Demo archived.");
      fetchDemos();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this demo and all associated logs?")) return;
    const res = await deleteDemoBusiness(id);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Demo deleted successfully.");
      fetchDemos();
    }
  };

  const getStatusBadge = (demoStatus: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    if (demoStatus === "converted") {
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Converted</span>;
    }
    if (demoStatus === "archived") {
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">Archived</span>;
    }
    if (demoStatus === "paused") {
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Paused</span>;
    }
    if (isExpired || demoStatus === "expired") {
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">Expired</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>;
  };

  const getFollowUpBadge = (fStatus: string) => {
    switch (fStatus) {
      case "converted":
        return <span className="text-xs font-semibold text-purple-400">Converted</span>;
      case "contacted":
        return <span className="text-xs font-semibold text-blue-400">Contacted</span>;
      case "interested":
        return <span className="text-xs font-semibold text-emerald-400">Interested</span>;
      case "not_interested":
        return <span className="text-xs font-semibold text-red-400">Not Interested</span>;
      case "follow_up_later":
        return <span className="text-xs font-semibold text-amber-400">Follow Up Later</span>;
      default:
        return <span className="text-xs font-semibold text-slate-500">Not Contacted</span>;
    }
  };

  const formatShortDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2">Demo CRM & Pipeline</h1>
          <p className="text-slate-400 text-sm">
            Track engagement, follow up with business owners, and convert prospects.
          </p>
        </div>
        <Link href="/admin/demo-generator">
          <button className="px-5 py-2.5 rounded-xl bg-indigo-650 hover:bg-indigo-600 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-950/20 transition-all cursor-pointer">
            <PlusCircle className="w-4 h-4" />
            Create Demo Assistant
          </button>
        </Link>
      </div>

      {/* Search and Filters panel */}
      <div className="bg-slate-950/65 border border-slate-850 p-6 rounded-2xl">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          
          {/* Search Input */}
          <div className="md:col-span-4 space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Search Leads</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Business Name, URL, or Email..."
                className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-all"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Status Select */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="expired">Expired</option>
              <option value="archived">Archived</option>
              <option value="converted">Converted</option>
            </select>
          </div>

          {/* Followup Status Select */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Follow-Up</label>
            <select
              value={followUpStatus}
              onChange={(e) => setFollowUpStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-all"
            >
              <option value="all">All Follow-ups</option>
              <option value="not_contacted">Not Contacted</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="not_interested">Not Interested</option>
              <option value="follow_up_later">Follow Up Later</option>
              <option value="converted">Converted</option>
            </select>
          </div>

          {/* Claimed Select */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Claimed</label>
            <select
              value={converted}
              onChange={(e) => setConverted(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-all"
            >
              <option value="all">All Leads</option>
              <option value="true">Claimed / Converted</option>
              <option value="false">Unclaimed Only</option>
            </select>
          </div>

          {/* Search Button */}
          <div className="md:col-span-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Apply Search
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setFollowUpStatus("all");
                setConverted("all");
                setTimeout(fetchDemos, 100);
              }}
              className="bg-slate-950 p-2.5 border border-slate-850 hover:bg-slate-900 text-slate-400 rounded-xl cursor-pointer"
              title="Reset Filters"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

        </form>
      </div>

      {/* CRM Pipeline Table */}
      <div className="bg-slate-950/65 border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto min-w-full">
          {loading ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-slate-400 text-sm font-semibold">Filtering pipeline database...</p>
            </div>
          ) : demos.length > 0 ? (
            <table className="w-full text-left min-w-[1000px]">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-850 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="px-6 py-4 whitespace-nowrap">Business / Website</th>
                  <th className="px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">Visits</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">Convs</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">Leads</th>
                  <th className="px-6 py-4 whitespace-nowrap">Follow-Up</th>
                  <th className="px-6 py-4 whitespace-nowrap">Expires</th>
                  <th className="px-6 py-4 whitespace-nowrap">Last Active</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 bg-slate-900/10">
                {demos.map((demo) => {
                  const isPaused = demo.status === "paused";
                  const isExpired = new Date(demo.expires_at) < new Date() || demo.status === "expired";
                  const demoAbsoluteUrl = `${window.location.origin}${demo.demo_url}`;
                  
                  return (
                    <tr key={demo.id} className="hover:bg-slate-950/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <Link href={`/admin/demos/${demo.id}`} className="font-extrabold text-white text-sm hover:text-indigo-400 transition-colors">
                            {demo.business_name}
                          </Link>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <a
                              href={demo.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-0.5"
                            >
                              {demo.website_url.replace(/https?:\/\/(www\.)?/, "")}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(demo.status, demo.expires_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-slate-300">
                        {demo.page_view_count || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-slate-300">
                        {demo.conversation_count || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        {demo.lead_count > 0 ? (
                          <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-xs font-bold rounded-lg">
                            {demo.lead_count}
                          </span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getFollowUpBadge(demo.follow_up_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-semibold">
                        {demo.status === "converted" ? "Claimed" : formatShortDate(demo.expires_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-semibold">
                        {formatShortDate(demo.last_activity_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          
                          {/* CRM detail */}
                          <Link href={`/admin/demos/${demo.id}`}>
                            <button
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                              title="View detail / CRM notes"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </Link>

                          {/* Copy Link */}
                          <button
                            onClick={() => copyDemoLink(demo.demo_slug)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="Copy demo link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Open hosted chatbot */}
                          <a
                            href={demo.demo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <button
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400 hover:text-indigo-300 transition-colors"
                              title="Open chatbot interface"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </a>

                          {/* Pause / Play */}
                          {demo.status !== "converted" && demo.status !== "archived" && (
                            <button
                              onClick={() => handleTogglePause(demo.id, isPaused)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 hover:text-amber-300 transition-colors"
                              title={isPaused ? "Play / Resume Demo" : "Pause Demo assistant"}
                            >
                              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Extend Demo */}
                          {demo.status !== "converted" && demo.status !== "archived" && (
                            <button
                              onClick={() => handleExtend(demo.id)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:text-emerald-300 transition-colors"
                              title="Extend Demo by 14 days"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Archive */}
                          {demo.status !== "converted" && demo.status !== "archived" && (
                            <button
                              onClick={() => handleArchive(demo.id)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
                              title="Archive Demo"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(demo.id)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete Demo completely"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-20 text-center space-y-4">
              <Sparkles className="w-12 h-12 text-slate-800 mx-auto" />
              <h3 className="font-extrabold text-white text-base">No prospective demos found</h3>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">
                Try refining your search, changing statuses, or click below to generate a new prospect assistant.
              </p>
              <Link href="/admin/demo-generator" className="inline-block mt-4">
                <button className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
                  <PlusCircle className="w-4 h-4" />
                  Generate First Demo
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
