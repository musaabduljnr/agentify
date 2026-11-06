"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { KnowledgeSource } from "@/lib/types";
import { scrapeUrl } from "@/lib/scraper/scrape-url";
import { crawlWebsite } from "@/lib/scraper/crawl-website";
import { generateEmbedding } from "@/lib/vertex/embeddings";
import { chunkSourceText } from "@/lib/embeddings/chunker";
import {
  countChunksNeedingEmbedding,
  generateEmbeddingsForSourceInternal,
} from "@/lib/embeddings/generate-source";
import {
  completeUsageQuota,
  getQuotaDenialMessage,
  releaseUsageQuota,
  reserveUsageQuota,
} from "@/lib/billing/usage";
import { requireBusinessEntitlement } from "@/lib/billing/entitlements";
import { rateLimit } from "@/lib/security/rate-limit";
import { validateFileUpload } from "@/lib/security/file-upload";
import { getUserFriendlyError, logErrorSync } from "@/lib/monitoring/log-error";
import { countWords } from "@/lib/scraper/text-cleaner";
import { createBusinessNotification } from "@/lib/notifications/service";
import { isChunkFromCurrentSource } from "@/lib/knowledge/lifecycle";

export type KnowledgeConsistencyRow = {
  source_id: string;
  title: string;
  source_status: string;
  content_version: number;
  indexed_version: number | null;
  index_status: "pending" | "indexing" | "ready" | "failed";
  indexed_at: string | null;
  index_error: string | null;
  chunk_count: number;
  embedded_chunk_count: number;
  current_version_chunk_count: number;
  stale_chunk_count: number;
  is_retrievable: boolean;
};

type KnowledgeActionResult = {
  success?: boolean;
  error?: string;
  warning?: string;
  embedded?: boolean;
  chunkCount?: number;
  embeddingsGenerated?: number;
  embeddingsReused?: number;
  wordCount?: number;
  pageCount?: number;
  pagesScraped?: number;
  pagesFailed?: number;
};

async function notifyKnowledgeProcessingFailure(
  businessId: string,
  sourceId: string,
  sourceTitle: string
) {
  await createBusinessNotification({
    businessId,
    eventKey: `knowledge-processing-failed:${sourceId}`,
    category: "knowledge",
    title: "Knowledge source processing failed",
    message: `“${sourceTitle}” could not be processed. Review it and try again.`,
    href: "/dashboard/knowledge",
    severity: "critical",
    metadata: { sourceId },
  }).catch((error) => {
    console.error("Failed to create knowledge-processing notification:", error);
  });
}

async function indexSourceContent(sourceId: string): Promise<{
  embedded: boolean;
  chunkCount?: number;
  embeddingsGenerated?: number;
  embeddingsReused?: number;
  warning?: string;
}> {
  const result = await generateEmbeddingsForSource(sourceId);

  if (result.error) {
    return {
      embedded: false,
      warning: `Content was saved, but search indexing failed: ${result.error} Use "Embed Content" to retry.`,
    };
  }

  return {
    embedded: true,
    chunkCount: result.chunkCount,
    embeddingsGenerated: result.embeddingsGenerated,
    embeddingsReused: result.embeddingsReused,
  };
}

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
  crawl_mode: z.enum(["single", "crawl"]).optional().default("single"),
  crawl_depth: z.number().int().min(1).max(10).optional().default(3),
  max_pages: z.number().int().min(1).max(1000).optional().default(50),
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

export async function createWebsiteSource(formData: {
  title: string;
  source_url: string;
  crawl_mode?: "single" | "crawl";
  crawl_depth?: number;
  max_pages?: number;
}) {
  const parsed = websiteSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const { reservation, reason } = await reserveUsageQuota(business.id, "knowledge_source", 1, {
    type: "website",
  });
  if (!reservation) {
    return { error: getQuotaDenialMessage(reason, "knowledge source") };
  }

  const { data, error } = await supabase.from("knowledge_sources").insert({
    business_id: business.id,
    type: "website",
    title: parsed.data.title,
    source_url: parsed.data.source_url,
    status: "pending",
    crawl_mode: parsed.data.crawl_mode,
    crawl_depth: parsed.data.crawl_depth,
    max_pages: parsed.data.max_pages,
    crawl_status: "not_started",
  }).select("id").single();

  if (error || !data) {
    await releaseUsageQuota(reservation);
    return { error: error?.message || "Failed to create knowledge source." };
  }
  await completeUsageQuota(reservation);
  revalidatePath("/dashboard/knowledge");
  return { success: true, id: data.id };
}

