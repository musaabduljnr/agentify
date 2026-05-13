import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  // Check for business and onboarding status
  const { data: business } = await supabase
    .from("businesses")
    .select("onboarding_completed")
    .eq("owner_id", user.id)
    .single();

  if (!business || !business.onboarding_completed) {
    return redirect("/onboarding");
  }

  return (
    <DashboardLayoutClient user={user}>
      {children}
    </DashboardLayoutClient>
  );
}
