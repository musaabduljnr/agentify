"use server";

import { createClient } from "@/utils/supabase/server";
import { startOfDay, subDays, eachDayOfInterval, format, isSameDay } from "date-fns";

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
    const business = await getCurrentBusiness();
    if (!business) return null;

    const supabase = await createClient();
    const thresholdDate = subDays(new Date(), days);

    // 1. Fetch Conversations
    const { data: conversations, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .eq("business_id", business.id)
      .gte("created_at", thresholdDate.toISOString());

    if (convError) throw new Error(convError.message);

    // 2. Fetch Messages
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("*")
      .eq("business_id", business.id)
      .gte("created_at", thresholdDate.toISOString());

    if (msgError) throw new Error(msgError.message);

    // 3. Fetch Leads
    const { data: leads, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("business_id", business.id)
      .gte("created_at", thresholdDate.toISOString());

    if (leadError) throw new Error(leadError.message);

    // 4. Fetch Usage Logs
    const { data: usageLogs, error: usageError } = await supabase
      .from("usage_logs")
      .select("*")
      .eq("business_id", business.id)
      .gte("created_at", thresholdDate.toISOString());

    if (usageError) throw new Error(usageError.message);

    const convList = conversations || [];
    const msgList = messages || [];
    const leadList = leads || [];
    const usageList = usageLogs || [];

    // Calculate core statistics
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

    // Generate Daily Trend data using date-fns for safety
    const daysInterval = eachDayOfInterval({
      start: thresholdDate,
      end: new Date()
    });

    const dailyTrend = daysInterval.map(day => {
      const dateStr = format(day, "MMM dd");
      const dayConvs = convList.filter(c => isSameDay(new Date(c.created_at), day)).length;
      const dayLeads = leadList.filter(l => isSameDay(new Date(l.created_at), day)).length;

      return {
        date: dateStr,
        conversations: dayConvs,
        leads: dayLeads
      };
    });

    // Top Sources Breakdown
    const sourceMap: Record<string, number> = {};
    const sourceLabels: Record<string, string> = {
      widget: "Chat Widget",
      hosted_chat: "Hosted Chat Link",
      dashboard_test: "Dashboard Test",
    };
    convList.forEach(c => {
      const src = sourceLabels[c.source] || "Other";
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    const sources = Object.entries(sourceMap).map(([name, value]) => ({ name, value }));
    if (sources.length === 0) {
      sources.push({ name: "Chat Widget", value: 0 });
      sources.push({ name: "Hosted Chat Link", value: 0 });
      sources.push({ name: "Dashboard Test", value: 0 });
    }

    // Lead Intent Breakdown
    const intentMap: Record<string, number> = {};
    leadList.forEach(l => {
      const intent = l.interest || l.metadata?.intent || "General Inquiry";
      const cleanIntent = intent.charAt(0).toUpperCase() + intent.slice(1);
      intentMap[cleanIntent] = (intentMap[cleanIntent] || 0) + 1;
    });
    const intentBreakdown = Object.entries(intentMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Usage by Type Summation
    const usageMap: Record<string, number> = {
      message: 0,
      embedding: 0,
      lead: 0,
      knowledge_source: 0
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
        knowledge_source: "Knowledge Sources"
      };
      return {
        name: labelMap[key] || key,
        value
      };
    });

    // Most Asked Questions
    const userMessages = msgList.filter(m => m.role === "user");
    const questionMap: Record<string, number> = {};
    userMessages.forEach(m => {
      const cleanQ = m.content.trim().replace(/[?.,!]/g, "");
      if (cleanQ.length > 8) {
        // Group by case-insensitive matched queries
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

    // Recent Unanswered Questions
    // Find conversations where the most recent message is from "user"
    const recentUnanswered: any[] = [];
    
    // Group messages by conversation ID
    const msgByConv: Record<string, any[]> = {};
    msgList.forEach(m => {
      if (!msgByConv[m.conversation_id]) {
        msgByConv[m.conversation_id] = [];
      }
      msgByConv[m.conversation_id].push(m);
    });

    convList.forEach(c => {
      const convMsgs = msgByConv[c.id] || [];
      if (convMsgs.length > 0) {
        // Sort conversation messages chronologically
        convMsgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const lastMsg = convMsgs[convMsgs.length - 1];
        
        if (lastMsg && lastMsg.role === "user") {
          recentUnanswered.push({
            conversationId: c.id,
            visitorName: c.visitor_name || "Anonymous Visitor",
            visitorEmail: c.visitor_email || "N/A",
            question: lastMsg.content,
            createdAt: lastMsg.created_at
          });
        }
      }
    });

    recentUnanswered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      stats: {
        totalConversations,
        totalMessages,
        totalLeads,
        conversionRate,
        widgetConversations,
        hostedChatConversations,
        hostedChatLeads,
        playgroundConversations
      },
      dailyTrend,
      sources,
      intentBreakdown,
      usageByType,
      mostAskedQuestions,
      recentUnanswered: recentUnanswered.slice(0, 5)
    };
  } catch (err: any) {
    console.error("getBusinessAnalytics error:", err);
    return null;
  }
}
