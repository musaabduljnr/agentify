import { getTeamMembers } from "@/lib/actions/team";
import { TeamManagement } from "@/components/dashboard/TeamManagement";
import { createClient } from "@/utils/supabase/server";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

async function getCurrentContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, owner_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("business_id", business?.id ?? "")
    .maybeSingle();

  if (!business) return null;

  const isOwner = business.owner_id === user.id;
  const role = isOwner ? "owner" : "member";

  return {
    user,
    business,
    plan: subscription?.plan ?? "free_trial",
    role: role as "owner" | "admin" | "member",
  };
}

export default async function TeamPage() {
  const [ctx, members] = await Promise.all([
    getCurrentContext(),
    getTeamMembers(),
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
          Invite colleagues, manage roles, and control who has access to your Agentify workspace.
        </p>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          {
            role: "Owner",
            desc: "Full control — billing, settings, team, and all data.",
            color: "from-amber-50 border-amber-200",
            icon: "👑",
          },
          {
            role: "Admin",
            desc: "Can manage assistants, knowledge, leads, and invite members.",
            color: "from-indigo-50 border-indigo-200",
            icon: "🛡️",
          },
          {
            role: "Member",
            desc: "Read access to analytics and conversations. Cannot modify settings.",
            color: "from-slate-50 border-slate-200",
            icon: "👤",
          },
        ].map(item => (
          <div key={item.role} className={`bg-gradient-to-b ${item.color} border rounded-2xl p-5`}>
            <div className="text-xl mb-2">{item.icon}</div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">{item.role}</h4>
            <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <TeamManagement
        members={members}
        currentUserRole={ctx.role}
        currentPlan={ctx.plan}
      />
    </>
  );
}
