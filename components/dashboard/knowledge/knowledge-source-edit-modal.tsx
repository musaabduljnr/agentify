"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateKnowledgeSource } from "@/lib/actions/knowledge";
import type { KnowledgeSource } from "@/lib/types";

export function KnowledgeSourceEditModal({
  source,
  onClose,
}: {
  source: KnowledgeSource;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(source.title);
  const [content, setContent] = useState(source.content ?? "");
  const [sourceUrl, setSourceUrl] = useState(source.source_url ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await updateKnowledgeSource({
      id: source.id,
      title,
      content: content || undefined,
      source_url: sourceUrl || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Edit Knowledge Source</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          {(source.type === "website") && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Source URL</label>
              <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
            </div>
          )}

          {(source.type === "faq" || source.type === "manual") && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Content</label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[160px]" />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-2xl font-bold">Cancel</Button>
            <Button type="submit" disabled={loading} className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
