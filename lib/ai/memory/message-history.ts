import "server-only";
import { createServiceClient } from "@/utils/supabase/service";
import { isAssistantTurnCurrent } from "@/lib/knowledge/lifecycle";
import { type ChatMessage } from "../engine/types";

/**
 * Retrieves recent messages for a conversation in chronological order.
 * Excludes system instructions, formats roles as 'user' or 'model', and keeps
 * only assistant turns produced by the business's current knowledge version.
 */
export async function getRecentConversationMessages(
  conversationId: string,
  limit = 8,
  currentKnowledgeVersion?: number
): Promise<ChatMessage[]> {
  try {
    const supabase = createServiceClient();
    const { data: messages, error } = await supabase
      .from("messages")
      .select("role, content, metadata")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false }) // Get newest first
      .limit(limit);

    if (error || !messages) return [];

    // Reverse to restore chronological order and map roles
    return messages
      .reverse()
      .filter((m) => m.role !== "system")
      .filter(
        (m) =>
          currentKnowledgeVersion === undefined ||
          isAssistantTurnCurrent(
            {
              role: m.role === "assistant" ? "assistant" : "user",
              metadata: (m.metadata as Record<string, unknown> | null) ?? null,
            },
            currentKnowledgeVersion
          )
      )
      .map((m) => ({
        role: m.role === "assistant" ? "model" as const : "user" as const,
        content: m.content || "",
      }));
  } catch (err) {
    console.error("[Memory Error] Failed to retrieve conversation history:", err);
    return [];
  }
}
