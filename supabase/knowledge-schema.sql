-- Knowledge Sources table
CREATE TABLE public.knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('website', 'faq', 'manual', 'document')),
  title TEXT NOT NULL,
  source_url TEXT,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'processing', 'trained', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own knowledge sources" ON public.knowledge_sources
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = knowledge_sources.business_id
      AND businesses.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = knowledge_sources.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER set_knowledge_sources_updated_at
  BEFORE UPDATE ON public.knowledge_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Storage bucket for business documents (run in Supabase Dashboard > Storage)
-- CREATE POLICY "Authenticated users can upload" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'business-documents');
-- CREATE POLICY "Users can view own business files" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (bucket_id = 'business-documents');
