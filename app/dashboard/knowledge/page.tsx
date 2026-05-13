import { Button } from "@/components/ui/button";
import { 
  Globe, 
  FileText, 
  Plus, 
  RefreshCcw, 
  Trash2, 
  Search,
  Upload,
  Link as LinkIcon
} from "lucide-react";
import { knowledgeSources } from "@/lib/mock-data";

export default function KnowledgeBasePage() {
  return (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Knowledge Base</h1>
          <p className="text-slate-500">Manage the sources your AI assistant uses for information.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-2xl h-12 px-6 flex items-center gap-2 font-bold border-2 border-slate-200">
            <RefreshCcw className="w-4 h-4" />
            Sync All
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 px-6 flex items-center gap-2 font-bold">
            <Plus className="w-4 h-4" />
            Add Source
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left: Add Sources */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-indigo-600" />
              Scrape Website
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Website URL</label>
                <div className="flex gap-2">
                  <input 
                    type="url" 
                    placeholder="https://example.com" 
                    className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  />
                  <Button className="bg-slate-900 text-white rounded-2xl h-12 px-6 font-bold shrink-0">
                    Scrape
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400 font-medium ml-1">We will crawl all pages and update daily.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Upload Document
            </h3>
            <div className="border-2 border-dashed border-slate-100 rounded-3xl p-10 text-center hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-white transition-all">
                <FileText className="w-7 h-7 text-slate-400 group-hover:text-indigo-600" />
              </div>
              <p className="text-sm font-bold text-slate-900 mb-1">Click to upload or drag & drop</p>
              <p className="text-[11px] text-slate-400 font-medium">PDF, DOCX, or TXT up to 20MB</p>
            </div>
          </div>
        </div>

        {/* Right: Sources Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Current Sources</h3>
              <div className="relative w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Filter sources..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:outline-none"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-8 py-4">Source Name</th>
                    <th className="px-8 py-4">Type</th>
                    <th className="px-8 py-4">Status</th>
                    <th className="px-8 py-4">Last Updated</th>
                    <th className="px-8 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {knowledgeSources.map((source) => (
                    <tr key={source.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-4">
                        <div className="font-bold text-slate-900 text-sm truncate max-w-[200px]">{source.name}</div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-2">
                          {source.type === "URL" ? <Globe className="w-4 h-4 text-slate-400" /> : <FileText className="w-4 h-4 text-slate-400" />}
                          <span className="text-sm text-slate-600 font-medium">{source.type}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-lg ${
                          source.status === "Trained" ? "bg-green-50 text-green-600" :
                          source.status === "Processing" ? "bg-blue-50 text-blue-600 animate-pulse" :
                          source.status === "Failed" ? "bg-red-50 text-red-600" :
                          "bg-slate-50 text-slate-500"
                        }`}>
                          {source.status}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-xs text-slate-400 font-medium">{source.lastUpdated}</td>
                      <td className="px-8 py-4 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span>Showing {knowledgeSources.length} sources</span>
              <div className="flex items-center gap-4">
                <button className="hover:text-indigo-600 transition-colors cursor-pointer disabled:opacity-30" disabled>Previous</button>
                <button className="hover:text-indigo-600 transition-colors cursor-pointer">Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
