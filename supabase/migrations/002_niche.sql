-- Adiciona o nicho da empresa para tornar a geração de conteúdo mais assertiva.
-- A coluna logo_url já existe em 001_initial.sql, portanto basta inserir o nicho.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS niche TEXT;

COMMENT ON COLUMN companies.niche IS
  'Nicho/segmento da empresa (ex: padaria, provedor_internet, restaurante). Usado pelos agentes de IA para gerar conteúdo mais assertivo.';
