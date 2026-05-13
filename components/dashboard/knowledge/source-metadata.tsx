"use client";

import { Clock, Hash, Type } from "lucide-react";
import type { KnowledgeSource } from "@/lib/types";

export function SourceMetadata({ source }: { source: KnowledgeSource }) {
  const meta = source.metadata as Record<string, any> | null;
  const wordCount = (source as any).word_count;
  const scrapedAt = (source as any).scraped_at;

  if (!wordCount && !scrapedAt) return null;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {wordCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Hash className="w-3 h-3" />
          <span className="font-medium">{wordCount.toLocaleString()} words</span>
        </div>
      )}
      {scrapedAt && (
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="w-3 h-3" />
          <span className="font-medium">Scraped {new Date(scrapedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
        </div>
      )}
      {meta?.scraped_title && (
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Type className="w-3 h-3" />
          <span className="font-medium truncate max-w-[200px]">{meta.scraped_title}</span>
        </div>
      )}
    </div>
  );
}
