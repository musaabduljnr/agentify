"use client";

import { useState } from "react";
import { Play, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { processDocumentSource } from "@/lib/actions/knowledge";

export function ProcessDocumentButton({
  sourceId,
  status,
}: {
  sourceId: string;
  status: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "pending" && status !== "failed") {
    return null;
  }

  const handleProcess = async () => {
    setLoading(true);
    setError(null);

    const result = await processDocumentSource(sourceId);

    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleProcess}
        disabled={loading}
        className="h-8 text-xs font-bold w-full rounded-lg bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <Play className="w-3.5 h-3.5 mr-1.5" />
        )}
        {status === "failed" ? "Retry Processing" : "Process Document"}
      </Button>
      {error && (
        <span className="text-[10px] text-red-500 font-medium flex items-center gap-1 mt-0.5 leading-tight">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
}
