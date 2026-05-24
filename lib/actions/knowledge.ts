"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { KnowledgeSource } from "@/lib/types";
import { scrapeUrl } from "@/lib/scraper/scrape-url";
import { generateEmbedding } from "@/lib/vertex/embeddings";
import { chunkText, estimateTokens } from "@/lib/embeddings/chunker";
import { checkUsageLimit, incrementUsage } from "@/lib/billing/usage";
import { rateLimit } from "@/lib/security/rate-limit";
import { validateFileUpload } from "@/lib/security/file-upload";
import { getUserFriendlyError, logErrorSync } from "@/lib/monitoring/log-error";

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

export async function getBusinessIdForUpload() {
  const business = await getCurrentBusiness();
  return business.id;
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
  file_url: z.string().min(1, "File URL is required"),
  file_type: z.string().min(1, "File type is required"),
  file_size: z.number().int().positive(),
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
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const business = await getCurrentBusiness();
  const supabase = await createClient();

  // Check knowledge source limit
  const limitCheck = await checkUsageLimit(business.id, "knowledge_source");
  if (!limitCheck.allowed) {
    return { error: "You've reached your knowledge source limit for this plan. Please upgrade to add more." };
  }

  const { error } = await supabase.from("knowledge_sources").insert({
    business_id: business.id,
    type: "website",
    title: parsed.data.title,
    source_url: parsed.data.source_url,
    status: "pending",
  });

  if (error) return { error: error.message };
  await incrementUsage(business.id, "knowledge_source", 1, { type: "website", title: parsed.data.title });
  revalidatePath("/dashboard/knowledge");
  return { success: true };
}

export async function createFaqSource(formData: { question: string; answer: string }) {
  const parsed = faqSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const business = await getCurrentBusiness();
  const supabase = await createClient();

  // Check knowledge source limit
  const limitCheck = await checkUsageLimit(business.id, "knowledge_source");
  if (!limitCheck.allowed) {
    return { error: "You've reached your knowledge source limit for this plan. Please upgrade to add more." };
  }

  const content = `Question: ${parsed.data.question}\nAnswer: ${parsed.data.answer}`;

  const { error } = await supabase.from("knowledge_sources").insert({
    business_id: business.id,
    type: "faq",
    title: parsed.data.question,
    content,
    status: "trained",
  });

  if (error) return { error: error.message };
  await incrementUsage(business.id, "knowledge_source", 1, { type: "faq", title: parsed.data.question });
  revalidatePath("/dashboard/knowledge");
  return { success: true };
}

export async function createManualSource(formData: { title: string; content: string }) {
  const parsed = manualSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const business = await getCurrentBusiness();
  const supabase = await createClient();

  // Check knowledge source limit
  const limitCheck = await checkUsageLimit(business.id, "knowledge_source");
  if (!limitCheck.allowed) {
    return { error: "You've reached your knowledge source limit for this plan. Please upgrade to add more." };
  }

  const { error } = await supabase.from("knowledge_sources").insert({
    business_id: business.id,
    type: "manual",
    title: parsed.data.title,
    content: parsed.data.content,
    status: "trained",
  });

  if (error) return { error: error.message };
  await incrementUsage(business.id, "knowledge_source", 1, { type: "manual", title: parsed.data.title });
  revalidatePath("/dashboard/knowledge");
  return { success: true };
}

export async function createDocumentSource(formData: {
  title: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
}) {
  const parsed = documentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const business = await getCurrentBusiness();
  const supabase = await createClient();

  if (!parsed.data.file_url.startsWith(`${business.id}/`) || parsed.data.file_url.includes("..")) {
    return { error: "Invalid upload path." };
  }

  const fileValidation = validateFileUpload(
    parsed.data.file_name,
    parsed.data.file_type,
    parsed.data.file_size
  );
  if (!fileValidation.valid) {
    return { error: fileValidation.error || "Invalid file upload." };
  }

  // Check knowledge source limit
  const limitCheck = await checkUsageLimit(business.id, "knowledge_source");
  if (!limitCheck.allowed) {
    return { error: "You've reached your knowledge source limit for this plan. Please upgrade to add more." };
  }

  const { error } = await supabase.from("knowledge_sources").insert({
    business_id: business.id,
    type: "document",
    title: parsed.data.title,
    file_name: parsed.data.file_name,
    file_url: parsed.data.file_url,
    metadata: {
      file_type: parsed.data.file_type,
      file_size: parsed.data.file_size,
    },
    status: "pending",
  });

  if (error) return { error: error.message };
  await incrementUsage(business.id, "knowledge_source", 1, { type: "document", title: parsed.data.title });
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
  if (!parsed.success) return { error: parsed.error.issues[0].message };

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
          ...(source.metadata || {}),
          scraped_title: result.title,
          scraped_description: result.description,
          scraped_page_count: result.pageCount,
          scraped_pages: result.pages,
          scraped_discovered_url_count: result.discoveredUrlCount,
          scraped_failed_page_count: result.failedPageCount,
          scraped_failed_pages: result.failedPages,
          embedded: false,
          chunk_count: 0,
        },
      })
      .eq("id", sourceId);

    if (updateError) return { error: updateError.message };

    await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("source_id", sourceId)
      .eq("business_id", business.id);

    revalidatePath("/dashboard/knowledge");
    return { success: true, wordCount: result.wordCount, pageCount: result.pageCount };
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

