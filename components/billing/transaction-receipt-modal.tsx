"use client";

import { Printer, X, CheckCircle2, AlertTriangle, Clock, ShieldCheck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TransactionDetails {
  id: string;
  reference: string;
  created_at: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  businessName?: string;
  contactEmail?: string;
  billingAddress?: string;
}

interface TransactionReceiptModalProps {
  transaction: TransactionDetails | null;
  onClose: () => void;
}

export function TransactionReceiptModal({ transaction, onClose }: TransactionReceiptModalProps) {
  if (!transaction) return null;

  const txDate = new Date(transaction.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const formattedAmount =
    transaction.currency === "NGN"
      ? `₦${Number(transaction.amount).toLocaleString()}`
      : `${transaction.currency} ${Number(transaction.amount).toLocaleString()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-6 sm:p-10 relative animate-in slide-in-from-bottom-4 border border-slate-200 print:shadow-none print:border-none print:w-full print:max-w-none print:p-0">
        
        {/* Header (No-print controls) */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-bold text-slate-800">Official Payment Receipt</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div className="py-6 space-y-6">
          {/* Brand header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-black text-slate-900 tracking-tight">Agentify</span>
              </div>
              <p className="text-xs text-slate-400">Agentify AI Customer Engagement Platform</p>
              <p className="text-xs text-slate-400">billing@agentifyhq.com</p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                transaction.status === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : transaction.status === "pending"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {transaction.status === "success" && <CheckCircle2 className="w-3.5 h-3.5" />}
                {transaction.status === "pending" && <Clock className="w-3.5 h-3.5" />}
                {transaction.status === "failed" && <AlertTriangle className="w-3.5 h-3.5" />}
                {transaction.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 uppercase font-bold tracking-wider text-[10px] block mb-1">Billed To</span>
              <p className="font-bold text-slate-800">{transaction.businessName || "Business Owner"}</p>
              <p className="text-slate-500">{transaction.contactEmail || "—"}</p>
              {transaction.billingAddress && (
                <p className="text-slate-500 mt-0.5">{transaction.billingAddress}</p>
              )}
            </div>
            <div className="text-right">
              <span className="text-slate-400 uppercase font-bold tracking-wider text-[10px] block mb-1">Payment Reference</span>
              <p className="font-mono text-slate-700 font-semibold select-all text-[11px]">{transaction.reference}</p>
              <span className="text-slate-400 uppercase font-bold tracking-wider text-[10px] block mt-2 mb-0.5">Date & Time</span>
              <p className="text-slate-600">{txDate}</p>
            </div>
          </div>

          {/* Line item summary */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Item & Description</th>
                  <th className="py-3 px-4 text-center">Provider</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-4 px-4">
                    <p className="font-bold text-slate-900 capitalize">Agentify {transaction.plan} Plan</p>
                    <p className="text-slate-400 text-[11px]">30-day recurring subscription access</p>
                  </td>
                  <td className="py-4 px-4 text-center capitalize text-slate-500 font-medium">
                    {transaction.provider}
                  </td>
                  <td className="py-4 px-4 text-right font-extrabold text-slate-900 text-sm">
                    {formattedAmount}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500">Total Paid</span>
            <span className="text-xl font-black text-slate-900">{formattedAmount}</span>
          </div>
        </div>

        {/* Footer controls (No-print) */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 print:hidden">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-2xl h-10 px-5 text-xs font-bold border-slate-200"
          >
            Close
          </Button>
          <Button
            onClick={handlePrint}
            className="rounded-2xl h-10 px-5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Receipt / PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
