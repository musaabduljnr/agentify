import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return profile;
}

export async function getCurrentBusiness() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  return business;
}

export async function getCurrentBusinessSetup() {
  const user = await getCurrentUser();
  if (!user) return { user: null, profile: null, business: null, assistant: null, widgetConfig: null, subscription: null, isComplete: false };

  const supabase = await createClient();
  
  // Fetch all in parallel for performance
  const [profileRes, businessRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("businesses").select("*").eq("owner_id", user.id).maybeSingle(),
  ]);

  const profile = profileRes.data;
  const business = businessRes.data;

  if (!business) {
    return { user, profile, business: null, assistant: null, widgetConfig: null, subscription: null, isComplete: false };
  }

  const [assistantRes, widgetRes, subRes] = await Promise.all([
    supabase.from("assistants").select("*").eq("business_id", business.id).eq("is_active", true).maybeSingle(),
    supabase.from("widget_configs").select("*").eq("business_id", business.id).maybeSingle(),
    supabase.from("subscriptions").select("*").eq("business_id", business.id).maybeSingle(),
  ]);

  const assistant = assistantRes.data;
  const widgetConfig = widgetRes.data;
  const subscription = subRes.data;

  const isComplete = !!(
    business &&
    business.onboarding_completed &&
    assistant &&
    widgetConfig &&
    subscription
  );

  return {
    user,
    profile,
    business,
    assistant,
    widgetConfig,
    subscription,
    isComplete,
  };
}

export async function requireCurrentBusiness() {
  const business = await getCurrentBusiness();
  if (!business) {
    redirect("/onboarding");
  }
  return business;
}

export async function requireCompleteBusinessSetup() {
  const setup = await getCurrentBusinessSetup();
  if (!setup.user) {
    redirect("/login");
  }
  if (!setup.isComplete) {
    redirect("/onboarding");
  }
  return setup;
}
