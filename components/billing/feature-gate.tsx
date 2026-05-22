"use client";

// ══════════════════════════════════════════════════════════════
// Feature Gate Component
// ══════════════════════════════════════════════════════════════
// Wraps content that requires a certain plan level.
// Shows an upgrade CTA if the business doesn't have access.

import { PLAN_ORDER, type PlanId } from "@/lib/billing/plans";
import { Zap, Lock } from "lucide-react";
import Link from "next/link";

type FeatureGateProps = {
  feature: string;
  requiredPlan: PlanId;
  currentPlan: PlanId;
  children: React.ReactNode;
};

export function FeatureGate({ feature, requiredPlan, currentPlan, children }: FeatureGateProps) {
  const currentIndex = PLAN_ORDER.indexOf(currentPlan);
  const requiredIndex = PLAN_ORDER.indexOf(requiredPlan);

  if (currentIndex >= requiredIndex) {
    return <>{children}</>;
  }

  return (
    <div className="relative rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
      <div className="absolute inset-0 rounded-3xl bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
          <Lock className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">{feature}</h3>
        <p className="text-sm text-slate-500 max-w-sm">
          This feature requires the <span className="font-bold text-indigo-600">{requiredPlan.replace("_", " ")}</span> plan or higher.
        </p>
        <Link
          href="/dashboard/billing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-2xl transition-all shadow-md shadow-indigo-200 hover:shadow-lg"
        >
          <Zap className="w-4 h-4" />
          Upgrade Plan
        </Link>
      </div>
      <div className="opacity-20 pointer-events-none">{children}</div>
    </div>
  );
}
