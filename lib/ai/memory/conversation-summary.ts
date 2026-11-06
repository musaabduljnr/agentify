import "server-only";
import { createServiceClient } from "@/utils/supabase/service";
import { isAssistantTurnCurrent } from "@/lib/knowledge/lifecycle";
import { generateGeminiContent } from "../providers/gemini";
import { type FeatureSource } from "../logs/ai-logs";

/**
 * Checks if a conversation has more than 10 messages and triggers summary extraction if so.
 * Stores the summary inside conversations.metadata.summary.
 */
export async function summarizeConversationIfNeeded(
  conversationId: string,
  businessId: string,
  featureSource?: FeatureSource,
  knowledgeVersion = 0
): Promise<string | null> {
  try {
    const supabase = createServiceClient();

    // 1. Fetch conversation details to check if summary is already present
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("metadata")
      .eq("id", conversationId)
      .maybeSingle();

    if (convErr || !conv) return null;

    const metadata = (conv.metadata as Record<string, any>) || {};
    const summaryVersion = metadata.summary_knowledge_version;
    const summaryIsCurrent =
      summaryVersion != null && Number(summaryVersion) === Number(knowledgeVersion);
    const currentSummary = summaryIsCurrent ? metadata.summary || null : null;
    
    // 2. Count messages
    const { count, error: countErr } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);

    if (countErr || !count || count < 10) {
      return currentSummary;
    }

    // Check if we summarized recently (e.g. within last 3 messages to avoid calling summary LLM constantly)
    const lastSummaryMessageCount = metadata.summary_msg_count || 0;
    if (
      summaryIsCurrent &&
      count - lastSummaryMessageCount < 3 &&
      metadata.summary
    ) {
      return metadata.summary;
    }

    // 3. Fetch all messages to build summary
    const { data: messages, error: msgErr } = await supabase
      .from("messages")
      .select("role, content, metadata")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgErr || !messages || messages.length === 0) {
      return currentSummary;
    }

    // Old assistant answers can contain deleted or outdated facts. Leave them
    // out of the transcript; visitor turns carry the requests and status.
    const currentMessages = messages.filter((m) =>
      isAssistantTurnCurrent(
        {
          role: m.role === "assistant" ? "assistant" : "user",
          metadata: (m.metadata as Record<string, unknown> | null) ?? null,
        },
        knowledgeVersion
      )
    );

    const conversationTranscript = currentMessages
      .map((m) => `${m.role === "assistant" ? "Assistant" : "Visitor"}: ${m.content}`)
      .join("\n");

    const prompt = `
You are an expert admin assistant. Summarize the following dialogue between a customer (Visitor) and an AI support agent in 2-3 concise sentences.
Focus on what the customer wants, any contact details provided, and the current status of their requests. Do not hallucinate or add outside facts.
Do not include prices, policies, hours, availability, or other factual business details stated by the Assistant; those may be outdated. Summarize only the visitor's requests and the status of the conversation.

CONVERSATION TRANSCRIPT:
${conversationTranscript}

SUMMARY:
`.trim();

    console.log(`[Memory] Generating conversation summary for ${conversationId}...`);
    const summary = await generateGeminiContent({
      model: "gemini-2.5-flash",
      prompt,
      systemInstruction: "You are a concise summarizer. Keep summaries under 60 words.",
      businessId,
      featureSource,
    });

    if (summary) {
      metadata.summary = summary.trim();
      metadata.summary_msg_count = count;
      metadata.summary_knowledge_version = Number(knowledgeVersion);
      
      await supabase
        .from("conversations")
        .update({ metadata })
        .eq("id", conversationId);
      
      return metadata.summary;
    }

    return currentSummary;
  } catch (err) {
    console.error("[Memory Error] Failed to generate conversation summary:", err);
    return null;
  }
}
