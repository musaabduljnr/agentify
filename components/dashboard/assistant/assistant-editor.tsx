"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Bot, Save, Wand2, ArrowRight, Loader2, ShieldAlert, 
  Plus, Trash2, Sparkles, AlertTriangle, Lock, Eye
} from "lucide-react";
import { 
  updateAssistant, 
  setActiveAssistant, 
  deleteAssistant, 
  createAssistant 
} from "@/lib/actions/chat";
import { toast } from "sonner";
import Link from "next/link";

interface AssistantEditorProps {
  initialBusiness: any;
  initialAssistants: any[];
  subscription: any;
}

export function AssistantEditor({ initialBusiness, initialAssistants, subscription }: AssistantEditorProps) {
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [assistants, setAssistants] = useState<any[]>(initialAssistants);
  
  // Calculate active and selected
  const activeId = assistants.find((a) => a.is_active)?.id || "";
  const [selectedId, setSelectedId] = useState<string>(activeId || assistants[0]?.id || "");

  const selectedAssistant = assistants.find((a) => a.id === selectedId);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    tone: "Friendly",
    welcome_message: "",
    business_description: initialBusiness?.description || "",
  });

  // Sync form data whenever selected assistant changes
  useEffect(() => {
    if (selectedAssistant) {
      setFormData({
        name: selectedAssistant.name || "",
        tone: selectedAssistant.tone || "Friendly",
        welcome_message: selectedAssistant.welcome_message || "",
        business_description: initialBusiness?.description || "",
      });
    }
  }, [selectedId, assistants, initialBusiness]);

  const limit = subscription?.widget_limit || 1;
  const planName = subscription?.plan === "free_trial" 
    ? "Free Early Access" 
    : (subscription?.plan || "Starter").charAt(0).toUpperCase() + (subscription?.plan || "Starter").slice(1);
  const isLimitReached = assistants.length >= limit;

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const result = await updateAssistant({
        id: selectedId,
        name: formData.name,
        tone: formData.tone,
        welcome_message: formData.welcome_message,
        business_description: formData.business_description,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Assistant configuration saved!");
        setAssistants(prev => prev.map(a => a.id === selectedId ? {
          ...a,
          name: formData.name,
          tone: formData.tone,
          welcome_message: formData.welcome_message,
        } : a));
      }
    } catch (error) {
      toast.error("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent selection override
    const toastId = toast.loading("Activating assistant...");
    try {
      const result = await setActiveAssistant(id);
      if (result.error) {
        toast.error(result.error, { id: toastId });
      } else {
        toast.success("Assistant activated successfully!", { id: toastId });
        setAssistants(prev => prev.map(a => ({
          ...a,
          is_active: a.id === id
        })));
      }
    } catch (err) {
      toast.error("Failed to activate assistant.", { id: toastId });
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this assistant configuration?")) return;
    
    const toastId = toast.loading("Deleting assistant...");
    try {
      const result = await deleteAssistant(id);
      if (result.error) {
        toast.error(result.error, { id: toastId });
      } else {
        toast.success("Assistant deleted.", { id: toastId });
        
        const deletedWasActive = assistants.find(a => a.id === id)?.is_active;
        const updatedAssistants = assistants.filter(a => a.id !== id);
        
        if (deletedWasActive && updatedAssistants.length > 0) {
          updatedAssistants[0].is_active = true;
        }
        
        setAssistants(updatedAssistants);
        
        if (selectedId === id && updatedAssistants.length > 0) {
          setSelectedId(updatedAssistants[0].id);
        }
      }
    } catch (err) {
      toast.error("Failed to delete assistant.", { id: toastId });
    }
  };

  const handleCreate = async () => {
    if (isLimitReached) {
      toast.error(`Limit reached. Upgrading your plan is required to add more assistants.`);
      return;
    }

    setCreating(true);
    const toastId = toast.loading("Creating new assistant config...");
    try {
      const defaultName = `Assistant #${assistants.length + 1}`;
      const result = await createAssistant({
        name: defaultName,
        tone: "Friendly",
        welcome_message: "Hello! I am your AI assistant. How can I help you today?",
      });

      if (result.error) {
        toast.error(result.error, { id: toastId });
      } else if (result.assistant) {
        toast.success("New assistant configuration created!", { id: toastId });
        setAssistants(prev => [...prev, result.assistant]);
        setSelectedId(result.assistant.id);
      }
    } catch (err) {
      toast.error("Failed to create assistant.", { id: toastId });
    } finally {
      setCreating(false);
    }
  };

  if (!initialBusiness) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-6 bg-muted/10 rounded-2xl border-2 border-dashed">
        <ShieldAlert size={48} className="text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Business Profile Missing</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          You need to set up your business profile before you can configure your AI assistants.
        </p>
        <Button asChild>
          <Link href="/onboarding">Complete Onboarding</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">AI Assistants Manager</h1>
          <p className="text-slate-500">Configure, activate, and toggle multiple custom AI configurations.</p>
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
          {selectedId && (
            <Button 
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl px-6 flex items-center gap-2 h-12 min-w-[140px]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid: Management Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Sidebar: Assistants List Manager (4 Columns) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Your Assistants</h3>
              <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {assistants.length} of {limit === 999999999 ? "∞" : limit}
              </span>
            </div>

            {/* List */}
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {assistants.map((ast) => {
                const isSelected = ast.id === selectedId;
                return (
                  <div
                    key={ast.id}
                    onClick={() => setSelectedId(ast.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex items-center justify-between group ${
                      isSelected 
                        ? "border-indigo-600 bg-indigo-50/20 shadow-sm" 
                        : "border-slate-150 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                        ast.is_active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                        <Bot className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-extrabold text-xs text-slate-900 truncate leading-tight">{ast.name}</p>
                          {ast.is_active && (
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Live Assistant" />
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{ast.tone} tone</p>
                      </div>
                    </div>

                    {/* Controls inside item */}
                    <div className="flex items-center gap-2 shrink-0">
                      {ast.is_active ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[8px] font-black uppercase tracking-wider">
                          Active
                        </span>
                      ) : (
                        <button
                          onClick={(e) => handleActivate(ast.id, e)}
                          className="px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          Activate
                        </button>
                      )}

                      {assistants.length > 1 && (
                        <button
                          onClick={(e) => handleDelete(ast.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          aria-label="Delete Assistant"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Creation CTA / Plan Lock */}
            <div className="border-t border-slate-100 pt-5">
              {isLimitReached ? (
                <div className="bg-amber-50/50 rounded-2xl border border-amber-100 p-4 space-y-3">
                  <div className="flex gap-2.5 items-start">
                    <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 leading-tight">Create Assistant Locked</h4>
                      <p className="text-[10px] text-amber-700 leading-normal mt-1">
                        Your current <strong>{planName}</strong> plan supports up to {limit} AI assistant. Upgrade to Growth to add up to 3 assistants.
                      </p>
                    </div>
                  </div>
                  <Link href="/dashboard/billing" className="block">
                    <Button 
                      variant="outline" 
                      className="w-full text-xs font-bold py-2 h-9 border-amber-200 hover:bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                      Upgrade to unlock
                    </Button>
                  </Link>
                </div>
              ) : (
                <Button 
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 h-11"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4.5 h-4.5" />}
                  Create Assistant config
                </Button>
              )}
            </div>
          </div>

          {/* Quick Stats/Tip */}
          <div className="bg-indigo-50/50 rounded-3xl p-6 border border-indigo-100 flex gap-3.5">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shrink-0 h-10 w-10 flex items-center justify-center shadow">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-indigo-900 text-xs font-bold mb-1">Active Chat Assistant</h4>
              <p className="text-indigo-700 text-[10px] leading-relaxed">
                Only the designated <strong>Active</strong> assistant configuration handles website widget and hosted chat sessions. Toggling configuration records takes effect instantly.
              </p>
            </div>
          </div>
        </div>

        {/* Right Section: Configuration Editor Form & Live Preview (8 Columns) */}
        <div className="lg:col-span-8">
          {selectedAssistant ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              
              {/* Form Config Fields (8 Columns of sub-grid) */}
              <div className="md:col-span-7 space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Assistant Configuration</h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 ml-1">Assistant Name</label>
                      <input 
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-xs text-slate-800"
                        placeholder="Name your assistant"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 ml-1">Tone of Voice</label>
                      <select 
                        value={formData.tone}
                        onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium bg-white text-xs text-slate-850"
                      >
                        <option>Friendly</option>
                        <option>Professional</option>
                        <option>Witty</option>
                        <option>Luxury</option>
                        <option>Direct</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 ml-1 flex items-center justify-between">
                      <span>Welcome Message</span>
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest">Supports Markdown</span>
                    </label>
                    <textarea 
                      rows={3}
                      value={formData.welcome_message}
                      onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-xs text-slate-800 resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 ml-1 flex items-center justify-between">
                      <span>Business Description</span>
                    </label>
                    <textarea 
                      rows={5}
                      value={formData.business_description}
                      onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
                      placeholder="Briefly describe what your business does and how the assistant should represent it..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-xs text-slate-800 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Chat Live Preview Panel (5 Columns of sub-grid) */}
              <div className="md:col-span-5 space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-slate-400" />
                      <h3 className="text-xs font-bold text-slate-900">Live Preview</h3>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-50 min-h-[320px] flex flex-col justify-between">
                    <div className="space-y-3 flex-1 overflow-y-auto">
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                        <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-inner border border-slate-150 text-[10px] text-slate-700 font-semibold leading-relaxed break-words max-w-[85%]">
                          {formData.welcome_message || "Hi, how can I help you today?"}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="bg-indigo-600 p-2.5 rounded-xl rounded-tr-none text-[10px] text-white max-w-[80%] font-semibold shadow-sm leading-relaxed">
                          Tell me about your services.
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <div className="bg-white border border-slate-200 rounded-full py-2 px-3 text-[9px] text-slate-400 font-bold flex justify-between items-center shadow-inner">
                        <span>Preview message box...</span>
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                          <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50/40 text-center border-t border-slate-150">
                    <p className="text-[9px] text-indigo-750 font-black uppercase tracking-wider">{formData.name}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 bg-white rounded-3xl border border-slate-200 shadow-sm text-center">
              <Bot className="w-10 h-10 text-slate-350 animate-pulse mb-3" />
              <p className="text-slate-500 font-bold text-sm">Select an assistant configuration to get started.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
