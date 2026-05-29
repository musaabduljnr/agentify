"use client";

import { useState } from "react";
import { Loader2, BrainCircuit, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateEmbeddingsForSource } from "@/lib/actions/knowledge";

export function GenerateEmbeddingsButton({ 
  sourceId, 
  status,
  isEmbedded 
}: { 
  sourceId: string; 
  status: string;
  isEmbedded?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  if (status !== "trained") return null;

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);

    const res = await generateEmbeddingsForSource(sourceId);

    if (res.error) {
      setResult({ error: res.error });
    } else {
      setResult({ success: true });
      setTimeout(() => setResult(null), 5000);
    }
    setLoading(false);
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        onClick={handleGenerate}
        disabled={loading}
        size="sm"
        className={`h-8 rounded-xl text-xs font-bold px-3 transition-all whitespace-nowrap ${
          isEmbedded 
            ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200"
            : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200"
        }`}
        variant="ghost"
      >
        {loading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
            Embedding...
          </>
        ) : isEmbedded ? (
          <>
            <Check className="w-3 h-3 mr-1" />
            Update Chunks
          </>
        ) : (
          <>
            <BrainCircuit className="w-3 h-3 mr-1" />
            Embed Content
          </>
        )}
      </Button>
      {result?.error && (
        <span className="text-[10px] text-red-500 font-medium max-w-[150px] truncate">{result.error}</span>
      )}
      {result?.success && !loading && (
        <span className="text-[10px] text-emerald-500 font-medium">✓ Chunks generated!</span>
      )}
    </div>
  );
}