export async function createFaqSource(formData: { question: string; answer: string }): Promise<KnowledgeActionResult> {
  const parsed = faqSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const { reservation, reason } = await reserveUsageQuota(business.id, "knowledge_source", 1, {
    type: "faq",
  });
  if (!reservation) {
    return { error: getQuotaDenialMessage(reason, "knowledge source") };
  }

  const content = `Question: ${parsed.data.question}\nAnswer: ${parsed.data.answer}`;

  const { data: created, error } = await supabase
    .from("knowledge_sources")
    .insert({
      business_id: business.id,
      type: "faq",
      title: parsed.data.question,
      content,
      status: "trained",
    })
    .select("id")
    .single();

  if (error || !created) {
    await releaseUsageQuota(reservation);
    return { error: error?.message || "Failed to create FAQ source." };
  }
  await completeUsageQuota(reservation);

  const indexing = await indexSourceContent(created.id);
  revalidatePath("/dashboard/knowledge");
  return { success: true, ...indexing };
}

export async function createManualSource(formData: { title: string; content: string }): Promise<KnowledgeActionResult> {
  const parsed = manualSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const { reservation, reason } = await reserveUsageQuota(business.id, "knowledge_source", 1, {
    type: "manual",
  });
  if (!reservation) {
    return { error: getQuotaDenialMessage(reason, "knowledge source") };
  }

  const { data: created, error } = await supabase
    .from("knowledge_sources")
    .insert({
      business_id: business.id,
      type: "manual",
      title: parsed.data.title,
      content: parsed.data.content,
      status: "trained",
    })
    .select("id")
    .single();

  if (error || !created) {
    await releaseUsageQuota(reservation);
    return { error: error?.message || "Failed to create manual knowledge source." };
  }
  await completeUsageQuota(reservation);

  const indexing = await indexSourceContent(created.id);
  revalidatePath("/dashboard/knowledge");
  return { success: true, ...indexing };
}

export async function getSignedUploadUrlAction(formData: {
  fileName: string;
  fileType: string;
  fileSize: number;
}) {
  try {
    const business = await getCurrentBusiness();
    await requireBusinessEntitlement(business.id, "canAddKnowledge");
    
    const fileValidation = validateFileUpload(formData.fileName, formData.fileType, formData.fileSize);
    if (!fileValidation.valid) {
      return { error: fileValidation.error || "Invalid file upload." };
    }

    const { buildStoragePath } = await import("@/lib/security/file-upload");
    const filePath = buildStoragePath(business.id, formData.fileName);

    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient.storage
      .from("business-documents")
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      throw new Error(`Failed to generate signed upload URL: ${error?.message}`);
    }

    return {
      signedUrl: data.signedUrl,
      filePath: filePath,
    };
  } catch (err: any) {
    return { error: err.message || "Failed to generate signed upload URL." };
  }
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

  const { reservation, reason } = await reserveUsageQuota(business.id, "knowledge_source", 1, {
    type: "document",
  });
  if (!reservation) {
    return { error: getQuotaDenialMessage(reason, "knowledge source") };
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

  if (error) {
    await releaseUsageQuota(reservation);
    return { error: error.message };
  }
  await completeUsageQuota(reservation);
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

  const indexing = parsed.data.content !== undefined
    ? await indexSourceContent(parsed.data.id)
    : null;

  revalidatePath("/dashboard/knowledge");
  return { success: true, ...(indexing || {}) };
}

export async function deleteKnowledgeSource(id: string) {
  const business = await getCurrentBusiness();
  const service = createServiceClient();

  const { data: source, error: fetchError } = await service
    .from("knowledge_sources")
    .select("id, type, file_url, title")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!source) return { error: "Knowledge source not found." };

  // Make the source ineligible before deleting anything. If the chunk cleanup
  // fails, the source stays excluded instead of serving removed knowledge.
  const { error: deactivateError } = await service
    .from("knowledge_sources")
    .update({
      index_status: "pending",
      index_run_id: null,
      index_started_at: null,
    })
    .eq("id", id)
    .eq("business_id", business.id);

  if (deactivateError) return { error: deactivateError.message };

  const { error: chunksError } = await service
    .from("knowledge_chunks")
    .delete()
    .eq("source_id", id)
    .eq("business_id", business.id);

  const { error: sourceError } = await service
    .from("knowledge_sources")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);

  if (sourceError) return { error: sourceError.message };
  if (chunksError) {
    // The source row is gone, so the foreign-key cascade also removed them.
    console.warn(
      `[Knowledge] Explicit chunk cleanup failed for deleted source ${id}; cascade handled it:`,
      chunksError.message
    );
  }

  if (source.type === "document" && source.file_url) {
    const { data: otherReferences } = await service
      .from("knowledge_sources")
      .select("id")
      .eq("business_id", business.id)
      .eq("file_url", source.file_url)
      .limit(1);

    if (!otherReferences || otherReferences.length === 0) {
      const { error: storageError } = await service.storage
        .from("business-documents")
        .remove([source.file_url]);

      if (storageError) {
        console.warn(
          `[Knowledge] Failed to remove stored file for deleted source ${id}:`,
          storageError.message
        );
      }
    }
  }

  revalidatePath("/dashboard/knowledge");
  return { success: true };
}

