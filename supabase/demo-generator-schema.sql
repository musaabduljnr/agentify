-- =========================================================================
-- Agentify Demo Generator + Demo CRM Database Schema
-- =========================================================================

-- Create public.demo_businesses table if not exists
CREATE TABLE IF NOT EXISTS public.demo_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  industry TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired', 'archived', 'converted')),
  demo_slug TEXT UNIQUE NOT NULL,
  demo_url TEXT,
  knowledge_source_count INTEGER DEFAULT 0,
  page_view_count INTEGER DEFAULT 0,
  unique_visitor_count INTEGER DEFAULT 0,
  conversation_count INTEGER DEFAULT 0,
  total_message_count INTEGER DEFAULT 0,
  lead_count INTEGER DEFAULT 0,
  converted BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sales_notes TEXT,
  follow_up_status TEXT DEFAULT 'not_contacted' CHECK (follow_up_status IN ('not_contacted', 'contacted', 'interested', 'not_interested', 'follow_up_later', 'converted')),
  next_follow_up_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  converted_at TIMESTAMP WITH TIME ZONE,
  converted_business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  placeholder_business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create public.demo_conversations table if not exists
CREATE TABLE IF NOT EXISTS public.demo_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_business_id UUID REFERENCES public.demo_businesses(id) ON DELETE CASCADE NOT NULL,
  visitor_id TEXT NOT NULL,
  source TEXT DEFAULT 'hosted_chat',
  first_message TEXT,
  last_message TEXT,
  message_count INTEGER DEFAULT 0,
  lead_captured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create public.demo_leads table if not exists
CREATE TABLE IF NOT EXISTS public.demo_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_business_id UUID REFERENCES public.demo_businesses(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES public.demo_conversations(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  interest TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create public.demo_events table if not exists
CREATE TABLE IF NOT EXISTS public.demo_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_business_id UUID REFERENCES public.demo_businesses(id) ON DELETE CASCADE NOT NULL,
  visitor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.demo_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_events ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- -------------------------------------------------------------------------

-- Policies for public demo pages (anon access)
CREATE POLICY "Anyone can view active demo businesses" ON public.demo_businesses
  FOR SELECT USING (status = 'active');

CREATE POLICY "Anyone can insert demo conversations" ON public.demo_conversations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.demo_businesses
      WHERE demo_businesses.id = demo_business_id AND demo_businesses.status = 'active'
    )
  );

CREATE POLICY "Anyone can update demo conversations" ON public.demo_conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.demo_businesses
      WHERE demo_businesses.id = demo_business_id AND demo_businesses.status = 'active'
    )
  );

CREATE POLICY "Anyone can insert demo leads" ON public.demo_leads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.demo_businesses
      WHERE demo_businesses.id = demo_business_id AND demo_businesses.status = 'active'
    )
  );

CREATE POLICY "Anyone can insert demo events" ON public.demo_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.demo_businesses
      WHERE demo_businesses.id = demo_business_id AND demo_businesses.status = 'active'
    )
  );

-- Policies for Admins (all operations allowed)
CREATE POLICY "Admins can manage all demo data" ON public.demo_businesses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all demo conversations" ON public.demo_conversations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all demo leads" ON public.demo_leads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all demo events" ON public.demo_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Triggers for handle_updated_at
DROP TRIGGER IF EXISTS set_demo_businesses_updated_at ON public.demo_businesses;
CREATE TRIGGER set_demo_businesses_updated_at 
  BEFORE UPDATE ON public.demo_businesses 
  FOR EACH ROW 
  EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS set_demo_conversations_updated_at ON public.demo_conversations;
CREATE TRIGGER set_demo_conversations_updated_at 
  BEFORE UPDATE ON public.demo_conversations 
  FOR EACH ROW 
  EXECUTE PROCEDURE handle_updated_at();
