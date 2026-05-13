"use client";

import { BrainCircuit, Clock } from "lucide-react";

export function EmbeddingStatusBadge({ 
  isEmbedded, 
  chunkCount,
  embeddedAt 
}: { 
  isEmbedded?: boolean;
  chunkCount?: number;
  embeddedAt?: string;
}) {
  if (!isEmbedded) return null;

  return (
    <div className="flex flex-col gap-1 mt-2">
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100 w-fit">
        <BrainCircuit className="w-3 h-3 text-indigo-600" />
        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-tight">
          Embedded ({chunkCount || 0} chunks)
        </span>
      </div>
      {embeddedAt && (
        <div className="flex items-center gap-1 text-[9px] text-slate-400 ml-1">
          <Clock className="w-2.5 h-2.5" />
          <span>Last: {new Date(embeddedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      )}
    </div>
  );
}
