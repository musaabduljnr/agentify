"use client";

import { useState } from "react";
import { Loader2, Zap, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { processWebsiteSource } from "@/lib/actions/knowledge";

export function ProcessWebsiteButton({ sourceId, status }: { sourceId: string; status: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  if (status !== "pending" && status !== "failed") return null;

  const handleProcess = async () => {
    setLoading(true);
    setResult(null);

    const res = await processWebsiteSource(sourceId);

    if (res.error) {
      setResult({ error: res.error });
    } else {
      setResult({ success: true });
    }
    setLoading(false);
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        onClick={handleProcess}
        disabled={loading}
        size="sm"
        className={`h-8 rounded-xl text-xs font-bold px-3 ${
          status === "failed"
            ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
            : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200"
        }`}
        variant="ghost"
      >
        {loading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
            Scraping...
          </>
        ) : status === "failed" ? (
          <>
            <RotateCcw className="w-3 h-3 mr-1" />
            Retry
          </>
        ) : (
          <>
            <Zap className="w-3 h-3 mr-1" />
            Process
          </>
        )}
      </Button>
      {result?.error && (
        <span className="text-[10px] text-red-500 font-medium max-w-[180px] truncate">{result.error}</span>
      )}
      {result?.success && (
        <span className="text-[10px] text-emerald-500 font-medium">✓ Scraped!</span>
      )}
    </div>
  );
}
