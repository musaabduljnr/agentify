import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Bot, Save, Wand2 } from "lucide-react";

export default function AssistantPage() {
  return (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">AI Assistant Settings</h1>
          <p className="text-slate-500">Customize how your assistant speaks and behaves.</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6 flex items-center gap-2 h-12">
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Assistant Name</label>
                <input 
                  type="text" 
                  defaultValue="Agentify Assistant" 
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Tone of Voice</label>
                <select className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium bg-white">
                  <option>Friendly</option>
                  <option>Professional</option>
                  <option>Witty</option>
                  <option>Luxury</option>
                  <option>Direct</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1 flex items-center justify-between">
                <span>Welcome Message</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest">Supports Markdown</span>
              </label>
              <textarea 
                rows={3}
                defaultValue="Hello! I'm the Agentify Assistant. How can I help you today?"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1 flex items-center justify-between">
                <span>Business Description</span>
                <button className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest flex items-center gap-1 hover:text-indigo-700">
                  <Wand2 className="w-3 h-3" /> Auto-generate
                </button>
              </label>
              <textarea 
                rows={6}
                placeholder="Briefly describe what your business does and how the assistant should represent it..."
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium resize-none"
              />
            </div>
          </div>

          <div className="bg-indigo-50 rounded-3xl p-8 border border-indigo-100 flex items-start gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-indigo-900 font-bold mb-1">Expert Tip: Use a Witty Tone</h4>
              <p className="text-indigo-700 text-sm leading-relaxed">
                Adding personality to your AI can increase user engagement by up to 40%. Our &apos;Witty&apos; tone is particularly effective for creative agencies and SaaS startups.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden sticky top-10">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Live Preview</h3>
            </div>
            <div className="p-6 bg-slate-50 min-h-[400px] flex flex-col">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-200 text-xs text-slate-700 font-medium">
                    Hello! I&apos;m the Agentify Assistant. How can I help you today?
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <div className="bg-indigo-600 p-3 rounded-2xl rounded-tr-none text-xs text-white max-w-[80%] font-medium">
                    Can you tell me about the pricing?
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-200 text-xs text-slate-700 font-medium">
                    Our pricing starts at $29/mo for the Starter plan. Would you like to see all plans?
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-200 relative">
                <div className="bg-white border border-slate-200 rounded-full py-3 px-4 text-xs text-slate-400 font-medium">
                  Type your message...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
