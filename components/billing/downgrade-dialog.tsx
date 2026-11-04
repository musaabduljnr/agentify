"use client";

import { useState } from "react";
import { AlertCircle, ArrowDownRight, X } from "lucide-react";
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

  if (isScheduled) {
    return (
      <div className="space-y-3">
        <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-950">Downgrade Scheduled</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Review or change this schedule through the Manage Billing control. Agentify updates plan access only after provider-confirmed billing events.
            </p>
          </div>
        </div>

        <Button
          onClick={() => setOpen(false)}
          variant="outline"
          className="w-full h-11 rounded-2xl border-2 border-amber-200 text-amber-800 hover:bg-amber-100/50 font-bold text-xs"
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <>
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
              onClick={() => setOpen(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5 text-amber-600">
              <ArrowDownRight className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 mb-2">
              Manage a downgrade through Bachs
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Use the Manage Billing control to schedule a plan change. Agentify does not change your plan or quotas from this dialog; access changes only after Bachs confirms the related billing event.
            </p>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 mb-6">
              <p className="text-xs font-bold text-slate-700">Billing authority</p>
              <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                <li>Current plan: {currentPlan}</li>
                <li>Requested plan: {targetPlan} ({targetPrice})</li>
                <li>Current billing period ends: {periodEndDate}</li>
              </ul>
            </div>

            <div className="flex">
              <Button
                onClick={() => setOpen(false)}
                className="flex-1 h-11 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
