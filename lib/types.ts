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
};

export type Business = {
  id: string;
  owner_id: string;
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
