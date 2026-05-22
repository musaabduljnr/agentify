import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { redirect } from "next/navigation";

export interface AdminProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Secures admin pages and routes.
 * Redirects unauthenticated users to /login and non-admin users to /dashboard.
 * Returns the validated admin profile record.
 */
export async function requireAdmin(): Promise<AdminProfile> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/admin/login");
  }

  // Fetch user profile using privileged service client to ensure robust, fast loads
  const serviceClient = createServiceClient();
  const { data: profile, error: dbError } = await serviceClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (dbError || !profile) {
    redirect("/dashboard");
  }

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return profile as AdminProfile;
}
