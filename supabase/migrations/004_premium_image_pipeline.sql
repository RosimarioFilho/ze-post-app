-- Premium Image Generation Pipeline
-- Replaces HTML/CSS Designer + Puppeteer with real AI image generation

ALTER TABLE creative_jobs
  ADD COLUMN IF NOT EXISTS creative_brief JSONB,
  ADD COLUMN IF NOT EXISTS image_provider TEXT,
  ADD COLUMN IF NOT EXISTS image_prompt TEXT,
  ADD COLUMN IF NOT EXISTS generated_image_url TEXT,
  ADD COLUMN IF NOT EXISTS visual_score INTEGER,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

ALTER TABLE creative_jobs DROP CONSTRAINT IF EXISTS creative_jobs_status_check;
ALTER TABLE creative_jobs ADD CONSTRAINT creative_jobs_status_check
  CHECK (status IN (
    'pending','bg_removing','analyzing','palette_extracting',
    'strategizing','copywriting','creative_directing',
    'prompt_engineering','generating_image','visual_review',
    'regenerating','done','failed'
  ));
