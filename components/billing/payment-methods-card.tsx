"use client";

import { useState } from "react";
import { CreditCard, ShieldCheck, Lock, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentMethodsCardProps {
  lastTransaction?: any;
  hasActiveCustomer?: boolean;
}

export function PaymentMethodsCard({ hasActiveCustomer }: PaymentMethodsCardProps) {
  const [openingPortal, setOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const handleOpenPortal = async () => {
    setOpeningPortal(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Could not launch billing portal.");
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error("Portal launch error:", err);
      setPortalError(err.message || "Failed to launch billing portal.");
      setOpeningPortal(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Payment Methods</h3>
            <p className="text-xs text-slate-500">Securely processed in USD via Bachs</p>
          </div>
        </div>

        {hasActiveCustomer && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenPortal}
            disabled={openingPortal}
            className="rounded-xl border-slate-200 text-xs font-semibold gap-1.5 hover:bg-slate-50"
          >
            {openingPortal ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>Manage in Portal</span>
          </Button>
        )}
      </div>

      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-bold text-slate-800">Bachs Recurring USD Card Billing</p>
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
            USD Only
          </span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Subscriptions are billed automatically to your saved card every month. You can update your payment method, view receipts, and download past invoices anytime in the Bachs customer portal.
        </p>
      </div>

      {portalError && (
        <p className="mb-4 text-xs text-red-600 font-medium">
          {portalError}
        </p>
      )}

      {/* Security Notice */}
      <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/80 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-indigo-900 font-bold">
          <Lock className="w-3.5 h-3.5 text-indigo-600" />
          <span>PCI-DSS Level 1 Compliant</span>
        </div>
        <p className="text-slate-600 leading-relaxed text-[11px]">
          Agentify never stores your credit card numbers, CVVs, or sensitive credentials in our database. All card handling is securely tokenized and processed through Bachs.
        </p>
      </div>
    </div>
  );
}
