"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { KnowledgeSource } from "@/lib/types";
import { scrapeUrl } from "@/lib/scraper/scrape-url";

// ── Helpers ──────────────────────────────────────────────────────────────

export async function getCurrentBusiness() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .eq("onboarding_completed", true)
    .limit(1)
    .single();

  if (error || !business) throw new Error("No business found");
  return business;
}

export async function getKnowledgeSources(): Promise<KnowledgeSource[]> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as KnowledgeSource[];
}

// ── Schemas ──────────────────────────────────────────────────────────────

const websiteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  source_url: z.string().url("Enter a valid URL"),
});

const faqSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
});

const manualSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(20, "Content must be at least 20 characters"),
});

const documentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  file_name: z.string().min(1, "File name is required"),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  content: z.string().optional(),
  source_url: z.string().optional(),
});

// ── Create Actions ───────────────────────────────────────────────────────

export async function createWebsiteSource(formData: { title: string; source_url: string }) {
  const parsed = websiteSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const { error } = await supabase.from("knowledge_sources").insert({
    business_id: business.id,
    type: "website",
    title: parsed.data.title,
    source_url: parsed.data.source_url,
    status: "pending",
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/knowledge");
  return { success: true };
}

export async function createFaqSource(formData: { question: string; answer: string }) {
  const parsed = faqSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const content = `Question: ${parsed.data.question}\nAnswer: ${parsed.data.answer}`;

  const { error } = await supabase.from("knowledge_sources").insert({
    business_id: business.id,
    type: "faq",
    title: parsed.data.question,
    content,
    status: "trained",
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/knowledge");
  return { success: true };
}

export async function createManualSource(formData: { title: string; content: string }) {
  const parsed = manualSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const { error } = await supabase.from("knowledge_sources").insert({
    business_id: business.id,
    type: "manual",
    title: parsed.data.title,
    content: parsed.data.content,
    status: "trained",
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/knowledge");
  return { success: true };
}

export async function createDocumentSource(formData: { title: string; file_name: string }) {
  const parsed = documentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const { error } = await supabase.from("knowledge_sources").insert({
    business_id: business.id,
    type: "document",
    title: parsed.data.title,
    file_name: parsed.data.file_name,
    status: "pending",
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/knowledge");
  return { success: true };
}

// ── Update / Delete ──────────────────────────────────────────────────────

export async function updateKnowledgeSource(formData: {
  id: string;
  title: string;
  content?: string;
  source_url?: string;
}) {
  const parsed = updateSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const updatePayload: Record<string, any> = { title: parsed.data.title };
  if (parsed.data.content !== undefined) updatePayload.content = parsed.data.content;
  if (parsed.data.source_url !== undefined) updatePayload.source_url = parsed.data.source_url;

  const { error } = await supabase
    .from("knowledge_sources")
    .update(updatePayload)
    .eq("id", parsed.data.id)
    .eq("business_id", business.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/knowledge");
  return { success: true };
}

export async function deleteKnowledgeSource(id: string) {
  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("knowledge_sources")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/knowledge");
  return { success: true };
}

// ── Website Scraping ─────────────────────────────────────────────────────

export async function processWebsiteSource(sourceId: string) {
  const business = await getCurrentBusiness();
  const supabase = await createClient();

  // 1. Fetch the source and verify ownership
  const { data: source, error: fetchError } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("id", sourceId)
    .eq("business_id", business.id)
    .single();

  if (fetchError || !source) return { error: "Knowledge source not found." };
  if (source.type !== "website") return { error: "Only website sources can be scraped." };
  if (!source.source_url) return { error: "No URL to scrape." };

  // 2. Set status to processing
  await supabase
    .from("knowledge_sources")
    .update({ status: "processing", error_message: null })
    .eq("id", sourceId);

  revalidatePath("/dashboard/knowledge");

  try {
    // 3. Scrape the URL
    const result = await scrapeUrl(source.source_url);

    // 4. Save extracted content
    const { error: updateError } = await supabase
      .from("knowledge_sources")
      .update({
        content: result.text,
        status: "trained",
        word_count: result.wordCount,
        character_count: result.characterCount,
        scraped_at: new Date().toISOString(),
        metadata: {
          scraped_title: result.title,
          scraped_description: result.description,
        },
      })
      .eq("id", sourceId);

    if (updateError) return { error: updateError.message };

    revalidatePath("/dashboard/knowledge");
    return { success: true, wordCount: result.wordCount };
  } catch (err: any) {
    // 5. Handle errors
    await supabase
      .from("knowledge_sources")
      .update({
        status: "failed",
        error_message: err.message || "An unknown error occurred during scraping.",
      })
      .eq("id", sourceId);

    revalidatePath("/dashboard/knowledge");
    return { error: err.message || "Scraping failed." };
  }
}
