import { getAllPayments } from "@/lib/actions/admin";
import { PaymentsTable } from "@/components/admin/payments-table";
import { CreditCard } from "lucide-react";

export default async function AdminPaymentsPage() {
  const payments = await getAllPayments();

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
          <CreditCard className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
            Payments Ledger
          </h1>
          <p className="text-slate-400 text-sm">
            Audit gateway transactions, inspect raw JSON response payloads, and trigger manual transaction status verification checks.
          </p>
        </div>
      </div>

      {/* Interactive Client-Side Payments Table */}
      <PaymentsTable initialPayments={payments} />
    </div>
  );
}
