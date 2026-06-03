"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2, Globe, HelpCircle, FileText, Upload, BookOpen, Layers, Sparkles, Play, Loader2, RefreshCcw } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { ProcessDocumentButton } from "./process-document-button";
import { GenerateEmbeddingsButton } from "./generate-embeddings-button";
import { EmbeddingStatusBadge } from "./embedding-status-badge";
import { SourceMetadata } from "./source-metadata";
import { KnowledgeSourceViewModal } from "./knowledge-source-view-modal";
import { KnowledgeSourceEditModal } from "./knowledge-source-edit-modal";
import { CrawledPagesModal } from "./crawled-pages-modal";
import { deleteKnowledgeSource, processWebsiteSource, crawlWebsiteSource } from "@/lib/actions/knowledge";
import { Button } from "@/components/ui/button";
import type { KnowledgeSource } from "@/lib/types";

const typeIcons: Record<string, any> = {
  website: Globe,
  faq: HelpCircle,
  manual: FileText,
  document: Upload,
};

export function KnowledgeSourceTable({ sources }: { sources: KnowledgeSource[] }) {
  const [viewSource, setViewSource] = useState<KnowledgeSource | null>(null);
  const [editSource, setEditSource] = useState<KnowledgeSource | null>(null);
  const [viewPagesSource, setViewPagesSource] = useState<KnowledgeSource | null>(null);
  
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [crawlErrors, setCrawlErrors] = useState<Record<string, string>>({});

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this knowledge source?")) return;
    setDeletingId(id);
    await deleteKnowledgeSource(id);
    setDeletingId(null);
  };

  const handleProcessSingle = async (sourceId: string) => {
    setProcessingId(sourceId);
    setCrawlErrors(prev => ({ ...prev, [sourceId]: "" }));
    const res = await processWebsiteSource(sourceId);
    if (res.error) {
      setCrawlErrors(prev => ({ ...prev, [sourceId]: res.error }));
    }
    setProcessingId(null);
  };

  const handleCrawlWebsite = async (sourceId: string, autoEmbed: boolean) => {
    setProcessingId(sourceId);
    setCrawlErrors(prev => ({ ...prev, [sourceId]: "" }));
    const res = await crawlWebsiteSource(sourceId, { autoEmbed });
    if (res.error) {
      setCrawlErrors(prev => ({ ...prev, [sourceId]: res.error }));
    }
    setProcessingId(null);
  };

  if (sources.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">No knowledge added yet</h3>
        <p className="text-slate-500 max-w-md mx-auto text-sm">
          Add your website, FAQs, documents, or manual business information to train your assistant.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Title</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Type</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell whitespace-nowrap">Details</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell whitespace-nowrap">Added</th>
              <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const Icon = typeIcons[source.type] || FileText;
              const isProcessing = processingId === source.id;
              const hasPages = source.type === "website" && (
                (source.crawled_pages && source.crawled_pages.length > 0) ||
                (source.failed_pages && source.failed_pages.length > 0) ||
                (source.metadata as any)?.scraped_pages?.length > 0
              );

              return (
                <tr key={source.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 truncate block max-w-[200px]">{source.title}</span>
                        {source.source_url && (
                          <span className="text-[10px] text-slate-400 truncate block max-w-[200px]">{source.source_url}</span>
                        )}
                        {source.type === "website" && (
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wider">
                              {source.crawl_mode === "crawl" ? "Full Crawl" : "Single Page"}
                            </span>
                            {source.crawl_status && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                source.crawl_status === "completed" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                source.crawl_status === "crawling" || source.crawl_status === "discovering" ? "bg-blue-50 text-blue-600 border border-blue-100 animate-pulse" :
                                source.crawl_status === "failed" ? "bg-red-50 text-red-600 border border-red-100" :
                                source.crawl_status === "partial" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                "bg-slate-50 text-slate-500"
                              }`}>
                                Crawl: {source.crawl_status.replace("_", " ")}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="text-xs font-bold text-slate-500 capitalize bg-slate-50 px-2 py-1 rounded-lg">{source.type}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-2">
                      <StatusBadge status={source.status} />
                      
                      {source.type === "website" && (
                        <div className="flex flex-col gap-1">
                          {isProcessing ? (
                            <div className="flex items-center text-xs text-slate-500 gap-1 p-1">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                              <span className="font-semibold">Processing...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {source.crawl_mode === "crawl" ? (
                                <>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleCrawlWebsite(source.id, false)}
                                      className="h-7 text-[10px] font-bold px-2 rounded-lg border-slate-200 text-slate-700 flex items-center gap-1"
                                    >
                                      <Layers className="w-3 h-3" />
                                      Crawl
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleCrawlWebsite(source.id, true)}
                                      className="h-7 text-[10px] font-bold px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1"
                                    >
                                      <Sparkles className="w-3 h-3" />
                                      Crawl & Embed
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleProcessSingle(source.id)}
                                  className="h-7 text-[10px] font-bold px-2 rounded-lg border-slate-200 text-slate-700 flex items-center gap-1 self-start"
                                >
                                  <Play className="w-3 h-3" />
                                  Process Page
                                </Button>
                              )}

                              {hasPages && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setViewPagesSource(source)}
                                  className="h-6 text-[10px] font-bold px-2 rounded-lg text-indigo-600 hover:bg-indigo-50 self-start"
                                >
                                  View Crawled Pages
                                </Button>
                              )}
                            </div>
                          )}
                          {crawlErrors[source.id] && (
                            <span className="text-[10px] text-red-500 font-semibold max-w-[150px] truncate block" title={crawlErrors[source.id]}>
                              {crawlErrors[source.id]}
                            </span>
                          )}
                        </div>
                      )}

                      {source.type === "document" && (
                        <ProcessDocumentButton sourceId={source.id} status={source.status} />
                      )}
                      
                      <GenerateEmbeddingsButton 
                        sourceId={source.id} 
                        status={source.status} 
                        isEmbedded={source.metadata?.embedded}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell whitespace-nowrap">
                    <SourceMetadata source={source} />
                    <EmbeddingStatusBadge 
                      isEmbedded={source.metadata?.embedded}
                      chunkCount={source.metadata?.chunk_count}
                      embeddedAt={source.metadata?.embedded_at}
                    />
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell whitespace-nowrap">
                    <span className="text-xs text-slate-500">{new Date(source.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setViewSource(source)}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-indigo-600"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditSource(source)}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-indigo-600"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        disabled={deletingId === source.id}
                        className="p-2 hover:bg-red-50 rounded-xl transition-colors text-slate-400 hover:text-red-600 disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewSource && <KnowledgeSourceViewModal source={viewSource} onClose={() => setViewSource(null)} />}
      {editSource && <KnowledgeSourceEditModal source={editSource} onClose={() => setEditSource(null)} />}
      {viewPagesSource && <CrawledPagesModal source={viewPagesSource} onClose={() => setViewPagesSource(null)} />}
    </>
  );
}
