"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Bot, 
  Palette, 
  MessageSquare,
  Save,
  Undo,
  X,
  Plus,
  Copy,
  ExternalLink,
  Share2
} from "lucide-react";
import { updateWidgetConfig, WidgetConfigData } from "@/lib/actions/widget";
import { toast } from "sonner";

export function WidgetCustomizerForm({ initialData }: { initialData: any }) {
  const [config, setConfig] = useState<WidgetConfigData>({
    primaryColor: initialData?.primary_color || "#4F46E5",
    position: initialData?.position || "bottom-right",
    welcomeText: initialData?.welcome_text || "Hi there! 👋 How can we help you today?",
    suggestedQuestions: initialData?.suggested_questions || ["Pricing information", "How to install?", "Contact sales"],
    showBranding: initialData?.show_branding ?? true,
    isEnabled: initialData?.is_enabled ?? true,
    collectLeads: initialData?.collect_leads ?? true,
    hostedChatEnabled: initialData?.hosted_chat_enabled ?? true,
    hostedChatSlug: initialData?.hosted_chat_slug || "",
    hostedChatTitle: initialData?.hosted_chat_title || "",
    hostedChatDescription: initialData?.hosted_chat_description || "",
    allowedDomains: initialData?.allowed_domains || [],
  });

  const [isSaving, setIsSaving] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateWidgetConfig(config);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Widget configuration published!");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig({
      primaryColor: initialData?.primary_color || "#4F46E5",
      position: initialData?.position || "bottom-right",
      welcomeText: initialData?.welcome_text || "Hi there! 👋 How can we help you today?",
      suggestedQuestions: initialData?.suggested_questions || ["Pricing information", "How to install?", "Contact sales"],
      showBranding: initialData?.show_branding ?? true,
      isEnabled: initialData?.is_enabled ?? true,
      collectLeads: initialData?.collect_leads ?? true,
      hostedChatEnabled: initialData?.hosted_chat_enabled ?? true,
      hostedChatSlug: initialData?.hosted_chat_slug || "",
      hostedChatTitle: initialData?.hosted_chat_title || "",
      hostedChatDescription: initialData?.hosted_chat_description || "",
      allowedDomains: initialData?.allowed_domains || [],
    });
  };

  const addQuestion = () => {
    if (newQuestion.trim()) {
      setConfig({
        ...config,
        suggestedQuestions: [...config.suggestedQuestions, newQuestion.trim()]
      });
      setNewQuestion("");
    }
  };

  const removeQuestion = (index: number) => {
    setConfig({
      ...config,
      suggestedQuestions: config.suggestedQuestions.filter((_, i) => i !== index)
    });
  };

  const colors = ["#4F46E5", "#3B82F6", "#10B981", "#0F172A", "#F43F5E", "#8B5CF6"];
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://agentifyhq.vercel.app").replace(/\/$/, "");
  const hostedChatLink = config.hostedChatSlug ? `${appUrl}/chat/${config.hostedChatSlug}` : "";
  const slugIsValid = /^[a-z0-9-]{3,}$/.test(config.hostedChatSlug);
  const normalizeSlug = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const copyHostedLink = async () => {
    if (!hostedChatLink) return;
    await navigator.clipboard.writeText(hostedChatLink);
    toast.success("Hosted chat link copied!");
  };

  return (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Widget Customizer</h1>
          <p className="text-slate-500">Style your chat widget to perfectly match your brand.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleReset}
            className="rounded-2xl h-12 px-6 flex items-center gap-2 font-bold border-2 border-slate-200"
          >
            <Undo className="w-4 h-4" />
            Reset
          </Button>
          <Button 
            disabled={isSaving}
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 px-6 flex items-center gap-2 font-bold"
          >
            {isSaving ? "Saving..." : (
              <>
                <Save className="w-4 h-4" />
                Publish Changes
              </>
            )}
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
                <div className="flex flex-wrap items-center gap-3">
                  {colors.map(color => (
                    <div 
                      key={color}
                      onClick={() => setConfig({...config, primaryColor: color})}
                      className={`w-10 h-10 rounded-xl cursor-pointer border-4 border-slate-50 shadow-sm transition-all ${config.primaryColor === color ? 'ring-2 ring-indigo-600' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    ></div>
                  ))}
                  <input 
                    type="color" 
                    value={config.primaryColor}
                    onChange={(e) => setConfig({...config, primaryColor: e.target.value})}
                    className="w-10 h-10 rounded-xl border-none cursor-pointer p-0 overflow-hidden"
                  />
                  <input 
                    type="text" 
                    value={config.primaryColor}
                    onChange={(e) => setConfig({...config, primaryColor: e.target.value})}
                    className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700 ml-1">Widget Position</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setConfig({...config, position: "bottom-right"})}
                    className={`flex-1 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${config.position === "bottom-right" ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    Bottom Right
                  </button>
                  <button 
                    onClick={() => setConfig({...config, position: "bottom-left"})}
                    className={`flex-1 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${config.position === "bottom-left" ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    Bottom Left
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-4">
              <label className="text-sm font-bold text-slate-700 ml-1">Widget Status</label>
              <div className="flex flex-wrap gap-4">
                 <button 
                  onClick={() => setConfig({...config, isEnabled: !config.isEnabled})}
                  className={`px-6 py-2 rounded-xl text-xs font-bold border-2 transition-all ${config.isEnabled ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-red-50 border-red-500 text-red-600'}`}
                >
                  {config.isEnabled ? "Enabled" : "Disabled"}
                </button>
                <button 
                  onClick={() => setConfig({...config, collectLeads: !config.collectLeads})}
                  className={`px-6 py-2 rounded-xl text-xs font-bold border-2 transition-all ${config.collectLeads ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  {config.collectLeads ? "Lead Collection On" : "Lead Collection Off"}
                </button>
                 <button 
                  onClick={() => setConfig({...config, showBranding: !config.showBranding})}
                  className={`px-6 py-2 rounded-xl text-xs font-bold border-2 transition-all ${config.showBranding ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  {config.showBranding ? "Branding On" : "Branding Off"}
                </button>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <label className="text-sm font-bold text-slate-700 ml-1">Allowed Domains (Optional)</label>
              <div className="space-y-2">
                <input 
                  type="text" 
                  placeholder="example.com, myshopify.com (comma separated)"
                  value={config.allowedDomains.join(", ")}
                  onChange={(e) => setConfig({...config, allowedDomains: e.target.value.split(",").map(d => d.trim()).filter(d => d !== "")})}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-indigo-500 transition-all font-medium"
                />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-1">Leave empty to allow all domains.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-indigo-600" />
              Hosted Chat Link
            </h3>

            <div className="space-y-6">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">Enable hosted chat page</p>
                  <p className="text-xs text-slate-500">Create a public link customers can open without a website.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, hostedChatEnabled: !config.hostedChatEnabled })}
                  className={`w-24 rounded-xl border-2 px-4 py-2 text-xs font-bold transition-all ${
                    config.hostedChatEnabled
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {config.hostedChatEnabled ? "On" : "Off"}
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Hosted Chat Slug</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white focus-within:border-indigo-500">
                    <span className="hidden shrink-0 items-center border-r border-slate-100 bg-slate-50 px-4 text-xs font-bold text-slate-400 sm:flex">
                      /chat/
                    </span>
                    <input
                      type="text"
                      value={config.hostedChatSlug}
                      onChange={(e) => setConfig({ ...config, hostedChatSlug: normalizeSlug(e.target.value) })}
                      placeholder="business-slug"
                      className="w-full px-4 py-3 text-sm font-bold outline-none"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyHostedLink}
                    disabled={!slugIsValid}
                    className="rounded-2xl border-2 border-slate-200 font-bold"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.open(hostedChatLink, "_blank", "noopener,noreferrer")}
                    disabled={!slugIsValid}
                    className="rounded-2xl border-2 border-slate-200 font-bold"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-widest ml-1 ${slugIsValid ? "text-slate-400" : "text-red-500"}`}>
                  Lowercase letters, numbers, and hyphens only. Minimum 3 characters.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Page Title</label>
                <input
                  type="text"
                  value={config.hostedChatTitle}
                  onChange={(e) => setConfig({ ...config, hostedChatTitle: e.target.value })}
                  placeholder="Chat with your business"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-indigo-500 transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Page Description</label>
                <textarea
                  rows={3}
                  value={config.hostedChatDescription}
                  onChange={(e) => setConfig({ ...config, hostedChatDescription: e.target.value })}
                  placeholder="Ask a question, request support, or leave your details."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium resize-none"
                />
              </div>

              {hostedChatLink && (
                <div className="rounded-2xl bg-slate-950 p-4 font-mono text-xs text-indigo-200 break-all">
                  {hostedChatLink}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Chat Content
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Welcome Text</label>
                <textarea 
                  rows={2}
                  value={config.welcomeText}
                  onChange={(e) => setConfig({...config, welcomeText: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium resize-none"
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-sm font-bold text-slate-700">Suggested Questions</label>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{config.suggestedQuestions.length} added</span>
                </div>
                <div className="space-y-2">
                  {config.suggestedQuestions.map((q, i) => (
                    <div key={i} className="flex items-center gap-2 group">
                      <div className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium">
                        {q}
                      </div>
                      <button 
                        onClick={() => removeQuestion(i)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-4">
                    <input 
                      type="text" 
                      placeholder="Add a new suggested question..."
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addQuestion()}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-all"
                    />
                    <Button 
                      type="button"
                      onClick={addQuestion}
                      className="h-8 w-8 p-0 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-5 relative">
          <div className="sticky top-10">
            <div className={`bg-slate-100 rounded-3xl p-10 min-h-[600px] flex items-end border-2 border-slate-200 border-dashed ${config.position === 'bottom-right' ? 'justify-end' : 'justify-start'}`}>
              {/* Actual Widget Preview */}
              <div className="w-full max-w-[360px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div 
                  className="p-6 text-white flex items-center justify-between"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">AI Assistant</h4>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                        <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Always Active</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 p-6 space-y-4 bg-white overflow-auto max-h-[300px]">
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${config.primaryColor}10`, color: config.primaryColor }}
                    >
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none text-xs text-slate-700 leading-relaxed">
                      {config.welcomeText}
                    </div>
                  </div>
                  
                  <div className="pt-2 flex flex-wrap gap-2">
                    {config.suggestedQuestions.map((q, i) => (
                      <button 
                        key={i} 
                        className="px-3 py-2 border rounded-xl text-[10px] font-bold transition-colors"
                        style={{ 
                          borderColor: `${config.primaryColor}20`, 
                          color: config.primaryColor,
                        }}
                      >
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
                  {config.showBranding && (
                    <div className="mt-3 flex items-center justify-center gap-1 text-[8px] font-bold text-slate-300 uppercase tracking-widest">
                      Powered by <span style={{ color: config.primaryColor }} className="opacity-80">Agentify</span>
                    </div>
                  )}
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
