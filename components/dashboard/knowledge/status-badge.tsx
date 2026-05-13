"use client";

import type { KnowledgeSourceStatus } from "@/lib/types";

const statusConfig: Record<KnowledgeSourceStatus, { label: string; classes: string }> = {
  draft: { label: "Draft", classes: "bg-slate-100 text-slate-600" },
  pending: { label: "Pending", classes: "bg-amber-50 text-amber-600" },
  processing: { label: "Processing", classes: "bg-blue-50 text-blue-600" },
  trained: { label: "Trained", classes: "bg-emerald-50 text-emerald-600" },
  failed: { label: "Failed", classes: "bg-red-50 text-red-600" },
};

export function StatusBadge({ status }: { status: KnowledgeSourceStatus }) {
  const config = statusConfig[status] ?? statusConfig.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${config.classes}`}>
      {config.label}
    </span>
  );
}
