import { Button } from "@/components/ui/button";
import { 
  Bot, 
  Palette, 
  Image as ImageIcon, 
  MessageSquare,
  Type,
  Layout,
  Save,
  Undo
} from "lucide-react";

export default function WidgetCustomizerPage() {
  return (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Widget Customizer</h1>
          <p className="text-slate-500">Style your chat widget to perfectly match your brand.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-2xl h-12 px-6 flex items-center gap-2 font-bold border-2 border-slate-200">
            <Undo className="w-4 h-4" />
            Reset
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 px-6 flex items-center gap-2 font-bold">
            <Save className="w-4 h-4" />
            Publish Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Customization Options */}
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-2">
              <Palette className="w-5 h-5 text-indigo-600" />
              Look & Feel
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700 ml-1">Primary Color</label>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 border-4 border-slate-50 shadow-sm cursor-pointer ring-2 ring-indigo-600"></div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-500 border-4 border-slate-50 shadow-sm cursor-pointer"></div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 border-4 border-slate-50 shadow-sm cursor-pointer"></div>
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border-4 border-slate-50 shadow-sm cursor-pointer"></div>
                  <input 
                    type="text" 
                    defaultValue="#4F46E5" 
                    className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700 ml-1">Widget Position</label>
                <div className="flex gap-2">
                  <button className="flex-1 py-3 bg-indigo-50 border-2 border-indigo-600 rounded-2xl text-xs font-bold text-indigo-600">Bottom Right</button>
                  <button className="flex-1 py-3 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-400 hover:border-slate-200 hover:text-slate-600 transition-all">Bottom Left</button>
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-4">
              <label className="text-sm font-bold text-slate-700 ml-1">Assistant Avatar</label>
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 shrink-0">
                  <Bot className="w-10 h-10" />
                </div>
                <div className="flex-1">
                  <div className="flex gap-2 mb-2">
                    <Button variant="outline" className="rounded-xl px-4 h-10 text-xs font-bold border-2 border-slate-100 hover:border-slate-200">
                      <ImageIcon className="w-4 h-4 mr-2" /> Upload New
                    </Button>
                    <Button variant="ghost" className="rounded-xl px-4 h-10 text-xs font-bold text-red-500 hover:bg-red-50">
                      Remove
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Recommended size: 512x512px. JPG or PNG.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Chat Content
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Widget Title</label>
                <input 
                  type="text" 
                  defaultValue="Agentify Support" 
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Welcome Text</label>
                <textarea 
                  rows={2}
                  defaultValue="Hi there! 👋 How can we help you today?" 
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium resize-none"
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-sm font-bold text-slate-700">Suggested Questions</label>
                  <button className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">+ Add New</button>
                </div>
                <div className="space-y-2">
                  {["Pricing information", "How to install?", "Contact sales"].map((q, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input 
                        type="text" 
                        defaultValue={q} 
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:outline-none font-medium"
                      />
                      <button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <Undo className="w-4 h-4 rotate-90" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-5 relative">
          <div className="sticky top-10">
            <div className="bg-slate-100 rounded-3xl p-10 min-h-[600px] flex items-end justify-end border-2 border-slate-200 border-dashed">
              {/* Actual Widget Preview */}
              <div className="w-full max-w-[360px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="bg-indigo-600 p-6 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">Agentify Support</h4>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                        <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Always Active</span>
                      </div>
                    </div>
                  </div>
                  <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <Undo className="w-4 h-4 -rotate-90" />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 p-6 space-y-4 bg-white overflow-auto max-h-[300px]">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none text-xs text-slate-700 leading-relaxed">
                      Hi there! 👋 How can we help you today?
                    </div>
                  </div>
                  
                  <div className="pt-2 flex flex-wrap gap-2">
                    {["Pricing information", "How to install?", "Contact sales"].map((q, i) => (
                      <button key={i} className="px-3 py-2 border border-indigo-100 rounded-xl text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input */}
                <div className="p-4 border-t border-slate-100">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-[10px] text-slate-400 font-bold">
                    Type your message here...
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1 text-[8px] font-bold text-slate-300 uppercase tracking-widest">
                    Powered by <span className="text-indigo-400">Agentify</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Live Widget Preview</p>
          </div>
        </div>
      </div>
    </>
  );
}
