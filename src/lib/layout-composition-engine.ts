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
    'Vertical story-format layout (9:16) — use a stacked three-zone composition',
    'ZONE 1 — Top 18%: must remain visually clean and free of all text (platform avatar and username overlay)',
    'ZONE 2 — Center (18% to 60% from top): hero product or subject — fully visible, scaled to fit, never cropped',
    'ZONE 3 — Lower area (60% to 82% from top): headline, subheadline and CTA text zone',
    'The product/subject must fit completely inside Zone 2 with visible breathing space around it',
    'Keep at least 8% clear margin between product edges and left/right canvas borders',
    'Product scale must be proportional — the full subject is visible with surrounding atmosphere',
    'If the subject is a vehicle, all four wheels, full roof and both bumpers must be clearly visible',
    'Do NOT zoom in on the product so tightly that it bleeds off any canvas edge',
    'Background creates a premium cinematic depth behind the product within Zone 2',
    'Headline must appear clearly below the product, well above the bottom 18% danger zone',
    'CTA sits at the bottom of Zone 3 — fully visible and not clipped by platform UI',
    'The entire composition should feel cinematic, premium and spacious — not cramped or oversized',
  ],

  VERTICAL_REELS_SAFE: [
    'Vertical Reels / TikTok composition (9:16) — use a compact safe-center stacked layout',
    'Top 15% must be clear — platform profile bar overlay (username, timestamp)',
    'Bottom 24% must be clear — Reels or TikTok action UI overlay (caption, audio, buttons)',
    'Right 12% column must be completely empty — social action buttons overlay',
    'Safe product zone: hero must be fully visible between 16% and 55% from the top of the canvas',
    'Hero product must never touch or cross any canvas border — maintain 8% side margins minimum',
    'Scale product proportionally — the entire subject must be visible with context around it',
    'For vehicles: full vehicle silhouette visible — no cropping of wheels, roof, or body panels',
    'Headline and subheadline zone: between 56% and 72% from top',
    'CTA zone: between 72% and 76% from top — above the bottom danger zone',
    'All text elements must be positioned at least 14% from the right edge (action bar safe)',
    'Background creates cinematic vertical depth behind the product',
    'Layout must look complete and premium when Reels/TikTok UI overlays are applied',
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
