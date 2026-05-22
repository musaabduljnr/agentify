"use client";

import { useState } from "react";
import { verifyPaymentReference } from "@/lib/actions/payments";
import {
  Search,
  CreditCard,
  RefreshCw,
  Eye,
  Calendar,
  X,
  Loader2,
  Code,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentsTableProps {
  initialPayments: any[];
}

export function PaymentsTable({ initialPayments }: PaymentsTableProps) {
  const [payments, setPayments] = useState(initialPayments);
  const [searchTerm, setSearchTerm] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadingRef, setLoadingRef] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<any | null>(null);
  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Search & Filter Logic
  const filtered = payments.filter((tx) => {
    const matchesSearch =
      tx.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.businesses?.name || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProvider = providerFilter === "all" || tx.provider === providerFilter;
    const matchesStatus = statusFilter === "all" || tx.status === statusFilter;

    return matchesSearch && matchesProvider && matchesStatus;
  });

  const handleReverify = async (reference: string) => {
    setLoadingRef(reference);
    setAlertMessage(null);
    try {
      const result = await verifyPaymentReference(reference);
      if (result.success) {
        setAlertMessage({
          type: "success",
          text: `Transaction ${reference} verified successfully! Status: UPGRADED`,
        });

        // Update local state
        setPayments((prev) =>
          prev.map((tx) => (tx.reference === reference ? { ...tx, status: "success" } : tx))
        );
      } else {
        throw new Error(result.error || "Failed to verify transaction.");
      }
    } catch (err: any) {
      setAlertMessage({
        type: "error",
        text: err.message || "An unexpected error occurred during reverification.",
      });
    } finally {
      setLoadingRef(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Double Filter Controls */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-950 p-6 rounded-3xl border border-slate-800">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search reference or business..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Provider Filter */}
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Providers</option>
            <option value="paystack">Paystack</option>
            <option value="flutterwave">Flutterwave</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {alertMessage && (
        <div
          className={`p-4 border rounded-2xl text-xs font-semibold ${
            alertMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          {alertMessage.text}
        </div>
      )}

      {/* Main Ledger Table Panel */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">Business Identity</th>
                  <th className="py-4 px-6">Gateway Provider</th>
                  <th className="py-4 px-6">Transaction Reference</th>
                  <th className="py-4 px-6">Target Plan</th>
                  <th className="py-4 px-6">Amount Billed</th>
                  <th className="py-4 px-6">Transaction Status</th>
                  <th className="py-4 px-6">Created Date</th>
                  <th className="py-4 px-6 text-right">Actions Panel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filtered.map((tx) => {
                  const txDate = new Date(tx.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <tr key={tx.id} className="text-slate-350 hover:bg-slate-900/30 transition-colors">
                      <td className="py-4 px-6 font-extrabold text-white text-sm">
                        {tx.businesses?.name || "Deleted Business"}
                      </td>
                      <td className="py-4 px-6 font-medium capitalize text-slate-400">
                        {tx.provider}
                      </td>
                      <td className="py-4 px-6 font-mono text-slate-400 select-all">
                        {tx.reference}
                      </td>
                      <td className="py-4 px-6 capitalize font-semibold text-slate-300">
                        {tx.plan}
                      </td>
                      <td className="py-4 px-6 font-black text-white text-sm">
                        ₦{tx.amount.toLocaleString()}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                            tx.status === "success"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : tx.status === "pending"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                              : "bg-red-500/10 border-red-500/20 text-red-400"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {txDate}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        {/* View JSON payload details */}
                        <Button
                          onClick={() => setSelectedResponse(tx.raw_response)}
                          variant="ghost"
                          title="Inspect Gateway Payload"
                          className="rounded-xl h-9 text-[10px] font-bold border border-slate-850 hover:bg-slate-900"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>

                        {/* Reverify trigger button */}
                        {tx.status === "pending" && (
                          <Button
                            onClick={() => handleReverify(tx.reference)}
                            disabled={loadingRef === tx.reference}
                            variant="ghost"
                            className="rounded-xl h-9 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20 text-indigo-400 hover:border-indigo-500/40 hover:bg-slate-900"
                          >
                            {loadingRef === tx.reference ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                Verify
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500">
            <p className="text-sm">No transaction records found matching filter criteria.</p>
          </div>
        )}
      </div>

      {/* Raw Payload Modal overlay */}
      {selectedResponse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-3xl p-6 relative shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-6 border-b border-slate-900 pb-4">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Inspect JSON Response Payload
                </h3>
              </div>
              <button
                onClick={() => setSelectedResponse(null)}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded-2xl bg-slate-900 border border-slate-850 p-5 font-mono text-xs text-indigo-300">
              <pre className="whitespace-pre-wrap select-all">
                {JSON.stringify(selectedResponse, null, 2)}
              </pre>
            </div>

            <div className="pt-4 border-t border-slate-900 mt-4 text-right">
              <Button
                onClick={() => setSelectedResponse(null)}
                className="bg-slate-900 border border-slate-850 text-slate-300 hover:text-white rounded-2xl h-11 px-6 font-bold"
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
