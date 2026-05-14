// ── Safe Area Engine ──────────────────────────────────────────────────
// Gera instruções de safe area para o prompt multimodal do Zé Premium.
// O modelo não tem "canvas" real — as instruções são injetadas via texto
// para que o modelo saiba exatamente onde posicionar headline, CTA e logo.

import type { SocialFormat } from './social-formats'
import { DANGER_ZONES } from './danger-zones'

// ════════════════════════════════════════════════════════════════════
// PROMPT GUIDANCE — Instrução injetada no início do prompt
// ════════════════════════════════════════════════════════════════════

export function buildSafeAreaGuidance(format: SocialFormat): string {
  const lines: string[] = []

  // 1. Identidade do formato
  lines.push(
    `This is a professional ${format.platform} advertisement — ` +
    `${format.label} format (${format.aspectRatio} aspect ratio, ` +
    `official size ${format.officialW}×${format.officialH}px)`
  )

  // 2. Safe area global
  lines.push(
    `Keep ALL text, headlines, CTAs and logos strictly within the safe composition area: ` +
    `minimum ${format.safeArea.top}% padding from top, ` +
    `${format.safeArea.bottom}% from bottom, ` +
    `${format.safeArea.left}% from left edge, ` +
    `${format.safeArea.right}% from right edge — ` +
    `never place any element outside these protected margins`
  )

  // 3. Danger zones específicas da plataforma
  const zones = format.dangerZoneIds
    .map(id => DANGER_ZONES[id])
    .filter(Boolean)

  if (zones.length > 0) {
    lines.push('CRITICAL — platform UI overlay zones that must remain completely clear:')
    for (const zone of zones) {
      lines.push(`  • ${zone.promptWarning}`)
    }
  }

  // 4. Regras tipográficas de segurança
  lines.push(
    'Typography safety rules: ' +
    'headline must be fully readable with generous safe margin from every edge — ' +
    'never clip, cut or hide any letter; ' +
    'CTA button must be entirely inside the safe zone; ' +
    'logo must never touch or overflow any border; ' +
    'phone number and subheadline must have clear breathing space from all edges'
  )

  // 5. Composição centrada e segura
  lines.push(
    'Anchor the entire composition within the protected inner area, ' +
    'center all critical visual elements safely away from any edge, ' +
    'ensure the artwork looks complete and professional when displayed on a real device with platform UI overlaid'
  )

  return lines.join(',\n')
}

// ════════════════════════════════════════════════════════════════════
// SAFE AREA SCORES — Avaliação de risco em build-time
// (não análise pós-geração — calculada a partir do perfil do formato)
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

  // Formatos verticais (9:16) têm mais area de UI overlay → risco maior
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
