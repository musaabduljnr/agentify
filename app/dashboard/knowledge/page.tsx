import { KnowledgeTabs } from "@/components/dashboard/knowledge/knowledge-tabs";
import { KnowledgeSourceTable } from "@/components/dashboard/knowledge/knowledge-source-table";
import { TestKnowledgeSearch } from "@/components/dashboard/knowledge/test-knowledge-search";
import { getKnowledgeSources, getCurrentBusiness } from "@/lib/actions/knowledge";
import { getBusinessBillingContext } from "@/lib/queries/billing";
import { UsageWarningBanner } from "@/components/billing/usage-warning-banner";
import { BrainCircuit } from "lucide-react";

export default async function KnowledgeBasePage() {
  const [sources, business, billing] = await Promise.all([
    getKnowledgeSources(),
    getCurrentBusiness(),
    getBusinessBillingContext(),
  ]);

  // Filter warnings relevant to this page
  const relevantWarnings = (billing?.warnings || []).filter(
    (w: any) => w.type === "knowledge_sources" || w.type === "embeddings"
  );

  return (
    <>
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <BrainCircuit className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Knowledge Base</h1>
            <p className="text-slate-500">Add the information your AI assistant will use to answer customers.</p>
          </div>
        </div>
      </div>

      {/* Usage Warnings */}
      <UsageWarningBanner warnings={relevantWarnings} />

      {/* Add Knowledge Section */}
      <div className="mb-10">
        <KnowledgeTabs />
      </div>

      {/* Knowledge Sources List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Your Knowledge Sources</h2>
          <p className="text-xs text-slate-500 mt-1">{sources.length} source{sources.length !== 1 ? "s" : ""} added</p>
        </div>
        <KnowledgeSourceTable sources={sources} />
      </div>

      {/* Test Search Section */}
      {sources.some(s => s.metadata?.embedded) && (
        <TestKnowledgeSearch businessId={business.id} />
      )}
    </>
  );
}
