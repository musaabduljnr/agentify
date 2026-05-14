"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot, Save, Wand2, ArrowRight, Loader2 } from "lucide-react";
import { updateAssistant } from "@/lib/actions/chat";
import { toast } from "sonner";
import Link from "next/link";

interface AssistantEditorProps {
  initialBusiness: any;
  initialAssistant: any;
}

export function AssistantEditor({ initialBusiness, initialAssistant }: AssistantEditorProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: initialAssistant?.name || "Agentify Assistant",
    tone: initialAssistant?.tone || "Friendly",
    welcome_message: initialAssistant?.welcome_message || "Hello! I'm the Agentify Assistant. How can I help you today?",
    business_description: initialBusiness?.description || "",
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await updateAssistant({
        id: initialAssistant?.id,
        ...formData,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Assistant configuration saved!");
      }
    } catch (error) {
      toast.error("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">AI Assistant Settings</h1>
          <p className="text-slate-500">Customize how your assistant speaks and behaves.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            asChild
            variant="outline"
            className="rounded-2xl px-6 h-12 flex items-center gap-2 border-2"
          >
            <Link href="/dashboard/playground">
              Test in Playground
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button 
            onClick={handleSave}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6 flex items-center gap-2 h-12 min-w-[140px]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Assistant Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Tone of Voice</label>
                <select 
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium bg-white"
                >
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
                value={formData.welcome_message}
                onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
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
                value={formData.business_description}
                onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
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
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Live Preview</h3>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <div className="w-2 h-2 rounded-full bg-green-400" />
              </div>
            </div>
            <div className="p-6 bg-slate-50 min-h-[400px] flex flex-col">
              <div className="flex-1 space-y-4">
                <div className="flex items-start gap-2 mb-6">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-1 shadow-md">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-200 text-xs text-slate-700 font-medium leading-relaxed">
                    {formData.welcome_message}
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <div className="bg-indigo-600 p-3 rounded-2xl rounded-tr-none text-xs text-white max-w-[80%] font-medium shadow-sm">
                    Can you tell me about your services?
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-1 shadow-md">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-200 text-xs text-slate-700 font-medium leading-relaxed italic opacity-70">
                    {formData.name} is typing...
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-200 relative">
                <div className="bg-white border border-slate-200 rounded-full py-3 px-4 text-xs text-slate-400 font-medium flex justify-between items-center">
                  <span>Type your message...</span>
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-muted/30 text-center border-t border-slate-100">
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Preview Mode</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
