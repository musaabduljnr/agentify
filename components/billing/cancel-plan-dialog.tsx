"use client";

import { useState, useTransition } from "react";
import { cancelSubscriptionAtPeriodEnd, reactivateSubscription } from "@/lib/actions/billing";
import { AlertTriangle, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CancelPlanDialogProps {
  cancelAtPeriodEnd: boolean;
  periodEndDate: string;
}

export function CancelPlanDialog({ cancelAtPeriodEnd, periodEndDate }: CancelPlanDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    if (!confirmed) return;
    startTransition(async () => {
      const result = await cancelSubscriptionAtPeriodEnd();
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Your subscription will be cancelled at the end of the billing period." });
        setOpen(false);
        setConfirmed(false);
      }
    });
  }

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateSubscription();
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Your subscription has been reactivated successfully." });
      }
    });
  }

  if (cancelAtPeriodEnd) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">Cancellation Scheduled</p>
            <p className="text-xs text-amber-700 mt-1">
              Your plan will be cancelled on <strong>{periodEndDate}</strong>. You keep access until then.
            </p>
          </div>
        </div>
        {message && (
          <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {message.text}
          </div>
        )}
        <Button
          onClick={handleReactivate}
          disabled={isPending}
          className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
        >
          {isPending ? "Reactivating..." : "✓ Keep My Subscription"}
        </Button>
      </div>
    );
  }

  return (
    <>
      {message && (
        <div className={`mb-3 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
          message.type === "success"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full h-11 rounded-2xl border-2 border-red-200 text-red-600 hover:bg-red-50 font-bold text-sm"
      >
        Cancel Subscription
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative animate-in slide-in-from-bottom-4">
            <button
              onClick={() => { setOpen(false); setConfirmed(false); }}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-2">Cancel Your Subscription?</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Your subscription will remain <strong>active until {periodEndDate}</strong>. After that:
            </p>

            <ul className="space-y-2 mb-6">
              {[
                "Your AI assistant will stop responding to visitors",
                "Access to advanced analytics will be removed",
                "Lead capture features will be disabled",
                "Your data will be preserved for 30 days",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
                  {item}
                </li>
              ))}
            </ul>

            <label className="flex items-start gap-3 cursor-pointer mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-red-50 hover:border-red-100 transition-colors group">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="mt-0.5 accent-red-500 w-4 h-4 shrink-0"
              />
              <span className="text-xs font-semibold text-slate-700 group-hover:text-red-700 transition-colors">
                I understand my subscription will be cancelled and the service will stop at the end of the billing period.
              </span>
            </label>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setOpen(false); setConfirmed(false); }}
                className="flex-1 h-11 rounded-2xl border-2 border-slate-200 text-slate-700 font-bold"
              >
                Keep Plan
              </Button>
              <Button
                onClick={handleCancel}
                disabled={!confirmed || isPending}
                className="flex-1 h-11 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-40"
              >
                {isPending ? "Cancelling..." : "Confirm Cancel"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
