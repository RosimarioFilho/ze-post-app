// ── Layout Composition Engine ─────────────────────────────────────────
// Determina o modo de composição ideal para cada formato de mídia social
// e gera instruções de layout adaptativas para o prompt multimodal.
// O modelo usa essas instruções para escolher como posicionar produto,
// headline, subheadline e CTA dentro do canvas.

import type { SocialFormat } from './social-formats'

export type LayoutCompositionMode =
  | 'SQUARE_HERO_CENTER'
  | 'VERTICAL_STORY_STACK'
  | 'VERTICAL_REELS_SAFE'
  | 'WIDE_SPLIT_HERO'
  | 'WIDE_CINEMATIC_BANNER'

export function getCompositionMode(format: SocialFormat): LayoutCompositionMode {
  const { aspectRatio, id } = format

  if (aspectRatio === '1:1') return 'SQUARE_HERO_CENTER'

  if (aspectRatio === '9:16') {
    if (id === 'INSTAGRAM_REELS_COVER' || id === 'TIKTOK_COVER') {
      return 'VERTICAL_REELS_SAFE'
    }
    return 'VERTICAL_STORY_STACK'
  }

  if (aspectRatio === '16:9') return 'WIDE_CINEMATIC_BANNER'

  return 'WIDE_SPLIT_HERO' // 1.91:1 — Facebook Post, LinkedIn Post
}

// ── Instruções de composição por modo ─────────────────────────────────

const COMPOSITION_GUIDANCE: Record<LayoutCompositionMode, string[]> = {

  SQUARE_HERO_CENTER: [
    'Balanced centered square composition — product or hero subject fills 60–70% of the canvas area',
    'Product must be fully visible within the canvas — never cropped at any edge',
    'Keep the subject centered or slightly left of center for natural visual balance',
    'Reserve the lower third or right side as a clean zone for headline, subheadline and CTA',
    'Background complements the product with atmospheric depth and premium lighting',
    'All elements maintain at least 8% safe margin from every canvas edge',
    'Typography lives in a clear zone — never overlapping the main product body',
    'Visual hierarchy: product commands attention, headline delivers message, CTA drives action',
  ],

  VERTICAL_STORY_STACK: [
    'VERTICAL STORY 9:16 — MANDATORY THREE-ZONE STACKED LAYOUT:',
    '═══ ZONE 1 (top 0–18%): EMPTY — completely clear, no text, no product, no graphics',
    '═══ ZONE 2 (18%–60% from top): PRODUCT ZONE — hero subject fully visible, centered horizontally',
    '═══ ZONE 3 (60%–82% from top): TEXT ZONE — headline, subheadline and CTA only',
    '═══ ZONE 4 (bottom 18%): EMPTY — platform UI zone, completely clear',
    'PRODUCT IN ZONE 2: the vehicle or hero subject must fit ENTIRELY inside Zone 2 boundaries — scaled DOWN if needed',
    'PRODUCT SCALE: the product width must not exceed 84% of canvas width — leave 8% margin on each side',
    'PRODUCT HEIGHT: the product must not be taller than 42% of the total canvas height',
    'ABSOLUTELY NO CROPPING: every part of the vehicle (wheels, roof, bumpers, mirrors) must be visible inside the canvas',
    'BACKGROUND: visible atmospheric background must surround the product on all four sides',
    'The layout reads top-to-bottom: empty header space → product in center → text below product → empty footer',
    'Think of this like a product catalog layout: product occupies upper-center, text block below',
    'The product should look like a hero shot in a magazine, not an extreme close-up',
  ],

  VERTICAL_REELS_SAFE: [
    'VERTICAL REELS/TIKTOK 9:16 — MANDATORY SAFE-CENTER LAYOUT:',
    '═══ TOP 15%: EMPTY — platform profile UI zone, completely clear',
    '═══ CENTER (15%–54% from top): PRODUCT ZONE — hero fully visible, scaled to fit',
    '═══ MID-LOWER (55%–76% from top): TEXT ZONE — headline, subheadline, CTA',
    '═══ BOTTOM 24%: EMPTY — Reels/TikTok overlay zone, completely clear',
    '═══ RIGHT 12%: EMPTY — action buttons column, completely clear',
    'PRODUCT SCALE: must fit entirely inside the center zone — scale DOWN to fit, never crop',
    'PRODUCT WIDTH: must not exceed 76% of canvas width (keep right 12% + 8% left margin clear)',
    'PRODUCT HEIGHT: must not exceed 38% of total canvas height to fit in the center zone',
    'ALL vehicle parts (wheels, roof, bumpers, side mirrors) must be fully inside the canvas',
    'Visible atmospheric background around all four sides of the product',
    'Text positioned at least 14% away from right edge (action bar safe area)',
    'Layout verified against overlay: looks professional with Reels UI elements applied on top',
  ],

  WIDE_SPLIT_HERO: [
    'Wide horizontal split-panel composition (1.91:1 or 16:9-ish) — product on one side, text on the other',
    'Left panel (45–55% width): hero product or subject — fully visible, never cropped',
    'Right panel (45–55% width): clean premium typography zone — headline, subheadline, CTA',
    'Product must have at least 6% breathing margin from all edges — no element touching the border',
    'For vehicles: full vehicle from front to rear completely visible with ground reflection if applicable',
    'Clear visual separation between the product side and the text side',
    'Background connects both panels with atmospheric depth and color continuity',
    'Typography panel may have a subtle dark gradient backing for text contrast',
    'All text elements at least 6% from top, bottom and side edges',
    'Visual rhythm: dramatic product left, confident messaging right — or reverse for variety',
  ],

  WIDE_CINEMATIC_BANNER: [
    'Wide cinematic banner composition (16:9) — full landscape panoramic layout',
    'Hero product or subject positioned prominently — fully visible, never cropped at any edge',
    'Subject may be positioned left, center or right with text in the opposing area',
    'Typography can span across the lower third in a cinematic title bar style',
    'Wide atmospheric background creates depth and brand environment behind the subject',
    'For vehicles: entire vehicle visible — all four sides, full profile or three-quarter view',
    'Keep at least 6% margin from every canvas edge for all elements',
    'Visual hierarchy: product anchors the scene, headline delivers the brand message, CTA closes',
    'Color grading and lighting should feel like a professional commercial photography shoot',
  ],
}

// ── Exportação principal ───────────────────────────────────────────────

export function buildCompositionGuidance(format: SocialFormat): string {
  const mode   = getCompositionMode(format)
  const lines  = COMPOSITION_GUIDANCE[mode]
  const header = `LAYOUT COMPOSITION — ${mode} mode for ${format.label} (${format.aspectRatio})`
  return [header, ...lines].join(',\n')
}
