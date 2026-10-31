"use client";

import { useState } from "react";
import { Calendar, Search, Filter, Layers, Receipt, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionReceiptModal, type TransactionDetails } from "./transaction-receipt-modal";

interface BillingHistoryTableProps {
  history: any[];
  businessName?: string;
  contactEmail?: string;
  billingAddress?: string;
}

export function BillingHistoryTable({
  history,
  businessName,
  contactEmail,
  billingAddress,
}: BillingHistoryTableProps) {
  const [selectedTx, setSelectedTx] = useState<TransactionDetails | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredHistory = history.filter((tx) => {
    const matchesSearch =
      tx.reference.toLowerCase().includes(search.toLowerCase()) ||
      tx.plan.toLowerCase().includes(search.toLowerCase()) ||
      String(tx.amount).includes(search);

    const matchesStatus = statusFilter === "all" || tx.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Billing History & Transactions
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              View and download receipts for all your subscriptions and past charges.
            </p>
          </div>

          {/* Search & Filter Controls */}
          {history.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search reference or plan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48 sm:w-56"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-600 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="success">Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          )}
        </div>

        {filteredHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filteredHistory.map((tx) => {
                  const txDate = new Date(tx.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 font-medium text-slate-700 whitespace-nowrap">{txDate}</td>
                      <td className="py-4 px-4 capitalize font-bold text-slate-900 whitespace-nowrap">
                        {tx.plan}
                      </td>
                      <td className="py-4 px-4 capitalize text-slate-500 whitespace-nowrap">{tx.provider}</td>
                      <td className="py-4 px-4 font-black text-slate-900 whitespace-nowrap">
                        {tx.currency === "NGN"
                          ? `₦${Number(tx.amount).toLocaleString()}`
                          : `${tx.currency} ${Number(tx.amount).toLocaleString()}`}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <code className="text-[11px] text-slate-400 font-mono select-all bg-slate-50 px-2 py-1 rounded border border-slate-100">
                          {tx.reference}
                        </code>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider border ${
                            tx.status === "success"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : tx.status === "pending"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {tx.status === "success" && <CheckCircle2 className="w-3 h-3" />}
                          {tx.status === "pending" && <Clock className="w-3 h-3" />}
                          {tx.status === "failed" && <AlertTriangle className="w-3 h-3" />}
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setSelectedTx({
                              ...tx,
                              businessName,
                              contactEmail,
                              billingAddress,
                            })
                          }
                          className="h-8 px-3 rounded-xl text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold text-xs"
                        >
                          <Receipt className="w-3.5 h-3.5 mr-1" />
                          Receipt
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Layers className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600 font-bold">No transactions found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {search || statusFilter !== "all"
                ? "No payment records match your search criteria."
                : "Your completed subscription payments and invoice receipts will appear here."}
            </p>
          </div>
        )}
      </div>

      <TransactionReceiptModal
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </>
  );
}
