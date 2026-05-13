"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, AlertCircle } from "lucide-react";
import { createManualSource } from "@/lib/actions/knowledge";

export function ManualSourceForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await createManualSource({ title, content });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTitle("");
      setContent("");
      setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <FileText className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Add Manual Text</h3>
          <p className="text-xs text-slate-500">Write custom knowledge for your AI assistant.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-600 font-medium">
          ✓ Manual text added and marked as trained!
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Return Policy, Shipping Info" required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Content</label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your business knowledge here... (minimum 20 characters)"
          className="min-h-[160px]"
          required
        />
        <p className="text-xs text-slate-400 ml-1">{content.length}/20 minimum characters</p>
      </div>

      <Button type="submit" disabled={loading || content.length < 20} className="h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Manual Text"}
      </Button>
    </form>
  );
}
