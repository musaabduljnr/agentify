import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

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

/**
 * Fetch all businesses a user belongs to (either as owner or as an active business_member).
 */
export async function getUserBusinesses(userId: string) {
  const supabase = createServiceClient();

  // 1. Fetch businesses user belongs to via business_members
  const { data: memberBiz } = await supabase
    .from("business_members")
    .select("role, businesses(*)")
    .eq("user_id", userId)
    .eq("status", "active");

  const businesses = (memberBiz || [])
    .map((m: any) => {
      if (!m.businesses) return null;
      return {
        ...m.businesses,
        userRole: m.role,
      };
    })
    .filter(Boolean);

  // 2. Fallback check for owned businesses directly in businesses table
  const { data: ownedBiz } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", userId);

  const owned = ownedBiz || [];
  for (const o of owned) {
    if (!businesses.some((b: any) => b.id === o.id)) {
      businesses.push({
        ...o,
        userRole: "owner",
      });
    }
  }

  return businesses;
}

/**
 * Get active business ID from request cookies.
 */
export async function getActiveBusinessId() {
  const cookieStore = await cookies();
  return cookieStore.get("active_business_id")?.value || null;
}

/**
 * Resolve current active business based on user session and active business cookie.
 */
export async function getCurrentBusiness() {
  const user = await getCurrentUser();
  if (!user) return null;

  const businesses = await getUserBusinesses(user.id);
  if (businesses.length === 0) return null;

  const activeId = await getActiveBusinessId();
  // Match either active cookie or fallback to first business membership (which is usually owned business)
  const activeBiz = businesses.find((b: any) => b.id === activeId) || businesses[0];

  return activeBiz;
}

export async function getCurrentBusinessSetup() {
  const user = await getCurrentUser();
  if (!user) return { user: null, profile: null, business: null, assistant: null, widgetConfig: null, subscription: null, isComplete: false, businesses: [] };

  const supabase = createServiceClient();
  
  const [profileRes, business] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    getCurrentBusiness(),
  ]);

  const profile = profileRes.data;
  const businesses = await getUserBusinesses(user.id);

  if (!business) {
    return { user, profile, business: null, assistant: null, widgetConfig: null, subscription: null, isComplete: false, businesses };
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
    businesses,
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
