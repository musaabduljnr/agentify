import { Metadata } from "next";
import { ChatPlayground } from "@/components/dashboard/playground/chat-playground";
import { requireCompleteBusinessSetup } from "@/lib/queries/business";
import { createClient } from "@/utils/supabase/server";
import { getBusinessBillingContext } from "@/lib/queries/billing";
import { UsageWarningBanner } from "@/components/billing/usage-warning-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings2, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "AI Playground | Agentify",
  description: "Test your AI business assistant in a private environment.",
};

export default async function PlaygroundPage() {
  const setup = await requireCompleteBusinessSetup();
  const { business, assistant } = setup;
  
  const supabase = await createClient();
  
  // Check if there is any embedded knowledge
  const { count } = await supabase
    .from("knowledge_chunks")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id);

  const hasKnowledge = (count || 0) > 0;

  const billing = await getBusinessBillingContext();
  const relevantWarnings = (billing?.warnings || []).filter(
    (w: any) => w.type === "messages"
  );

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">AI Playground</h1>
            <Badge variant="secondary" className="font-normal">Private workspace</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Test your assistant&apos;s knowledge and behavior before going live.
          </p>
        </div>
        {assistant && (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
              <Sparkles size={17} />
            </div>
            <div className="min-w-0">
              <p className="max-w-48 truncate text-sm font-medium">{assistant.name}</p>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {assistant.is_active && (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    <span>Active</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span className="capitalize">{assistant.tone || "Default"} tone</span>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="ml-1 shrink-0">
              <a href="/dashboard/assistant">
                <Settings2 size={15} className="mr-1.5" />
                Configure
              </a>
            </Button>
          </div>
        )}
      </header>

      <div className="min-h-0">
        <UsageWarningBanner warnings={relevantWarnings} />
      </div>

      <ChatPlayground
        initialAssistant={assistant}
        hasKnowledge={hasKnowledge}
      />
    </div>
  );
}
