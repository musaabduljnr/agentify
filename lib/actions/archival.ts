"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

async function getCurrentBusiness() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  return business;
}

/**
 * Archive all conversations older than `days` days for the current business.
 * Calls the atomic RPC for safety.
 */
export async function archiveOldConversations(days: number = 90) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return { error: "Unauthorized" };

    const supabase = await createClient();
    const { data: count, error } = await supabase.rpc("archive_old_conversations", {
      p_business_id: business.id,
      p_days: days,
    });

    if (error) throw error;

    revalidatePath("/dashboard/conversations");
    revalidatePath("/dashboard/conversations/archived");
    return { success: true, count: count as number };
  } catch (err: any) {
    console.error("archiveOldConversations error:", err);
    return { error: "Failed to archive conversations. Please try again." };
  }
}

/**
 * Manually archive a single conversation.
 */
export async function archiveConversation(conversationId: string) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return { error: "Unauthorized" };

    const supabase = await createClient();
    const { error } = await supabase
      .from("conversations")
      .update({
        archived_at: new Date().toISOString(),
        archive_reason: "manual",
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("business_id", business.id);

    if (error) throw error;

    revalidatePath("/dashboard/conversations");
    return { success: true };
  } catch (err: any) {
    console.error("archiveConversation error:", err);
    return { error: "Failed to archive conversation." };
  }
}

/**
 * Restore an archived conversation.
 */
export async function unarchiveConversation(conversationId: string) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return { error: "Unauthorized" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("unarchive_conversation", {
      p_conversation_id: conversationId,
    });

    if (error) throw error;

    revalidatePath("/dashboard/conversations/archived");
    return { success: true };
  } catch (err: any) {
    console.error("unarchiveConversation error:", err);
    return { error: "Failed to restore conversation." };
  }
}

export interface ArchivedConversation {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  source: string;
  archived_at: string;
  archive_reason: string | null;
  created_at: string;
  message_count: number;
}

/**
 * Fetch archived conversations for the current business.
 */
export async function getArchivedConversations(page: number = 1, pageSize: number = 20): Promise<{
  data: ArchivedConversation[];
  total: number;
}> {
  try {
    const business = await getCurrentBusiness();
    if (!business) return { data: [], total: 0 };

    const supabase = await createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const [{ data, error }, { count }] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, visitor_name, visitor_email, source, archived_at, archive_reason, created_at")
        .eq("business_id", business.id)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false })
        .range(from, to),

      supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .not("archived_at", "is", null),
    ]);

    if (error) throw error;

    // Enrich with message counts
    const ids = (data || []).map(c => c.id);
    let messageCounts: Record<string, number> = {};

    if (ids.length > 0) {
      const { data: msgData } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", ids);

      (msgData || []).forEach((m: any) => {
        messageCounts[m.conversation_id] = (messageCounts[m.conversation_id] || 0) + 1;
      });
    }

    const enriched: ArchivedConversation[] = (data || []).map(c => ({
      ...c,
      message_count: messageCounts[c.id] || 0,
    }));

    return { data: enriched, total: count || 0 };
  } catch (err: any) {
    console.error("getArchivedConversations error:", err);
    return { data: [], total: 0 };
  }
}
