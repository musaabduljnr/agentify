import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateInstantAgent } from "@/lib/actions/instant-generator";
import { createDemoBusiness } from "@/lib/actions/demo-generator";
import { isPrivateOrLocalUrl } from "@/lib/scraper/url-safety";
import { crawlWebsite } from "@/lib/scraper/crawl-website";
import { generateGeminiContent } from "@/lib/ai/providers/gemini";
import { generateEmbeddingsBatch } from "@/lib/ai/engine/embeddings";
import { rateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/utils/supabase/service";

// Mock dependencies
vi.mock("@/lib/scraper/crawl-website", () => ({
  crawlWebsite: vi.fn(),
}));

vi.mock("@/lib/ai/providers/gemini", () => ({
  generateGeminiContent: vi.fn(),
}));

vi.mock("@/lib/ai/engine/embeddings", () => ({
  generateEmbeddingsBatch: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: vi.fn(),
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/scraper/url-safety", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scraper/url-safety")>();
  return {
    ...actual,
    assertPublicHttpUrl: vi.fn(async (url: string) => {
      if (actual.isPrivateOrLocalUrl(url)) {
        throw new Error("Cannot scrape private or local URLs.");
      }
      if (url.includes("unresolvable-domain")) {
        throw new Error("Could not resolve hostname \"unresolvable-domain.com\". Please check that the URL exists and is publicly accessible.");
      }
    }),
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn((key: string) => (key === "x-forwarded-for" ? "198.51.100.24" : null)),
  }),
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn(() => []),
    get: vi.fn(() => null),
    set: vi.fn(),
  }),
}));

function createMockSupabase(overrides?: {
  onInsert?: (table: string, data: any) => void;
  onDelete?: (table: string) => void;
  demoBusinessResult?: any;
}) {
  return {
    from: vi.fn((table: string) => {
      const q: any = {
        _table: table,
        _filters: {},
        insert: vi.fn((data: any) => {
          if (overrides?.onInsert) overrides.onInsert(table, data);
          q._inserted = Array.isArray(data)
            ? data.map((d, i) => ({ id: `mock-${table}-${i}`, ...d }))
            : { id: `mock-${table}-id`, ...data };
          return q;
        }),
        select: vi.fn(() => q),
        update: vi.fn(() => q),
        delete: vi.fn(() => {
          if (overrides?.onDelete) overrides.onDelete(table);
          return q;
        }),
        eq: vi.fn((col: string, val: any) => {
          q._filters[col] = val;
          return q;
        }),
        neq: vi.fn(() => q),
        gt: vi.fn(() => q),
        gte: vi.fn(() => q),
        lt: vi.fn(() => q),
        lte: vi.fn(() => q),
        order: vi.fn(() => q),
        limit: vi.fn(() => q),
        single: vi.fn(async () => {
          return { data: q._inserted || { id: `mock-${table}-single-id` }, error: null };
        }),
        maybeSingle: vi.fn(async () => {
          if (table === "demo_businesses" && overrides?.demoBusinessResult !== undefined) {
            return { data: overrides.demoBusinessResult, error: null };
          }
          return { data: null, error: null };
        }),
      };
      return q;
    }),
  };
}

