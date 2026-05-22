"use server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/utils/supabase/service";
import { getPlanLimits, type PlanId } from "@/lib/billing/plans";
import { revalidatePath } from "next/cache";
import { generateGeminiChat, generateGeminiEmbedding } from "@/lib/ai/providers/gemini";
import { generateOpenRouterChat } from "@/lib/ai/providers/openrouter";
import { generateGroqChat } from "@/lib/ai/providers/groq";
import { generateVertexChat, generateVertexEmbedding } from "@/lib/ai/providers/vertex";

/**
 * 1. Admin Overview Statistics
 */
export async function getAdminOverviewStats() {
  await requireAdmin();
  const supabase = createServiceClient();

  const [
    { count: usersCount },
    { count: businessesCount },
    { data: activeSubs },
    { data: trialSubs },
    { count: convsCount },
    { count: leadsCount },
    { data: paymentsData },
    { data: failedKnowledge },
    { data: recentBusinesses },
    { data: recentLeads },
    { data: highUsageSubs },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("businesses").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("*").eq("status", "active"),
    supabase.from("subscriptions").select("*").eq("plan", "free_trial"),
    supabase.from("conversations").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("payment_transactions").select("*").eq("status", "success"),
    supabase.from("knowledge_sources").select("*").eq("status", "failed"),
    supabase.from("businesses").select("*, profiles(email, full_name)").order("created_at", { ascending: false }).limit(5),
    supabase.from("leads").select("*, businesses(name)").order("created_at", { ascending: false }).limit(5),
    supabase.from("subscriptions").select("*, businesses(name)").order("current_usage", { ascending: false }).limit(5),
  ]);

  // Calculate monthly revenue from successful payments
  const totalRevenue = (paymentsData || []).reduce((sum, p) => sum + (p.amount || 0), 0);

  // Sum of AI messages used across all active subscriptions
  const totalAIMessagesUsed = (activeSubs || []).reduce((sum, s) => sum + (s.current_usage || 0), 0);

  return {
    totalUsers: usersCount || 0,
    totalBusinesses: businessesCount || 0,
    activeSubscriptions: activeSubs?.length || 0,
    trialUsers: trialSubs?.length || 0,
    totalConversations: convsCount || 0,
    totalLeads: leadsCount || 0,
    totalPayments: paymentsData?.length || 0,
    monthlyRevenue: totalRevenue,
    aiMessagesUsed: totalAIMessagesUsed,
    failedKnowledgeSources: failedKnowledge?.length || 0,
    recentBusinesses: recentBusinesses || [],
    recentPayments: (paymentsData || []).slice(0, 5),
    recentLeads: recentLeads || [],
    highUsageBusinesses: highUsageSubs || [],
  };
}

/**
 * 2. User Management Actions
 */
export async function getAllUsers() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: users, error } = await supabase
    .from("profiles")
    .select("*, businesses(id, name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return users || [];
}

export async function updateUserRole(userId: string, role: "client" | "admin") {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: true };
}

/**
 * 3. Businesses Management Actions
 */
export async function getAllBusinesses() {
  await requireAdmin();
  const supabase = createServiceClient();

  // Load all businesses, including owner email, assistant, widget status, and subscription
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("*, owner:profiles(email, full_name), assistants(id, name, is_active), widget_configs(id, is_enabled), subscriptions(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return businesses || [];
}

export async function updateBusinessStatus(businessId: string, suspend: boolean) {
  await requireAdmin();
  const supabase = createServiceClient();

  // Suspending works by changing the linked subscription status
  const targetStatus = suspend ? "suspended" : "active";

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: targetStatus, updated_at: new Date().toISOString() })
    .eq("business_id", businessId);

  if (error) return { error: error.message };

  revalidatePath("/admin/businesses");
  return { success: true };
}

/**
 * 4. Subscriptions Management Actions
 */
export async function getAllSubscriptions() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select("*, businesses(name, slug)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return subscriptions || [];
}

