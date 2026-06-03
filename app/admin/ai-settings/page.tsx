import { getAIEngineSettings, getAIEngineLogsStats } from "@/lib/actions/admin";
import { AISettingsForm } from "@/components/admin/ai-settings-form";
import { Cpu } from "lucide-react";

export default async function AdminAISettingsPage() {
  const settings = await getAIEngineSettings();
  const logsStats = await getAIEngineLogsStats();

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
          <Cpu className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
            AI Engine Configurations
          </h1>
          <p className="text-slate-400 text-sm">
            Dynamically switch core chat & embedding LLM providers on the fly without making codebase adjustments.
          </p>
        </div>
      </div>

      {/* Dynamic Settings Form Component */}
      <AISettingsForm initialSettings={settings} logsStats={logsStats} />
    </div>
  );
}
