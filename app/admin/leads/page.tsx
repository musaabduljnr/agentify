import { getAllLeads } from "@/lib/actions/admin";
import { LeadsTable } from "@/components/admin/leads-table";
import { Contact2 } from "lucide-react";

export default async function AdminLeadsPage() {
  const leads = await getAllLeads();

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
          <Contact2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
            Leads Control
          </h1>
          <p className="text-slate-400 text-sm">
            Review captured visitor profiles, analyze AI-detected buying intent grades, and audit linked conversation transcripts.
          </p>
        </div>
      </div>

      {/* Interactive Client-Side Leads Table */}
      <LeadsTable initialLeads={leads} />
    </div>
  );
}
