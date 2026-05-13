"use client";

import { useState } from "react";
import { Search, Loader2, BrainCircuit, Quote } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchKnowledge } from "@/lib/actions/knowledge";

export function TestKnowledgeSearch({ businessId }: { businessId: string }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    const res = await searchKnowledge(query, businessId);

    if (res.error) {
      setError(res.error);
    } else {
      setResults(res.matches || []);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8 mt-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <BrainCircuit className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Test Knowledge Search</h3>
          <p className="text-xs text-slate-500">Search through your embedded knowledge to see how the AI retrieves information.</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to test?"
            className="pl-11 h-12 rounded-2xl border-slate-200 focus:border-indigo-300 focus:ring-indigo-100 transition-all"
          />
        </div>
        <Button 
          type="submit" 
          disabled={loading || !query.trim()}
          className="h-12 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search Knowledge"}
        </Button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600 mb-6">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {results.length > 0 ? (
          results.map((result, idx) => (
            <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 relative group">
              <div className="absolute right-4 top-4 bg-white px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500 shadow-sm">
                {(result.similarity * 100).toFixed(1)}% Match
              </div>
              <div className="flex items-start gap-3">
                <Quote className="w-4 h-4 text-indigo-300 mt-1 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm text-slate-700 leading-relaxed italic">
                    "{result.content}"
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Source: {result.metadata?.source_title || "Unknown"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : !loading && query && (
          <div className="text-center py-10">
            <p className="text-sm text-slate-400 italic">No matching results found for this query.</p>
          </div>
        )}
      </div>
    </div>
  );
}
