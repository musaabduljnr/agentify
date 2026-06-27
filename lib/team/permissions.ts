import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";

export type BusinessRole = "owner" | "admin" | "support" | "sales" | "viewer";

export type Permission =
  | "manage_team"
  | "manage_billing"
  | "manage_knowledge"
  | "manage_widget"
  | "manage_leads"
  | "manage_conversations"
  | "manual_takeover"
  | "view_analytics"
  | "delete_business"
  | "transfer_ownership";

export const PERMISSION_MAP: Record<BusinessRole, Record<Permission, boolean>> = {
  owner: {
    manage_team: true,
    manage_billing: true,
    manage_knowledge: true,
    manage_widget: true,
    manage_leads: true,
    manage_conversations: true,
    manual_takeover: true,
    view_analytics: true,
    delete_business: true,
    transfer_ownership: true,
  },
  admin: {
    manage_team: true,
    manage_billing: false,
    manage_knowledge: true,
    manage_widget: true,
    manage_leads: true,
    manage_conversations: true,
    manual_takeover: true,
    view_analytics: true,
    delete_business: false,
    transfer_ownership: false,
  },
  support: {
    manage_team: false,
    manage_billing: false,
    manage_knowledge: false,
    manage_widget: false,
    manage_leads: false,
    manage_conversations: true,
    manual_takeover: true,
    view_analytics: false,
    delete_business: false,
    transfer_ownership: false,
  },
  sales: {
    manage_team: false,
    manage_billing: false,
    manage_knowledge: false,
    manage_widget: false,
    manage_leads: true,
    manage_conversations: true,
    manual_takeover: false,
    view_analytics: true,
    delete_business: false,
    transfer_ownership: false,
  },
  viewer: {
    manage_team: false,
    manage_billing: false,
    manage_knowledge: false,
    manage_widget: false,
    manage_leads: false,
    manage_conversations: false,
    manual_takeover: false,
    view_analytics: true,
    delete_business: false,
    transfer_ownership: false,
  },
};

/**
 * Get the current user's role in a business.
 */
export async function getUserBusinessRole(
  userId: string,
  businessId: string
): Promise<BusinessRole | null> {
  const supabase = createServiceClient();

  // 1. Check if they are the business owner in businesses table
  const { data: business } = await supabase
    .from("businesses")
    .select("owner_id")
    .eq("id", businessId)
    .maybeSingle();

  if (business?.owner_id === userId) {
    return "owner";
  }

  // 2. Check the business_members table
  const { data: member } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (member) {
    return member.role as BusinessRole;
  }

  return null;
}

/**
 * Server-side function to enforce a permission check.
 * Throws an error if unauthorized.
 */
export async function requireBusinessPermission(
  businessId: string,
  permission: Permission
): Promise<BusinessRole> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const role = await getUserBusinessRole(user.id, businessId);
  if (!role) {
    throw new Error("Access Denied: You do not belong to this business.");
  }

  const hasPermission = PERMISSION_MAP[role]?.[permission] ?? false;
  if (!hasPermission) {
    throw new Error(`Access Denied: Insufficient permissions for action: '${permission}'`);
  }

  return role;
}

// Granular checkers
export function canManageTeam(role: BusinessRole): boolean {
  return PERMISSION_MAP[role]?.manage_team || false;
}

export function canManageBilling(role: BusinessRole): boolean {
  return PERMISSION_MAP[role]?.manage_billing || false;
}

export function canManageKnowledge(role: BusinessRole): boolean {
  return PERMISSION_MAP[role]?.manage_knowledge || false;
}

export function canManageWidget(role: BusinessRole): boolean {
  return PERMISSION_MAP[role]?.manage_widget || false;
}

export function canManageLeads(role: BusinessRole): boolean {
  return PERMISSION_MAP[role]?.manage_leads || false;
}

export function canManageConversations(role: BusinessRole): boolean {
  return PERMISSION_MAP[role]?.manage_conversations || false;
}

export function canUseManualTakeover(role: BusinessRole): boolean {
  return PERMISSION_MAP[role]?.manual_takeover || false;
}

export function canViewAnalytics(role: BusinessRole): boolean {
  return PERMISSION_MAP[role]?.view_analytics || false;
}