export async function updateSubscriptionPlan(subscriptionId: string, plan: PlanId) {
  await requireAdmin();
  const supabase = createServiceClient();

  const planLimits = getPlanLimits(plan);
  const now = new Date();
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  const { error } = await supabase
    .from("subscriptions")
    .update({
      plan,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      reset_date: periodEnd.toISOString(),
      cancel_at_period_end: false,
      ...planLimits,
      updated_at: now.toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) return { error: error.message };

  revalidatePath("/admin/subscriptions");
  return { success: true };
}

export async function updateSubscriptionStatus(subscriptionId: string, status: string) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);

  if (error) return { error: error.message };

  revalidatePath("/admin/subscriptions");
  return { success: true };
}

export async function resetBusinessUsage(subscriptionId: string) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("subscriptions")
    .update({ current_usage: 0, updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);

  if (error) return { error: error.message };

  revalidatePath("/admin/subscriptions");
  return { success: true };
}

/**
 * 5. Payments Management Actions
 */
export async function getAllPayments() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: payments, error } = await supabase
    .from("payment_transactions")
    .select("*, businesses(name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return payments || [];
}

/**
 * 6. Usage Logs Actions
 */
export async function getAllUsageLogs() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: logs, error } = await supabase
    .from("usage_logs")
    .select("*, businesses(name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return logs || [];
}

/**
 * 7. Conversations Management Actions
 */
export async function getAllConversations() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("*, businesses(name), messages(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return conversations || [];
}

/**
 * 8. Leads Management Actions
 */
export async function getAllLeads() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*, businesses(name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return leads || [];
}

/**
 * 9. AI Engine Settings Management
 */
export async function getAIEngineSettings() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("ai_engine_settings")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateAIEngineSettings(settings: {
  provider: string;
  chat_model: string;
  embedding_provider: string;
  embedding_model: string;
  fallback_provider: string;
  fallback_chat_model: string;
}) {
  await requireAdmin();
  const supabase = createServiceClient();

  // Update existing row or insert a new one
  const { data: current } = await supabase
    .from("ai_engine_settings")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (current) {
    const { error } = await supabase
      .from("ai_engine_settings")
      .update({
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("ai_engine_settings").insert({
      ...settings,
      is_active: true,
    });

    if (error) return { error: error.message };
  }

  revalidatePath("/admin/ai-settings");
  return { success: true };
}

/**
 * 10. Provider Test Functions
 */
export async function testAIProvider(provider: string, model: string) {
  await requireAdmin();
  const systemInstruction = "You are a friendly AI service test bot. Keep answers extremely short.";
  const userMessage = "Verify that our connection is working!";

  try {
    let result = "";
    switch (provider) {
      case "gemini":
        result = await generateGeminiChat({ model, systemInstruction, userMessage });
        break;
      case "openrouter":
        result = await generateOpenRouterChat({ model, systemInstruction, userMessage });
        break;
      case "groq":
        result = await generateGroqChat({ model, systemInstruction, userMessage });
        break;
      case "vertex":
        result = await generateVertexChat({ model, systemInstruction, userMessage });
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return { success: true, response: result };
  } catch (error: any) {
    console.error(`AI test failed for ${provider} (${model}):`, error);
    return { error: error.message || "AI Test verification call failed." };
  }
}

export async function testEmbeddingProvider(provider: string, model: string) {
  await requireAdmin();
  const testText = "Agentify embedding test connectivity statement.";

  try {
    let values: number[] = [];
    switch (provider) {
      case "gemini":
        values = await generateGeminiEmbedding({ model, text: testText });
        break;
      case "vertex":
        values = await generateVertexEmbedding({ model, text: testText });
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return { success: true, dimensions: values.length };
  } catch (error: any) {
    console.error(`Embedding test failed for ${provider} (${model}):`, error);
    return { error: error.message || "Embedding Test verification call failed." };
  }
}

/**
 * 11. Custom Admin Login Handler
 */
export async function adminLogin(email: string, password: string) {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !user) {
    return { error: authError?.message || "Invalid credentials." };
  }

  const serviceClient = createServiceClient();
  const { data: profile, error: dbError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (dbError || profile?.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "This account is not authorized for the admin console." };
  }

  return { success: true };
}
