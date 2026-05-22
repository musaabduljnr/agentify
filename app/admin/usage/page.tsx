import { getAllUsageLogs } from "@/lib/actions/admin";
import { UsageTable } from "@/components/admin/usage-table";
import { Activity } from "lucide-react";

export default async function AdminUsagePage() {
  const logs = await getAllUsageLogs();

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
            Usage Audits
          </h1>
          <p className="text-slate-400 text-sm">
            Monitor API activity logs, analyze AI model call records, and trace business quota integrations in real time.
          </p>
        </div>
      </div>

      {/* Interactive Client-Side Usage Table */}
      <UsageTable initialLogs={logs} />
    </div>
  );
}
