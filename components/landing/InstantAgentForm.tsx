"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { generateInstantAgent, type InstantGenerationSuccess } from "@/lib/actions/instant-generator";
import { 
  Globe, 
  Zap, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Bot, 
  ArrowRight, 
  RotateCcw,
  Sparkles,
  HelpCircle,
  FileText,
  Layers
} from "lucide-react";

export function InstantAgentForm() {
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InstantGenerationSuccess | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();

    if (!cleanUrl) {
      setError("Please enter your business website URL.");
      return;
    }

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
          <div className="bg-[#ffffff] p-2 rounded-xl border border-[#eceef2] shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row items-center gap-2 transition-all focus-within:border-[#2a54c0] focus-within:ring-4 focus-within:ring-[#2a54c0]/10">
            <div className="flex items-center gap-2.5 px-3 flex-1 w-full min-w-0">
              <Globe className="w-5 h-5 text-[#747684] shrink-0" />
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isPending}
                placeholder="Enter your business website URL (e.g. acme.com)"
                className="w-full bg-transparent text-[15px] text-[#181c1f] placeholder:text-[#747684] focus:outline-none py-1.5 disabled:opacity-60"
                aria-label="Enter website URL for AI agent generation"
              />
            </div>
            <button
              type="submit"
              disabled={isPending || !url.trim()}
              className="w-full sm:w-auto px-6 py-3 bg-[#181c1f] hover:bg-[#2d3134] text-white rounded-lg font-semibold text-[14px] tracking-tight flex items-center justify-center gap-2 transition-all shrink-0 active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Scanning & Training...</span>
                </>
              ) : (
                <>
                  <span>Generate My AI Agent</span>
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300 shrink-0" />
                </>
              )}
            </button>
          </div>

          {isPending && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-medium bg-[#dbe1ff]/60 border border-[#b4c5ff] text-[#013daa] animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-[#2a54c0]" />
              <span>Scanning website structure, extracting knowledge base, and synthesizing agent persona...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg text-xs font-medium bg-[#ffdad6]/60 border border-[#ffb4ab] text-[#ba1a1a]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#ba1a1a]" />
              <div className="flex-1">{error}</div>
            </div>
          )}
        </form>
      ) : (
        <div className="p-6 rounded-2xl bg-[#ffffff] border border-[#eceef2] shadow-xl text-left space-y-5 animate-in fade-in-50 zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#eceef2]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-[#2a54c0] text-white rounded-xl flex items-center justify-center shadow-md shadow-[#2a54c0]/20">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ECFDF3] text-[#027A48] font-bold text-[11px] uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3" />
                    Agent Draft Ready
                  </span>
                  {result.industry && (
                    <span className="text-[11px] font-medium text-[#747684] uppercase tracking-wider">
                      • {result.industry}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-[#181c1f] mt-0.5">
                  {result.businessName} Assistant
                </h3>
              </div>
            </div>

            <div className="text-right text-[12px] text-[#747684]">
              <div className="flex items-center justify-end gap-1">
                <Layers className="w-3.5 h-3.5 text-[#747684]" />
                <span>{result.pagesScraped} {result.pagesScraped === 1 ? "page" : "pages"} scanned</span>
              </div>
              <div className="flex items-center justify-end gap-1 text-[#2a54c0] font-semibold mt-0.5">
                <FileText className="w-3.5 h-3.5" />
                <span>{result.wordCount.toLocaleString()} words learned</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-[#f2f4f8] border border-[#eceef2] text-xs sm:text-sm text-[#434653]">
              <p className="font-semibold text-[#181c1f] mb-1 flex items-center gap-1.5 text-xs text-[#2a54c0]">
                <Sparkles className="w-3.5 h-3.5" />
                Trained Opening Greeting:
              </p>
              &ldquo;{result.welcomeMessage}&rdquo;
            </div>

            {result.suggestedQuestions.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#747684] flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  Sample trained visitor questions:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {result.suggestedQuestions.map((q, idx) => (
                    <span 
                      key={idx} 
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#ffffff] border border-[#eceef2] text-[#434653] shadow-xs"
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
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#2a54c0] hover:bg-[#2447a3] text-white rounded-xl font-bold text-sm shadow-md shadow-[#2a54c0]/25 transition-all"
            >
              <span>Test Interactive Demo</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold text-[#747684] hover:text-[#181c1f] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Try another website</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
