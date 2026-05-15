// ── Safe Area Engine ──────────────────────────────────────────────────
// Gera instruções de safe area para o prompt multimodal do Zé Premium.
// O modelo não tem "canvas" real — as instruções são injetadas via texto
// para que o modelo saiba exatamente onde posicionar headline, CTA, logo
// e o produto/herói visual.

import type { SocialFormat } from './social-formats'
import { DANGER_ZONES } from './danger-zones'

// ════════════════════════════════════════════════════════════════════
// TEXT + UI SAFE AREA GUIDANCE
// Instrui sobre margens de texto, CTA, logo e zonas de perigo da UI
// ════════════════════════════════════════════════════════════════════

export function buildSafeAreaGuidance(format: SocialFormat): string {
  const lines: string[] = []

  // 1. Identidade do formato
  lines.push(
    `This is a professional ${format.platform} advertisement — ` +
    `${format.label} format (${format.aspectRatio} aspect ratio, ` +
    `official size ${format.officialW}×${format.officialH}px)`
  )

  // 2. Safe area global de texto
  lines.push(
    `Keep ALL text, headlines, CTAs and logos strictly within the safe composition area: ` +
    `minimum ${format.safeArea.top}% padding from top, ` +
    `${format.safeArea.bottom}% from bottom, ` +
    `${format.safeArea.left}% from left edge, ` +
    `${format.safeArea.right}% from right edge — ` +
    `never place any text element outside these protected margins`
  )

  // 3. Danger zones específicas da plataforma
  const zones = format.dangerZoneIds
    .map(id => DANGER_ZONES[id])
    .filter(Boolean)

  if (zones.length > 0) {
    lines.push('CRITICAL — platform UI overlay zones that must remain completely clear of all content:')
    for (const zone of zones) {
      lines.push(`  • ${zone.promptWarning}`)
    }
  }

  // 4. Regras tipográficas de segurança
  lines.push(
    'Typography safety rules: ' +
    'headline must be fully readable with generous safe margin from every edge — ' +
    'never clip, cut or hide any single letter; ' +
    'CTA button must be entirely inside the safe zone — never near the platform bottom bar; ' +
    'logo must never touch or overflow any border; ' +
    'phone number and subheadline must have clear breathing space from all edges'
  )

  // 5. Composição centrada e segura
  lines.push(
    'Anchor the entire text composition within the protected inner area, ' +
    'ensure the artwork looks complete and professional when displayed on a real device with platform UI overlaid'
  )

  return lines.join(',\n')
}

// ════════════════════════════════════════════════════════════════════
// PRODUCT / HERO VISUAL SAFE AREA GUIDANCE
// Instrui sobre posicionamento, escala e integridade do produto herói
// ════════════════════════════════════════════════════════════════════

