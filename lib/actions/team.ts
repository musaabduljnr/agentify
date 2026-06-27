"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";
import { getCurrentBusiness } from "@/lib/queries/business";
import { getUserBusinessRole, BusinessRole } from "@/lib/team/permissions";
import { sendTeamInvitationEmail } from "@/lib/email/send-email";
import { getEffectivePlanLimits } from "@/lib/billing/platform";

// Helper to normalize error messages
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// Helper to check user context and permissions
async function getCurrentBusinessWithRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const business = await getCurrentBusiness();
  if (!business) return null;

  const role = await getUserBusinessRole(user.id, business.id);
  if (!role) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return { business, user, role, profile };
}

// Zod Input Validations
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "support", "sales", "viewer"]),
});

const memberActionSchema = z.object({
  memberId: z.string().uuid(),
});

const roleUpdateSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["admin", "support", "sales", "viewer"]),
});

const invitationActionSchema = z.object({
  invitationId: z.string().uuid(),
});

/**
 * Fetch all team members for the active business.
 */
export async function getTeamMembers() {
  try {
    const ctx = await getCurrentBusinessWithRole();
    if (!ctx) return [];

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("business_members")
      .select("*, profile:profiles(email, full_name)")
      .eq("business_id", ctx.business.id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("getTeamMembers error:", err);
    return [];
  }
}

/**
 * Fetch all invitations for the active business.
 */
export async function getTeamInvitations() {
  try {
    const ctx = await getCurrentBusinessWithRole();
    if (!ctx) return [];

    const supabase = createServiceClient();

    // Prune old revoked or expired invitations older than 30 days
    try {
      const pruneDate = new Date();
      pruneDate.setDate(pruneDate.getDate() - 30);
      await supabase
        .from("team_invitations")
        .delete()
        .eq("business_id", ctx.business.id)
        .in("status", ["revoked", "expired"])
        .lt("updated_at", pruneDate.toISOString());
    } catch (pruneErr) {
      console.warn("Failed to prune old team invitations:", pruneErr);
    }

    const { data, error } = await supabase
      .from("team_invitations")
      .select("*, inviter:profiles!team_invitations_invited_by_fkey(email, full_name)")
      .eq("business_id", ctx.business.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("getTeamInvitations error:", err);
    return [];
  }
}

/**
 * Invite a member.
 */
export async function inviteTeamMember(email: string, role: string) {
  try {
    const ctx = await getCurrentBusinessWithRole();
    if (!ctx) return { error: "Unauthorized" };
    if (!["owner", "admin"].includes(ctx.role)) {
      return { error: "Only owners and admins can invite team members." };
    }

    const input = inviteSchema.parse({ email, role });
    const normalizedEmail = input.email.trim().toLowerCase();

    const serviceClient = createServiceClient();

    // 1. Check duplicate active members
    const { data: existingMember } = await serviceClient
      .from("business_members")
      .select("id, status")
      .eq("business_id", ctx.business.id)
      .eq("user_id", (
        await serviceClient
          .from("profiles")
          .select("id")
          .eq("email", normalizedEmail)
          .maybeSingle()
      ).data?.id || "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    if (existingMember && existingMember.status === "active") {
      return { error: "This user is already an active member of this business." };
    }

    // 2. Check team member limits on active subscriptions
    const { data: subscription } = await serviceClient
      .from("subscriptions")
      .select("plan, team_member_limit")
      .eq("business_id", ctx.business.id)
      .maybeSingle();

    let limit = subscription?.team_member_limit;
    if (limit === null || limit === undefined) {
      const planLimits = await getEffectivePlanLimits(subscription?.plan || "free_trial");
      limit = planLimits.team_member_limit;
    }

    // Count currently active members
    const { count: activeCount } = await serviceClient
      .from("business_members")
      .select("id", { count: "exact", head: true })
      .eq("business_id", ctx.business.id)
      .eq("status", "active");

    // Count pending invitations
    const { count: pendingCount } = await serviceClient
      .from("team_invitations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", ctx.business.id)
      .eq("status", "pending");

    const totalAllocated = (activeCount || 0) + (pendingCount || 0);
    if (totalAllocated >= limit) {
      return { 
        error: "limit_reached",
        message: `Your subscription plan limit has been reached (${limit} team members). Please upgrade your plan to invite more team members.`
      };
    }

    // 3. Remove/revoke any duplicate pending invitations for this email to avoid index crash
    await serviceClient
      .from("team_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("business_id", ctx.business.id)
      .eq("email", normalizedEmail)
      .eq("status", "pending");

    // 4. Generate secure token
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // 5. Insert invitation
    const { error: inviteError } = await serviceClient
      .from("team_invitations")
      .insert({
        business_id: ctx.business.id,
        email: normalizedEmail,
        role: input.role,
        token_hash: tokenHash,
        status: "pending",
        invited_by: ctx.user.id,
        expires_at: expiresAt.toISOString(),
        last_sent_at: new Date().toISOString(),
      });

    if (inviteError) throw inviteError;

    // 6. Generate Link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentifyhq.vercel.app";
    const inviteLink = `${appUrl}/invite/team?token=${token}`;

    // 7. Send Invitation Email
    let emailFailed = false;
    try {
      const emailRes = await sendTeamInvitationEmail({
        to: normalizedEmail,
        businessName: ctx.business.name,
        inviterName: ctx.profile?.full_name || ctx.user?.email || "Team Owner",
        role: input.role,
        inviteUrl: inviteLink,
        expiresAt: expiresAt.toISOString(),
        businessId: ctx.business.id,
      });

      if (!emailRes.success) {
        emailFailed = true;
        console.warn("[TEAM ACTIONS] Invitation email dispatch failed:", emailRes.error);
      }
    } catch (emailErr) {
      emailFailed = true;
      console.error("[TEAM ACTIONS] Exception during invite email send:", emailErr);
    }

    revalidatePath("/dashboard/settings/team");
    return { success: true, inviteLink, emailFailed };
  } catch (err) {
    console.error("inviteTeamMember error:", err);
    return { error: getErrorMessage(err) };
  }
}

/**
 * Resend invitation.
 */
export async function resendTeamInvitation(invitationId: string) {
  try {
    const ctx = await getCurrentBusinessWithRole();
    if (!ctx) return { error: "Unauthorized" };
    if (!["owner", "admin"].includes(ctx.role)) {
      return { error: "Only owners and admins can manage invitations." };
    }

    const input = invitationActionSchema.parse({ invitationId });
    const serviceClient = createServiceClient();

    // 1. Fetch invitation
    const { data: invite, error: fetchErr } = await serviceClient
      .from("team_invitations")
      .select("*")
      .eq("id", input.invitationId)
      .eq("business_id", ctx.business.id)
      .maybeSingle();

    if (fetchErr || !invite) return { error: "Invitation not found." };

    // 2. Generate new token
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 3. Update invite
    const { error: updateErr } = await serviceClient
      .from("team_invitations")
      .update({
        token_hash: tokenHash,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        last_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    if (updateErr) throw updateErr;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentifyhq.vercel.app";
    const inviteLink = `${appUrl}/invite/team?token=${token}`;

    // 4. Send email
    let emailFailed = false;
    try {
      const emailRes = await sendTeamInvitationEmail({
        to: invite.email,
        businessName: ctx.business.name,
        inviterName: ctx.profile?.full_name || ctx.user?.email || "Team Owner",
        role: invite.role,
        inviteUrl: inviteLink,
        expiresAt: expiresAt.toISOString(),
        businessId: ctx.business.id,
      });

      if (!emailRes.success) emailFailed = true;
    } catch {
      emailFailed = true;
    }

    revalidatePath("/dashboard/settings/team");
    return { success: true, inviteLink, emailFailed };
  } catch (err) {
    console.error("resendTeamInvitation error:", err);
    return { error: getErrorMessage(err) };
  }
}

/**
 * Revoke invitation.
 */
export async function revokeTeamInvitation(invitationId: string) {
  try {
    const ctx = await getCurrentBusinessWithRole();
    if (!ctx) return { error: "Unauthorized" };
    if (!["owner", "admin"].includes(ctx.role)) {
      return { error: "Insufficient permissions." };
    }

    const input = invitationActionSchema.parse({ invitationId });
    const serviceClient = createServiceClient();

    const { error } = await serviceClient
      .from("team_invitations")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.invitationId)
      .eq("business_id", ctx.business.id);

    if (error) throw error;

    revalidatePath("/dashboard/settings/team");
    return { success: true };
  } catch (err) {
    console.error("revokeTeamInvitation error:", err);
    return { error: getErrorMessage(err) };
  }
}

/**
 * Accept invitation.
 */
export async function acceptTeamInvitation(token: string) {
  try {
    if (!token) return { error: "Invalid token" };
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const serviceClient = createServiceClient();

    // 1. Resolve invitation
    const { data: invite, error: fetchErr } = await serviceClient
      .from("team_invitations")
      .select("*, businesses(name)")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (fetchErr || !invite) return { error: "invalid" };
    if (invite.status === "revoked") return { error: "revoked" };
    if (invite.status === "accepted") return { error: "accepted_already" };

    // Check expiry
    const now = new Date();
    if (new Date(invite.expires_at) < now || invite.status === "expired") {
      await serviceClient
        .from("team_invitations")
        .update({ status: "expired" })
        .eq("id", invite.id);
      return { error: "expired" };
    }

    // 2. Fetch authenticated session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Prompt sign up/login
      return { error: "logged_out", invitation: invite };
    }

    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return {
        error: `This invitation was sent to '${invite.email}'. You are currently logged in as '${user.email}'. Please log in with the correct account to accept.`
      };
    }

    // Ensure email matches or user accepts manually
    // 3. Prevent duplicate active membership
    const { data: existingMember } = await serviceClient
      .from("business_members")
      .select("id")
      .eq("business_id", invite.business_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (existingMember) {
      // Mark accepted since they are already members
      await serviceClient
        .from("team_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          invited_user_id: user.id,
        })
        .eq("id", invite.id);

      return { success: true, businessId: invite.business_id };
    }

    // 4. Create membership via service client
    const { error: memberError } = await serviceClient
      .from("business_members")
      .insert({
        business_id: invite.business_id,
        user_id: user.id,
        role: invite.role,
        status: "active",
        invited_by: invite.invited_by,
      });

    if (memberError) throw memberError;

    // 5. Update invitation to accepted
    await serviceClient
      .from("team_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        invited_user_id: user.id,
      })
      .eq("id", invite.id);

    revalidatePath("/dashboard");
    return { success: true, businessId: invite.business_id };
  } catch (err) {
    console.error("acceptTeamInvitation error:", err);
    return { error: getErrorMessage(err) };
  }
}

/**
 * Update member role.
 */
export async function updateTeamMemberRole(memberId: string, role: string) {
  try {
    const ctx = await getCurrentBusinessWithRole();
    if (!ctx) return { error: "Unauthorized" };
    if (ctx.role !== "owner") {
      return { error: "Only owners can change member roles." };
    }

    const input = roleUpdateSchema.parse({ memberId, role });
    const serviceClient = createServiceClient();

    // Verify target member
    const { data: target } = await serviceClient
      .from("business_members")
      .select("role")
      .eq("id", input.memberId)
      .eq("business_id", ctx.business.id)
      .maybeSingle();

    if (!target) return { error: "Member not found." };
    if (target.role === "owner") return { error: "Cannot change the owner's role." };

    const { error } = await serviceClient
      .from("business_members")
      .update({
        role: input.role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.memberId)
      .eq("business_id", ctx.business.id);

    if (error) throw error;

    revalidatePath("/dashboard/settings/team");
    return { success: true };
  } catch (err) {
    console.error("updateTeamMemberRole error:", err);
    return { error: getErrorMessage(err) };
  }
}

/**
 * Suspend team member access.
 */
export async function suspendTeamMember(memberId: string) {
  try {
    const ctx = await getCurrentBusinessWithRole();
    if (!ctx) return { error: "Unauthorized" };
    if (!["owner", "admin"].includes(ctx.role)) {
      return { error: "Insufficient permissions." };
    }

    const input = memberActionSchema.parse({ memberId });
    const serviceClient = createServiceClient();

    const { data: target } = await serviceClient
      .from("business_members")
      .select("role, user_id")
      .eq("id", input.memberId)
      .eq("business_id", ctx.business.id)
      .maybeSingle();

    if (!target) return { error: "Member not found." };
    if (target.role === "owner") return { error: "Cannot suspend the owner." };
    if (ctx.role === "admin" && target.role === "admin") {
      return { error: "Admins cannot suspend other admins." };
    }

    const { error } = await serviceClient
      .from("business_members")
      .update({
        status: "suspended",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.memberId)
      .eq("business_id", ctx.business.id);

    if (error) throw error;

    revalidatePath("/dashboard/settings/team");
    return { success: true };
  } catch (err) {
    console.error("suspendTeamMember error:", err);
    return { error: getErrorMessage(err) };
  }
}

/**
 * Reactivate suspended team member.
 */
export async function reactivateTeamMember(memberId: string) {
  try {
    const ctx = await getCurrentBusinessWithRole();
    if (!ctx) return { error: "Unauthorized" };
    if (!["owner", "admin"].includes(ctx.role)) {
      return { error: "Insufficient permissions." };
    }

    const input = memberActionSchema.parse({ memberId });
    const serviceClient = createServiceClient();

    // Check plan limit before reactivating
    const { data: subscription } = await serviceClient
      .from("subscriptions")
      .select("plan, team_member_limit")
      .eq("business_id", ctx.business.id)
      .maybeSingle();

    let limit = subscription?.team_member_limit;
    if (limit === null || limit === undefined) {
      const planLimits = await getEffectivePlanLimits(subscription?.plan || "free_trial");
      limit = planLimits.team_member_limit;
    }

    // Count currently active members
    const { count: activeCount } = await serviceClient
      .from("business_members")
      .select("id", { count: "exact", head: true })
      .eq("business_id", ctx.business.id)
      .eq("status", "active");

    // Count pending invitations
    const { count: pendingCount } = await serviceClient
      .from("team_invitations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", ctx.business.id)
      .eq("status", "pending");

    const totalAllocated = (activeCount || 0) + (pendingCount || 0);
    if (totalAllocated >= limit) {
      return { 
        error: `Your subscription plan limit has been reached (${limit} team members). Please upgrade your plan to reactivate this member.`
      };
    }

    const { error } = await serviceClient
      .from("business_members")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.memberId)
      .eq("business_id", ctx.business.id);

    if (error) throw error;

    revalidatePath("/dashboard/settings/team");
    return { success: true };
  } catch (err) {
    console.error("reactivateTeamMember error:", err);
    return { error: getErrorMessage(err) };
  }
}

/**
 * Remove a member completely.
 */
export async function removeTeamMember(memberId: string) {
  try {
    const ctx = await getCurrentBusinessWithRole();
    if (!ctx) return { error: "Unauthorized" };
    if (!["owner", "admin"].includes(ctx.role)) {
      return { error: "Insufficient permissions." };
    }

    const input = memberActionSchema.parse({ memberId });
    const serviceClient = createServiceClient();

    const { data: target } = await serviceClient
      .from("business_members")
      .select("role, user_id")
      .eq("id", input.memberId)
      .eq("business_id", ctx.business.id)
      .maybeSingle();

    if (!target) return { error: "Member not found." };
    if (target.role === "owner") return { error: "Cannot remove the owner." };
    if (ctx.role === "admin" && target.role === "admin") {
      return { error: "Admins cannot remove other admins." };
    }

    // Prevent sole owner from removing themselves
    if (target.user_id === ctx.user.id) {
      return { error: "You cannot remove yourself. Transfer ownership first." };
    }

    const { error } = await serviceClient
      .from("business_members")
      .delete()
      .eq("id", input.memberId)
      .eq("business_id", ctx.business.id);

    if (error) throw error;

    revalidatePath("/dashboard/settings/team");
    return { success: true };
  } catch (err) {
    console.error("removeTeamMember error:", err);
    return { error: getErrorMessage(err) };
  }
}
