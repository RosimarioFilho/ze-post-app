-- ============================================================
-- Migration 003: Creative Studio
-- Adiciona tabelas para geração de artes premium com agentes IA
-- ============================================================

-- 1. Colunas faltando em contents (usadas no código mas ausentes na migration 001)
ALTER TABLE contents ADD COLUMN IF NOT EXISTS art_html TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS art_width INTEGER;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS art_height INTEGER;

-- 2. creative_jobs — rastreamento completo do pipeline de geração
CREATE TABLE IF NOT EXISTS creative_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL,
  briefing TEXT NOT NULL,
  product_image_url TEXT,
  product_image_nobg_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','bg_removing','analyzing','palette_extracting',
    'strategizing','copywriting','art_directing','designing',
    'rendering','critiquing','correcting','done','failed'
  )),
  current_agent TEXT,
  progress_pct INTEGER DEFAULT 0,
  vision_analysis JSONB,
  palette JSONB,
  strategy JSONB,
  copy_output JSONB,
  art_direction JSONB,
  designer_html TEXT,
  rendered_png_url TEXT,
  critique JSONB,
  correction_attempts INTEGER DEFAULT 0,
  final_html TEXT,
  final_png_url TEXT,
  content_id UUID REFERENCES contents(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. brand_kits — identidade de marca estendida além da tabela companies
CREATE TABLE IF NOT EXISTS brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  primary_font TEXT DEFAULT 'Montserrat',
  secondary_font TEXT DEFAULT 'Open Sans',
  accent_color TEXT,
  tone_of_voice TEXT DEFAULT 'profissional',
  preferred_styles TEXT[] DEFAULT '{}',
  rejected_styles TEXT[] DEFAULT '{}',
  preferred_ctas TEXT[] DEFAULT ARRAY['Saiba mais','Aproveite','Compre agora'],
  approved_art_examples TEXT[] DEFAULT '{}',
  rejected_art_examples TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. design_templates — biblioteca de templates HTML/CSS por categoria
CREATE TABLE IF NOT EXISTS design_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'oferta','autoridade','produto','servico','depoimento',
    'antes-depois','carrossel-educativo','institucional',
    'data-comemorativa','anuncio-agressivo'
  )),
  compatible_formats TEXT[] NOT NULL,
  description TEXT NOT NULL,
  html_skeleton TEXT NOT NULL,
  preview_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE creative_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_company" ON creative_jobs FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "brand_kits_company" ON brand_kits FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "templates_read" ON design_templates FOR SELECT USING (is_active = TRUE);

-- ── Trigger updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER creative_jobs_updated_at
  BEFORE UPDATE ON creative_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER brand_kits_updated_at
  BEFORE UPDATE ON brand_kits FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Seed: 10 templates iniciais ──────────────────────────────
INSERT INTO design_templates (name, category, compatible_formats, description, html_skeleton) VALUES

('Oferta Explosiva', 'oferta', ARRAY['post_instagram','post_facebook','carrossel'],
'Fundo sólido saturado com produto centralizado grande no centro. Badge de preço no canto superior direito. CTA em faixa de cor contrastante no rodapé. Ideal para promoções relâmpago.',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:{{WIDTH}}px;height:{{HEIGHT}}px;overflow:hidden;font-family:Montserrat,sans-serif;background:{{PRIMARY_COLOR}}}</style></head><body style="position:relative">
<div style="position:absolute;top:40px;left:50%;transform:translateX(-50%);text-align:center;z-index:5;width:90%"><p style="font-size:18px;font-weight:700;color:rgba(255,255,255,0.8);letter-spacing:3px;text-transform:uppercase">{{COMPANY_NAME}}</p><h1 style="font-size:{{HEADLINE_SIZE}}px;font-weight:900;color:#fff;line-height:0.9;margin-top:8px">{{HEADLINE}}</h1></div>
<img src="{{PRODUCT_IMAGE_URL}}" alt="produto" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);height:{{PRODUCT_HEIGHT}}px;max-width:88%;object-fit:contain;filter:drop-shadow(0 40px 80px rgba(0,0,0,0.5));z-index:3">
<div style="position:absolute;top:30px;right:30px;background:#fff;border-radius:50%;width:100px;height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:6"><p style="font-size:11px;color:{{PRIMARY_COLOR}};font-weight:700;text-transform:uppercase">apenas</p><p style="font-size:22px;font-weight:900;color:{{PRIMARY_COLOR}}">{{PRICE}}</p></div>
<div style="position:absolute;bottom:0;left:0;right:0;background:{{SECONDARY_COLOR}};height:80px;display:flex;align-items:center;justify-content:center;z-index:5"><p style="font-size:20px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:2px">{{CTA}}</p></div>
</body></html>'),

