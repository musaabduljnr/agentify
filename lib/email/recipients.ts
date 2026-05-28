import { createServiceClient } from "@/utils/supabase/service";

/**
 * Validates a string to ensure it is in a valid email format.
 */
export function validateEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  // Standard email format validation regex
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}

/**
 * Resolves the primary notification email for a business.
 * 
 * Logic:
 * 1. Fetch business support_email and owner's profile email.
 * 2. If business.support_email exists and is valid, use it.
 * 3. Else if business owner profile email exists and is valid, use it.
 * 4. Else fall back to environment-level SUPPORT_EMAIL.
 */
export async function getBusinessNotificationEmail(businessId: string): Promise<string> {
  const supabase = createServiceClient();
  const fallbackEmail = process.env.SUPPORT_EMAIL || "support@agentify.app";

  try {
    const { data: business, error } = await supabase
      .from("businesses")
      .select("support_email, owner_id")
      .eq("id", businessId)
      .maybeSingle();

    if (error) {
      console.error(`[RECIPIENT RESOLUTION WARNING] Error fetching business for ${businessId}:`, error.message);
    }

    if (business) {
      // 1. Check support_email
      if (business.support_email && validateEmail(business.support_email)) {
        return business.support_email.trim();
      }

      // 2. Fetch owner's profile email
      if (business.owner_id) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", business.owner_id)
          .maybeSingle();

        if (profileError) {
          console.error(`[RECIPIENT RESOLUTION WARNING] Error fetching profile for ${business.owner_id}:`, profileError.message);
        }

        if (profile?.email && validateEmail(profile.email)) {
          return profile.email.trim();
        }
      }
    }
  } catch (err) {
    console.error(`[RECIPIENT RESOLUTION CRITICAL] Exception resolving email for business ${businessId}:`, err);
  }

  // 3. Final fallback
  return fallbackEmail;
}
