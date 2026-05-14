import { Metadata } from "next";
import { ChatPlayground } from "@/components/dashboard/playground/chat-playground";
import { getCurrentBusiness, getAssistant } from "@/lib/actions/chat";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "AI Playground | Agentify",
  description: "Test your AI business assistant in a private environment.",
};

export default async function PlaygroundPage() {
  const business = await getCurrentBusiness();
  const assistant = await getAssistant(business.id);
  
  const supabase = await createClient();
  
  // Check if there is any embedded knowledge
  const { count, error: countError } = await supabase
    .from("knowledge_chunks")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id);

  const hasKnowledge = (count || 0) > 0;

  return (
    <div className="flex flex-col gap-6 h-full overflow-hidden">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Playground</h1>
        <p className="text-muted-foreground">
          Test your assistant&apos;s knowledge and behavior before going live.
        </p>
      </div>

      <ChatPlayground 
        initialAssistant={assistant} 
        hasKnowledge={hasKnowledge}
      />
    </div>
  );
}
