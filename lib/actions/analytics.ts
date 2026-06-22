"use server";

import { createClient } from "@/utils/supabase/server";
import { startOfDay, subDays, eachDayOfInterval, format, isSameDay } from "date-fns";
import { getConfig } from "@/lib/config/platform-config";

async function getCurrentBusiness() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  return business;
}

export interface AnalyticsData {
  stats: {
    totalConversations: number;
    totalMessages: number;
    totalLeads: number;
    conversionRate: number;
    widgetConversations: number;
    hostedChatConversations: number;
    hostedChatLeads: number;
    playgroundConversations: number;
    avgMessagesPerSession: number;
    sessionsWithLeads: number;
    demoConversations: number;
    demoLeads: number;
  };
  dailyTrend: {
    date: string;
    conversations: number;
    leads: number;
  }[];
  sources: {
    name: string;
    value: number;
  }[];
  intentBreakdown: {
    name: string;
    value: number;
  }[];
  usageByType: {
    name: string;
    value: number;
  }[];
  mostAskedQuestions: {
    question: string;
    count: number;
  }[];
  recentUnanswered: {
    conversationId: string;
    visitorName: string;
    visitorEmail: string;
    question: string;
    createdAt: string;
  }[];
}

export async function getBusinessAnalytics(days: number = 30): Promise<AnalyticsData | null> {
  try {
    const analyticsEnabled = await getConfig("feature_flags", "enable_analytics");
    if (analyticsEnabled === "false") {
      return null;
    }

    const business = await getCurrentBusiness();
    if (!business) return null;

    const supabase = await createClient();
    const thresholdDate = subDays(new Date(), days);

    // Fetch all data sources concurrently
    const [
      { data: conversations, error: convError },
      { data: messages, error: msgError },
      { data: leads, error: leadError },
      { data: usageLogs, error: usageError },
      { data: demoData },
    ] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, source, created_at, visitor_name, visitor_email, visitor_phone, metadata")
        .eq("business_id", business.id)
        .is("archived_at", null)
        .gte("created_at", thresholdDate.toISOString()),

      supabase
        .from("messages")
        .select("id, role, content, conversation_id, created_at")
        .eq("business_id", business.id)
        .gte("created_at", thresholdDate.toISOString()),

      supabase
        .from("leads")
        .select("id, source, interest, metadata, created_at, conversation_id")
        .eq("business_id", business.id)
        .gte("created_at", thresholdDate.toISOString()),

      supabase
        .from("usage_logs")
        .select("type, amount, created_at")
        .eq("business_id", business.id)
        .gte("created_at", thresholdDate.toISOString()),

      // Demo usage from demo_businesses
      supabase
        .from("demo_businesses")
        .select("conversation_count, lead_count, unique_visitor_count")
        .eq("created_by", (await supabase.auth.getUser()).data.user?.id ?? "")
        .eq("status", "active")
        .limit(10),
    ]);

    if (convError) throw new Error(convError.message);
    if (msgError) throw new Error(msgError.message);
    if (leadError) throw new Error(leadError.message);
    if (usageError) throw new Error(usageError.message);

    const convList = conversations || [];
    const msgList = messages || [];
    const leadList = leads || [];
    const usageList = usageLogs || [];
    const demoList = demoData || [];

    // Core statistics
    const totalConversations = convList.length;
    const totalMessages = msgList.length;
    const totalLeads = leadList.length;
    const conversionRate = totalConversations > 0
      ? Math.round((totalLeads / totalConversations) * 1000) / 10
      : 0;

    const widgetConversations = convList.filter(c => c.source === "widget").length;
    const hostedChatConversations = convList.filter(c => c.source === "hosted_chat").length;
    const hostedChatLeads = leadList.filter(l => l.source === "hosted_chat").length;
    const playgroundConversations = convList.filter(c => c.source === "dashboard_test").length;

    // Assistant performance: avg messages per session, sessions that converted to leads
    const leadConvIds = new Set(leadList.map(l => l.conversation_id).filter(Boolean));
    const sessionsWithLeads = convList.filter(c => leadConvIds.has(c.id)).length;

    const msgCountByConv: Record<string, number> = {};
    msgList.forEach(m => {
      msgCountByConv[m.conversation_id] = (msgCountByConv[m.conversation_id] || 0) + 1;
    });
    const convCounts = Object.values(msgCountByConv);
    const avgMessagesPerSession = convCounts.length > 0
      ? Math.round((convCounts.reduce((a, b) => a + b, 0) / convCounts.length) * 10) / 10
      : 0;

    // Demo usage aggregation
    const demoConversations = demoList.reduce((sum, d) => sum + (d.conversation_count || 0), 0);
    const demoLeads = demoList.reduce((sum, d) => sum + (d.lead_count || 0), 0);

    // Daily trend
    const daysInterval = eachDayOfInterval({ start: thresholdDate, end: new Date() });
    const dailyTrend = daysInterval.map(day => {
      const dateStr = format(day, "MMM dd");
      const dayConvs = convList.filter(c => isSameDay(new Date(c.created_at), day)).length;
      const dayLeads = leadList.filter(l => isSameDay(new Date(l.created_at), day)).length;
      return { date: dateStr, conversations: dayConvs, leads: dayLeads };
    });

    // Source breakdown
    const sourceMap: Record<string, number> = {};
    const sourceLabels: Record<string, string> = {
      widget: "Chat Widget",
      hosted_chat: "Hosted Chat Link",
      dashboard_test: "Dashboard Test",
      playground: "Playground",
    };
    convList.forEach(c => {
      const src = sourceLabels[c.source] || "Other";
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    const sources = Object.entries(sourceMap).map(([name, value]) => ({ name, value }));
    if (sources.length === 0) {
      sources.push(
        { name: "Chat Widget", value: 0 },
        { name: "Hosted Chat Link", value: 0 },
        { name: "Dashboard Test", value: 0 }
      );
    }

    // Intent breakdown
    const intentMap: Record<string, number> = {};
    leadList.forEach(l => {
      const intent = l.interest || (l.metadata as any)?.intent || "General Inquiry";
      const cleanIntent = intent.charAt(0).toUpperCase() + intent.slice(1);
      intentMap[cleanIntent] = (intentMap[cleanIntent] || 0) + 1;
    });
    const intentBreakdown = Object.entries(intentMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Usage by type
    const usageMap: Record<string, number> = {
      message: 0,
      embedding: 0,
      lead: 0,
      knowledge_source: 0,
    };
    usageList.forEach(log => {
      const typeLabel = log.type === "widget_chat" ? "message" : log.type;
      if (typeLabel in usageMap) {
        usageMap[typeLabel] += log.amount || 1;
      } else {
        usageMap[typeLabel] = log.amount || 1;
      }
    });
    const usageByType = Object.entries(usageMap).map(([key, value]) => {
      const labelMap: Record<string, string> = {
        message: "AI Messages",
        embedding: "Vector Embeddings",
        lead: "Leads Captured",
        knowledge_source: "Knowledge Sources",
      };
      return { name: labelMap[key] || key, value };
    });

    // Most asked questions — deduplicated case-insensitive
    const userMessages = msgList.filter(m => m.role === "user");
    const questionMap: Record<string, number> = {};
    userMessages.forEach(m => {
      const cleanQ = m.content.trim().replace(/[?.,!]/g, "").substring(0, 120);
      if (cleanQ.length > 8) {
        const matchedKey = Object.keys(questionMap).find(
          k => k.toLowerCase() === cleanQ.toLowerCase()
        );
        if (matchedKey) {
          questionMap[matchedKey]++;
        } else {
          questionMap[cleanQ] = 1;
        }
      }
    });
    const mostAskedQuestions = Object.entries(questionMap)
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Recent unanswered
    const msgByConv: Record<string, typeof msgList> = {};
    msgList.forEach(m => {
      if (!msgByConv[m.conversation_id]) msgByConv[m.conversation_id] = [];
      msgByConv[m.conversation_id].push(m);
    });

    const recentUnanswered: AnalyticsData["recentUnanswered"] = [];
    convList.forEach(c => {
      const convMsgs = (msgByConv[c.id] || []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const lastMsg = convMsgs[convMsgs.length - 1];
      if (lastMsg && lastMsg.role === "user") {
        recentUnanswered.push({
          conversationId: c.id,
          visitorName: c.visitor_name || "Anonymous Visitor",
          visitorEmail: c.visitor_email || "N/A",
          question: lastMsg.content,
          createdAt: lastMsg.created_at,
        });
      }
    });
    recentUnanswered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return {
      stats: {
        totalConversations,
        totalMessages,
        totalLeads,
        conversionRate,
        widgetConversations,
        hostedChatConversations,
        hostedChatLeads,
        playgroundConversations,
        avgMessagesPerSession,
        sessionsWithLeads,
        demoConversations,
        demoLeads,
      },
      dailyTrend,
      sources,
      intentBreakdown,
      usageByType,
      mostAskedQuestions,
      recentUnanswered: recentUnanswered.slice(0, 5),
    };
  } catch (err: any) {
    console.error("getBusinessAnalytics error:", err);
    return null;
  }
}
