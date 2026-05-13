"use client";

import { X, Globe, HelpCircle, FileText, Upload, ExternalLink } from "lucide-react";
import { StatusBadge } from "./status-badge";
import type { KnowledgeSource } from "@/lib/types";

export function KnowledgeSourceViewModal({
  source,
  onClose,
}: {
  source: KnowledgeSource;
  onClose: () => void;
}) {
  const typeIcons: Record<string, any> = {
    website: Globe,
    faq: HelpCircle,
    manual: FileText,
    document: Upload,
  };
  const Icon = typeIcons[source.type] || FileText;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Icon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{source.title}</h3>
              <p className="text-xs text-slate-500 capitalize">{source.type} source</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
              <StatusBadge status={source.status} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Type</p>
              <span className="text-sm font-bold text-slate-700 capitalize">{source.type}</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Added</p>
              <span className="text-sm font-medium text-slate-700">
                {new Date(source.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </span>
            </div>
          </div>

          {source.source_url && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Source URL</p>
              <a
                href={source.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
              >
                {source.source_url} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {source.file_name && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">File</p>
              <span className="text-sm font-medium text-slate-700">{source.file_name}</span>
            </div>
          )}

          {source.content && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Content</p>
              <div className="bg-slate-50 rounded-2xl p-4 text-sm text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {source.content}
              </div>
            </div>
          )}

          {source.error_message && (
            <div>
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Error</p>
              <div className="bg-red-50 rounded-2xl p-4 text-sm text-red-600">
                {source.error_message}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
