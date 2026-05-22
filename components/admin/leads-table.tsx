"use client";

import { useState } from "react";
import {
  Search,
  Calendar,
  Contact2,
  X,
  Mail,
  Phone,
  User,
  ShieldAlert,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeadsTableProps {
  initialLeads: any[];
}

export function LeadsTable({ initialLeads }: LeadsTableProps) {
  const [leads] = useState(initialLeads);
  const [searchTerm, setSearchTerm] = useState("");
  const [intentFilter, setIntentFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  // Search & Filter Logic
  const filtered = leads.filter((lead) => {
    const nameStr = (lead.name || "").toLowerCase();
    const emailStr = (lead.email || "").toLowerCase();
    const matchesSearch =
      nameStr.includes(searchTerm.toLowerCase()) ||
      emailStr.includes(searchTerm.toLowerCase()) ||
      (lead.businesses?.name || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesIntent = intentFilter === "all" || lead.buying_intent === intentFilter;

    return matchesSearch && matchesIntent;
  });

  return (
    <div className="space-y-6">
      {/* Search & Intent Filter controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-950 p-6 rounded-3xl border border-slate-800">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search email, name or business..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex gap-2 shrink-0">
          {["all", "high", "medium", "low"].map((intent) => (
            <button
              key={intent}
              onClick={() => setIntentFilter(intent)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                intentFilter === intent
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                  : "bg-slate-900 border-slate-850 text-slate-400 hover:text-white"
              }`}
            >
              {intent === "all" ? "All Intent" : `${intent} Intent`}
            </button>
          ))}
        </div>
      </div>

      {/* Main Leads Table Panel */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">Lead Coordinates</th>
                  <th className="py-4 px-6">Business Partner</th>
                  <th className="py-4 px-6">Phone Number</th>
                  <th className="py-4 px-6">Buying Intent Grade</th>
                  <th className="py-4 px-6">Collected Origin</th>
                  <th className="py-4 px-6">Collection Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filtered.map((lead) => {
                  const leadDate = new Date(lead.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <tr key={lead.id} className="text-slate-350 hover:bg-slate-900/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-white text-sm">
                            {lead.name || "Anonymous Visitor"}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium font-mono select-all block mt-0.5">
                          {lead.email}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-300">
                        {lead.businesses?.name || "Deleted Business"}
                      </td>
                      <td className="py-4 px-6 font-mono text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          {lead.phone || "—"}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest ${
                            lead.buying_intent === "high"
                              ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                              : lead.buying_intent === "medium"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          {lead.buying_intent || "low"}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium capitalize text-slate-400">
                        {lead.metadata?.source || "Widget Prompt"}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {leadDate}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Button
                          onClick={() => setSelectedLead(lead)}
                          variant="ghost"
                          className="rounded-xl h-9 text-[10px] font-bold uppercase tracking-wider border border-slate-850 hover:bg-slate-900 hover:text-white"
                        >
                          Inspect
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
            <p className="text-sm">No visitor leads found matching criteria.</p>
          </div>
        )}
      </div>

      {/* Lead Info Inspector Modal Overlay */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg h-full bg-slate-950 border-l border-slate-800 p-8 overflow-y-auto flex flex-col justify-between relative shadow-2xl">
            <div>
              {/* Top Controls */}
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                    <Contact2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-white">Lead Details</h2>
                    <p className="text-[10px] font-medium text-indigo-400 uppercase tracking-wider">
                      Visitor Contact Record
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Specs Grid */}
              <div className="space-y-6">
                {/* Panel 1: Profile card */}
                <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-850 text-xs">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Contact Card coordinates
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-slate-500 font-semibold">Visitor Name</p>
                      <p className="text-white font-bold text-sm">{selectedLead.name || "Anonymous Visitor"}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-semibold">Email Address</p>
                      <p className="text-indigo-400 font-bold flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        {selectedLead.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-semibold">Phone Number</p>
                      <p className="text-white font-bold flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {selectedLead.phone || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Panel 2: AI intent extraction summary */}
                <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-850 text-xs">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    Buying intent metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-slate-500 font-semibold">Intent Grade</p>
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-1 ${
                        selectedLead.buying_intent === "high"
                          ? "bg-rose-500/15 text-rose-400"
                          : selectedLead.buying_intent === "medium"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-slate-900 text-slate-400"
                      }`}>
                        {selectedLead.buying_intent || "low"} Intent
                      </span>
                    </div>
                    <div>
                      <p className="text-slate-500 font-semibold">Linked Business</p>
                      <p className="text-white font-bold mt-1.5">{selectedLead.businesses?.name}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-500 font-semibold mb-1">AI intent analysis details</p>
                    <p className="text-slate-300 leading-relaxed italic bg-slate-950 p-4 rounded-xl border border-slate-900">
                      {selectedLead.intent_summary || "No AI intent explanation logged for this contact profile."}
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Bottom Controls */}
            <div className="pt-6 border-t border-slate-900 mt-6">
              <Button
                onClick={() => setSelectedLead(null)}
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
