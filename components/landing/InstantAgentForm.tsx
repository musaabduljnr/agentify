"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { generateInstantAgent, type InstantGenerationSuccess } from "@/lib/actions/instant-generator";
import { 
  Sparkles, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Globe, 
  Bot, 
  HelpCircle,
  FileText,
  Layers,
  RotateCcw
} from "lucide-react";

export function InstantAgentForm(_props?: { dark?: boolean }) {
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InstantGenerationSuccess | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();

    if (!cleanUrl) {
      setError("Please enter your website URL.");
      return;
    }

    // Client-side format pre-check
    let testUrl = cleanUrl;
    if (!testUrl.startsWith("http://") && !testUrl.startsWith("https://")) {
      testUrl = "https://" + testUrl;
    }

    try {
      const parsed = new URL(testUrl);
      if (!parsed.hostname || !parsed.hostname.includes(".")) {
        setError("Please enter a valid domain address (e.g., yourcompany.com).");
        return;
      }
    } catch {
      setError("Please enter a valid website URL.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const response = await generateInstantAgent({ websiteUrl: cleanUrl });
        if (response.success) {
          setResult(response);
          setError(null);
        } else {
          setError(response.error);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to generate AI agent draft. Please try again.");
      }
    });
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setUrl("");
  };

  return (
    <div className="w-full">
      {!result ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 rounded-2xl bg-[#090b12] border border-white/10 shadow-lg shadow-black/40 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 flex-1 min-w-0">
              <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isPending}
                placeholder="Enter your website URL (e.g. yourbrand.com)"
                className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
                aria-label="Website URL for instant agent generation"
              />
            </div>
            <button
              type="submit"
              disabled={isPending || !url.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950/60 disabled:text-indigo-400/50 text-white rounded-xl font-medium text-sm shadow-md shadow-indigo-600/30 transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Scanning & Training...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 shrink-0 text-indigo-200" />
                  <span>Generate Agent</span>
                </>
              )}
            </button>
          </div>

          {isPending && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-indigo-400" />
              <span>Crawling website structure, extracting knowledge, and building vector embeddings...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1">{error}</div>
            </div>
          )}
        </form>
      ) : (
        <div className="p-6 rounded-2xl bg-[#090b12] border border-white/10 shadow-2xl text-left space-y-5">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-xl flex items-center justify-center shadow-inner">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-[10px] uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3" />
                    Agent Trained
                  </span>
                  {result.industry && (
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      • {result.industry}
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                  {result.businessName} Assistant
                </h3>
              </div>
            </div>

            <div className="text-right text-[11px] text-slate-400 font-medium">
              <div className="flex items-center justify-end gap-1">
                <Layers className="w-3 h-3 text-slate-500" />
                <span>{result.pagesScraped} {result.pagesScraped === 1 ? "page" : "pages"} indexed</span>
              </div>
              <div className="flex items-center justify-end gap-1 text-indigo-400 font-semibold mt-0.5">
                <FileText className="w-3 h-3" />
                <span>{result.wordCount.toLocaleString()} words learned</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs sm:text-sm text-slate-300">
              <p className="font-semibold text-white mb-1 flex items-center gap-1.5 text-xs text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" />
                Trained Opening Greeting:
              </p>
              &ldquo;{result.welcomeMessage}&rdquo;
            </div>

            {result.suggestedQuestions.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  Sample trained visitor questions:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {result.suggestedQuestions.map((q, idx) => (
                    <span 
                      key={idx} 
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-slate-300"
                    >
                      {q}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Link
              href={result.previewUrl}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-indigo-600/30 transition-all"
            >
              <span>Test Interactive Demo</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Try another URL</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
