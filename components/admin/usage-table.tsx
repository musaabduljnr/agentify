"use client";

import { useState } from "react";
import { Search, Calendar, Activity, Info, BarChart2, Layers } from "lucide-react";

interface UsageTableProps {
  initialLogs: any[];
}

export function UsageTable({ initialLogs }: UsageTableProps) {
  const [logs] = useState(initialLogs);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Search & Filter Logic
  const filtered = logs.filter((log) => {
    const matchesSearch = (log.businesses?.name || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "all" || log.type === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter Top bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-950 p-6 rounded-3xl border border-slate-800">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search business name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex gap-2 shrink-0">
          {["all", "message", "embedding", "lead", "knowledge_source"].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                typeFilter === type
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                  : "bg-slate-900 border-slate-850 text-slate-400 hover:text-white"
              }`}
            >
              {type === "all" ? "All Logs" : type.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Usage Logs Panel */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6 whitespace-nowrap">Business Name</th>
                  <th className="py-4 px-6 whitespace-nowrap">Resource Type</th>
                  <th className="py-4 px-6 whitespace-nowrap">Consumption Amount</th>
                  <th className="py-4 px-6 whitespace-nowrap">Trace Logs Metadata</th>
                  <th className="py-4 px-6 text-right whitespace-nowrap">Audit Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filtered.map((log) => {
                  const logDate = new Date(log.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={log.id} className="text-slate-350 hover:bg-slate-900/30 transition-colors">
                      <td className="py-4 px-6 font-extrabold text-white text-sm whitespace-nowrap">
                        {log.businesses?.name || "Deleted Business"}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider whitespace-nowrap ${
                            log.type === "message"
                              ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                              : log.type === "embedding"
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                              : log.type === "lead"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          {log.type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-white text-sm whitespace-nowrap">
                        +{log.amount.toLocaleString()} units
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <code className="text-xs text-slate-500 font-mono select-all bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-850 block max-w-xs truncate whitespace-nowrap">
                          {JSON.stringify(log.metadata || {})}
                        </code>
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-slate-400 whitespace-nowrap">
                        <span className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {logDate}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500">
            <p className="text-sm">No activity logs recorded matching criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