export function buildProductSafeAreaGuidance(format: SocialFormat): string {
  const { aspectRatio } = format
  const lines: string[] = []

  lines.push('PRODUCT / HERO VISUAL SAFE AREA — critical rules for the main subject:')

  if (aspectRatio === '9:16') {
    // Formatos verticais — Stories, Reels, TikTok, WhatsApp
    lines.push(
      'VERTICAL FORMAT: the hero product must be scaled to fit ENTIRELY within the canvas without any cropping',
      'Position the product/hero fully visible in the central safe zone — vertically between 18% and 60% from the top',
      'Keep at least 8% clear margin between the product and both left and right canvas edges',
      'The product must NOT touch, bleed or overflow any canvas border — preserve complete subject visibility from all sides',
      'Scale the product proportionally to fit the safe zone — DO NOT zoom in so close that the subject is cropped',
      'If the subject is a vehicle: show the COMPLETE vehicle — front bumper, rear bumper, all four wheels, full roof — all visible with room around them',
      'If the subject is a person: show the full body or at minimum from head to mid-thigh — never cut the face or torso',
      'Product/hero should occupy maximum 45–52% of the total canvas HEIGHT in this vertical format',
      'There must be visible atmosphere/background around the product on all sides — not a tight crop',
      'Reserve the area below 60% from top as the text zone — headline, subheadline and CTA go here',
      'Background behind the product creates cinematic depth and brand atmosphere without competing with the subject'
    )
  } else if (aspectRatio === '1:1') {
    // Formato quadrado
    lines.push(
      'SQUARE FORMAT: the hero product can be larger and more commanding, but must remain fully visible',
      'Product must be completely inside the canvas — no cropping at any edge, no element touching the border',
      'Keep at least 8% margin from all four canvas edges around the product',
      'Product can occupy 55–65% of the canvas visual area',
      'If subject is a vehicle: the complete vehicle with all four wheels and full roof must be clearly visible',
      'Reserve clearly visible space for headline and CTA — below the product or to the side',
      'Product should have breathing room — a zone of background atmosphere surrounding the subject'
    )
  } else {
    // Wide formats: 1.91:1 / 16:9
    lines.push(
      'WIDE HORIZONTAL FORMAT: place product on one side in a split composition',
      'Product must be ENTIRELY visible — never cropped at left, right, top or bottom edges',
      'Keep at least 6% margin from all canvas edges around the product',
      'Product should occupy one half of the canvas (roughly 40–50% width) with natural breathing space around it',
      'If subject is a vehicle: full vehicle silhouette visible — complete profile or three-quarter view showing all body panels',
      'The opposite half holds a clean text panel for headline, subheadline and CTA',
      'Product must not overlap the text panel — maintain clear visual separation between product zone and type zone'
    )
  }

  // Regra universal
  lines.push(
    'UNIVERSAL RULE: it is always better to scale the product slightly smaller than to crop any part of it — ' +
    'a complete, fully visible product in context always looks more professional than an oversized cropped subject'
  )

  return lines.join(',\n')
}

// ════════════════════════════════════════════════════════════════════
// SAFE AREA SCORES — Avaliação de risco em build-time
// Calculada a partir do perfil do formato — não análise pós-geração
// ════════════════════════════════════════════════════════════════════

export interface SafeAreaScores {
  headline_safe_score: number      // 0–100
  cta_safe_score: number
  logo_safe_score: number
  typography_margin_score: number
  overall: number
  risk_level: 'low' | 'medium' | 'high'
}

export function computeSafeAreaScores(format: SocialFormat): SafeAreaScores {
  const hasDangerZones = format.dangerZoneIds.length > 0
  const numDangerZones = format.dangerZoneIds.length
  const isVertical     = format.genH > format.genW

  // Base: formatos com danger zones têm mais risco
  const base = hasDangerZones
    ? Math.max(60, 95 - numDangerZones * 8)
    : 95

  // Formatos verticais (9:16) têm mais área de UI overlay → risco maior
  const verticalPenalty = isVertical ? 5 : 0

  const headline        = Math.min(100, base - verticalPenalty + 10)
  const cta             = Math.min(100, base - verticalPenalty)
  const logo            = Math.min(100, base - verticalPenalty + 5)
  const typographyScore = Math.min(100, base - verticalPenalty + 8)
  const overall         = Math.round((headline + cta + logo + typographyScore) / 4)

  const risk_level: SafeAreaScores['risk_level'] =
    overall >= 85 ? 'low' :
    overall >= 70 ? 'medium' : 'high'

  return {
    headline_safe_score: headline,
    cta_safe_score: cta,
    logo_safe_score: logo,
    typography_margin_score: typographyScore,
    overall,
    risk_level,
  }
}

// ── Product Safe Score ─────────────────────────────────────────────────
// Score de confiança para o produto/herói ficar intacto no formato dado

export function computeProductSafeScore(format: SocialFormat): number {
  const isVertical     = format.genH > format.genW
  const hasDangerZones = format.dangerZoneIds.length > 0

  let score = 92
  if (isVertical)     score -= 18  // formatos verticais têm menos espaço livre para o produto
  if (hasDangerZones) score -= 6   // danger zones reduzem área disponível ao produto

  return Math.max(50, Math.min(100, score))
}
