-- Carousel Narrative Engine — adiciona suporte a carrosséis multi-slide no creative_jobs

ALTER TABLE creative_jobs
  ADD COLUMN IF NOT EXISTS is_carousel         BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS carousel_slide_count INTEGER      DEFAULT 1,
  ADD COLUMN IF NOT EXISTS carousel_plan        JSONB,
  ADD COLUMN IF NOT EXISTS carousel_slides      JSONB        DEFAULT '[]'::jsonb;

COMMENT ON COLUMN creative_jobs.is_carousel          IS 'TRUE quando o job é um carrossel multi-slide';
COMMENT ON COLUMN creative_jobs.carousel_slide_count IS 'Número total de slides do carrossel (default 5)';
COMMENT ON COLUMN creative_jobs.carousel_plan         IS 'CarouselNarrativePlan — plano narrativo gerado pelo carousel-engine';
COMMENT ON COLUMN creative_jobs.carousel_slides       IS 'Array de CarouselSlideResult com url, role, score e status de cada slide';
