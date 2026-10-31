"use client";

import { CreditCard, ShieldCheck, Lock, ExternalLink, Info } from "lucide-react";

interface PaymentMethodsCardProps {
  lastTransaction?: any;
}

export function PaymentMethodsCard({ lastTransaction }: PaymentMethodsCardProps) {
  // Extract authorization info if present from Paystack
  const authorization = lastTransaction?.raw_response?.authorization ||
    lastTransaction?.raw_response?.data?.authorization;

  const cardLast4 = authorization?.last4;
  const cardBrand = authorization?.brand || authorization?.card_type;
  const expMonth = authorization?.exp_month;
  const expYear = authorization?.exp_year;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
          <CreditCard className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">Payment Methods</h3>
          <p className="text-xs text-slate-500">Securely processed via Paystack</p>
        </div>
      </div>

      {cardLast4 ? (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-7 bg-white rounded-lg border border-slate-200 flex items-center justify-center font-black text-[10px] text-slate-700 tracking-wider uppercase shadow-xs">
              {cardBrand || "CARD"}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 font-mono">
                •••• •••• •••• {cardLast4}
              </p>
              {expMonth && expYear && (
                <p className="text-[10px] text-slate-500 font-medium">
                  Expires {expMonth}/{expYear}
                </p>
              )}
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Active
          </span>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 mb-5">
          <p className="text-xs font-bold text-slate-800 mb-0.5">Paystack Recurring Billing</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Payment methods are automatically linked upon completing checkout. We support Visa, Mastercard, Verve, Bank Transfer, and USSD.
          </p>
        </div>
      )}

      {/* Security & Updating Payment Notice */}
      <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/80 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-indigo-900 font-bold">
          <Lock className="w-3.5 h-3.5 text-indigo-600" />
          <span>PCI-DSS Level 1 Compliant</span>
        </div>
        <p className="text-slate-600 leading-relaxed text-[11px]">
          Agentify never stores your card numbers, CVVs, or sensitive credentials on our servers. To update your card or billing account, simply choose a new payment method during your next plan upgrade or checkout renewal.
        </p>
      </div>
    </div>
  );
}
