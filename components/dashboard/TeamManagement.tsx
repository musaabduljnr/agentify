"use client";

import { useState, useTransition } from "react";
import {
  inviteTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  suspendTeamMember,
  reactivateTeamMember,
  resendTeamInvitation,
  revokeTeamInvitation,
} from "@/lib/actions/team";
import {
  Users,
  Mail,
  Shield,
  Crown,
  UserMinus,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Clock,
  Copy,
  Check,
  RefreshCw,
  Ban,
  UserCheck,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ROLE_CONFIG = {
  owner: { label: "Owner", icon: Crown, color: "text-amber-600 bg-amber-50 border-amber-200" },
  admin: { label: "Admin", icon: Shield, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  support: { label: "Support", icon: Users, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  sales: { label: "Sales", icon: Users, color: "text-blue-600 bg-blue-50 border-blue-200" },
  viewer: { label: "Viewer", icon: Users, color: "text-slate-600 bg-slate-100 border-slate-200" },
};

const STATUS_CONFIG = {
  active: { label: "Active", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  suspended: { label: "Suspended", color: "bg-red-50 text-red-600 border-red-200" },
  pending: { label: "Pending", color: "bg-blue-50 text-blue-600 border-blue-200" },
  accepted: { label: "Accepted", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  revoked: { label: "Revoked", color: "bg-slate-100 text-slate-500 border-slate-200" },
  expired: { label: "Expired", color: "bg-amber-50 text-amber-600 border-amber-200" },
};

interface TeamManagementProps {
  members: any[];
  invitations: any[];
  currentUserRole: "owner" | "admin" | "support" | "sales" | "viewer";
  currentPlan: string;
}

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.viewer;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color}`}>
      {status === "pending" && <Clock className="w-2.5 h-2.5 mr-1" />}
      {cfg.label}
    </span>
  );
}

export function TeamManagement({
  members: initialMembers,
  invitations: initialInvitations,
  currentUserRole,
  currentPlan,
}: TeamManagementProps) {
  const [members, setMembers] = useState<any[]>(initialMembers);
  const [invitations, setInvitations] = useState<any[]>(initialInvitations);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "support" | "sales" | "viewer">("viewer");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  const canManage = ["owner", "admin"].includes(currentUserRole);

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 8000);
  }

  const handleCopyLink = (link: string, key: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleCopyInviteListLink = (link: string, inviteId: string) => {
    navigator.clipboard.writeText(link);
    setCopiedInviteId(inviteId);
    setTimeout(() => setCopiedInviteId(null), 2500);
  };

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    startTransition(async () => {
      const result = await inviteTeamMember(inviteEmail.trim(), inviteRole);
      if (result.error === "limit_reached") {
        showMessage("error", result.message || "Your plan's team member limit has been reached.");
      } else if (result.error) {
        showMessage("error", result.error);
      } else {
        if (result.emailFailed) {
          showMessage(
            "success",
            `Invitation created for ${inviteEmail.trim()}, but invitation email could not be sent. Please copy and share the link manually.`
          );
        } else {
          showMessage("success", `Invitation sent successfully to ${inviteEmail.trim()}.`);
        }
        setInviteEmail("");
        
        // Refresh local lists dynamically
        if (result.inviteLink) {
          setInvitations(prev => [
            {
              id: "new-" + Date.now(),
              email: inviteEmail.trim().toLowerCase(),
              role: inviteRole,
              status: "pending",
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              inviteLink: result.inviteLink,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      }
    });
  }

  function handleRemove(memberId: string) {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    setBusyMemberId(memberId);
    startTransition(async () => {
      const result = await removeTeamMember(memberId);
      setBusyMemberId(null);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        setMembers(prev => prev.filter(m => m.id !== memberId));
        showMessage("success", "Team member has been removed.");
      }
    });
  }

  function handleSuspend(memberId: string) {
    setBusyMemberId(memberId);
    startTransition(async () => {
      const result = await suspendTeamMember(memberId);
      setBusyMemberId(null);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: "suspended" } : m));
        showMessage("success", "Member access suspended.");
      }
    });
  }

  function handleReactivate(memberId: string) {
    setBusyMemberId(memberId);
    startTransition(async () => {
      const result = await reactivateTeamMember(memberId);
      setBusyMemberId(null);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: "active" } : m));
        showMessage("success", "Member access reactivated.");
      }
    });
  }

  function handleRoleChange(memberId: string, newRole: any) {
    setBusyMemberId(memberId);
    startTransition(async () => {
      const result = await updateTeamMemberRole(memberId, newRole);
      setBusyMemberId(null);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
        showMessage("success", "Member role updated.");
      }
    });
  }

  function handleResendInvite(inviteId: string) {
    setBusyInviteId(inviteId);
    startTransition(async () => {
      const result = await resendTeamInvitation(inviteId);
      setBusyInviteId(null);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        if (result.emailFailed) {
          showMessage("success", "Invitation regenerated, but email delivery failed. Share link manually.");
        } else {
          showMessage("success", "Invitation resent successfully.");
        }
        if (result.inviteLink) {
          setInvitations(prev =>
            prev.map(inv =>
              inv.id === inviteId
                ? { ...inv, status: "pending", inviteLink: result.inviteLink, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }
                : inv
            )
          );
        }
      }
    });
  }

  function handleRevokeInvite(inviteId: string) {
    if (!confirm("Are you sure you want to revoke this invitation?")) return;
    setBusyInviteId(inviteId);
    startTransition(async () => {
      const result = await revokeTeamInvitation(inviteId);
      setBusyInviteId(null);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        setInvitations(prev => prev.map(inv => inv.id === inviteId ? { ...inv, status: "revoked" } : inv));
        showMessage("success", "Invitation revoked.");
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Legend & Explanation */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          Workspace Permissions Guide
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100/50">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-1">👑 Owner</span>
            <p className="text-xs text-slate-600 leading-relaxed">Full system access, manage billing, change workspace settings, delete/transfer business.</p>
          </div>
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/50">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block mb-1">🛡️ Admin</span>
            <p className="text-xs text-slate-600 leading-relaxed">Manage assistants, training sources, widgets, settings. Invite & remove support/sales/viewers.</p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/50">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">🟢 Support</span>
            <p className="text-xs text-slate-600 leading-relaxed">Read-write access to conversations and customer takeovers. Read-only access to leads.</p>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">🔵 Sales</span>
            <p className="text-xs text-slate-600 leading-relaxed">Manage leads, lead status, lead notes. Read-only access to conversations & analytics.</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">⚪ Viewer</span>
            <p className="text-xs text-slate-600 leading-relaxed">Read-only access to analytics, conversations dashboard, and leads. Cannot update any configurations.</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-medium border animate-fadeIn ${
          message.type === "success"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <div className="flex-1 leading-relaxed">{message.text}</div>
        </div>
      )}

      {/* Invite Form */}
      {canManage && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-7">
          <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600" />
            Invite a New Team Member
          </h3>
          <p className="text-xs text-slate-500 mb-5">They will receive an email invitation to accept. You can also copy the link manually if needed.</p>

          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                required
                className="w-full pl-10 pr-4 h-11 rounded-2xl border-2 border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
              />
            </div>

            <div className="relative">
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as any)}
                className="h-11 pl-4 pr-10 rounded-2xl border-2 border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-400 appearance-none cursor-pointer"
              >
                <option value="viewer">Viewer (Read-only)</option>
                <option value="sales">Sales (Leads)</option>
                <option value="support">Support (Conversations)</option>
                <option value="admin">Admin (Assistant Manager)</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <Button
              type="submit"
              disabled={isPending || !inviteEmail.trim()}
              className="h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 shrink-0 shadow-lg shadow-indigo-600/10"
            >
              {isPending ? "Sending..." : "Send Invite"}
            </Button>
          </form>
        </div>
      )}

      {/* Active Members list */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            Active Team Members
            <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full">
              {members.length}
            </span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-4">Member</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Joined Date</th>
                {canManage && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {members.map(member => {
                const emailStr = member.profile?.email || "Unknown User";
                const isOwnerCurrentUser = currentUserRole === "owner";
                const isTargetOwner = member.role === "owner";
                const isTargetAdmin = member.role === "admin";
                const canChangeRole = isOwnerCurrentUser && !isTargetOwner;
                const canModifyStatus = isOwnerCurrentUser ? !isTargetOwner : (canManage && !isTargetOwner && !isTargetAdmin);
                const canDelete = isOwnerCurrentUser ? !isTargetOwner : (canManage && !isTargetOwner && !isTargetAdmin);

                return (
                  <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8.5 h-8.5 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                          {emailStr.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {member.profile?.full_name || "New Team Member"}
                          </p>
                          <p className="text-xs text-slate-400 font-medium">
                            {emailStr}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {canChangeRole ? (
                        <div className="relative inline-block">
                          <select
                            value={member.role}
                            onChange={e => handleRoleChange(member.id, e.target.value)}
                            disabled={busyMemberId === member.id}
                            className="appearance-none pl-2.5 pr-8 py-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-indigo-400 cursor-pointer disabled:opacity-50"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="sales">Sales</option>
                            <option value="support">Support</option>
                            <option value="admin">Admin</option>
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
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
                        : "N/A"}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canModifyStatus && (
                            member.status === "active" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSuspend(member.id)}
                                disabled={busyMemberId === member.id}
                                className="text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl text-xs font-bold h-8.5 px-3"
                              >
                                <Ban className="w-3.5 h-3.5 mr-1" />
                                Suspend
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReactivate(member.id)}
                                disabled={busyMemberId === member.id}
                                className="text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-bold h-8.5 px-3"
                              >
                                <UserCheck className="w-3.5 h-3.5 mr-1" />
                                Activate
                              </Button>
                            )
                          )}

                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemove(member.id)}
                              disabled={busyMemberId === member.id}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold h-8.5 px-3"
                            >
                              <UserMinus className="w-3.5 h-3.5 mr-1" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations list */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600" />
            Pending Invitations
            <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full">
              {invitations.filter(i => i.status === "pending").length}
            </span>
          </h3>
        </div>

        {invitations.length === 0 ? (
          <div className="p-16 text-center">
            <Mail className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">No pending invitations.</p>
            <p className="text-xs text-slate-400 mt-1">Sent invites that are waiting for acceptance will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4">Invited Email</th>
                  <th className="px-6 py-4">Assigned Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Expiration</th>
                  {canManage && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invitations.map(invite => {
                  const isPendingStatus = invite.status === "pending";
                  const inviteId = invite.id;
                  
                  // Construct manually copyable link if present
                  let manualLink = invite.inviteLink || "";
                  if (!manualLink && invite.token_hash) {
                    // Fallback using raw token placeholder (instructing the admin to regenerate is safer, but let's provide link copying)
                  }

                  return (
                    <tr key={invite.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-slate-700">{invite.email}</span>
                      </td>
                      <td className="px-6 py-4">
                        <RoleBadge role={invite.role} />
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={invite.status} />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 font-medium">
                        {new Date(invite.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isPendingStatus && manualLink && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyInviteListLink(manualLink, invite.id)}
                                className="border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold h-8.5 px-3"
                              >
                                {copiedInviteId === invite.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                    Copy Link
                                  </>
                                )}
                              </Button>
                            )}

                            {isPendingStatus && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResendInvite(invite.id)}
                                disabled={busyInviteId === invite.id}
                                className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl text-xs font-bold h-8.5 px-3"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${busyInviteId === invite.id ? "animate-spin" : ""}`} />
                                Resend
                              </Button>
                            )}

                            {isPendingStatus && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeInvite(invite.id)}
                                disabled={busyInviteId === invite.id}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold h-8.5 px-3"
                              >
                                <UserMinus className="w-3.5 h-3.5 mr-1" />
                                Revoke
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
