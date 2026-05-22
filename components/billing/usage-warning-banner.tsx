"use client";

// ══════════════════════════════════════════════════════════════
// Usage Warning Banner
// ══════════════════════════════════════════════════════════════

import { AlertTriangle, XCircle, Zap } from "lucide-react";
import Link from "next/link";

type UsageWarning = {
  type: string;
  label: string;
  level: "warning" | "critical";
  used: number;
  limit: number;
  percentage: number;
};

export function UsageWarningBanner({ warnings }: { warnings: UsageWarning[] }) {
  if (!warnings || warnings.length === 0) return null;

  // Show the most critical warning first
  const sorted = [...warnings].sort((a, b) => {
    if (a.level === "critical" && b.level !== "critical") return -1;
    if (b.level === "critical" && a.level !== "critical") return 1;
    return b.percentage - a.percentage;
  });

  return (
    <div className="space-y-3 mb-6">
      {sorted.map((warning) => (
        <div
          key={warning.type}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
            warning.level === "critical"
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-amber-50 border border-amber-200 text-amber-700"
          }`}
        >
          {warning.level === "critical" ? (
            <XCircle className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span className="flex-1">
            {warning.level === "critical"
              ? `You've reached your ${warning.label.toLowerCase()} limit (${warning.used.toLocaleString()}/${warning.limit.toLocaleString()}).`
              : `You're nearing your monthly ${warning.label.toLowerCase()} limit (${warning.percentage}% used).`}
          </span>
          <Link
            href="/dashboard/billing"
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              warning.level === "critical"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-amber-600 hover:bg-amber-700 text-white"
            }`}
          >
            <Zap className="w-3 h-3" />
            Upgrade
          </Link>
        </div>
      ))}
    </div>
  );
}
