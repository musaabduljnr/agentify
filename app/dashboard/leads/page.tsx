import { Button } from "@/components/ui/button";
import { 
  Search, 
  Filter, 
  Download, 
  MoreVertical,
  Mail,
  Phone,
  Calendar
} from "lucide-react";
import { leads } from "@/lib/mock-data";

export default function LeadsPage() {
  return (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Leads</h1>
          <p className="text-slate-500">View and manage potential customers captured by your AI.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-2xl h-12 px-6 flex items-center gap-2 font-bold border-2 border-slate-200">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 px-6 flex items-center gap-2 font-bold">
            Add New Lead
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search leads by name, email..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            />
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0">
            {["All Leads", "New", "Contacted", "Qualified", "Closed"].map((tab) => (
              <button 
                key={tab} 
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                  tab === "All Leads" ? "bg-slate-900 text-white" : "bg-white text-slate-400 hover:bg-slate-50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-5">Contact</th>
                <th className="px-8 py-5">Contact Info</th>
                <th className="px-8 py-5">Interest</th>
                <th className="px-8 py-5">Source</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                        {lead.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="font-bold text-slate-900 text-sm">{lead.name}</div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <Mail className="w-3 h-3" /> {lead.email}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <Phone className="w-3 h-3" /> {lead.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-2 py-1 text-[9px] font-bold rounded-lg uppercase tracking-widest ${
                      lead.interest === "High" ? "bg-red-50 text-red-600" :
                      lead.interest === "Medium" ? "bg-orange-50 text-orange-600" :
                      "bg-blue-50 text-blue-600"
                    }`}>
                      {lead.interest} Interest
                    </span>
                  </td>
                  <td className="px-8 py-6 text-sm text-slate-500 font-medium">{lead.source}</td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        lead.status === "New" ? "bg-indigo-500" :
                        lead.status === "Contacted" ? "bg-blue-400" :
                        lead.status === "Qualified" ? "bg-green-500" :
                        "bg-slate-300"
                      }`}></div>
                      <span className="text-sm font-bold text-slate-700">{lead.status}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing <span className="text-slate-900">4</span> out of <span className="text-slate-900">128</span> leads
          </p>
          <div className="flex items-center gap-2">
            {[1, 2, 3, "...", 12].map((p, i) => (
              <button 
                key={i} 
                className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${
                  p === 1 ? "bg-indigo-600 text-white" : "bg-white text-slate-400 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
