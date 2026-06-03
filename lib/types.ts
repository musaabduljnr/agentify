export type KnowledgeSourceType = "website" | "faq" | "manual" | "document";

export type KnowledgeSourceStatus = "draft" | "pending" | "processing" | "trained" | "failed";

export type KnowledgeSource = {
  id: string;
  business_id: string;
  type: KnowledgeSourceType;
  title: string;
  source_url: string | null;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  status: KnowledgeSourceStatus;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  crawl_mode?: "single" | "crawl" | null;
  crawl_status?: "not_started" | "discovering" | "crawling" | "completed" | "failed" | "partial" | null;
  crawl_depth?: number | null;
  max_pages?: number | null;
  pages_found?: number | null;
  pages_scraped?: number | null;
  pages_failed?: number | null;
  crawl_started_at?: string | null;
  crawl_completed_at?: string | null;
  crawled_pages?: any[] | null;
  failed_pages?: any[] | null;
};

export type Business = {
  id: string;
  owner_id: string | null;
  name: string;
  slug: string;
  website_url: string | null;
  industry: string | null;
  description: string | null;
  logo_url: string | null;
  contact_email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};