// ── Diagnostics ──────────────────────────────────────────────────────────

export async function getKnowledgeConsistencyReport() {
  try {
    const business = await getCurrentBusiness();
    const service = createServiceClient();

    const [consistency, orphaned] = await Promise.all([
      service.rpc("get_knowledge_consistency", { p_business_id: business.id }),
      service.rpc("count_orphaned_knowledge_chunks", { p_business_id: business.id }),
    ]);

    if (consistency.error) return { error: consistency.error.message };

    const rows = ((consistency.data || []) as KnowledgeConsistencyRow[]).map((row) => ({
      ...row,
      chunk_count: Number(row.chunk_count || 0),
      embedded_chunk_count: Number(row.embedded_chunk_count || 0),
      current_version_chunk_count: Number(row.current_version_chunk_count || 0),
      stale_chunk_count: Number(row.stale_chunk_count || 0),
    }));

    return {
      rows,
      orphanedChunks: orphaned.error ? null : Number(orphaned.data || 0),
      totals: {
        sources: rows.length,
        retrievableSources: rows.filter((row) => row.is_retrievable).length,
        pendingSources: rows.filter(
          (row) => row.index_status === "pending" || row.index_status === "indexing"
        ).length,
        failedSources: rows.filter((row) => row.index_status === "failed").length,
        sourcesWithStaleChunks: rows.filter((row) => row.stale_chunk_count > 0).length,
        chunks: rows.reduce((sum, row) => sum + row.chunk_count, 0),
        currentChunks: rows.reduce(
          (sum, row) => sum + row.current_version_chunk_count,
          0
        ),
      },
    };
  } catch (err: any) {
    return { error: err.message || "Failed to load knowledge diagnostics." };
  }
}

// ── Website Scraping ─────────────────────────────────────────────────────

export async function processWebsiteSource(sourceId: string): Promise<KnowledgeActionResult> {
  const business = await getCurrentBusiness();
  await requireBusinessEntitlement(business.id, "canAddKnowledge");
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
    .update({ 
      status: "processing", 
      error_message: null,
      crawl_mode: "single",
      crawl_status: "discovering",
      crawl_started_at: new Date().toISOString()
    })
    .eq("id", sourceId);

  revalidatePath("/dashboard/knowledge");

  try {
    // 3. Scrape the URL
    const result = await scrapeUrl(source.source_url, {
      businessId: business.id,
      featureSource: "website_summary_generation",
    });

    const crawlStatus = result.failedPageCount > 0 ? "partial" : "completed";

    // 4. Save extracted content
    const { error: updateError } = await supabase
      .from("knowledge_sources")
      .update({
        content: result.text,
        status: "trained",
        word_count: result.wordCount,
        character_count: result.characterCount,
        scraped_at: new Date().toISOString(),
        crawl_status: crawlStatus,
        crawl_completed_at: new Date().toISOString(),
        pages_found: result.pageCount,
        pages_scraped: result.pageCount,
        pages_failed: result.failedPageCount,
        crawled_pages: result.pages.map(p => ({
          url: p.url,
          title: p.title,
          wordCount: p.wordCount,
          characterCount: p.characterCount,
          status: "scraped"
        })),
        failed_pages: result.failedPages,
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
          embedding_status: "pending",
          chunk_count: 0,
        },
      })
      .eq("id", sourceId);

    if (updateError) return { error: updateError.message };

    const indexing = await indexSourceContent(sourceId);

    revalidatePath("/dashboard/knowledge");
    return {
      success: true,
      wordCount: result.wordCount,
      pageCount: result.pageCount,
      ...indexing,
    };
  } catch (err: any) {
    // 5. Handle errors
    await supabase
      .from("knowledge_sources")
      .update({
        status: "failed",
        crawl_status: "failed",
        error_message: err.message || "An unknown error occurred during scraping.",
      })
      .eq("id", sourceId);

    await notifyKnowledgeProcessingFailure(business.id, sourceId, source.title);
    revalidatePath("/dashboard/knowledge");
    return { error: err.message || "Scraping failed." };
  }
}