// ── Document Processing ──────────────────────────────────────────────────

export async function processDocumentSource(sourceId: string) {
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
  if (source.type !== "document") return { error: "Only document sources can be processed here." };
  if (!source.file_url) return { error: "No file URL found." };

  // 2. Set status to processing
  await supabase
    .from("knowledge_sources")
    .update({ status: "processing", error_message: null })
    .eq("id", sourceId);

  revalidatePath("/dashboard/knowledge");

  try {
    // 3. Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("business-documents")
      .download(source.file_url);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download document: ${downloadError?.message || "Unknown error"}`);
    }

    // 4. Extract Text
    const { extractDocumentText, getWordCount, getCharacterCount } = await import("@/lib/documents/extract-text");
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const extractedText = await extractDocumentText(buffer, fileData.type);

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error("Could not extract any text from the document.");
    }

    const wordCount = getWordCount(extractedText);
    const charCount = getCharacterCount(extractedText);

    // 5. Save extracted content
    const { error: updateError } = await supabase
      .from("knowledge_sources")
      .update({
        content: extractedText,
        status: "trained",
        word_count: wordCount,
        character_count: charCount,
        metadata: {
          file_type: fileData.type,
          processed_at: new Date().toISOString(),
        },
      })
      .eq("id", sourceId);

    if (updateError) return { error: updateError.message };

    revalidatePath("/dashboard/knowledge");
    return { success: true, wordCount };
  } catch (err: any) {
    // 6. Handle errors
    await supabase
      .from("knowledge_sources")
      .update({
        status: "failed",
        error_message: err.message || "An unknown error occurred during document processing.",
      })
      .eq("id", sourceId);

    revalidatePath("/dashboard/knowledge");
    return { error: err.message || "Document processing failed." };
  }
}

// ── Vector Embeddings ────────────────────────────────────────────────────

export async function generateEmbeddingsForSource(sourceId: string) {
  try {
    const business = await getCurrentBusiness();
    const supabase = await createClient();

    const rateLimitResult = await rateLimit(business.id, "embedding_generation");
    if (!rateLimitResult.success) {
      return { error: "Too many embedding requests. Please try again later." };
    }

    // 1. Fetch source
    const { data: source, error: fetchError } = await supabase
      .from("knowledge_sources")
      .select("*")
      .eq("id", sourceId)
      .eq("business_id", business.id)
      .single();

    if (fetchError || !source) return { error: "Knowledge source not found." };
    if (source.status !== "trained") return { error: "Source must be 'trained' before generating embeddings." };
    if (!source.content) return { error: "Source has no content to embed." };

    // 1.5 Check embedding usage limit
    const chunks = chunkText(source.content);
    if (chunks.length === 0) {
      const updatedMetadata = {
        ...(source.metadata || {}),
        embedded: false,
        chunk_count: 0,
        embedding_error: "No usable text chunks were found. Add more source content or reprocess the website.",
      };

      await supabase
        .from("knowledge_sources")
        .update({ metadata: updatedMetadata })
        .eq("id", sourceId);

      revalidatePath("/dashboard/knowledge");
      return { error: "No usable text was found to embed. Add more content or reprocess this source." };
    }

    const embeddingCheck = await checkUsageLimit(business.id, "embedding");
    if (!embeddingCheck.allowed) {
      return { error: "You've reached your embedding limit for this plan. Please upgrade to generate more embeddings." };
    }
    if (embeddingCheck.remaining < chunks.length) {
      return { error: `You need ${chunks.length} embeddings but only have ${embeddingCheck.remaining} remaining. Please upgrade your plan.` };
    }

    // 2. Delete existing chunks
    await supabase.from("knowledge_chunks").delete().eq("source_id", sourceId);
    
    // 3. Generate embeddings and insert
    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      const embedding = await generateEmbedding(content);
      
      const { error: insertError } = await supabase.from("knowledge_chunks").insert({
        business_id: business.id,
        source_id: sourceId,
        content: content,
        embedding: embedding,
        chunk_index: i,
        token_estimate: estimateTokens(content),
        metadata: {
          source_type: source.type,
          source_title: source.title
        }
      });

      if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
    }

    // 4. Increment embedding usage by chunk count
    await incrementUsage(business.id, "embedding", chunks.length, {
      source_id: sourceId,
      source_title: source.title,
    });

    // 5. Update source metadata
    const updatedMetadata = {
      ...(source.metadata || {}),
      embedded: true,
      embedded_at: new Date().toISOString(),
      chunk_count: chunks.length
    };

    await supabase
      .from("knowledge_sources")
      .update({ metadata: updatedMetadata })
      .eq("id", sourceId);

    revalidatePath("/dashboard/knowledge");
    return { success: true, chunkCount: chunks.length };
  } catch (err: any) {
    logErrorSync(err, "embedding-generation");
    return { error: getUserFriendlyError("embedding-generation") };
  }
}

export async function searchKnowledge(query: string, businessId: string) {
  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    const supabase = await createClient();
    
    // Call RPC
    const { data, error } = await supabase.rpc("match_knowledge_chunks", {
      query_embedding: queryEmbedding,
      match_business_id: businessId,
      match_count: 5
    });

    if (error) throw new Error(error.message);
    return { success: true, matches: data };
  } catch (err: any) {
    return { error: err.message || "Search failed." };
  }
}
