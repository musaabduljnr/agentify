"use client";

import { useState } from "react";
import { Upload, FileText, File, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDocumentSource, getBusinessIdForUpload } from "@/lib/actions/knowledge";
import { createClient } from "@/utils/supabase/client";
import { buildStoragePath, validateFileUpload } from "@/lib/security/file-upload";

const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function DocumentSourceForm() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(false);
    
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      const validation = validateFileUpload(selectedFile.name, selectedFile.type, selectedFile.size);
      if (!validation.valid) {
        setError(validation.error || "Invalid file type. Only PDF, DOCX, and TXT are supported.");
        setFile(null);
        return;
      }
      
      if (selectedFile.size > MAX_SIZE_BYTES) {
        setError(`File size exceeds ${MAX_SIZE_MB}MB limit.`);
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.split('.').slice(0, -1).join('.'));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !file) {
      setError("Please provide a title and select a file.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // 1. Get business ID for storage path
      const businessId = await getBusinessIdForUpload();
      
      // 2. Upload file to Supabase Storage
      const supabase = createClient();
      const filePath = buildStoragePath(businessId, file.name);
      
      const { error: uploadError } = await supabase.storage
        .from("business-documents")
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
        
      if (uploadError) {
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }
      
      // 3. Create knowledge source record
      const result = await createDocumentSource({
        title,
        file_name: file.name,
        file_url: filePath,
        file_type: file.type,
        file_size: file.size,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setSuccess(true);
      setTitle("");
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById("document-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Upload Document</h3>
        <p className="text-sm text-slate-500 mt-1">
          Upload PDF, DOCX, or TXT files to train your assistant. Maximum file size is {MAX_SIZE_MB}MB.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-medium">
          Document uploaded successfully! It is now pending processing.
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Document Title
          </label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Q3 Company Handbook"
            className="rounded-xl h-12"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            File
          </label>
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:bg-slate-50 transition-colors">
            <input
              type="file"
              id="document-upload"
              accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFileChange}
              disabled={loading}
            />
            <label
              htmlFor="document-upload"
              className="cursor-pointer flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                {file ? <FileText className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
              </div>
              <div>
                <span className="text-sm font-bold text-indigo-600 hover:text-indigo-700 block">
                  {file ? file.name : "Click to select a file"}
                </span>
                <span className="text-xs text-slate-500 mt-1 block">
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF, DOCX, or TXT up to 10MB"}
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || !file || !title.trim()}
        className="w-full h-12 rounded-xl text-base font-bold bg-indigo-600 hover:bg-indigo-700"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          "Upload Document"
        )}
      </Button>
    </form>
  );
}