export async function crawlWebsiteSource(sourceId: string, options?: {
  maxPages?: number;
  depth?: number;
  autoEmbed?: boolean;
}): Promise<KnowledgeActionResult> {
  let businessId: string | null = null;
  let sourceTitle = "Website source";
  let hadPreviousContent = false;
  try {
    const business = await getCurrentBusiness();
    businessId = business.id;
    await requireBusinessEntitlement(business.id, "canAddKnowledge");
    const supabase = await createClient();

    // 1. Fetch the source and verify ownership
    const { data: source, error: fetchError } = await supabase
      .from("knowledge_sources")
      .select("*")
      .eq("id", sourceId)
      .eq("business_id", business.id)
      .single();

    if (fetchError || !source) return { error: "Knowledge source not found." };
    sourceTitle = source.title;
    hadPreviousContent = Boolean(source.content);
    if (source.type !== "website") return { error: "Only website sources can be crawled." };
    if (!source.source_url) return { error: "No URL to crawl." };

    // 2. Set status to processing & update crawl_status to discovering
    await supabase
      .from("knowledge_sources")
      .update({
        status: "processing",
        crawl_mode: "crawl",
        crawl_status: "discovering",
        crawl_started_at: new Date().toISOString(),
        error_message: null
      })
      .eq("id", sourceId);

    revalidatePath("/dashboard/knowledge");

    // 3. Perform crawling
    const maxPages = options?.maxPages ?? source.max_pages ?? 10;
    const depth = options?.depth ?? source.crawl_depth ?? 1;

    const result = await crawlWebsite({
      startUrl: source.source_url,
      maxPages,
      depth,
      businessId: business.id,
      featureSource: "website_summary_generation",
    });

    // 4. Update the database fields
    const crawlStatus = result.pagesScraped === 0
      ? "failed"
      : result.pagesFailed > 0
        ? "partial"
        : "completed";

    // A completely failed re-crawl must not wipe usable content from a
    // previous successful crawl.
    if (result.pagesScraped === 0) {
      const failedAt = new Date().toISOString();

      await supabase
        .from("knowledge_sources")
        .update({
          status: hadPreviousContent ? "trained" : "failed",
          crawl_status: "failed",
          crawl_completed_at: failedAt,
          pages_found: result.pagesFound,
          pages_scraped: 0,
          pages_failed: result.pagesFailed,
          failed_pages: result.failedPages,
          error_message: "Crawling failed to extract content from any pages.",
          metadata: {
            ...(source.metadata || {}),
            last_crawl_failed_at: failedAt,
            last_crawl_failed_pages: result.failedPages,
            last_crawl_error: "Crawling failed to extract content from any pages.",
          },
        })
        .eq("id", sourceId);

      await notifyKnowledgeProcessingFailure(business.id, sourceId, source.title);
      revalidatePath("/dashboard/knowledge");
      return {
        success: false,
        error: "Crawling failed to extract content from any pages.",
        pagesScraped: 0,
        pagesFailed: result.pagesFailed,
      };
    }

    const { error: updateError } = await supabase
      .from("knowledge_sources")
      .update({
        content: result.combinedText,
        status: "trained",
        error_message: null,
        word_count: countWords(result.combinedText),
        character_count: result.combinedText.length,
        scraped_at: new Date().toISOString(),
        crawl_status: crawlStatus,
        crawl_completed_at: new Date().toISOString(),
        pages_found: result.pagesFound,
        pages_scraped: result.pagesScraped,
        pages_failed: result.pagesFailed,
        crawled_pages: result.pages,
        failed_pages: result.failedPages,
        metadata: {
          ...(source.metadata || {}),
          scraped_title: result.pages[0]?.title || source.title,
          scraped_description: result.pages[0]?.description || "",
          scraped_page_count: result.pagesScraped,
          scraped_pages: result.pages.map(p => ({
            url: p.url,
            title: p.title,
            wordCount: p.wordCount,
            characterCount: p.characterCount
          })),
          embedded: false,
          embedding_status: "pending",
          chunk_count: 0,
        }
      })
      .eq("id", sourceId);

    if (updateError) return { error: updateError.message };

    // The previous chunk index is kept until the new one has been built
    // successfully by the embedding pipeline.
    const indexing = options?.autoEmbed
      ? await indexSourceContent(sourceId)
      : {
          embedded: false,
          warning:
            "Crawl completed, but embeddings were not generated. Click \"Embed Content\" to make this source searchable.",
        };

    revalidatePath("/dashboard/knowledge");
    return {
      success: true,
      pagesScraped: result.pagesScraped,
      pagesFailed: result.pagesFailed,
      ...indexing,
    };
  } catch (err: any) {
    // Save error state
    const supabase = await createClient();
    await supabase
      .from("knowledge_sources")
      .update({
        status: hadPreviousContent ? "trained" : "failed",
        crawl_status: "failed",
        error_message: err.message || "An unknown error occurred during crawling.",
      })
      .eq("id", sourceId);

    if (businessId) await notifyKnowledgeProcessingFailure(businessId, sourceId, sourceTitle);
    revalidatePath("/dashboard/knowledge");
    return { error: err.message || "Crawling failed." };
  }
}

