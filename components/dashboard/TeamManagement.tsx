"use client";

import { useState, useTransition } from "react";
import { inviteTeamMember, removeTeamMember, updateMemberRole, type TeamMember } from "@/lib/actions/team";
import { Users, Mail, Shield, Crown, UserMinus, ChevronDown, CheckCircle2, AlertTriangle, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const ROLE_CONFIG = {
  owner: { label: "Owner", icon: Crown, color: "text-amber-600 bg-amber-50 border-amber-200" },
  admin: { label: "Admin", icon: Shield, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  member: { label: "Member", icon: Users, color: "text-slate-600 bg-slate-100 border-slate-200" },
};

const STATUS_CONFIG = {
  active: { label: "Active", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  pending: { label: "Invited", color: "bg-blue-50 text-blue-600 border-blue-200" },
  removed: { label: "Removed", color: "bg-red-50 text-red-600 border-red-200" },
};

interface TeamManagementProps {
  members: TeamMember[];
  currentUserRole: "owner" | "admin" | "member";
  currentPlan: string;
}

function RoleBadge({ role }: { role: TeamMember["role"] }) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: TeamMember["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color}`}>
      {status === "pending" && <Clock className="w-2.5 h-2.5 mr-1" />}
      {cfg.label}
    </span>
  );
}

export function TeamManagement({ members: initialMembers, currentUserRole, currentPlan }: TeamManagementProps) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isPaidPlan = !["free_trial"].includes(currentPlan);
  const canManage = ["owner", "admin"].includes(currentUserRole);

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    startTransition(async () => {
      const result = await inviteTeamMember(inviteEmail.trim(), inviteRole);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        showMessage("success", `Invitation sent to ${inviteEmail.trim()}.`);
        setInviteEmail("");
        // Optimistically add pending member
        setMembers(prev => [{
          id: "pending-" + Date.now(),
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          status: "pending",
          joined_at: null,
          invited_at: new Date().toISOString(),
          user_id: null,
        }, ...prev]);
      }
    });
  }

  function handleRemove(memberId: string) {
    setRemovingId(memberId);
    startTransition(async () => {
      const result = await removeTeamMember(memberId);
      setRemovingId(null);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        setMembers(prev => prev.filter(m => m.id !== memberId));
        showMessage("success", "Member removed.");
      }
    });
  }

  function handleRoleChange(memberId: string, newRole: "admin" | "member") {
    setUpdatingId(memberId);
    startTransition(async () => {
      const result = await updateMemberRole(memberId, newRole);
      setUpdatingId(null);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      }
    });
  }

  if (!isPaidPlan) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 text-center">
        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Users className="w-7 h-7 text-indigo-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Team Collaboration</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
          Upgrade to a paid plan to invite team members and collaborate with your team on Agentify.
        </p>
        <Button asChild className="rounded-2xl px-6 h-11 font-bold bg-indigo-600 hover:bg-indigo-700">
          <a href="/dashboard/billing">Upgrade Plan</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Feedback */}
      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-medium border ${
          message.type === "success"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Invite Form */}
      {canManage && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-7">
          <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600" />
            Invite a Team Member
          </h3>
          <p className="text-xs text-slate-500 mb-5">Send an email invitation to add someone to your team.</p>

          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                required
                className="w-full pl-9 pr-4 h-11 rounded-2xl border-2 border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
              />
            </div>

            <div className="relative">
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as "admin" | "member")}
                className="h-11 pl-4 pr-8 rounded-2xl border-2 border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-400 appearance-none cursor-pointer"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <Button
              type="submit"
              disabled={isPending || !inviteEmail.trim()}
              className="h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 shrink-0"
            >
              {isPending ? "Sending..." : "Send Invite"}
            </Button>
          </form>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            Team Members
            <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full">
              {members.length}
            </span>
          </h3>
        </div>

        {members.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">No team members yet.</p>
            <p className="text-xs text-slate-400 mt-1">Invite colleagues to collaborate.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Member</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Joined</th>
                  {canManage && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {members.map(member => (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {member.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-700 truncate max-w-[200px]">
                          {member.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {canManage && member.role !== "owner" && currentUserRole === "owner" ? (
                        <div className="relative inline-block">
                          <select
                            value={member.role}
                            onChange={e => handleRoleChange(member.id, e.target.value as "admin" | "member")}
                            disabled={updatingId === member.id}
                            className="appearance-none pl-2 pr-6 py-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-indigo-400 cursor-pointer disabled:opacity-50"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                        </div>
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={member.status} />
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-medium">
                      {member.joined_at
                        ? new Date(member.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "Pending"}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        {member.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(member.id)}
                            disabled={removingId === member.id || isPending}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold h-8"
                          >
                            <UserMinus className="w-3.5 h-3.5 mr-1" />
                            {removingId === member.id ? "Removing..." : "Remove"}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
