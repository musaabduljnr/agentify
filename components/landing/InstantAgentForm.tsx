"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { generateInstantAgent, type InstantGenerationSuccess } from "@/lib/actions/instant-generator";
import { Sparkles, ArrowRight, Loader2, AlertCircle, CheckCircle2, Globe, Bot, HelpCircle } from "lucide-react";

export function InstantAgentForm() {
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
      } catch (err: any) {
        setError(err.message || "Failed to generate AI agent draft. Please try again.");
      }
    });
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setUrl("");
  };

  return (
    <div className="w-full max-w-xl mx-auto lg:mx-0">
      {!result ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-lg shadow-indigo-100/50 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-slate-400">
              <Globe className="w-5 h-5 text-indigo-500 shrink-0" />
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isPending}
                placeholder="Enter your website (e.g. acme.com)"
                className="w-full bg-transparent text-slate-800 placeholder-slate-400 text-sm sm:text-base focus:outline-none disabled:opacity-60"
                aria-label="Website URL for instant agent generation"
              />
            </div>
            <button
              type="submit"
              disabled={isPending || !url.trim()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm sm:text-base shadow-md shadow-indigo-600/20 transition-all duration-200 shrink-0 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Scanning & Training...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Generate My AI Agent</span>
                </>
              )}
            </button>
          </div>

          {isPending && (
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs font-semibold text-indigo-700 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Crawling website structure, reading content, and building vector embeddings...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200/80 rounded-xl text-xs font-medium text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          <p className="text-xs text-slate-500 font-medium px-1 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Instant generation in ~10 seconds. No credit card required.
          </p>
        </form>
      ) : (
        <div className="p-6 bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-indigo-100/60 text-left space-y-5 animate-in fade-in-50 zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-indigo-200">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Agent Draft Ready
                  </span>
                  {result.industry && (
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      • {result.industry}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug">{result.businessName} Assistant</h3>
              </div>
            </div>

            <div className="text-right text-[11px] font-semibold text-slate-500">
              <div>{result.pagesScraped} {result.pagesScraped === 1 ? "page" : "pages"} scanned</div>
              <div className="text-indigo-600 font-bold">{result.wordCount} words learned</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <p className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Custom Welcome Message:
              </p>
              &ldquo;{result.welcomeMessage}&rdquo;
            </div>

            {result.suggestedQuestions.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  Suggested questions trained from your site:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {result.suggestedQuestions.map((q, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
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
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-600/20 transition-all duration-200"
            >
              <span>Test Interactive Preview</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={handleReset}
              className="px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Try another website
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