describe("Phase 1: Instant AI Agent Generation Test Suite", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = createMockSupabase();
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase);
    vi.mocked(rateLimit).mockResolvedValue({
      success: true,
      remaining: 4,
      reset: Math.floor(Date.now() / 1000) + 3600,
      limit: 5,
    });
  });

  // 1. Valid URL submission
  it("Requirement 1: successfully generates an instant agent draft for a valid URL", async () => {
    vi.mocked(crawlWebsite).mockResolvedValueOnce({
      startUrl: "https://acme.example.com",
      pagesFound: 2,
      pagesScraped: 2,
      pagesFailed: 0,
      combinedText: "Acme Corp provides automated cloud accounting, billing solutions, and payment reconciliation for modern growing enterprises. Our flexible platform connects directly with global bank feeds and delivers real-time financial reporting for finance teams.",
      pages: [
        {
          url: "https://acme.example.com",
          title: "Acme Corp - Cloud Accounting",
          description: "Automated billing and accounting software for growing enterprises.",
          text: "Acme Corp provides automated cloud accounting, billing solutions, and payment reconciliation for modern growing enterprises.",
          wordCount: 16,
          characterCount: 125,
          status: "scraped",
        },
        {
          url: "https://acme.example.com/pricing",
          title: "Pricing - Acme Corp",
          description: "Simple transparent plans.",
          text: "Starter plans begin at $29/mo with full feature access and unlimited automated bank reconciliation.",
          wordCount: 14,
          characterCount: 104,
          status: "scraped",
        },
      ],
      failedPages: [],
    });

    vi.mocked(generateGeminiContent).mockResolvedValueOnce(
      JSON.stringify({
        businessName: "Acme Corp",
        industry: "SaaS Accounting",
        description: "Automated cloud accounting and billing solutions for modern enterprises.",
        suggestedQuestions: ["What are your pricing plans?", "How does bank feed reconciliation work?"],
        welcomeMessage: "Hi there! I'm the Acme Corp assistant. How can I help you today?",
      })
    );

    vi.mocked(generateEmbeddingsBatch).mockResolvedValueOnce([
      new Array(768).fill(0.01),
    ]);

    const result = await generateInstantAgent({ websiteUrl: "acme.example.com" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.businessName).toBe("Acme Corp");
      expect(result.draftSlug).toMatch(/^draft-acme-corp-/);
      expect(result.previewUrl).toContain("/demo/draft-acme-corp-");
      expect(result.pagesScraped).toBe(2);
      expect(result.welcomeMessage).toContain("Acme Corp");
      expect(result.suggestedQuestions).toHaveLength(2);
    }
  });

  // 2. Malformed URL rejection
  it("Requirement 2: rejects malformed and empty URLs", async () => {
    const emptyRes = await generateInstantAgent({ websiteUrl: "" });
    expect(emptyRes.success).toBe(false);
    if (!emptyRes.success) {
      expect(emptyRes.code).toBe("INVALID_URL");
    }

    const invalidRes = await generateInstantAgent({ websiteUrl: "not-a-domain-name" });
    expect(invalidRes.success).toBe(false);
    if (!invalidRes.success) {
      expect(invalidRes.code).toBe("INVALID_URL");
    }
  });

  // 3. Localhost, private IP, metadata endpoint, and unsafe redirect rejection
  it("Requirement 3: rejects localhost, private IPs, and cloud metadata endpoints", async () => {
    expect(isPrivateOrLocalUrl("http://localhost:3000")).toBe(true);
    expect(isPrivateOrLocalUrl("http://127.0.0.1")).toBe(true);
    expect(isPrivateOrLocalUrl("http://169.254.169.254/latest/meta-data/")).toBe(true);
    expect(isPrivateOrLocalUrl("http://metadata.google.internal/computeMetadata/v1/")).toBe(true);
    expect(isPrivateOrLocalUrl("http://10.0.0.1")).toBe(true);
    expect(isPrivateOrLocalUrl("http://192.168.1.1")).toBe(true);
    expect(isPrivateOrLocalUrl("http://172.16.0.1")).toBe(true);
    expect(isPrivateOrLocalUrl("http://[::1]")).toBe(true);
    expect(isPrivateOrLocalUrl("http://[::ffff:127.0.0.1]")).toBe(true);

    const localhostRes = await generateInstantAgent({ websiteUrl: "http://localhost:3000" });
    expect(localhostRes.success).toBe(false);
    if (!localhostRes.success) {
      expect(localhostRes.code).toBe("SSRF_BLOCKED");
    }

    const metadataRes = await generateInstantAgent({ websiteUrl: "http://169.254.169.254" });
    expect(metadataRes.success).toBe(false);
    if (!metadataRes.success) {
      expect(metadataRes.code).toBe("SSRF_BLOCKED");
    }
  });

  // 4. Inaccessible websites and empty extraction
  it("Requirement 4: handles inaccessible websites and empty extraction gracefully", async () => {
    // 4a. Unresolvable DNS hostname
    const dnsFailRes = await generateInstantAgent({ websiteUrl: "https://unresolvable-domain.com" });
    expect(dnsFailRes.success).toBe(false);
    if (!dnsFailRes.success) {
      expect(dnsFailRes.code).toBe("SCRAPE_FAILED");
    }

    // 4b. Crawl connection refused
    vi.mocked(crawlWebsite).mockRejectedValueOnce(new Error("Connection refused (ECONNREFUSED)"));
    const unreachableRes = await generateInstantAgent({ websiteUrl: "https://offline-server.com" });
    expect(unreachableRes.success).toBe(false);
    if (!unreachableRes.success) {
      expect(unreachableRes.code).toBe("SCRAPE_FAILED");
    }

    // 4c. Empty / sparse content (< 25 words)
    vi.mocked(crawlWebsite).mockResolvedValueOnce({
      startUrl: "https://empty-spa.com",
      pagesFound: 1,
      pagesScraped: 1,
      pagesFailed: 0,
      combinedText: "Loading... Please enable JavaScript to run this app.",
      pages: [
        {
          url: "https://empty-spa.com",
          title: "App",
          description: "",
          text: "Loading... Please enable JavaScript to run this app.",
          wordCount: 8,
          characterCount: 52,
          status: "scraped",
        },
      ],
      failedPages: [],
    });

    const sparseRes = await generateInstantAgent({ websiteUrl: "https://empty-spa.com" });
    expect(sparseRes.success).toBe(false);
    if (!sparseRes.success) {
      expect(sparseRes.code).toBe("INSUFFICIENT_CONTENT");
    }
  });

  // 5. Rate-limit enforcement
  it("Requirement 5: blocks requests when rate limit is exceeded", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 1800,
      limit: 5,
    });

    const rateLimitedRes = await generateInstantAgent({ websiteUrl: "https://valid-example.com" });
    expect(rateLimitedRes.success).toBe(false);
    if (!rateLimitedRes.success) {
      expect(rateLimitedRes.code).toBe("RATE_LIMITED");
      expect(rateLimitedRes.error).toContain("Generation limit reached");
    }
  });

  // 6. AI-provider and embedding failures
  it("Requirement 6: falls back safely when Gemini profile extraction or embeddings fail", async () => {
    vi.mocked(crawlWebsite).mockResolvedValueOnce({
      startUrl: "https://lawfirm.example.com",
      pagesFound: 1,
      pagesScraped: 1,
      pagesFailed: 0,
      combinedText: "Smith & Partners provides criminal defense and corporate law representation with over 20 years of courtroom experience in Boston. Our legal attorneys represent businesses in commercial disputes, contract negotiations, compliance matters, and regulatory inquiries.",
      pages: [
        {
          url: "https://lawfirm.example.com",
          title: "Smith & Partners | Legal Counsel",
          description: "Defense and corporate law representation",
          text: "Smith & Partners provides criminal defense and corporate law representation with over 20 years of courtroom experience in Boston.",
          wordCount: 35,
          characterCount: 260,
          status: "scraped",
        },
      ],
      failedPages: [],
    });

    // Simulate AI extraction failure / quota
    vi.mocked(generateGeminiContent).mockRejectedValueOnce(new Error("429 Resource Exhausted"));
    // Simulate embeddings failure
    vi.mocked(generateEmbeddingsBatch).mockRejectedValueOnce(new Error("Embeddings API unavailable"));

    const fallbackRes = await generateInstantAgent({ websiteUrl: "https://lawfirm.example.com" });

    expect(fallbackRes.success).toBe(true);
    if (fallbackRes.success) {
      // Should fall back to title without hallucinating
      expect(fallbackRes.businessName).toBe("Smith & Partners");
      expect(fallbackRes.welcomeMessage).toContain("Smith & Partners");
      expect(fallbackRes.suggestedQuestions.length).toBeGreaterThan(0);
    }
  });

  // 7. Duplicate submissions and partial-failure cleanup
  it("Requirement 7: detects recent duplicate submissions and cleans up database on failure", async () => {
    // 7a. Duplicate re-use
    const dupSupabase = createMockSupabase({
      demoBusinessResult: {
        demo_slug: "draft-existing-biz-xyz",
        demo_url: "/demo/draft-existing-biz-xyz",
        business_name: "Existing Biz",
        placeholder_business_id: "biz-123",
        industry: "Retail",
      },
    });
    vi.mocked(createServiceClient).mockReturnValueOnce(dupSupabase as any);

    const dupRes = await generateInstantAgent({ websiteUrl: "https://existing-biz.com" });
    expect(dupRes.success).toBe(true);
    if (dupRes.success) {
      expect(dupRes.cached).toBe(true);
      expect(dupRes.draftSlug).toBe("draft-existing-biz-xyz");
    }

    // 7b. Partial failure cleanup
    const deleteTables: string[] = [];
    const failingSupabase: any = {
      from: vi.fn((table: string) => {
        const q: any = {
          insert: vi.fn(() => {
            if (table === "demo_businesses") {
              return {
                select: () => ({
                  single: async () => ({ data: null, error: new Error("DB Constraint Error on Demo") }),
                }),
              };
            }
            return {
              select: () => ({
                single: async () => ({ data: { id: "biz-rollback-id" }, error: null }),
              }),
            };
          }),
          select: vi.fn(() => q),
          delete: vi.fn(() => {
            deleteTables.push(table);
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
          eq: vi.fn(() => q),
          gt: vi.fn(() => q),
          order: vi.fn(() => q),
          limit: vi.fn(() => q),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        };
        return q;
      }),
    };
    vi.mocked(createServiceClient).mockReturnValueOnce(failingSupabase);

    vi.mocked(crawlWebsite).mockResolvedValueOnce({
      startUrl: "https://clean-fail.com",
      pagesFound: 1,
      pagesScraped: 1,
      pagesFailed: 0,
      combinedText: "This website provides plenty of rich business content describing professional services, customer offerings, enterprise support, and strategic consultations to satisfy the minimum word threshold easily and completely for automated onboarding.",
      pages: [{ url: "https://clean-fail.com", title: "Test", description: "", text: "This website provides plenty of rich business content describing professional services, customer offerings, enterprise support, and strategic consultations to satisfy the minimum word threshold easily and completely for automated onboarding.", wordCount: 30, characterCount: 220, status: "scraped" }],
      failedPages: [],
    });

    const failRes = await generateInstantAgent({ websiteUrl: "https://clean-fail.com" });
    expect(failRes.success).toBe(false);
    expect(deleteTables).toContain("businesses");
  });

  // 8. Draft isolation between different visitors and businesses
  it("Requirement 8: ensures draft businesses have owner_id null and isolated placeholders", async () => {
    let insertedBusinessData: any = null;

    const isolatingSupabase = createMockSupabase({
      onInsert: (table, data) => {
        if (table === "businesses") {
          insertedBusinessData = data;
        }
      },
    });
    vi.mocked(createServiceClient).mockReturnValueOnce(isolatingSupabase as any);

    vi.mocked(crawlWebsite).mockResolvedValueOnce({
      startUrl: "https://isolated-tenant.com",
      pagesFound: 1,
      pagesScraped: 1,
      pagesFailed: 0,
      combinedText: "Isolated tenant knowledge for verifying tenancy segregation and anonymous ownership without user linkage. Our platform delivers enterprise grade isolation and zero data crossover between different business customer accounts.",
      pages: [{ url: "https://isolated-tenant.com", title: "Tenant", description: "", text: "Isolated tenant knowledge for verifying tenancy segregation and anonymous ownership without user linkage. Our platform delivers enterprise grade isolation and zero data crossover between different business customer accounts.", wordCount: 30, characterCount: 220, status: "scraped" }],
      failedPages: [],
    });

    const res = await generateInstantAgent({ websiteUrl: "https://isolated-tenant.com" });
    expect(res.success).toBe(true);
    expect(insertedBusinessData).toBeDefined();
    // Anonymous drafts must have owner_id null and onboarding_completed false
    expect(insertedBusinessData.owner_id).toBeNull();
    expect(insertedBusinessData.onboarding_completed).toBe(false);
  });

  // 9. Successful draft creation and expected database relationships
  it("Requirement 9: creates expected database relationships across business, demo, assistant, and widget", async () => {
    const createdTables: string[] = [];

    const relationalSupabase = createMockSupabase({
      onInsert: (table) => {
        createdTables.push(table);
      },
    });
    vi.mocked(createServiceClient).mockReturnValueOnce(relationalSupabase as any);

    vi.mocked(crawlWebsite).mockResolvedValueOnce({
      startUrl: "https://relational-test.com",
      pagesFound: 1,
      pagesScraped: 1,
      pagesFailed: 0,
      combinedText: "Relational test ensuring all business, demo, assistant, widget, and source rows are established properly across database tables with correct foreign keys, valid timestamps, and consistent tenant identifiers.",
      pages: [{ url: "https://relational-test.com", title: "Relational", description: "", text: "Relational test ensuring all business, demo, assistant, widget, and source rows are established properly across database tables with correct foreign keys, valid timestamps, and consistent tenant identifiers.", wordCount: 30, characterCount: 220, status: "scraped" }],
      failedPages: [],
    });

    const res = await generateInstantAgent({ websiteUrl: "https://relational-test.com" });
    expect(res.success).toBe(true);
    expect(createdTables).toContain("businesses");
    expect(createdTables).toContain("demo_businesses");
    expect(createdTables).toContain("assistants");
    expect(createdTables).toContain("widget_configs");
    expect(createdTables).toContain("knowledge_sources");
  });

  // 10. Existing admin generation remaining restricted to authorized administrators
  it("Requirement 10: confirms admin demo generator remains restricted to authorized admins", async () => {
    // When called without an admin session, createDemoBusiness should reject
    const adminActionRes = await createDemoBusiness({
      businessName: "Unauthorized Biz",
      websiteUrl: "https://example.com",
    });

    // requireAdmin throws error when user is not admin, which returns { error: "..." }
    expect(adminActionRes).toHaveProperty("error");
  });
});
