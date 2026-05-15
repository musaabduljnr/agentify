import { createClient } from "@/utils/supabase/server";
import { getCurrentBusiness } from "./business";

export async function getDashboardStats() {
  const business = await getCurrentBusiness();
  if (!business) return null;

  const supabase = await createClient();

  // 1. Get total conversations
  const { count: totalConversations } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id);

  // 2. Get total leads (conversations with visitor_email or visitor_phone)
  const { count: totalLeads } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id)
    .or("visitor_email.neq.null,visitor_phone.neq.null");

  // 3. Get message usage from subscription
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("current_usage, message_limit")
    .eq("business_id", business.id)
    .maybeSingle();

  // 4. Get knowledge source count
  const { count: knowledgeSources } = await supabase
    .from("knowledge_sources")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id);

  return {
    totalConversations: totalConversations || 0,
    totalLeads: totalLeads || 0,
    usage: subscription?.current_usage || 0,
    limit: subscription?.message_limit || 100,
    knowledgeSources: knowledgeSources || 0,
  };
}

export async function getRecentConversations(limit = 5) {
  const business = await getCurrentBusiness();
  if (!business) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversations")
    .select(`
      id,
      visitor_name,
      visitor_email,
      visitor_phone,
      updated_at,
      messages:messages(content, created_at)
    `)
    .eq("business_id", business.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  return data.map(conv => {
    const lastMessage = (conv.messages as any[])?.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    return {
      id: conv.id,
      visitor: conv.visitor_name || "Anonymous",
      lastMessage: lastMessage?.content || "No messages yet",
      status: (conv.visitor_email || conv.visitor_phone) ? "Lead" : "Chat",
      time: new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  });
}

export async function getSetupChecklist() {
  const business = await getCurrentBusiness();
  if (!business) return [];

  const supabase = await createClient();

  const [assistant, widget, knowledge] = await Promise.all([
    supabase.from("assistants").select("id").eq("business_id", business.id).maybeSingle(),
    supabase.from("widget_configs").select("id").eq("business_id", business.id).maybeSingle(),
    supabase.from("knowledge_sources").select("id").eq("business_id", business.id).limit(1).maybeSingle(),
  ]);

  return [
    { id: 1, task: "Create Business Profile", completed: !!business.onboarding_completed },
    { id: 2, task: "Configure Assistant", completed: !!assistant.data },
    { id: 3, task: "Add Knowledge Base", completed: !!knowledge.data },
    { id: 4, task: "Customize Widget", completed: !!widget.data },
    { id: 5, task: "Install on Website", completed: false }, // Manual check or based on some flag
  ];
}
