"use client";

import { useState } from "react";
import { X, CheckCircle, AlertTriangle, BookOpen } from "lucide-react";
import type { KnowledgeSource } from "@/lib/types";

interface Page {
  url: string;
  title: string;
  wordCount?: number;
  characterCount?: number;
  status?: string;
}

interface FailedPage {
  url: string;
  error: string;
}

interface CrawledPagesModalProps {
  source: KnowledgeSource;
  onClose: () => void;
}

export function CrawledPagesModal({ source, onClose }: CrawledPagesModalProps) {
  const [activeTab, setActiveTab] = useState<"crawled" | "failed">("crawled");
  
  const crawledPages: Page[] = source.crawled_pages || (source.metadata as any)?.scraped_pages || [];
  const failedPages: FailedPage[] = source.failed_pages || (source.metadata as any)?.scraped_failed_pages || [];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Crawl Details</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[450px]">
              Source: <span className="font-semibold">{source.title}</span> ({source.source_url})
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tabs Control */}
        <div className="flex border-b border-slate-100 px-6 bg-slate-50/50 flex-shrink-0">
          <button
            onClick={() => setActiveTab("crawled")}
            className={`py-3 px-4 text-xs font-bold border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              activeTab === "crawled"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Crawled Pages ({crawledPages.length})
          </button>
          <button
            onClick={() => setActiveTab("failed")}
            className={`py-3 px-4 text-xs font-bold border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              activeTab === "failed"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Failed Pages ({failedPages.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {activeTab === "crawled" ? (
            crawledPages.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-sm font-semibold text-slate-500">No crawled pages recorded.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {crawledPages.map((page, idx) => (
                  <div key={idx} className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors">
                    <div className="min-w-0 space-y-1">
                      <span className="font-bold text-slate-800 truncate block">{page.title || "Untitled Page"}</span>
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline truncate block"
                      >
                        {page.url}
                      </a>
                    </div>
                    {page.wordCount !== undefined && (
                      <div className="flex-shrink-0 text-slate-400 bg-white border border-slate-200/60 rounded-xl px-3 py-1 font-semibold text-[10px] uppercase text-center self-start sm:self-auto whitespace-nowrap">
                        {page.wordCount} words
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : failedPages.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle className="w-12 h-12 text-emerald-100 mx-auto mb-4" />
              <p className="text-sm font-semibold text-slate-500">No crawl failures detected!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {failedPages.map((page, idx) => (
                <div key={idx} className="bg-red-50/30 border border-red-100/60 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="min-w-0">
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-700 hover:underline font-bold truncate block"
                    >
                      {page.url}
                    </a>
                  </div>
                  <div className="text-red-500 font-medium leading-relaxed">
                    Error: {page.error}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
