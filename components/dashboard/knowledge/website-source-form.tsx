"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Globe, Loader2, AlertCircle } from "lucide-react";
import { createWebsiteSource } from "@/lib/actions/knowledge";

export function WebsiteSourceForm() {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await createWebsiteSource({ title, source_url: url });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTitle("");
      setUrl("");
      setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <Globe className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Add Website Source</h3>
          <p className="text-xs text-slate-500">Add a URL to scrape and train your AI assistant.</p>
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
          ✓ Website source added! It will be processed in the next step.
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Page Title / Label</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Homepage, About Us, Pricing" required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Website URL</label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/page" type="url" required />
      </div>

      <Button type="submit" disabled={loading} className="h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Website Source"}
      </Button>

      <p className="text-xs text-slate-400 text-center">
        Website scraping will be processed in the next step.
      </p>
    </form>
  );
}
