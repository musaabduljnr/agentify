"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

async function getCurrentBusinessWithRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, owner_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  // Owner check: business owner_id matches user.id
  if (business) return { business, user, role: "owner" as const };

  // Check if user is a team member of any business
  const { data: membership } = await supabase
    .from("team_members")
    .select("business_id, role, businesses(id, name, owner_id)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membership) {
    const biz = membership.businesses as any;
    return { business: biz, user, role: membership.role as "admin" | "member" };
  }

  return null;
}

export interface TeamMember {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  status: "pending" | "active" | "removed";
  joined_at: string | null;
  invited_at: string;
  user_id: string | null;
}

/**
 * Fetch all active/pending team members for the current business.
 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  try {
    const ctx = await getCurrentBusinessWithRole();
    if (!ctx) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("team_members")
      .select("id, email, role, status, joined_at, invited_at, user_id")
      .eq("business_id", ctx.business.id)
      .neq("status", "removed")
      .order("invited_at", { ascending: false });

    if (error) throw error;
    return (data || []) as TeamMember[];
  } catch (err) {
    console.error("getTeamMembers error:", err);
    return [];
  }
}

/**
 * Invite a new team member by email.
 * Only owners and admins can invite.
 */
export async function inviteTeamMember(email: string, role: "admin" | "member") {
  try {
    const ctx = await getCurrentBusinessWithRole();
    if (!ctx) return { error: "Unauthorized" };
    if (!["owner", "admin"].includes(ctx.role)) return { error: "Only owners and admins can invite members." };

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return { error: "Please enter a valid email address." };
    }

    const serviceClient = createServiceClient();

    // Check if member already exists
    const { data: existing } = await serviceClient
      .from("team_members")
      .select("id, status")
      .eq("business_id", ctx.business.id)
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing && existing.status !== "removed") {
      return { error: "This email has already been invited or is already a member." };
    }

    const inviteToken = randomBytes(32).toString("hex");

    const { error: insertError } = await serviceClient
      .from("team_members")
      .upsert({
        business_id: ctx.business.id,
        email: normalizedEmail,
        role,
        status: "pending",
        invited_by: ctx.user.id,
        invited_at: new Date().toISOString(),
        invite_token: inviteToken,
        updated_at: new Date().toISOString(),
      }, { onConflict: "business_id,email" });

    if (insertError) throw insertError;

    revalidatePath("/dashboard/settings/team");
    return { success: true, inviteToken };
  } catch (err: any) {
    console.error("inviteTeamMember error:", err);
    return { error: "Failed to send invitation. Please try again." };
  }
}

/**
 * Remove a team member (set status to 'removed').
 * Owners can remove anyone; admins can only remove members.
 */
export async function removeTeamMember(memberId: string) {
  try {
    const ctx = await getCurrentBusinessWithRole();
    if (!ctx) return { error: "Unauthorized" };
    if (!["owner", "admin"].includes(ctx.role)) return { error: "Insufficient permissions." };

    const serviceClient = createServiceClient();

    // Fetch the member to check their role
    const { data: member } = await serviceClient
      .from("team_members")
      .select("role, email")
      .eq("id", memberId)
      .eq("business_id", ctx.business.id)
      .maybeSingle();

    if (!member) return { error: "Member not found." };
    if (member.role === "owner") return { error: "Cannot remove the owner." };
    if (ctx.role === "admin" && member.role === "admin") {
      return { error: "Admins cannot remove other admins." };
    }

    const { error } = await serviceClient
      .from("team_members")
      .update({ status: "removed", updated_at: new Date().toISOString() })
      .eq("id", memberId)
      .eq("business_id", ctx.business.id);

    if (error) throw error;

    revalidatePath("/dashboard/settings/team");
    return { success: true };
  } catch (err: any) {
    console.error("removeTeamMember error:", err);
    return { error: "Failed to remove member. Please try again." };
  }
}

/**
 * Update a team member's role.
 * Only owners can change roles.
 */
export async function updateMemberRole(memberId: string, newRole: "admin" | "member") {
  try {
    const ctx = await getCurrentBusinessWithRole();
    if (!ctx) return { error: "Unauthorized" };
    if (ctx.role !== "owner") return { error: "Only owners can change member roles." };

    const serviceClient = createServiceClient();
    const { error } = await serviceClient
      .from("team_members")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("id", memberId)
      .eq("business_id", ctx.business.id);

    if (error) throw error;

    revalidatePath("/dashboard/settings/team");
    return { success: true };
  } catch (err: any) {
    console.error("updateMemberRole error:", err);
    return { error: "Failed to update role. Please try again." };
  }
}

/**
 * Accept a team invite via token.
 */
export async function acceptTeamInvite(token: string) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc("accept_team_invite", {
      p_token: token,
    });

    if (error) throw error;

    const parsed = result as any;
    if (parsed?.error) return { error: parsed.error };

    revalidatePath("/dashboard");
    return { success: true, businessId: parsed?.business_id, role: parsed?.role };
  } catch (err: any) {
    console.error("acceptTeamInvite error:", err);
    return { error: "Failed to accept invite. The link may be expired." };
  }
}