// ── Document Processing ──────────────────────────────────────────────────

export async function processDocumentSource(sourceId: string): Promise<KnowledgeActionResult> {
  const business = await getCurrentBusiness();
  await requireBusinessEntitlement(business.id, "canAddKnowledge");
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
          ...(source.metadata || {}),
          file_type: fileData.type,
          processed_at: new Date().toISOString(),
          embedded: false,
          embedding_status: "pending",
          chunk_count: 0,
        },
      })
      .eq("id", sourceId);

    if (updateError) return { error: updateError.message };

    const indexing = await indexSourceContent(sourceId);

    revalidatePath("/dashboard/knowledge");
    return { success: true, wordCount, ...indexing };
  } catch (err: any) {
    // 6. Handle errors
    await supabase
      .from("knowledge_sources")
      .update({
        status: "failed",
        error_message: err.message || "An unknown error occurred during document processing.",
      })
      .eq("id", sourceId);

    await notifyKnowledgeProcessingFailure(business.id, sourceId, source.title);
    revalidatePath("/dashboard/knowledge");
    return { error: err.message || "Document processing failed." };
  }
}

// ── Vector Embeddings ────────────────────────────────────────────────────

export async function generateEmbeddingsForSource(sourceId: string): Promise<{
  success?: boolean;
  error?: string;
  chunkCount?: number;
  embeddingsGenerated?: number;
  embeddingsReused?: number;
}> {
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

    // 1.5 Check embedding usage limit. Only count chunks that do not already
    // have a valid, unchanged embedding.
    const totalChunks = chunkSourceText(source.content).length;
    if (totalChunks === 0) {
      return { error: "No usable text was found to embed. Add more content or reprocess this source." };
    }

    const neededChunks = await countChunksNeedingEmbedding(sourceId, business.id);
    const billableChunks = neededChunks === null ? totalChunks : neededChunks;

    let reservation = null;
    if (billableChunks > 0) {
      const reservationResult = await reserveUsageQuota(
        business.id,
        "embedding",
        billableChunks,
        { source_id: sourceId }
      );
      if (!reservationResult.reservation) {
        return {
          error: getQuotaDenialMessage(reservationResult.reason, `${billableChunks} embeddings`),
        };
      }
      reservation = reservationResult.reservation;
    }

    // Call internal generator
    const result = await generateEmbeddingsForSourceInternal(sourceId, business.id);
    if (result.error) {
      if (reservation) await releaseUsageQuota(reservation);
      return { error: result.error };
    }

    if (reservation) await completeUsageQuota(reservation);

    revalidatePath("/dashboard/knowledge");
    return {
      success: true,
      chunkCount: result.chunkCount ?? totalChunks,
      embeddingsGenerated: result.embeddingsGenerated ?? billableChunks,
      embeddingsReused: result.embeddingsReused ?? 0,
    };
  } catch (err: any) {
    logErrorSync(err, "embedding-generation");
    return { error: getUserFriendlyError("embedding-generation") };
  }
}

export async function searchKnowledge(query: string, businessId: string) {
  try {
    const business = await getCurrentBusiness();
    if (business.id !== businessId) throw new Error("Unauthorized");
    await requireBusinessEntitlement(business.id, "canUseAi");

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query, businessId, "playground");

    const supabase = await createClient();
    
    // Call RPC
    const { data, error } = await supabase.rpc("match_knowledge_chunks", {
      query_embedding: queryEmbedding,
      match_business_id: businessId,
      match_count: 5
    });

    if (error) throw new Error(error.message);
    const matches = ((data || []) as Array<{ metadata?: Record<string, any> | null }>).filter(
      (match) => isChunkFromCurrentSource(match.metadata)
    );
    return { success: true, matches };
  } catch (err: any) {
    return { error: err.message || "Search failed." };
  }
}
