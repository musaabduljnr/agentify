import { Button } from "@/components/ui/button";
import { 
  Download,
} from "lucide-react";
import { getBusinessLeads } from "@/lib/actions/leads";

export const dynamic = "force-dynamic";

import { LeadsTable } from "@/components/dashboard/leads/leads-table";
import { getBusinessBillingContext } from "@/lib/queries/billing";
import { UsageWarningBanner } from "@/components/billing/usage-warning-banner";

export default async function LeadsPage() {
  const [leads, billing] = await Promise.all([
    getBusinessLeads(),
    getBusinessBillingContext(),
  ]);

  const relevantWarnings = (billing?.warnings || []).filter(
    (w: any) => w.type === "leads"
  );

  return (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Leads Intelligence</h1>
          <p className="text-slate-500">View and manage potential customers captured by your AI assistant.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-2xl h-12 px-6 flex items-center gap-2 font-bold border-2 border-slate-200">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <UsageWarningBanner warnings={relevantWarnings} />

      <LeadsTable initialLeads={leads || []} />
    </>
  );
}
