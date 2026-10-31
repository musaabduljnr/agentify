"use client";

import { useState, useTransition } from "react";
import { requestDowngrade, cancelPendingDowngrade } from "@/lib/actions/billing";
import { AlertCircle, ArrowDownRight, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DowngradeDialogProps {
  currentPlan: string;
  targetPlan: "starter";
  targetPrice: string;
  periodEndDate: string;
  isScheduled: boolean;
}

export function DowngradeDialog({
  currentPlan,
  targetPlan,
  targetPrice,
  periodEndDate,
  isScheduled,
}: DowngradeDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRequestDowngrade = () => {
    if (!confirmed) return;
    startTransition(async () => {
      setMessage(null);
      const res = await requestDowngrade(targetPlan);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: res.message || "Downgrade scheduled successfully." });
        setOpen(false);
        setConfirmed(false);
      }
    });
  };

  const handleCancelDowngrade = () => {
    startTransition(async () => {
      setMessage(null);
      const res = await cancelPendingDowngrade();
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: res.message || "Scheduled downgrade cancelled." });
      }
    });
  };

  if (isScheduled) {
    return (
      <div className="space-y-3">
        <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-950">Downgrade Scheduled</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Your plan will switch to <strong className="capitalize">{targetPlan}</strong> ({targetPrice}) at the end of your billing cycle on <strong>{periodEndDate}</strong>. You continue to enjoy your current {currentPlan} benefits until then.
            </p>
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        <Button
          onClick={handleCancelDowngrade}
          disabled={isPending}
          variant="outline"
          className="w-full h-11 rounded-2xl border-2 border-amber-200 text-amber-800 hover:bg-amber-100/50 font-bold text-xs"
        >
          {isPending ? "Cancelling Downgrade..." : "Cancel Scheduled Downgrade"}
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
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full h-11 rounded-2xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs"
      >
        <ArrowDownRight className="w-4 h-4 mr-1 text-slate-500" />
        Downgrade to Starter
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 relative animate-in slide-in-from-bottom-4 border border-slate-100">
            <button
              onClick={() => {
                setOpen(false);
                setConfirmed(false);
              }}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5 text-amber-600">
              <ArrowDownRight className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 mb-2">
              Downgrade to Starter?
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Your plan will remain on <strong className="capitalize">{currentPlan}</strong> until your current period ends on <strong>{periodEndDate}</strong>. Starting on that date, you will be charged <strong>{targetPrice}</strong> and your quotas will adjust to Starter (200 AI replies, 1 assistant, 25 knowledge sources, 50 leads).
            </p>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 mb-6">
              <p className="text-xs font-bold text-slate-700">What happens on downgrade:</p>
              <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                <li>No immediate charge or refund</li>
                <li>Full access to your current plan until {periodEndDate}</li>
                <li>Can cancel or switch anytime before then</li>
              </ul>
            </div>

            <label className="flex items-start gap-3 cursor-pointer mb-6 select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span className="text-xs text-slate-600 leading-normal">
                I understand that my plan limits will reduce at the end of the billing cycle.
              </span>
            </label>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setConfirmed(false);
                }}
                className="flex-1 h-11 rounded-2xl border-2 border-slate-200 font-bold text-xs"
              >
                Keep Current Plan
              </Button>
              <Button
                disabled={!confirmed || isPending}
                onClick={handleRequestDowngrade}
                className="flex-1 h-11 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
              >
                {isPending ? "Scheduling..." : "Confirm Downgrade"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
