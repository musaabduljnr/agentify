"use client";

import { useState, useEffect } from "react";
import {
  updateAIEngineSettings,
  testAIProvider,
  testEmbeddingProvider,
} from "@/lib/actions/admin";
import {
  Cpu,
  Save,
  Play,
  Sparkles,
  CheckCircle2,
  AlertOctagon,
  Loader2,
  Clock,
  Activity,
  AlertTriangle,
  FileCheck,
  Layers,
  ArrowRight,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AISettingsFormProps {
  initialSettings: any;
  logsStats?: {
    logs: any[];
    metrics: {
      totalRequests: number;
      successRate: number;
      avgLatency: number;
      failedRequests: number;
      fallbackRequests: number;
    };
    providerMetrics: Array<{
      providerModel: string;
      successRate: number;
      avgLatency: number;
      totalRequests: number;
    }>;
  };
}

const PROVIDER_CHAT_MODELS: Record<string, string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"],
  openrouter: [
    "openai/gpt-oss-20b:free",
    "deepseek/deepseek-v4-flash:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "google/gemma-4-26b-a4b-it:free",
    "openrouter/auto",
  ],
  vertex: ["gemini-2.5-flash"],
  groq: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"],
};

const PROVIDER_EMBEDDING_MODELS: Record<string, string[]> = {
  gemini: ["gemini-embedding-001"],
  vertex: ["text-embedding-004"],
};

export function AISettingsForm({ initialSettings, logsStats }: AISettingsFormProps) {
  const [provider, setProvider] = useState(initialSettings?.provider || "gemini");
  const [chatModel, setChatModel] = useState(initialSettings?.chat_model || "gemini-2.5-flash");
  
  const [embeddingProvider, setEmbeddingProvider] = useState(initialSettings?.embedding_provider || "gemini");
  const [embeddingModel, setEmbeddingModel] = useState(initialSettings?.embedding_model || "gemini-embedding-001");
  
  const [fallbackProvider, setFallbackProvider] = useState(initialSettings?.fallback_provider || "openrouter");
  const [fallbackChatModel, setFallbackChatModel] = useState(initialSettings?.fallback_chat_model || "openai/gpt-oss-20b:free");

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

  const metrics = logsStats?.metrics || {
    totalRequests: 0,
    successRate: 100,
    avgLatency: 0,
    failedRequests: 0,
    fallbackRequests: 0,
  };

  const logs = logsStats?.logs || [];
  const providerMetrics = logsStats?.providerMetrics || [];

  return (
    <div className="space-y-12">
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

      {/* 3. System Health & Observability */}
      <div className="space-y-8">
        <div className="border-b border-slate-900 pb-4">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            System Health & AI Engine Observability
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Real-time latency metrics, failover frequency records, and diagnostic invocation tracing.
          </p>
        </div>

        {/* Observability Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Interactions</span>
            <div className="text-2xl font-extrabold text-white flex items-baseline gap-2">
              {metrics.totalRequests}
              <span className="text-xs text-slate-400 font-normal">requests</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">Cumulative model calls tracked.</p>
          </div>

          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Success Rate</span>
            <div className="text-2xl font-extrabold text-white">
              {metrics.successRate.toFixed(1)}%
            </div>
            <div className="flex gap-2 text-[10px]">
              <span className="text-emerald-400 font-semibold">{metrics.totalRequests - metrics.failedRequests} OK</span>
              <span className="text-red-400 font-semibold">{metrics.failedRequests} ERR</span>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Avg Latency</span>
            <div className="text-2xl font-extrabold text-white flex items-baseline gap-2">
              {metrics.avgLatency.toFixed(0)}
              <span className="text-xs text-slate-400 font-normal">ms</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">Mean response generation duration.</p>
          </div>

          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Failovers Triggered</span>
            <div className="text-2xl font-extrabold text-amber-400 flex items-baseline gap-2">
              {metrics.fallbackRequests}
              <span className="text-xs text-slate-400 font-normal">events</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">Primary engine timeouts or crash recovery.</p>
          </div>

        </div>

        {/* Split Section: Provider Breakdown & Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Provider performance metrics */}
          <div className="lg:col-span-1 bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 border-b border-slate-900 pb-3">
              <Layers className="w-4 h-4 text-indigo-400" />
              Engine Performance
            </h3>

            {providerMetrics.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4">No diagnostic metrics recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {providerMetrics.map((pm, idx) => (
                  <div key={idx} className="bg-slate-900/50 border border-slate-850 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white truncate max-w-[150px]">{pm.providerModel}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        pm.successRate >= 95 ? "bg-emerald-500/10 text-emerald-400" :
                        pm.successRate >= 80 ? "bg-amber-500/10 text-amber-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>
                        {pm.successRate.toFixed(1)}% SR
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{pm.totalRequests} calls</span>
                      <span>Avg: {pm.avgLatency.toFixed(0)}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Diagnostic Invocation logs */}
          <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 border-b border-slate-900 pb-3">
              <Clock className="w-4 h-4 text-indigo-400" />
              Recent Interaction Diagnostic Logs
            </h3>

            {logs.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-8 text-center">No interaction log logs captured yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="pb-3 pr-2">Timestamp</th>
                      <th className="pb-3 px-2">Business</th>
                      <th className="pb-3 px-2">Provider (Model)</th>
                      <th className="pb-3 px-2 text-right">Latency</th>
                      <th className="pb-3 pl-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/40">
                        <td className="py-3 pr-2 text-slate-500 font-mono">
                          {new Date(log.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-3 px-2 font-semibold text-white max-w-[120px] truncate">
                          {log.businesses?.name || "Global / System"}
                        </td>
                        <td className="py-3 px-2 font-mono">
                          {log.provider} ({log.model})
                          {log.fallback_used && (
                            <span className="ml-1.5 text-[9px] text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded font-sans">
                              failover
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-bold text-slate-400">
                          {log.latency_ms}ms
                        </td>
                        <td className="py-3 pl-2 text-right">
                          <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[9px] ${
                            log.status === "success" ? "bg-emerald-500/10 text-emerald-400" :
                            log.status === "fallback_success" ? "bg-amber-500/10 text-amber-400" :
                            "bg-red-500/10 text-red-400"
                          }`}>
                            {log.status === "success" && "success"}
                            {log.status === "fallback_success" && "failover success"}
                            {log.status === "failed" && "failed"}
                          </span>
                          {log.error_message && (
                            <div className="text-[9px] text-red-400 font-mono mt-1 text-left max-w-[200px] truncate" title={log.error_message}>
                              {log.error_message}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
