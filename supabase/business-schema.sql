-- Business table
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  website_url TEXT,
  industry TEXT,
  description TEXT,
  logo_url TEXT,
  contact_email TEXT,
  phone TEXT,
  whatsapp TEXT,
  address TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Assistants table
CREATE TABLE assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  tone TEXT NOT NULL,
  welcome_message TEXT NOT NULL,
  system_prompt TEXT,
  model TEXT DEFAULT 'gemini-2.5-pro',
  temperature NUMERIC DEFAULT 0.7,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Widget Configurations table
CREATE TABLE widget_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  primary_color TEXT DEFAULT '#4f46e5',
  position TEXT DEFAULT 'bottom-right',
  welcome_text TEXT,
  suggested_questions JSONB DEFAULT '[]'::jsonb,
  avatar_url TEXT,
  show_branding BOOLEAN DEFAULT TRUE,
  is_enabled BOOLEAN DEFAULT TRUE,
  allowed_domains TEXT[] DEFAULT '{}',
  collect_leads BOOLEAN DEFAULT TRUE,
  hosted_chat_enabled BOOLEAN DEFAULT TRUE,
  hosted_chat_slug TEXT UNIQUE,
  hosted_chat_title TEXT,
  hosted_chat_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  message_limit INTEGER DEFAULT 100,
  current_usage INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage Logs table
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Policies for Businesses
CREATE POLICY "Users can view their own business." ON businesses
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own business." ON businesses
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own business." ON businesses
  FOR UPDATE USING (auth.uid() = owner_id);

-- Policies for Assistants (linked to business)
CREATE POLICY "Users can view their own business assistants." ON assistants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses 
      WHERE businesses.id = assistants.business_id 
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own business assistants." ON assistants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM businesses 
      WHERE businesses.id = assistants.business_id 
      AND businesses.owner_id = auth.uid()
    )
  );

-- Similar policies for other tables...
CREATE POLICY "Users can manage their own widget configs." ON widget_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM businesses 
      WHERE businesses.id = widget_configs.business_id 
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own subscriptions." ON subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses 
      WHERE businesses.id = subscriptions.business_id 
      AND businesses.owner_id = auth.uid()
    )
  );

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_assistants_updated_at BEFORE UPDATE ON assistants FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_widget_configs_updated_at BEFORE UPDATE ON widget_configs FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