('Produto Premium', 'produto', ARRAY['post_instagram','stories','reels'],
'Background gradiente escuro com produto em destaque máximo. Headline acima e subheadline + CTA abaixo do produto. Visual luxuoso e sofisticado.',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:{{WIDTH}}px;height:{{HEIGHT}}px;overflow:hidden;font-family:Montserrat,sans-serif;background:linear-gradient(160deg,#0a0a1a 0%,{{PRIMARY_COLOR}} 100%)}</style></head><body style="position:relative">
<div style="position:absolute;top:50px;left:0;right:0;text-align:center;z-index:5;padding:0 60px"><h1 style="font-size:{{HEADLINE_SIZE}}px;font-weight:900;color:#fff;line-height:0.92;letter-spacing:-1px">{{HEADLINE}}</h1></div>
<img src="{{PRODUCT_IMAGE_URL}}" alt="produto" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);height:{{PRODUCT_HEIGHT}}px;max-width:88%;object-fit:contain;filter:drop-shadow(0 60px 120px rgba(0,0,0,0.8)) brightness(1.05);z-index:3">
<div style="position:absolute;bottom:60px;left:0;right:0;text-align:center;z-index:5;padding:0 60px"><p style="font-size:{{SUBLINE_SIZE}}px;color:rgba(255,255,255,0.75);font-weight:400;margin-bottom:20px">{{SUBLINE}}</p><div style="display:inline-block;background:{{SECONDARY_COLOR}};padding:14px 40px;border-radius:50px"><p style="font-size:16px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:2px">{{CTA}}</p></div></div>
</body></html>'),

('Autoridade Digital', 'autoridade', ARRAY['post_instagram','post_linkedin_imagem','post_facebook'],
'Layout split: foto à esquerda ocupando 45%, texto institucional à direita. Barra vertical de acento colorido separando as zonas. Tom profissional e confiável.',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:{{WIDTH}}px;height:{{HEIGHT}}px;overflow:hidden;font-family:Montserrat,sans-serif;background:#fff}</style></head><body style="position:relative;display:flex">
<div style="width:45%;height:100%;overflow:hidden;position:relative"><img src="{{PRODUCT_IMAGE_URL}}" alt="produto" style="width:100%;height:100%;object-fit:cover"></div>
<div style="width:8px;height:100%;background:{{SECONDARY_COLOR}};flex-shrink:0"></div>
<div style="flex:1;padding:60px 50px;display:flex;flex-direction:column;justify-content:center;background:{{PRIMARY_COLOR}}">
  <p style="font-size:13px;font-weight:700;color:{{SECONDARY_COLOR}};text-transform:uppercase;letter-spacing:3px;margin-bottom:20px">{{COMPANY_NAME}}</p>
  <h1 style="font-size:{{HEADLINE_SIZE}}px;font-weight:900;color:#fff;line-height:1;margin-bottom:20px">{{HEADLINE}}</h1>
  <p style="font-size:{{SUBLINE_SIZE}}px;color:rgba(255,255,255,0.8);line-height:1.5;margin-bottom:30px">{{SUBLINE}}</p>
  <div style="background:{{SECONDARY_COLOR}};display:inline-block;padding:12px 30px;border-radius:6px"><p style="font-size:14px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:2px">{{CTA}}</p></div>
</div>
</body></html>'),

('Depoimento Impacto', 'depoimento', ARRAY['post_instagram','post_facebook','stories'],
'Fundo escuro com foto do cliente em círculo ao centro topo. Aspas grandes decorativas em cor de acento. Texto do depoimento em destaque e nome do cliente abaixo. Gera credibilidade social.',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:{{WIDTH}}px;height:{{HEIGHT}}px;overflow:hidden;font-family:Montserrat,sans-serif;background:{{PRIMARY_COLOR}}}</style></head><body style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 80px">
<p style="font-size:120px;font-weight:900;color:{{SECONDARY_COLOR}};line-height:0.5;opacity:0.6;align-self:flex-start;margin-bottom:20px">"</p>
<h2 style="font-size:{{HEADLINE_SIZE}}px;font-weight:700;color:#fff;text-align:center;line-height:1.3;margin-bottom:40px">{{HEADLINE}}</h2>
<div style="display:flex;align-items:center;gap:20px">
  <img src="{{PRODUCT_IMAGE_URL}}" alt="cliente" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid {{SECONDARY_COLOR}}">
  <div><p style="font-size:16px;font-weight:700;color:#fff">{{SUBLINE}}</p><p style="font-size:13px;color:rgba(255,255,255,0.6)">{{COMPANY_NAME}}</p></div>
</div>
</body></html>'),

('Serviço Destaque', 'servico', ARRAY['post_instagram','post_facebook','post_linkedin_imagem'],
'Ícone ou imagem do serviço centralizado com fundo de gradiente suave. Lista de 3 benefícios rápidos com checkmarks. CTA destacado na base. Clareza e conversão.',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:{{WIDTH}}px;height:{{HEIGHT}}px;overflow:hidden;font-family:Montserrat,sans-serif;background:linear-gradient(135deg,{{PRIMARY_COLOR}} 0%,#0a1628 100%)}</style></head><body style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:60px">
<div style="text-align:center"><p style="font-size:13px;font-weight:700;color:{{SECONDARY_COLOR}};text-transform:uppercase;letter-spacing:3px;margin-bottom:16px">{{COMPANY_NAME}}</p><h1 style="font-size:{{HEADLINE_SIZE}}px;font-weight:900;color:#fff;line-height:0.92">{{HEADLINE}}</h1></div>
<img src="{{PRODUCT_IMAGE_URL}}" alt="serviço" style="height:{{PRODUCT_HEIGHT}}px;max-width:80%;object-fit:contain;filter:drop-shadow(0 30px 60px rgba(0,0,0,0.5))">
<div style="width:100%"><p style="font-size:{{SUBLINE_SIZE}}px;color:rgba(255,255,255,0.8);text-align:center;margin-bottom:20px">{{SUBLINE}}</p><div style="background:{{SECONDARY_COLOR}};padding:16px;border-radius:12px;text-align:center"><p style="font-size:16px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:2px">{{CTA}}</p></div></div>
</body></html>'),

('Antes e Depois', 'antes-depois', ARRAY['post_instagram','post_facebook','carrossel'],
'Divisão vertical 50/50 com linha central branca. Lado esquerdo "ANTES" com tom apagado/cinza, lado direito "DEPOIS" com cores vibrantes. Labels em faixas no topo de cada metade. Resultado visual imediato.',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:{{WIDTH}}px;height:{{HEIGHT}}px;overflow:hidden;font-family:Montserrat,sans-serif}</style></head><body style="position:relative;display:flex">
<div style="width:50%;height:100%;background:#1a1a1a;position:relative;overflow:hidden"><img src="{{PRODUCT_IMAGE_URL}}" alt="antes" style="width:100%;height:100%;object-fit:cover;filter:grayscale(100%) brightness(0.6)"><div style="position:absolute;top:0;left:0;right:0;background:rgba(0,0,0,0.5);padding:16px;text-align:center"><p style="font-size:20px;font-weight:900;color:#fff;letter-spacing:4px">ANTES</p></div></div>
<div style="width:4px;height:100%;background:#fff;z-index:10;flex-shrink:0"></div>
<div style="width:50%;height:100%;background:{{PRIMARY_COLOR}};position:relative;overflow:hidden"><img src="{{PRODUCT_IMAGE_URL}}" alt="depois" style="width:100%;height:100%;object-fit:cover;filter:saturate(1.2) brightness(1.05)"><div style="position:absolute;top:0;left:0;right:0;background:{{SECONDARY_COLOR}};padding:16px;text-align:center"><p style="font-size:20px;font-weight:900;color:#fff;letter-spacing:4px">DEPOIS</p></div></div>
<div style="position:absolute;bottom:0;left:0;right:0;background:{{PRIMARY_COLOR}};padding:20px;text-align:center;z-index:5"><h2 style="font-size:{{HEADLINE_SIZE}}px;font-weight:900;color:#fff">{{HEADLINE}}</h2><p style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:6px">{{CTA}}</p></div>
</body></html>'),

('Institucional Profissional', 'institucional', ARRAY['post_instagram','post_linkedin_imagem','post_facebook'],
'Background branco clean com borda de acento lateral esquerda. Logo + slogan no topo. Imagem centralizada. Texto institucional abaixo em tom sóbrio. Transmite confiança e longevidade.',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:{{WIDTH}}px;height:{{HEIGHT}}px;overflow:hidden;font-family:Montserrat,sans-serif;background:#f8f9fa}</style></head><body style="position:relative;display:flex;flex-direction:column">
<div style="background:{{PRIMARY_COLOR}};padding:30px 50px;display:flex;align-items:center;justify-content:space-between"><p style="font-size:20px;font-weight:900;color:#fff">{{COMPANY_NAME}}</p><p style="font-size:13px;color:rgba(255,255,255,0.7);font-weight:600">{{SUBLINE}}</p></div>
<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:40px"><img src="{{PRODUCT_IMAGE_URL}}" alt="empresa" style="max-height:{{PRODUCT_HEIGHT}}px;max-width:90%;object-fit:contain;filter:drop-shadow(0 20px 50px rgba(0,0,0,0.15))"></div>
<div style="padding:40px 50px;background:#fff;border-top:4px solid {{SECONDARY_COLOR}}"><h2 style="font-size:{{HEADLINE_SIZE}}px;font-weight:900;color:{{PRIMARY_COLOR}};margin-bottom:10px">{{HEADLINE}}</h2><p style="font-size:14px;color:#666;line-height:1.5">{{SUBLINE}}</p></div>
</body></html>'),

('Data Comemorativa', 'data-comemorativa', ARRAY['post_instagram','post_facebook','stories'],
'Background festivo com gradiente vibrante e confetes decorativos CSS. Saudação grande centralizada. Mensagem emotiva abaixo. Logo e nome da empresa no rodapé. Celebra datas especiais.',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:{{WIDTH}}px;height:{{HEIGHT}}px;overflow:hidden;font-family:Montserrat,sans-serif;background:linear-gradient(135deg,{{PRIMARY_COLOR}} 0%,{{SECONDARY_COLOR}} 100%)}.confete{position:absolute;border-radius:2px;animation:queda 3s infinite}</style></head><body style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center">
<div style="position:absolute;top:0;left:0;right:0;bottom:0;opacity:0.15">
  <div class="confete" style="width:10px;height:20px;background:#fff;top:10%;left:20%;transform:rotate(45deg)"></div>
  <div class="confete" style="width:8px;height:16px;background:#ffeb3b;top:20%;left:60%;transform:rotate(-30deg)"></div>
  <div class="confete" style="width:12px;height:12px;background:#e91e63;top:30%;left:80%;border-radius:50%"></div>
  <div class="confete" style="width:10px;height:20px;background:#fff;top:60%;left:10%;transform:rotate(20deg)"></div>
  <div class="confete" style="width:8px;height:8px;background:#ffeb3b;top:70%;left:70%;border-radius:50%"></div>
</div>
<img src="{{PRODUCT_IMAGE_URL}}" alt="celebração" style="height:{{PRODUCT_HEIGHT}}px;max-width:85%;object-fit:contain;filter:drop-shadow(0 30px 60px rgba(0,0,0,0.3));z-index:2;margin-bottom:30px">
<h1 style="font-size:{{HEADLINE_SIZE}}px;font-weight:900;color:#fff;text-align:center;text-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:2">{{HEADLINE}}</h1>
<p style="font-size:{{SUBLINE_SIZE}}px;color:rgba(255,255,255,0.9);text-align:center;margin-top:16px;z-index:2">{{SUBLINE}}</p>
<p style="position:absolute;bottom:30px;font-size:14px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:2px;z-index:2">{{COMPANY_NAME}}</p>
</body></html>'),

('Anúncio Agressivo', 'anuncio-agressivo', ARRAY['post_instagram','post_facebook','stories','reels'],
'Background preto total com produto iluminado em spotlights. Urgência visual máxima: headline grande vermelha/laranja no topo, countdown ou oferta limitada em destaque, CTA impossível de ignorar.',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:{{WIDTH}}px;height:{{HEIGHT}}px;overflow:hidden;font-family:Montserrat,sans-serif;background:#000}</style></head><body style="position:relative">
<div style="position:absolute;top:0;left:0;right:0;background:{{SECONDARY_COLOR}};padding:20px;text-align:center;z-index:6"><p style="font-size:15px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:4px">⚡ OFERTA LIMITADA ⚡</p></div>
<div style="position:absolute;top:80px;left:0;right:0;text-align:center;z-index:5;padding:0 40px"><h1 style="font-size:{{HEADLINE_SIZE}}px;font-weight:900;color:#fff;line-height:0.88;text-transform:uppercase">{{HEADLINE}}</h1></div>
<img src="{{PRODUCT_IMAGE_URL}}" alt="produto" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);height:{{PRODUCT_HEIGHT}}px;max-width:90%;object-fit:contain;filter:drop-shadow(0 0 80px {{SECONDARY_COLOR}}) drop-shadow(0 40px 80px rgba(0,0,0,0.9));z-index:3">
<div style="position:absolute;bottom:0;left:0;right:0;z-index:5"><div style="background:{{SECONDARY_COLOR}};padding:10px;text-align:center"><p style="font-size:{{SUBLINE_SIZE}}px;color:#fff;font-weight:700">{{SUBLINE}}</p></div><div style="background:#fff;padding:20px;text-align:center"><p style="font-size:20px;font-weight:900;color:{{PRIMARY_COLOR}};text-transform:uppercase;letter-spacing:3px">{{CTA}} →</p></div></div>
</body></html>'),

('Carrossel Educativo', 'carrossel-educativo', ARRAY['carrossel','post_instagram'],
'Card individual de carrossel com número do slide no topo esquerdo. Título do slide centralizado. Conteúdo didático com ícone e texto. Rodapé com branding. Fundo claro para legibilidade.',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:{{WIDTH}}px;height:{{HEIGHT}}px;overflow:hidden;font-family:Montserrat,sans-serif;background:#fff}</style></head><body style="position:relative;display:flex;flex-direction:column">
<div style="background:{{PRIMARY_COLOR}};padding:40px 60px 30px"><span style="font-size:48px;font-weight:900;color:rgba(255,255,255,0.3)">01</span><h1 style="font-size:{{HEADLINE_SIZE}}px;font-weight:900;color:#fff;margin-top:10px;line-height:1">{{HEADLINE}}</h1></div>
<div style="flex:1;padding:40px 60px;display:flex;flex-direction:column;justify-content:center">
  <img src="{{PRODUCT_IMAGE_URL}}" alt="conteúdo" style="width:100%;max-height:{{PRODUCT_HEIGHT}}px;object-fit:contain;margin-bottom:30px;filter:drop-shadow(0 10px 30px rgba(0,0,0,0.1))">
  <p style="font-size:{{SUBLINE_SIZE}}px;color:#333;line-height:1.6">{{SUBLINE}}</p>
</div>
<div style="background:{{SECONDARY_COLOR}};padding:20px 60px;display:flex;align-items:center;justify-content:space-between"><p style="font-size:14px;font-weight:700;color:#fff">{{COMPANY_NAME}}</p><p style="font-size:13px;color:rgba(255,255,255,0.8)">{{CTA}} →</p></div>
</body></html>');
