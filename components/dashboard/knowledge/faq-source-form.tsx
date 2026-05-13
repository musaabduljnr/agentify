"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { HelpCircle, Loader2, AlertCircle } from "lucide-react";
import { createFaqSource } from "@/lib/actions/knowledge";

export function FaqSourceForm() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await createFaqSource({ question, answer });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setQuestion("");
      setAnswer("");
      setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Add FAQ</h3>
          <p className="text-xs text-slate-500">Add common questions and answers for your AI assistant.</p>
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
          ✓ FAQ added and marked as trained!
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Question</label>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What are your opening hours?" required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Answer</label>
        <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="e.g. We are open Monday to Friday from 9am to 5pm." required />
      </div>

      <Button type="submit" disabled={loading} className="h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add FAQ"}
      </Button>
    </form>
  );
}
