"use client";

import { useState, useEffect } from "react";
import {
  updateAIEngineSettings,
  testAIProvider,
  testEmbeddingProvider,
} from "@/lib/actions/admin";
import { Cpu, Save, Play, Sparkles, CheckCircle2, AlertOctagon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AISettingsFormProps {
  initialSettings: any;
}

const PROVIDER_CHAT_MODELS: Record<string, string[]> = {
  gemini: ["gemini-2.0-flash", "gemini-1.5-flash"],
  openrouter: [
    "meta-llama/llama-3.1-8b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "mistralai/mistral-7b-instruct:free",
  ],
  vertex: ["gemini-2.5-flash"],
  groq: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"],
};

const PROVIDER_EMBEDDING_MODELS: Record<string, string[]> = {
  gemini: ["text-embedding-004"],
  vertex: ["text-embedding-004"],
};

export function AISettingsForm({ initialSettings }: AISettingsFormProps) {
  const [provider, setProvider] = useState(initialSettings?.provider || "gemini");
  const [chatModel, setChatModel] = useState(initialSettings?.chat_model || "gemini-2.0-flash");
  
  const [embeddingProvider, setEmbeddingProvider] = useState(initialSettings?.embedding_provider || "gemini");
  const [embeddingModel, setEmbeddingModel] = useState(initialSettings?.embedding_model || "text-embedding-004");
  
  const [fallbackProvider, setFallbackProvider] = useState(initialSettings?.fallback_provider || "openrouter");
  const [fallbackChatModel, setFallbackChatModel] = useState(initialSettings?.fallback_chat_model || "meta-llama/llama-3.1-8b-instruct:free");

  const [saving, setSaving] = useState(false);
  const [testingChat, setTestingChat] = useState(false);
  const [testingEmbedding, setTestingEmbedding] = useState(false);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Update default models when provider changes
  useEffect(() => {
    const models = PROVIDER_CHAT_MODELS[provider] || [];
    if (models.length > 0 && !models.includes(chatModel)) {
      setChatModel(models[0]);
    }
  }, [provider]);

  useEffect(() => {
    const models = PROVIDER_EMBEDDING_MODELS[embeddingProvider] || [];
    if (models.length > 0 && !models.includes(embeddingModel)) {
      setEmbeddingModel(models[0]);
    }
  }, [embeddingProvider]);

  useEffect(() => {
    const models = PROVIDER_CHAT_MODELS[fallbackProvider] || [];
    if (models.length > 0 && !models.includes(fallbackChatModel)) {
      setFallbackChatModel(models[0]);
    }
  }, [fallbackProvider]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const result = await updateAIEngineSettings({
        provider,
        chat_model: chatModel,
        embedding_provider: embeddingProvider,
        embedding_model: embeddingModel,
        fallback_provider: fallbackProvider,
        fallback_chat_model: fallbackChatModel,
      });

      if (result.error) throw new Error(result.error);
      setFeedback({ type: "success", text: "AI Engine configurations saved & active successfully!" });
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to save AI engine configurations." });
    } finally {
      setSaving(false);
    }
  };

  const handleTestChat = async () => {
    setTestingChat(true);
    setFeedback(null);
    setTestResult(null);
    try {
      const result = await testAIProvider(provider, chatModel);
      if (result.error) {
        throw new Error(result.error);
      }
      setFeedback({ type: "success", text: "Primary Chat provider connectivity verified!" });
      setTestResult(result.response || "No response received.");
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Primary Chat test invocation failed." });
    } finally {
      setTestingChat(false);
    }
  };

  const handleTestEmbedding = async () => {
    setTestingEmbedding(true);
    setFeedback(null);
    setTestResult(null);
    try {
      const result = await testEmbeddingProvider(embeddingProvider, embeddingModel);
      if (result.error) {
        throw new Error(result.error);
      }
      setFeedback({ type: "success", text: `Embedding Provider verified! Response dimension size: ${result.dimensions}` });
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Embedding connection check failed." });
    } finally {
      setTestingEmbedding(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
      
      {/* 1. Configuration Panel Form */}
      <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-3xl p-8 space-y-8">
        
        {/* Chat LLM Provider settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-900 pb-3">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Primary Chat Model configurations
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="text-slate-400 font-bold block mb-2">Provider Engine</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="gemini">Gemini (Google)</option>
                <option value="openrouter">OpenRouter (Multi-model)</option>
                <option value="groq">Groq (LPU Speed)</option>
                <option value="vertex">Vertex AI (Google Enterprise)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-bold block mb-2">Target Chat Model</label>
              <select
                value={chatModel}
                onChange={(e) => setChatModel(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 font-semibold focus:outline-none focus:border-indigo-500"
              >
                {(PROVIDER_CHAT_MODELS[provider] || []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Embedding settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-900 pb-3">
            <Cpu className="w-4 h-4 text-indigo-400" />
            Vector Embeddings configuration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="text-slate-400 font-bold block mb-2">Embedding Provider</label>
              <select
                value={embeddingProvider}
                onChange={(e) => setEmbeddingProvider(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="gemini">Gemini</option>
                <option value="vertex">Vertex AI</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-bold block mb-2">Embedding Model</label>
              <select
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 font-semibold focus:outline-none focus:border-indigo-500"
              >
                {(PROVIDER_EMBEDDING_MODELS[embeddingProvider] || []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Fallback settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-900 pb-3">
            <AlertOctagon className="w-4 h-4 text-indigo-400" />
            Failover Fallback configurations
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="text-slate-400 font-bold block mb-2">Fallback Provider</label>
              <select
                value={fallbackProvider}
                onChange={(e) => setFallbackProvider(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="gemini">Gemini</option>
                <option value="openrouter">OpenRouter</option>
                <option value="groq">Groq</option>
                <option value="vertex">Vertex AI</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-bold block mb-2">Fallback Model</label>
              <select
                value={fallbackChatModel}
                onChange={(e) => setFallbackChatModel(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 font-semibold focus:outline-none focus:border-indigo-500"
              >
                {(PROVIDER_CHAT_MODELS[fallbackProvider] || []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Form controls */}
        <div className="pt-6 border-t border-slate-900 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-2xl h-12 px-6 bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save & Deploy Active Engine
          </Button>
        </div>

      </div>

      {/* 2. Interactive Testing Center */}
      <div className="space-y-6">
        
        {/* Test panel container */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <Play className="w-3.5 h-3.5 text-indigo-400" />
            Connectivity Test Center
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed">
            Verify keys, system authorizations, and responsiveness of the configured model integrations without editing core code.
          </p>

          <div className="space-y-3">
            {/* Test Chat */}
            <Button
              onClick={handleTestChat}
              disabled={testingChat || testingEmbedding || saving}
              variant="outline"
              className="w-full rounded-xl h-11 border-slate-800 hover:bg-slate-900 hover:text-white text-xs font-bold text-slate-300"
            >
              {testingChat ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Testing Chat Provider...
                </>
              ) : (
                "Test Chat Provider Connection"
              )}
            </Button>

            {/* Test Embeddings */}
            <Button
              onClick={handleTestEmbedding}
              disabled={testingChat || testingEmbedding || saving}
              variant="outline"
              className="w-full rounded-xl h-11 border-slate-800 hover:bg-slate-900 hover:text-white text-xs font-bold text-slate-300"
            >
              {testingEmbedding ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Testing Embedding Provider...
                </>
              ) : (
                "Test Embedding Provider"
              )}
            </Button>
          </div>
        </div>

        {/* Live response / alert console */}
        {(feedback || testResult) && (
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
            {feedback && (
              <div className="flex items-start gap-2 text-xs">
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <span className={feedback.type === "success" ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                  {feedback.text}
                </span>
              </div>
            )}

            {testResult && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Live Response Output
                </p>
                <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl font-mono text-xs text-indigo-300 italic leading-relaxed whitespace-pre-wrap select-all">
                  {testResult}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
