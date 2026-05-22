"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const leadStatusSchema = z.enum(["new", "contacted", "qualified", "converted", "closed"]);

async function getCurrentBusiness() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  return business;
}

export async function getBusinessLeads() {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("Unauthorized");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  } catch (err: any) {
    console.error("getBusinessLeads error:", err);
    return [];
  }
}

export async function updateLeadStatus(leadId: string, status: string) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("Unauthorized");

    const parsedStatus = leadStatusSchema.parse(status);
    const supabase = await createClient();

    const { error } = await supabase
      .from("leads")
      .update({ status: parsedStatus })
      .eq("id", leadId)
      .eq("business_id", business.id);

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/leads");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateLeadNotes(leadId: string, notes: string) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("Unauthorized");

    const supabase = await createClient();
    const { error } = await supabase
      .from("leads")
      .update({ notes })
      .eq("id", leadId)
      .eq("business_id", business.id);

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/leads");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function deleteLead(leadId: string) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("Unauthorized");

    const supabase = await createClient();
    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", leadId)
      .eq("business_id", business.id);

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/leads");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
