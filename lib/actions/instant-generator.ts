"use server";

import { headers } from "next/headers";
import { createServiceClient } from "@/utils/supabase/service";
import { crawlWebsite } from "@/lib/scraper/crawl-website";
import { assertPublicHttpUrl, normalizeUrl } from "@/lib/scraper/url-safety";
import { cleanExtractedText, countWords } from "@/lib/scraper/text-cleaner";
import { chunkText, estimateTokens } from "@/lib/embeddings/chunker";
import { generateEmbeddingsBatch } from "@/lib/ai/engine/embeddings";
import { generateGeminiContent } from "@/lib/ai/providers/gemini";
import { rateLimit } from "@/lib/security/rate-limit";
import { logErrorSync, getUserFriendlyError } from "@/lib/monitoring/log-error";

export type InstantGenerationSuccess = {
  success: true;
  draftSlug: string;
  previewUrl: string;
  businessName: string;
  industry?: string;
  description?: string;
  welcomeMessage: string;
  suggestedQuestions: string[];
  pagesScraped: number;
  wordCount: number;
  cached?: boolean;
};

export type InstantGenerationError = {
  success: false;
  error: string;
  code: "INVALID_URL" | "SSRF_BLOCKED" | "RATE_LIMITED" | "SCRAPE_FAILED" | "INSUFFICIENT_CONTENT" | "SERVER_ERROR";
  retryAfter?: number;
};

