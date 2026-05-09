-- Zé Post — Schema inicial

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  razao_social TEXT,
  phone TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#052d64',
  secondary_color TEXT DEFAULT '#fe7902',
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'pro')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'member')),
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Squad members (AI agents per company)
CREATE TABLE IF NOT EXISTS squad_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('estrategista','copywriter','designer','social_media','pesquisador','postador')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contents
CREATE TABLE IF NOT EXISTS contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'post_instagram','post_facebook','post_linkedin_imagem','post_linkedin_texto',
    'stories','carrossel','youtube','reels'
  )),
  platforms TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'rascunho' CHECK (status IN (
    'rascunho','pendente_aprovacao','aprovado','agendado','publicado','rejeitado'
  )),
  media_urls TEXT[] DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approvals
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting messages
CREATE TABLE IF NOT EXISTS meeting_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  meeting_session TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user','agent')),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  agent_role TEXT,
  agent_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social accounts
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram','facebook','tiktok','linkedin','youtube')),
  account_name TEXT,
  account_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- Row Level Security
-- =====================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

-- Profiles: usuário vê/edita apenas o próprio
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

-- Companies: usuário vê apenas a empresa dele
CREATE POLICY "companies_own" ON companies FOR ALL USING (
  id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- Tabelas scoped por company
CREATE POLICY "squad_company" ON squad_members FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "contents_company" ON contents FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "approvals_company" ON approvals FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "meetings_company" ON meeting_messages FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "social_company" ON social_accounts FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- =====================
-- Trigger: auto-criar profile ao signup
-- =====================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
