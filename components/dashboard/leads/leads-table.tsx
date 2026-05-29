"use client";

import { useState } from "react";
import { 
  Search, 
  MoreVertical,
  Mail,
  Phone,
  Calendar,
  ExternalLink,
  Trash2,
  FileText,
  User as UserIcon,
  Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateLeadStatus, updateLeadNotes, deleteLead } from "@/lib/actions/leads";
import { toast } from "sonner";
import { format } from "date-fns";

interface Lead {
  id: string;
  business_id: string;
  conversation_id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  interest: string;
  status: "new" | "contacted" | "qualified" | "converted" | "closed";
  source: string;
  notes: string;
  metadata: any;
  created_at: string;
}

export function LeadsTable({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredLeads = leads.filter(l => {
    const matchesSearch = 
      (l.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.company?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "All" || l.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    const res = await updateLeadStatus(leadId, newStatus);
    if (res.success) {
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus as any } : l));
      if (selectedLead?.id === leadId) setSelectedLead({ ...selectedLead, status: newStatus as any });
      toast.success("Lead status updated");
    } else {
      toast.error("Failed to update status");
    }
  };

  const handleNotesUpdate = async (leadId: string, notes: string) => {
    const res = await updateLeadNotes(leadId, notes);
    if (res.success) {
      setLeads(leads.map(l => l.id === leadId ? { ...l, notes } : l));
      toast.success("Notes updated");
    }
  };

  const handleDelete = async (leadId: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    const res = await deleteLead(leadId);
    if (res.success) {
      setLeads(leads.filter(l => l.id !== leadId));
      setSelectedLead(null);
      toast.success("Lead deleted");
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search leads..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
          />
        </div>
        <div className="flex items-center gap-3 overflow-x-auto flex-nowrap scrollbar-none pb-2 md:pb-0">
          {["All", "New", "Contacted", "Qualified", "Converted", "Closed"].map((tab) => (
            <button 
              key={tab} 
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                statusFilter === tab ? "bg-slate-900 text-white" : "bg-white text-slate-400 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th className="px-8 py-5 whitespace-nowrap">Contact</th>
              <th className="px-8 py-5 whitespace-nowrap">Contact Info</th>
              <th className="px-8 py-5 whitespace-nowrap">Intent</th>
              <th className="px-8 py-5 whitespace-nowrap">Status</th>
              <th className="px-8 py-5 text-right whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredLeads.map((lead) => (
              <tr 
                key={lead.id} 
                onClick={() => setSelectedLead(lead)}
                className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
              >
                <td className="px-8 py-6 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                      {(lead.name || "A").split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{lead.name || "Anonymous"}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{lead.company || "No Company"}</div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6 whitespace-nowrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <Mail className="w-3 h-3" /> {lead.email || "No email"}
                    </div>
                    {lead.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <Phone className="w-3 h-3" /> {lead.phone}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-8 py-6 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span className="px-2 py-1 text-[9px] font-bold rounded-lg uppercase tracking-widest bg-blue-50 text-blue-600 w-fit">
                      {lead.metadata?.intent_type || "General Inquiry"}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                      {lead.interest || "No specific interest"}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      lead.status === "new" ? "bg-indigo-500" :
                      lead.status === "contacted" ? "bg-blue-400" :
                      lead.status === "qualified" ? "bg-green-500" :
                      lead.status === "converted" ? "bg-emerald-600" :
                      "bg-slate-300"
                    }`}></div>
                    <span className="text-sm font-bold text-slate-700 capitalize">{lead.status}</span>
                  </div>
                </td>
                <td className="px-8 py-6 text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredLeads.length === 0 && (
          <div className="p-20 text-center text-slate-400 italic">
            No leads found matching your criteria.
          </div>
        )}
      </div>

      {/* Lead Detail Modal - Simplified for brevity but functional */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] sm:max-h-[85vh] flex flex-col">
            <div className="p-5 sm:p-8 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-[1.25rem] bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shadow-lg shadow-indigo-200">
                  {(selectedLead.name || "A").split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h2 className="text-lg sm:text-2xl font-black text-slate-900 truncate">{selectedLead.name || "Anonymous Lead"}</h2>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Lead ID: {selectedLead.id.slice(0, 8)}</p>
                </div>
              </div>
              <Button variant="ghost" className="rounded-2xl" onClick={() => setSelectedLead(null)}>Close</Button>
            </div>
            
            <div className="p-5 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 overflow-y-auto flex-1">
              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Contact Details</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-slate-600">
                      <Mail className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm font-medium">{selectedLead.email || "Not provided"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <Phone className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm font-medium">{selectedLead.phone || "Not provided"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <Tag className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm font-medium">{selectedLead.company || "No company information"}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Intent Intelligence</h4>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">{selectedLead.metadata?.intent_type || "General Inquiry"}</p>
                    <p className="text-sm text-slate-700 font-medium">{selectedLead.interest || "No specific request captured yet."}</p>
                    {selectedLead.metadata?.requested_action && (
                      <div className="mt-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg font-bold w-fit">
                        Action: {selectedLead.metadata.requested_action}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Lead Status</h4>
                  <div className="flex flex-wrap gap-2">
                    {["new", "contacted", "qualified", "converted", "closed"].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(selectedLead.id, s)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                          selectedLead.status === s 
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                            : "bg-white text-slate-400 border border-slate-100 hover:border-slate-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Internal Notes</h4>
                  <textarea 
                    className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium resize-none"
                    placeholder="Add notes about this lead..."
                    defaultValue={selectedLead.notes}
                    onBlur={(e) => handleNotesUpdate(selectedLead.id, e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-8 bg-slate-50 border-t border-slate-100 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  className="rounded-2xl h-11 px-6 font-bold border-2"
                  onClick={() => window.open(`/dashboard/conversations?id=${selectedLead.conversation_id}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Conversation
                </Button>
                <Button 
                  variant="ghost" 
                  className="rounded-2xl h-11 text-red-500 hover:text-red-600 hover:bg-red-50 font-bold"
                  onClick={() => handleDelete(selectedLead.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sm:text-right">
                Captured {format(new Date(selectedLead.created_at), "MMM d, yyyy")} via {selectedLead.source}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
