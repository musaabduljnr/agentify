import { Button } from "@/components/ui/button";
import { 
  Code2, 
  Copy, 
  CheckCircle2, 
  Monitor, 
  ExternalLink,
  ChevronRight,
  Info
} from "lucide-react";

export default function EmbedCodePage() {
  const embedCode = `<script 
  src="https://agentify.ai/widget.js"
  data-business-id="business_123"
  async>
</script>`;

  return (
    <>
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Embed Code</h1>
        <p className="text-slate-500">Add the code below to your website to activate your AI assistant.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Code2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Your Widget Code</h3>
              </div>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6 flex items-center gap-2 font-bold h-10">
                <Copy className="w-4 h-4" />
                Copy Code
              </Button>
            </div>
            <div className="p-8 bg-slate-900 overflow-x-auto">
              <pre className="text-indigo-300 font-mono text-sm leading-relaxed">
                {embedCode}
              </pre>
            </div>
            <div className="p-6 bg-slate-50 flex items-center gap-3">
              <Info className="w-5 h-5 text-indigo-600 shrink-0" />
              <p className="text-xs text-slate-600 font-medium">
                Copy this code and paste it into your website&apos;s <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-900">&lt;head&gt;</code> or just before the closing <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-900">&lt;/body&gt;</code> tag.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Installation Guides
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["WordPress", "Shopify", "Webflow", "Wix", "React", "HTML/Plain"].map((platform) => (
                <button 
                  key={platform}
                  className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-indigo-600 hover:shadow-md transition-all text-left group"
                >
                  <h4 className="font-bold text-slate-900 mb-2">{platform}</h4>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                    View Guide <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-100 overflow-hidden relative">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <h3 className="text-xl font-bold mb-4 relative z-10">Test Installation</h3>
            <p className="text-indigo-100 text-sm mb-8 relative z-10">
              Once you&apos;ve added the code to your site, you can verify if it&apos;s working correctly.
            </p>
            <div className="space-y-4 relative z-10">
              <div className="space-y-2">
                <label className="text-xs font-bold opacity-80 uppercase tracking-widest">Your Website URL</label>
                <input 
                  type="url" 
                  placeholder="https://yourwebsite.com" 
                  className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 placeholder:text-indigo-300"
                />
              </div>
              <Button className="w-full bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl font-bold h-12">
                Check Status
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Need help?</h3>
            <div className="space-y-4">
              <button className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-indigo-50 transition-colors">
                <div className="flex items-center gap-3 text-left">
                  <Monitor className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                  <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-900">Watch Video Guide</span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-300" />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-indigo-50 transition-colors">
                <div className="flex items-center gap-3 text-left">
                  <CheckCircle2 className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                  <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-900">Installation FAQ</span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
