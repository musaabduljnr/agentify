"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Globe, Loader2, AlertCircle, Play, ShieldAlert, Sparkles, Layers } from "lucide-react";
import { createWebsiteSource, processWebsiteSource, crawlWebsiteSource } from "@/lib/actions/knowledge";

export function WebsiteSourceForm() {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [crawlMode, setCrawlMode] = useState<"single" | "crawl">("single");
  const [maxPages, setMaxPages] = useState<number>(50);
  const [crawlDepth, setCrawlDepth] = useState<number>(3);
  const [autoEmbed, setAutoEmbed] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAction = async (actionType: "create" | "process" | "crawl" | "crawl_embed") => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setLoadingStep("Creating knowledge source...");

    try {
      const mode = (actionType === "process" || actionType === "create" && crawlMode === "single") ? "single" : "crawl";
      const finalMaxPages = mode === "single" ? 1 : maxPages;
      const finalDepth = mode === "single" ? 1 : crawlDepth;

      const result = await createWebsiteSource({
        title,
        source_url: url,
        crawl_mode: mode,
        crawl_depth: finalDepth,
        max_pages: finalMaxPages,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      const sourceId = result.id;
      if (!sourceId) {
        throw new Error("Failed to retrieve new source ID.");
      }

      if (actionType === "create") {
        setSuccess("Website source added to database! You can process it from the table below.");
        setTitle("");
        setUrl("");
      } else if (actionType === "process") {
        setLoadingStep("Scraping webpage content...");
        const processResult = await processWebsiteSource(sourceId);
        if (processResult.error) {
          throw new Error(processResult.error);
        }
        setSuccess(`Successfully scraped single page! Extracted ${processResult.wordCount} words.`);
        setTitle("");
        setUrl("");
      } else if (actionType === "crawl" || actionType === "crawl_embed") {
        setLoadingStep(`Crawling website (up to ${maxPages} pages)...`);
        const crawlResult = await crawlWebsiteSource(sourceId, {
          maxPages: finalMaxPages,
          depth: finalDepth,
          autoEmbed: actionType === "crawl_embed"
        });

        if (crawlResult.error) {
          throw new Error(crawlResult.error);
        }

        if (actionType === "crawl_embed") {
          setSuccess(`Successfully crawled ${crawlResult.pagesScraped} pages and generated vector embeddings!`);
        } else {
          setSuccess(`Successfully crawled ${crawlResult.pagesScraped} pages!`);
        }
        setTitle("");
        setUrl("");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setLoadingStep(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <Globe className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Add Website Source</h3>
          <p className="text-xs text-slate-500">Scrape pages or crawl a full domain to train your assistant.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-600 font-medium">
          ✓ {success}
        </div>
      )}

      {/* Crawl Mode Selection */}
      <div className="flex bg-slate-100 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setCrawlMode("single")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-colors ${
            crawlMode === "single" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Single Page Scrape
        </button>
        <button
          type="button"
          onClick={() => setCrawlMode("crawl")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-colors ${
            crawlMode === "crawl" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Full Website Crawl
        </button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Website URL</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={crawlMode === "single" ? "https://example.com/about" : "https://example.com"}
            type="url"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Label / Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Company Main Site"
            required
            disabled={loading}
          />
        </div>

        {/* Crawling Advanced Options */}
        {crawlMode === "crawl" && (
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <label className="text-slate-600 font-bold block">Max Pages to Crawl</label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={maxPages}
                onChange={(e) => setMaxPages(Math.max(1, parseInt(e.target.value) || 1))}
                className="bg-white"
                disabled={loading}
              />
              <p className="text-[10px] text-slate-400">Limits execution size (maximum 1000 pages).</p>
            </div>

            <div className="space-y-2">
              <label className="text-slate-600 font-bold block">Crawl Depth</label>
              <select
                value={crawlDepth}
                onChange={(e) => setCrawlDepth(parseInt(e.target.value))}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
                disabled={loading}
              >
                <option value={1}>1 (Same domain subpages only)</option>
                <option value={2}>2 (Follow link connections)</option>
                <option value={3}>3 (Deep crawl - 3 levels)</option>
                <option value={5}>5 (Very deep crawl)</option>
                <option value={10}>10 (Maximum depth)</option>
              </select>
              <p className="text-[10px] text-slate-400">Determines link path traversal limits.</p>
            </div>
          </div>
        )}
      </div>

      {/* Button Controls */}
      <div className="space-y-3 pt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border text-slate-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs font-bold text-slate-700">{loadingStep}</span>
          </div>
        ) : (
          <>
            {crawlMode === "single" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAction("create")}
                  className="h-12 rounded-2xl border-slate-200 text-slate-700 font-bold text-xs"
                >
                  Add Website Source
                </Button>
                <Button
                  type="button"
                  onClick={() => handleAction("process")}
                  className="h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  Process Single Page
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAction("create")}
                    className="h-12 rounded-2xl border-slate-200 text-slate-700 font-bold text-xs"
                  >
                    Add Website Source
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleAction("crawl")}
                    className="h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Crawl Website
                  </Button>
                </div>
                <Button
                  type="button"
                  onClick={() => handleAction("crawl_embed")}
                  className="h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Crawl & Embed
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