export type InstantGenerationResult = InstantGenerationSuccess | InstantGenerationError;

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function parseGeminiJson(text: string): Record<string, any> | null {
  try {
    const cleanText = text
      .replace(/```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    return JSON.parse(cleanText);
  } catch {
    return null;
  }
}

async function getClientIp(): Promise<string> {
  try {
    const headersList = await headers();
    const forwarded = headersList.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    const realIp = headersList.get("x-real-ip");
    if (realIp) return realIp.trim();
  } catch {
    // When running in testing environments or background contexts
  }
  return "127.0.0.1";
}

/**
 * Public, rate-limited action to instantly generate an AI agent draft from a website URL.
 */
export async function generateInstantAgent(formData: {
  websiteUrl: string;
  businessName?: string;
}): Promise<InstantGenerationResult> {
  let placeholderBizId: string | null = null;
  let demoBizId: string | null = null;
  const serviceClient = createServiceClient();

  try {
    const rawUrl = formData.websiteUrl?.trim();
    if (!rawUrl) {
      return {
        success: false,
        error: "Please enter a website URL.",
        code: "INVALID_URL",
      };
    }

    // 1. URL formatting check
    let parsedUrl: URL;
    try {
      let candidate = rawUrl;
      if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
        candidate = "https://" + candidate;
      }
      parsedUrl = new URL(candidate);
      const host = parsedUrl.hostname.toLowerCase();
      if (!host || (!host.includes(".") && host !== "localhost" && !host.endsWith(".local") && !host.endsWith(".internal"))) {
        throw new Error("Invalid domain name");
      }
    } catch {
      return {
        success: false,
        error: "Please enter a valid website address (e.g. example.com or https://example.com).",
        code: "INVALID_URL",
      };
    }

    const normalized = normalizeUrl(parsedUrl.toString());

    // 2. Server-side Rate Limiting (per IP) - check first before DNS/network calls
    const clientIp = await getClientIp();
    const rl = await rateLimit(clientIp, "instant_generation");
    if (!rl.success) {
      const retryAfter = Math.max(0, rl.reset - Math.floor(Date.now() / 1000));
      return {
        success: false,
        error: "Generation limit reached for your IP address. Please wait a short while before generating another agent.",
        code: "RATE_LIMITED",
        retryAfter,
      };
    }

    // 3. SSRF Protection: verify non-private, non-local, public HTTP(S) URL
    try {
      await assertPublicHttpUrl(normalized);
    } catch (ssrfError: any) {
      const isDnsFailure = ssrfError.message?.toLowerCase().includes("resolve hostname");
      return {
        success: false,
        error: ssrfError.message || "Invalid or disallowed website URL.",
        code: isDnsFailure ? "SCRAPE_FAILED" : "SSRF_BLOCKED",
      };
    }

    // 4. Duplicate Check: Re-use recent identical crawl (within last 15 minutes) to protect cost and quotas
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: existingRecentDemo } = await serviceClient
      .from("demo_businesses")
      .select("demo_slug, demo_url, business_name, placeholder_business_id, industry")
      .eq("website_url", normalized)
      .eq("status", "active")
      .gt("created_at", fifteenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRecentDemo && existingRecentDemo.placeholder_business_id) {
      const [{ data: existingAssistant }, { data: existingWidget }] = await Promise.all([
        serviceClient
          .from("assistants")
          .select("welcome_message")
          .eq("business_id", existingRecentDemo.placeholder_business_id)
          .eq("is_active", true)
          .maybeSingle(),
        serviceClient
          .from("widget_configs")
          .select("suggested_questions")
          .eq("business_id", existingRecentDemo.placeholder_business_id)
          .maybeSingle(),
      ]);

      return {
        success: true,
        draftSlug: existingRecentDemo.demo_slug,
        previewUrl: existingRecentDemo.demo_url || `/demo/${existingRecentDemo.demo_slug}`,
        businessName: existingRecentDemo.business_name,
        industry: existingRecentDemo.industry || undefined,
        welcomeMessage: existingAssistant?.welcome_message || `Hello! I'm the AI assistant for ${existingRecentDemo.business_name}.`,
        suggestedQuestions: Array.isArray(existingWidget?.suggested_questions) ? existingWidget.suggested_questions : [],
        pagesScraped: 3,
        wordCount: 500,
        cached: true,
      };
    }

    // 5. Dedicated Instant Crawl Profile: 3 pages max, depth 1, 8s per page timeout
    let crawlResult;
    try {
      crawlResult = await crawlWebsite({
        startUrl: normalized,
        maxPages: 3,
        depth: 1,
        timeoutMs: 8000,
        featureSource: "demo_generation",
      });
    } catch (crawlErr: any) {
      return {
        success: false,
        error: crawlErr.message || "Could not connect to the website. Please check the URL and try again.",
        code: "SCRAPE_FAILED",
      };
    }

    // Validate extracted content quality
    const totalWords = countWords(crawlResult.combinedText);
    if (!crawlResult || crawlResult.pagesScraped === 0 || totalWords < 25) {
      return {
        success: false,
        error: "We could not extract sufficient business information from this website. The site may be unreachable, blocking automated visitors, or rendered completely with client-side JavaScript.",
        code: "INSUFFICIENT_CONTENT",
      };
    }

    // 6. AI Profile Extraction with Safe Fallbacks
    let businessName = formData.businessName?.trim() || "";
    let industry = "";
    let description = "";
    let welcomeMessage = "";
    let suggestedQuestions: string[] = [];

    try {
      const extractionSystemPrompt = `You are an AI business profile extractor.
Given the following scraped website content from a business website, extract accurate details about the business to configure their AI assistant.
Respond strictly in JSON format. Do not invent products, pricing, or services not in the text.

JSON format:
{
  "businessName": "brand or business name extracted from page content",
  "industry": "industry name",
  "description": "a concise 2-3 sentence business summary",
  "suggestedQuestions": ["Question 1", "Question 2", "Question 3"],
  "welcomeMessage": "A friendly, brand-specific welcome message for their AI assistant. Introduce yourself as the assistant for the business."
}`;

      const rawAiResponse = await generateGeminiContent({
        model: "gemini-2.5-flash",
        prompt: `Website URL: ${normalized}\n\nScraped Content:\n${crawlResult.combinedText.slice(0, 12000)}`,
        systemInstruction: extractionSystemPrompt,
        temperature: 0.2,
        maxOutputTokens: 1024,
        featureSource: "demo_generation",
      });

      const extracted = parseGeminiJson(rawAiResponse);
      if (extracted) {
        if (!businessName && extracted.businessName && typeof extracted.businessName === "string" && extracted.businessName.trim().length > 1) {
          businessName = extracted.businessName.trim();
        }
        if (extracted.industry && typeof extracted.industry === "string") {
          industry = extracted.industry.trim();
        }
        if (extracted.description && typeof extracted.description === "string") {
          description = extracted.description.trim();
        }
        if (extracted.welcomeMessage && typeof extracted.welcomeMessage === "string") {
          welcomeMessage = extracted.welcomeMessage.trim();
        }
        if (Array.isArray(extracted.suggestedQuestions) && extracted.suggestedQuestions.length > 0) {
          suggestedQuestions = extracted.suggestedQuestions
            .filter((q: unknown) => typeof q === "string" && q.trim().length > 0)
            .slice(0, 4);
        }
      }
    } catch (aiErr) {
      console.warn("[InstantGenerator] AI profile extraction failed; using safe fallbacks:", aiErr);
    }

    // Grounded Fallbacks (never fabricate facts)
    if (!businessName) {
      const pageTitle = crawlResult.pages[0]?.title || "";
      if (pageTitle && pageTitle.length < 50 && !pageTitle.toLowerCase().includes("error")) {
        businessName = pageTitle.split(/[|\-–:]/)[0].trim();
      }
      if (!businessName) {
        const host = parsedUrl.hostname.replace(/^www\./, "");
        const namePart = host.split(".")[0];
        businessName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      }
    }

    if (!description) {
      description = crawlResult.pages[0]?.description ||
        cleanExtractedText(crawlResult.combinedText).slice(0, 240).trim() + "...";
    }

    if (!welcomeMessage) {
      welcomeMessage = `Hello! 👋 I'm the AI assistant for ${businessName}. How can I help you today?`;
    }

    if (suggestedQuestions.length === 0) {
      suggestedQuestions = [
        "What products or services do you offer?",
        "What are your business hours?",
        "How can I contact your team?",
      ];
    }

    // 7. Generate Unique Draft Slug
    let baseSlug = slugify(businessName);
    if (!baseSlug || baseSlug.length < 3) {
      baseSlug = "draft-" + Math.random().toString(36).substring(2, 7);
    }

    let draftSlug = `draft-${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
    let slugExists = true;
    let attempts = 0;
    while (slugExists && attempts < 5) {
      const { data } = await serviceClient
        .from("demo_businesses")
        .select("id")
        .eq("demo_slug", draftSlug)
        .maybeSingle();

      if (!data) {
        slugExists = false;
      } else {
        draftSlug = `draft-${baseSlug}-${Math.floor(Math.random() * 10000)}`;
      }
      attempts++;
    }

    // 8. Database Persistence (Atomic Draft Creation)
    // 8.1 Create placeholder business (owner_id: null, onboarding_completed: false)
    const { data: placeholderBiz, error: bizError } = await serviceClient
      .from("businesses")
      .insert({
        owner_id: null,
        name: businessName,
        slug: `draft-biz-${draftSlug}`,
        website_url: normalized,
        industry: industry || null,
        description: description || null,
        onboarding_completed: false,
      })
      .select("id")
      .single();

    if (bizError || !placeholderBiz) {
      throw new Error(`Failed to create business record: ${bizError?.message}`);
    }
    placeholderBizId = placeholderBiz.id;

    // 8.2 Create demo record (14-day expiry)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);
    const demoUrl = `/demo/${draftSlug}`;

    const { data: demoBiz, error: demoError } = await serviceClient
      .from("demo_businesses")
      .insert({
        business_name: businessName,
        website_url: normalized,
        industry: industry || null,
        status: "active",
        demo_slug: draftSlug,
        demo_url: demoUrl,
        placeholder_business_id: placeholderBizId,
        created_by: null,
        expires_at: expiresAt.toISOString(),
        knowledge_source_count: 1,
        follow_up_status: "not_contacted",
      })
      .select("id")
      .single();

    if (demoError || !demoBiz) {
      throw new Error(`Failed to create demo record: ${demoError?.message}`);
    }
    demoBizId = demoBiz.id;

    // 8.3 Create assistant record
    const sysPrompt = `You are the AI business assistant for ${businessName}. Your name is ${businessName} Assistant.
Tone: Friendly and professional.
Business Description: ${description || "Customer support and inquiry handling."}

STRICT RULES:
- Answer ONLY using the provided business context and website information.
- If you don't know the answer based on context, state that politely and offer to collect contact information so the team can follow up.
- Never invent pricing, policies, services, or details not found in the context.
- Stay concise and helpful.`;

    const { error: asstError } = await serviceClient
      .from("assistants")
      .insert({
        business_id: placeholderBizId,
        name: `${businessName} Assistant`,
        tone: "Friendly",
        welcome_message: welcomeMessage,
        system_prompt: sysPrompt,
        model: "gemini-2.5-flash",
        temperature: 0.4,
        is_active: true,
      });

    if (asstError) {
      throw new Error(`Failed to create assistant record: ${asstError.message}`);
    }

    // 8.4 Create widget config record
    const { error: widgetError } = await serviceClient
      .from("widget_configs")
      .insert({
        business_id: placeholderBizId,
        primary_color: "#4f46e5",
        welcome_text: welcomeMessage.slice(0, 100),
        suggested_questions: suggestedQuestions,
        show_branding: true,
        is_enabled: true,
        collect_leads: true,
        hosted_chat_enabled: true,
        hosted_chat_slug: `demo-${draftSlug}`,
        hosted_chat_title: `Chat with ${businessName}`,
      });

    if (widgetError) {
      throw new Error(`Failed to create widget config: ${widgetError.message}`);
    }

    // 8.5 Save knowledge source
    const sourceTitle = crawlResult.pages[0]?.title || `${businessName} Website Knowledge`;
    const sourceMetadata = {
      scraped_title: crawlResult.pages[0]?.title || businessName,
      scraped_description: description,
      scraped_at: new Date().toISOString(),
      scraped_page_count: crawlResult.pagesScraped,
      scraped_pages: crawlResult.pages.map((p) => ({
        url: p.url,
        title: p.title,
        wordCount: p.wordCount,
      })),
    };

    const { data: source, error: sourceError } = await serviceClient
      .from("knowledge_sources")
      .insert({
        business_id: placeholderBizId,
        type: "website",
        title: sourceTitle,
        source_url: normalized,
        content: crawlResult.combinedText,
        status: "trained",
        crawl_mode: "crawl",
        crawl_status: crawlResult.pagesFailed > 0 ? "partial" : "completed",
        pages_found: crawlResult.pagesFound,
        pages_scraped: crawlResult.pagesScraped,
        pages_failed: crawlResult.pagesFailed,
        crawled_pages: crawlResult.pages,
        failed_pages: crawlResult.failedPages,
        word_count: totalWords,
        character_count: crawlResult.combinedText.length,
        metadata: sourceMetadata,
      })
      .select("id")
      .single();

    if (sourceError || !source) {
      throw new Error(`Failed to create knowledge source: ${sourceError?.message}`);
    }

    // 8.6 Generate and insert vector embeddings in batch
    const chunks = chunkText(crawlResult.combinedText, { maxChunkSize: 1200, overlap: 150 });
    // Limit chunks for instant generation (max 20 chunks)
    const limitedChunks = chunks.slice(0, 20);

    if (limitedChunks.length > 0) {
      try {
        const embeddings = await generateEmbeddingsBatch(
          limitedChunks,
          placeholderBizId || undefined,
          "embeddings_generation"
        );

        if (embeddings.length === limitedChunks.length) {
          const chunkInserts = limitedChunks.map((content, idx) => ({
            business_id: placeholderBizId!,
            source_id: source.id,
            content,
            embedding: embeddings[idx],
            chunk_index: idx,
            token_estimate: estimateTokens(content),
            metadata: {
              source_type: "website",
              source_title: sourceTitle,
            },
          }));

          const { error: chunkError } = await serviceClient
            .from("knowledge_chunks")
            .insert(chunkInserts);

          if (chunkError) {
            console.warn("[InstantGenerator] Failed to insert knowledge chunks:", chunkError.message);
          } else {
            await serviceClient
              .from("knowledge_sources")
              .update({
                metadata: {
                  ...sourceMetadata,
                  embedded: true,
                  embedded_at: new Date().toISOString(),
                  chunk_count: limitedChunks.length,
                },
              })
              .eq("id", source.id);
          }
        }
      } catch (embedError) {
        console.warn("[InstantGenerator] Batch embeddings failed, continuing with text knowledge:", embedError);
      }
    }

    return {
      success: true,
      draftSlug,
      previewUrl: demoUrl,
      businessName,
      industry: industry || undefined,
      description: description || undefined,
      welcomeMessage,
      suggestedQuestions,
      pagesScraped: crawlResult.pagesScraped,
      wordCount: totalWords,
    };
  } catch (err: any) {
    // Cleanup on failure: delete placeholder business if it was partially inserted
    if (placeholderBizId) {
      try {
        await serviceClient.from("businesses").delete().eq("id", placeholderBizId);
      } catch (_) {}
    }
    if (demoBizId) {
      try {
        await serviceClient.from("demo_businesses").delete().eq("id", demoBizId);
      } catch (_) {}
    }

    logErrorSync(err, "instant-generator");
    return {
      success: false,
      error: getUserFriendlyError("instant-generator") || err.message || "Failed to generate AI agent draft.",
      code: "SERVER_ERROR",
    };
  }
}
