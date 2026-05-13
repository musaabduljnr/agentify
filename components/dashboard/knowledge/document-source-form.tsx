"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, AlertCircle, File } from "lucide-react";
import { createDocumentSource } from "@/lib/actions/knowledge";

export function DocumentSourceForm() {
  const [title, setTitle] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await createDocumentSource({ title, file_name: fileName });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTitle("");
      setFileName("");
      setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
          <Upload className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Upload Document</h3>
          <p className="text-xs text-slate-500">Upload PDF, DOCX, or TXT files for AI training.</p>
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
          ✓ Document source added! Text extraction will be processed later.
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Document Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Product Catalog, Employee Handbook" required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Select File</label>
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-all">
          {fileName ? (
            <div className="flex items-center gap-3 text-sm font-bold text-slate-700">
              <File className="w-5 h-5 text-indigo-600" />
              {fileName}
            </div>
          ) : (
            <div className="text-center">
              <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">Click to select a file</p>
              <p className="text-xs text-slate-400">PDF, DOCX, TXT (max 10MB)</p>
            </div>
          )}
          <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileChange} />
        </label>
      </div>

      <Button type="submit" disabled={loading || !fileName} className="h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload Document"}
      </Button>

      <p className="text-xs text-slate-400 text-center">
        Document text extraction will be processed in a later step.
      </p>
    </form>
  );
}
