import { getAllSubscriptions } from "@/lib/actions/admin";
import { SubscriptionsTable } from "@/components/admin/subscriptions-table";
import { KeyRound } from "lucide-react";

export default async function AdminSubscriptionsPage() {
  const subscriptions = await getAllSubscriptions();

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
            Subscriptions Management
          </h1>
          <p className="text-slate-400 text-sm">
            Audit subscription logs, change active tiers manually, reset AI quota usages, and suspend access.
          </p>
        </div>
      </div>

      {/* Interactive Client-Side Subscriptions Table */}
      <SubscriptionsTable initialSubscriptions={subscriptions} />
    </div>
  );
}
