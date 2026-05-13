"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2, Globe, HelpCircle, FileText, Upload, BookOpen } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { ProcessWebsiteButton } from "./process-website-button";
import { SourceMetadata } from "./source-metadata";
import { KnowledgeSourceViewModal } from "./knowledge-source-view-modal";
import { KnowledgeSourceEditModal } from "./knowledge-source-edit-modal";
import { deleteKnowledgeSource } from "@/lib/actions/knowledge";
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this knowledge source?")) return;
    setDeletingId(id);
    await deleteKnowledgeSource(id);
    setDeletingId(null);
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
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Title</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Details</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Added</th>
              <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const Icon = typeIcons[source.type] || FileText;
              return (
                <tr key={source.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 truncate block max-w-[200px]">{source.title}</span>
                        {source.source_url && (
                          <span className="text-[10px] text-slate-400 truncate block max-w-[200px]">{source.source_url}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs font-bold text-slate-500 capitalize bg-slate-50 px-2 py-1 rounded-lg">{source.type}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      <StatusBadge status={source.status} />
                      {source.type === "website" && (
                        <ProcessWebsiteButton sourceId={source.id} status={source.status} />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <SourceMetadata source={source} />
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-xs text-slate-500">{new Date(source.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                  </td>
                  <td className="px-4 py-4">
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
    </>
  );
}
