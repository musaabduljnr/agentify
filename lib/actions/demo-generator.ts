"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { scrapeUrl } from "@/lib/scraper/scrape-url";
import { crawlWebsite } from "@/lib/scraper/crawl-website";
import { generateEmbeddingsForSourceInternal } from "@/lib/actions/knowledge";
import { generateEmbedding } from "@/lib/vertex/embeddings";
import { chunkText, estimateTokens } from "@/lib/embeddings/chunker";
import { generateGeminiResponse } from "@/lib/vertex/gemini";
import { buildBusinessPrompt } from "@/lib/ai/build-business-prompt";
import { checkUsageLimit, incrementUsage } from "@/lib/billing/usage";
import { getConfig } from "@/lib/config/platform-config";

// Helper to slugify business name
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^a-z0-9\-]/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start
    .replace(/-+$/, ""); // Trim - from end
}

// Helper to clean and parse JSON from Gemini response
function parseGeminiJson(text: string) {
  try {
    const cleanText = text
      .replace(/```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse extracted JSON from Gemini:", e);
    return null;
  }
}

/**
 * Creates a Demo Assistant and records details in public.demo_businesses.
 * Scrapes site, extracts business details with Gemini, and builds embeddings.
 */
export async function createDemoBusiness(formData: {
  businessName: string;
  websiteUrl: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}) {
  try {
    const demoGenEnabled = await getConfig("feature_flags", "enable_demo_generator");
    if (demoGenEnabled === "false") {
      throw new Error("Demo Generator is globally disabled.");
    }

    const adminProfile = await requireAdmin();
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    const { businessName, websiteUrl, contactName, contactEmail, contactPhone } = formData;

    // 1. Generate unique slug
    let baseSlug = slugify(businessName);
    if (!baseSlug || baseSlug.length < 3) {
      baseSlug = "demo-" + Math.random().toString(36).substring(2, 7);
    }
    
    let slug = baseSlug;
    let slugExists = true;
    let attempts = 0;
    while (slugExists && attempts < 10) {
      const { data } = await serviceClient
        .from("demo_businesses")
        .select("id")
        .eq("demo_slug", slug)
        .maybeSingle();
      
      if (!data) {
        slugExists = false;
      } else {
        slug = `${baseSlug}-${Math.floor(Math.random() * 1000)}`;
      }
      attempts++;
    }

    // 2. Create placeholder business
    const { data: placeholderBiz, error: bizError } = await serviceClient
      .from("businesses")
      .insert({
        owner_id: null,
        name: businessName,
        slug: `demo-${slug}-${Math.floor(Math.random() * 10000)}`, // unique business slug
        website_url: websiteUrl,
        onboarding_completed: false, // hidden from admin normal lists
      })
      .select()
      .single();

    if (bizError || !placeholderBiz) {
      throw new Error(`Failed to create placeholder business: ${bizError?.message}`);
    }

    // 3. Create demo record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const demoUrl = `/demo/${slug}`;

    const { data: demoBiz, error: demoError } = await serviceClient
      .from("demo_businesses")
      .insert({
        business_name: businessName,
        website_url: websiteUrl,
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        demo_slug: slug,
        demo_url: demoUrl,
        expires_at: expiresAt.toISOString(),
        created_by: adminProfile.id,
        placeholder_business_id: placeholderBiz.id,
        status: "active",
        follow_up_status: "not_contacted",
      })
      .select()
      .single();

    if (demoError || !demoBiz) {
      // clean up business
      await serviceClient.from("businesses").delete().eq("id", placeholderBiz.id);
      throw new Error(`Failed to create demo record: ${demoError?.message}`);
    }

    // 4. Create default assistant and widget config
    const defaultWelcome = `Hello! 👋 I'm the AI assistant for ${businessName}. I can answer questions about our services, business details, or contact information. What would you like to know?`;
    const { data: assistant, error: asstError } = await serviceClient
      .from("assistants")
      .insert({
        business_id: placeholderBiz.id,
        name: `${businessName} Assistant`,
        tone: "Friendly",
        welcome_message: defaultWelcome,
        system_prompt: `You are a helpful customer support assistant for ${businessName}.`,
        model: "gemini-2.5-flash",
        temperature: 0.4,
        is_active: true,
      })
      .select()
      .single();

    const { data: widgetConfig, error: widgetError } = await serviceClient
      .from("widget_configs")
      .insert({
        business_id: placeholderBiz.id,
        primary_color: "#4f46e5",
        welcome_text: "Hi! How can we help you today?",
        suggested_questions: [
          "What products or services do you offer?",
          "What are your business hours?",
          "How can I contact your team?"
        ],
        show_branding: true,
        is_enabled: true,
        collect_leads: true,
        hosted_chat_enabled: true,
        hosted_chat_slug: `demo-${slug}`,
        hosted_chat_title: `Chat with ${businessName}`,
      })
      .select()
      .single();

    // Log the created event
    await serviceClient.from("demo_events").insert({
      demo_business_id: demoBiz.id,
      visitor_id: "admin",
      event_type: "demo_created",
      metadata: { created_by: adminProfile.id }
    });

    // 5. Scrape and process website content (using crawlWebsite by default)
    let scrapedText = "";
    let scrapTitle = "";
    let scrapDesc = "";
    let scrapeSucceeded = false;
    let pagesCount = 0;
    let crawledPagesData: any[] = [];
    let failedPagesData: any[] = [];

    try {
      const crawlResult = await crawlWebsite({
        startUrl: websiteUrl,
        maxPages: 15,
        depth: 2,
        businessId: placeholderBiz.id,
        featureSource: "website_summary_generation"
      });

      if (crawlResult && crawlResult.combinedText) {
        scrapedText = crawlResult.combinedText;
        scrapTitle = crawlResult.pages[0]?.title || "";
        scrapDesc = crawlResult.pages[0]?.description || "";
        scrapeSucceeded = true;
        pagesCount = crawlResult.pagesScraped;
        crawledPagesData = crawlResult.pages;
        failedPagesData = crawlResult.failedPages;
      }
    } catch (scrapErr) {
      console.error(`Failed to crawl URL ${websiteUrl} for demo:`, scrapErr);
    }

    if (scrapeSucceeded && scrapedText) {
      // 5.1 Save scraped content in public.knowledge_sources
      const { data: source, error: sourceError } = await serviceClient
        .from("knowledge_sources")
        .insert({
          business_id: placeholderBiz.id,
          type: "website",
          title: scrapTitle || "Website Crawled Knowledge",
          source_url: websiteUrl,
          content: scrapedText,
          status: "trained",
          crawl_mode: "crawl",
          crawl_status: failedPagesData.length > 0 ? "partial" : "completed",
          pages_found: crawledPagesData.length + failedPagesData.length,
          pages_scraped: pagesCount,
          pages_failed: failedPagesData.length,
          crawled_pages: crawledPagesData,
          failed_pages: failedPagesData,
          metadata: {
            scraped_title: scrapTitle,
            scraped_description: scrapDesc,
            scraped_at: new Date().toISOString(),
            scraped_page_count: pagesCount,
            scraped_pages: crawledPagesData.map(p => ({
              url: p.url,
              title: p.title,
              wordCount: p.wordCount,
              characterCount: p.characterCount
            }))
          }
        })
        .select()
        .single();

      if (!sourceError && source) {
        // Update knowledge source count in demo
        await serviceClient
          .from("demo_businesses")
          .update({ knowledge_source_count: 1 })
          .eq("id", demoBiz.id);

        // 5.2 Generate embeddings by reusing the function
        try {
          await generateEmbeddingsForSourceInternal(source.id, placeholderBiz.id);
        } catch (embedErr) {
          console.error(`Embedding generation failed for demo source ${source.id}:`, embedErr);
        }

        // 5.3 AI Extraction: Extract details with Gemini
        try {
          const systemPrompt = `You are an AI business profile extractor.
Given the following scraped website content from a business website, extract details about the business to configure their AI assistant.
Respond strictly in JSON format.

JSON format:
{
  "industry": "industry name",
  "description": "a concise 2-3 sentence business summary",
  "suggestedQuestions": ["Question 1", "Question 2", "Question 3"],
  "welcomeMessage": "A friendly, brand-specific welcome message for their AI assistant. Introduce yourself as the assistant for the business."
}`;

          const extractionRaw = await generateGeminiResponse({
            systemInstruction: systemPrompt,
            userMessage: `Website content:\n${scrapedText.slice(0, 12000)}`,
            temperature: 0.2,
            businessId: placeholderBiz.id,
            featureSource: "demo_generation",
          });

          const extracted = parseGeminiJson(extractionRaw);
          if (extracted) {
            // Update business details
            await serviceClient
              .from("businesses")
              .update({
                industry: extracted.industry || placeholderBiz.industry,
                description: extracted.description || placeholderBiz.description,
              })
              .eq("id", placeholderBiz.id);

            // Update demo business industry
            if (extracted.industry) {
              await serviceClient
                .from("demo_businesses")
                .update({ industry: extracted.industry })
                .eq("id", demoBiz.id);
            }

            // Update assistant
            const sysPrompt = `You are the AI business assistant for ${businessName}. Your name is ${assistant.name}.
Tone: Friendly and professional.
Business Description: ${extracted.description || "Helpful customer service"}

STRICT RULES:
- Answer ONLY using the provided business context and business information.
- If you don't know the answer based on context, offer to collect their contact details.
- Stay concise.`;

            await serviceClient
              .from("assistants")
              .update({
                welcome_message: extracted.welcomeMessage || assistant.welcome_message,
                system_prompt: sysPrompt,
              })
              .eq("id", assistant.id);

            // Update widget config suggested questions
            if (extracted.suggestedQuestions && Array.isArray(extracted.suggestedQuestions)) {
              await serviceClient
                .from("widget_configs")
                .update({
                  suggested_questions: extracted.suggestedQuestions.slice(0, 4),
                  welcome_text: extracted.welcomeMessage ? extracted.welcomeMessage.slice(0, 100) : "Hi! How can we help you today?",
                })
                .eq("id", widgetConfig.id);
            }
          }
        } catch (aiErr) {
          console.error("Failed AI Profile extraction for demo:", aiErr);
        }
      }
    }

    revalidatePath("/admin/demos");
    revalidatePath("/admin/demo-generator");
    return { success: true, demoUrl: demoBiz.demo_url, slug: demoBiz.demo_slug };
  } catch (error: any) {
    console.error("Error in createDemoBusiness Server Action:", error);
    return { error: error.message || "Failed to generate demo." };
  }
}

/**
 * Retrieves all demo businesses for the CRM dashboard.
 */
export async function getDemoBusinesses(filters?: {
  status?: string;
  followUpStatus?: string;
  converted?: boolean;
  search?: string;
  industry?: string;
}) {
  try {
    const demoCrmEnabled = await getConfig("feature_flags", "enable_admin_demo_crm");
    if (demoCrmEnabled === "false") {
      throw new Error("Admin Demo CRM is globally disabled.");
    }
    await requireAdmin();
    const serviceClient = createServiceClient();

    let query = serviceClient
      .from("demo_businesses")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters) {
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters.followUpStatus && filters.followUpStatus !== "all") {
        query = query.eq("follow_up_status", filters.followUpStatus);
      }
      if (filters.converted !== undefined) {
        query = query.eq("converted", filters.converted);
      }
      if (filters.industry && filters.industry !== "all") {
        query = query.ilike("industry", `%${filters.industry}%`);
      }
      if (filters.search) {
        const searchTerm = `%${filters.search.trim()}%`;
        query = query.or(
          `business_name.ilike.${searchTerm},website_url.ilike.${searchTerm},contact_email.ilike.${searchTerm},demo_slug.ilike.${searchTerm}`
        );
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Error in getDemoBusinesses:", error);
    return [];
  }
}

/**
 * Retrieves full details for a demo business CRM card.
 */
export async function getDemoBusinessDetail(id: string) {
  try {
    const demoCrmEnabled = await getConfig("feature_flags", "enable_admin_demo_crm");
    if (demoCrmEnabled === "false") {
      throw new Error("Admin Demo CRM is globally disabled.");
    }
    await requireAdmin();
    const serviceClient = createServiceClient();

    // 1. Fetch demo business
    const { data: demo, error: demoErr } = await serviceClient
      .from("demo_businesses")
      .select("*")
      .eq("id", id)
      .single();

    if (demoErr || !demo) throw new Error("Demo business not found");

    // 2. Fetch conversations
    const { data: conversations } = await serviceClient
      .from("demo_conversations")
      .select("*")
      .eq("demo_business_id", id)
      .order("updated_at", { ascending: false });

    // 3. Fetch leads
    const { data: leads } = await serviceClient
      .from("demo_leads")
      .select("*")
      .eq("demo_business_id", id)
      .order("created_at", { ascending: false });

    // 4. Fetch events
    const { data: events } = await serviceClient
      .from("demo_events")
      .select("*")
      .eq("demo_business_id", id)
      .order("created_at", { ascending: false });

    // 5. Fetch assistant config (to display details in dashboard)
    let assistant = null;
    if (demo.placeholder_business_id) {
      const { data } = await serviceClient
        .from("assistants")
        .select("*")
        .eq("business_id", demo.placeholder_business_id)
        .eq("is_active", true)
        .maybeSingle();
      assistant = data;
    }

    return {
      demo,
      conversations: conversations || [],
      leads: leads || [],
      events: events || [],
      assistant,
    };
  } catch (error: any) {
    console.error("Error in getDemoBusinessDetail:", error);
    throw error;
  }
}

/**
 * Updates CRM attributes of a demo record.
 */
export async function updateDemoCRM(
  id: string,
  data: {
    sales_notes?: string;
    follow_up_status?: string;
    next_follow_up_at?: string | null;
  }
) {
  try {
    const demoCrmEnabled = await getConfig("feature_flags", "enable_admin_demo_crm");
    if (demoCrmEnabled === "false") {
      throw new Error("Admin Demo CRM is globally disabled.");
    }
    await requireAdmin();
    const serviceClient = createServiceClient();

    const updatePayload: Record<string, any> = {};
    if (data.sales_notes !== undefined) updatePayload.sales_notes = data.sales_notes;
    if (data.follow_up_status !== undefined) updatePayload.follow_up_status = data.follow_up_status;
    if (data.next_follow_up_at !== undefined) updatePayload.next_follow_up_at = data.next_follow_up_at;

    const { error } = await serviceClient
      .from("demo_businesses")
      .update(updatePayload)
      .eq("id", id);

    if (error) throw error;
    
    revalidatePath(`/admin/demos/${id}`);
    revalidatePath("/admin/demos");
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateDemoCRM:", error);
    return { error: error.message || "Failed to update CRM details" };
  }
}

/**
 * Deletes a demo and its placeholder business.
 */
export async function deleteDemoBusiness(id: string) {
  try {
    const demoCrmEnabled = await getConfig("feature_flags", "enable_admin_demo_crm");
    if (demoCrmEnabled === "false") {
      throw new Error("Admin Demo CRM is globally disabled.");
    }
    await requireAdmin();
    const serviceClient = createServiceClient();

    // Fetch the demo record to get the placeholder business id
    const { data: demo } = await serviceClient
      .from("demo_businesses")
      .select("placeholder_business_id")
      .eq("id", id)
      .single();

    if (demo?.placeholder_business_id) {
      // Deleting the business cascades to assistants, configs, sources, chunks, conversations, messages, leads
      await serviceClient
        .from("businesses")
        .delete()
        .eq("id", demo.placeholder_business_id);
    }

    const { error } = await serviceClient
      .from("demo_businesses")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/admin/demos");
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteDemoBusiness:", error);
    return { error: error.message || "Failed to delete demo." };
  }
}

/**
 * Toggles pause state of a demo business.
 */
export async function pauseDemoBusiness(id: string, pause: boolean) {
  try {
    const demoCrmEnabled = await getConfig("feature_flags", "enable_admin_demo_crm");
    if (demoCrmEnabled === "false") {
      throw new Error("Admin Demo CRM is globally disabled.");
    }
    await requireAdmin();
    const serviceClient = createServiceClient();

    const status = pause ? "paused" : "active";

    const { error } = await serviceClient
      .from("demo_businesses")
      .update({ status })
      .eq("id", id);

    if (error) throw error;

    // Log event
    await serviceClient.from("demo_events").insert({
      demo_business_id: id,
      visitor_id: "admin",
      event_type: pause ? "demo_paused" : "demo_extended",
      metadata: { status }
    });

    revalidatePath("/admin/demos");
    revalidatePath(`/admin/demos/${id}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in pauseDemoBusiness:", error);
    return { error: error.message || "Failed to update demo status." };
  }
}

/**
 * Extends demo expiration by 14 days.
 */
export async function extendDemoBusiness(id: string) {
  try {
    const demoCrmEnabled = await getConfig("feature_flags", "enable_admin_demo_crm");
    if (demoCrmEnabled === "false") {
      throw new Error("Admin Demo CRM is globally disabled.");
    }
    await requireAdmin();
    const serviceClient = createServiceClient();

    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 14);

    const { error } = await serviceClient
      .from("demo_businesses")
      .update({
        expires_at: newExpiry.toISOString(),
        status: "active", // reactivate if expired
      })
      .eq("id", id);

    if (error) throw error;

    // Log event
    await serviceClient.from("demo_events").insert({
      demo_business_id: id,
      visitor_id: "admin",
      event_type: "demo_extended",
      metadata: { expires_at: newExpiry.toISOString() }
    });

    revalidatePath("/admin/demos");
    revalidatePath(`/admin/demos/${id}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in extendDemoBusiness:", error);
    return { error: error.message || "Failed to extend demo." };
  }
}

/**
 * Archives a demo business.
 */
export async function archiveDemoBusiness(id: string) {
  try {
    const demoCrmEnabled = await getConfig("feature_flags", "enable_admin_demo_crm");
    if (demoCrmEnabled === "false") {
      throw new Error("Admin Demo CRM is globally disabled.");
    }
    await requireAdmin();
    const serviceClient = createServiceClient();

    const { error } = await serviceClient
      .from("demo_businesses")
      .update({ status: "archived" })
      .eq("id", id);

    if (error) throw error;

    // Log event
    await serviceClient.from("demo_events").insert({
      demo_business_id: id,
      visitor_id: "admin",
      event_type: "demo_archived",
    });

    revalidatePath("/admin/demos");
    revalidatePath(`/admin/demos/${id}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in archiveDemoBusiness:", error);
    return { error: error.message || "Failed to archive demo." };
  }
}

/**
 * Claims a demo assistant, transferring ownership of the placeholder business 
 * to the logged-in client account. Bypasses onboarding.
 */
export async function claimDemoAssistant(slug: string, userId: string) {
  try {
    const serviceClient = createServiceClient();

    // 1. Fetch demo business
    const { data: demo, error: demoErr } = await serviceClient
      .from("demo_businesses")
      .select("*")
      .eq("demo_slug", slug)
      .maybeSingle();

    if (demoErr || !demo) {
      return { error: "Demo assistant not found or already claimed." };
    }

    if (demo.converted) {
      return { error: "This assistant has already been claimed." };
    }

    if (!demo.placeholder_business_id) {
      return { error: "This demo does not have a placeholder assistant configuration available." };
    }

    // Check if the user already has a business. 
    // In our app, a user typically has one business. If they already have one, we can re-use it or allow them to claim it.
    const { data: existingBusiness } = await serviceClient
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .eq("onboarding_completed", true)
      .maybeSingle();

    if (existingBusiness) {
      return { error: "Your account already has a configured business. You cannot claim another demo assistant." };
    }

    // 2. Transfer placeholder business ownership to user & complete onboarding
    const { error: transferError } = await serviceClient
      .from("businesses")
      .update({
        owner_id: userId,
        onboarding_completed: true, // Mark complete!
      })
      .eq("id", demo.placeholder_business_id);

    if (transferError) {
      throw new Error(`Failed to claim business assistant: ${transferError.message}`);
    }

    // 3. Setup a free trial subscription for this business if they don't have one
    const { data: existingSub } = await serviceClient
      .from("subscriptions")
      .select("id")
      .eq("business_id", demo.placeholder_business_id)
      .maybeSingle();

    if (!existingSub) {
      await serviceClient.from("subscriptions").insert({
        business_id: demo.placeholder_business_id,
        plan: "free_trial",
        status: "active",
        message_limit: 100,
        current_usage: 0,
      });
    } else {
      // Ensure active trial status
      await serviceClient
        .from("subscriptions")
        .update({
          plan: "free_trial",
          status: "active",
        })
        .eq("business_id", demo.placeholder_business_id);
    }

    // 4. Mark demo record as converted
    await serviceClient
      .from("demo_businesses")
      .update({
        converted: true,
        status: "converted",
        follow_up_status: "converted",
        converted_at: new Date().toISOString(),
        converted_business_id: demo.placeholder_business_id,
      })
      .eq("id", demo.id);

    // 5. Track conversion event
    await serviceClient.from("demo_events").insert({
      demo_business_id: demo.id,
      visitor_id: userId,
      event_type: "demo_converted",
      metadata: { claimed_by: userId }
    });

    revalidatePath("/admin/demos");
    revalidatePath(`/admin/demos/${demo.id}`);
    revalidatePath("/dashboard", "layout");
    
    return { success: true };
  } catch (error: any) {
    console.error("Error in claimDemoAssistant:", error);
    return { error: error.message || "Failed to claim assistant." };
  }
}

/**
 * Retrieves global analytics for all generated demos.
 */
export async function getAdminDemoAnalytics() {
  try {
    const demoCrmEnabled = await getConfig("feature_flags", "enable_admin_demo_crm");
    if (demoCrmEnabled === "false") {
      throw new Error("Admin Demo CRM is globally disabled.");
    }
    await requireAdmin();
    const serviceClient = createServiceClient();

    const { data: demos, error } = await serviceClient
      .from("demo_businesses")
      .select("*");

    if (error) throw error;

    const total = demos.length;
    const active = demos.filter(d => d.status === "active").length;
    const expired = demos.filter(d => d.status === "expired" || (d.status === "active" && new Date(d.expires_at) < new Date())).length;
    const converted = demos.filter(d => d.converted).length;
    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

    let totalVisits = 0;
    let totalConvs = 0;
    let totalLeads = 0;
    let totalMessages = 0;
    let needFollowUp = 0;

    demos.forEach((d) => {
      totalVisits += d.page_view_count || 0;
      totalConvs += d.conversation_count || 0;
      totalLeads += d.lead_count || 0;
      totalMessages += d.total_message_count || 0;
      if (d.follow_up_status === "not_contacted" || d.follow_up_status === "follow_up_later") {
        needFollowUp++;
      }
    });

    return {
      total,
      active,
      expired,
      converted,
      conversionRate,
      totalVisits,
      totalConvs,
      totalLeads,
      totalMessages,
      needFollowUp,
    };
  } catch (error) {
    console.error("Error fetching admin demo analytics:", error);
    return {
      total: 0,
      active: 0,
      expired: 0,
      converted: 0,
      conversionRate: 0,
      totalVisits: 0,
      totalConvs: 0,
      totalLeads: 0,
      totalMessages: 0,
      needFollowUp: 0,
    };
  }
}
