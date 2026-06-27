import { getTeamMembers, getTeamInvitations } from "@/lib/actions/team";
import { TeamManagement } from "@/components/dashboard/TeamManagement";
import { createClient } from "@/utils/supabase/server";
import { getCurrentBusiness } from "@/lib/queries/business";
import { getUserBusinessRole } from "@/lib/team/permissions";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

async function getCurrentContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const business = await getCurrentBusiness();
  if (!business) return null;

  const [role, { data: subscription }] = await Promise.all([
    getUserBusinessRole(user.id, business.id),
    supabase
      .from("subscriptions")
      .select("plan")
      .eq("business_id", business.id)
      .maybeSingle(),
  ]);

  if (!role) return null;

  return {
    user,
    business,
    plan: subscription?.plan ?? "free_trial",
    role,
  };
}

export default async function TeamPage() {
  const [ctx, members, invitations] = await Promise.all([
    getCurrentContext(),
    getTeamMembers(),
    getTeamInvitations(),
  ]);

  if (!ctx) return null;

  return (
    <>
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Team Management</h1>
        </div>
        <p className="text-slate-500">
          Invite colleagues, assign specific roles, and control who has access to your Agentify workspace.
        </p>
      </div>

      <TeamManagement
        members={members}
        invitations={invitations}
        currentUserRole={ctx.role}
        currentPlan={ctx.plan}
      />
    </>
  );
}
