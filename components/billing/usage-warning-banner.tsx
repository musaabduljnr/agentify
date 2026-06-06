"use client";

// ══════════════════════════════════════════════════════════════
// Usage Warning Banner
// ══════════════════════════════════════════════════════════════

import { AlertTriangle, XCircle, Zap } from "lucide-react";
import Link from "next/link";

type UsageWarning = {
  type: string;
  label: string;
  level: "warning" | "critical" | "blocked";
  used: number;
  limit: number;
  percentage: number;
};

export function UsageWarningBanner({ warnings }: { warnings: UsageWarning[] }) {
  if (!warnings || warnings.length === 0) return null;

  // Show the most severe warnings first
  const sorted = [...warnings].sort((a, b) => {
    const severityMap = { blocked: 3, critical: 2, warning: 1 };
    const aSeverity = severityMap[a.level] || 0;
    const bSeverity = severityMap[b.level] || 0;

    if (aSeverity !== bSeverity) {
      return bSeverity - aSeverity;
    }
    return b.percentage - a.percentage;
  });

  return (
    <div className="space-y-3 mb-6">
      {sorted.map((warning) => {
        let containerClass = "bg-amber-50 border border-amber-200 text-amber-800";
        let icon = <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />;
        let buttonClass = "bg-amber-600 hover:bg-amber-700 text-white";
        let warningText = `You're nearing your monthly ${warning.label.toLowerCase()} limit (${warning.percentage}% used).`;

        if (warning.level === "blocked") {
          containerClass = "bg-red-50 border border-red-200 text-red-800";
          icon = <XCircle className="w-5 h-5 shrink-0 text-red-600" />;
          buttonClass = "bg-red-600 hover:bg-red-700 text-white";
          warningText = `You've reached your ${warning.label.toLowerCase()} limit (${warning.used.toLocaleString()}/${warning.limit.toLocaleString()}). Further AI responses are blocked. Please upgrade to continue.`;
        } else if (warning.level === "critical") {
          containerClass = "bg-orange-50 border border-orange-200 text-orange-850";
          icon = <AlertTriangle className="w-5 h-5 shrink-0 text-orange-600" />;
          buttonClass = "bg-orange-600 hover:bg-orange-700 text-white";
          warningText = `You're almost out of ${warning.label.toLowerCase()} capacity (${warning.percentage}% used). Please upgrade your plan soon to avoid service disruption.`;
        }

        return (
          <div
            key={warning.type}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all ${containerClass}`}
          >
            {icon}
            <span className="flex-1">{warningText}</span>
            <Link
              href="/dashboard/billing"
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-colors ${buttonClass}`}
            >
              <Zap className="w-3 h-3" />
              Upgrade
            </Link>
          </div>
        );
      })}
    </div>
  );
}
