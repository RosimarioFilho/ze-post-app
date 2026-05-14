// ── Product Staging Engine — Submódulo do Creative Engine ──────────
// Analisa o produto enviado pelo usuário para garantir que seja tratado
// como herói visual da composição. Integrado ao pipeline de geração.

import type Anthropic from '@anthropic-ai/sdk'
import type { VisualStyle, Layout } from './creative-engine'

// ════════════════════════════════════════════════════════════════════
// TIPOS
// ════════════════════════════════════════════════════════════════════

export interface ProductStagingResult {
  product_detected: boolean
  product_category: 'vehicle' | 'electronics' | 'food' | 'fashion' | 'person' | 'service' | 'generic'
  product_main_color: string
  product_luminance: 'high' | 'medium' | 'low'
  product_angle: string
  product_crop_quality: 'good' | 'acceptable' | 'poor'
  background_removed: boolean
  recommended_stage_style: VisualStyle
  recommended_layout: Layout
  contrast_risk: 'low' | 'medium' | 'high'
  visual_priority_score: number
  is_automotive: boolean
  needs_product_spotlight: boolean
  text_zone: 'bottom' | 'bottom-left' | 'bottom-right' | 'top-strip'
  // % da altura da imagem que o overlay pode cobrir sem atingir o produto
  overlay_safe_percent: number
}

// ════════════════════════════════════════════════════════════════════
// DETECÇÃO AUTOMOTIVA — Baseada em keywords do briefing/nicho
// ════════════════════════════════════════════════════════════════════

const AUTOMOTIVE_KEYWORDS = [
  'carro', 'veículo', 'veiculo', 'concessionária', 'concessionaria',
  'financiamento', 'test-drive', 'testdrive', 'seminovo', 'zerokm', 'zero km',
  'fiat', 'jeep', 'chevrolet', 'toyota', 'hyundai', 'honda', 'renault', 'nissan',
  'volkswagen', 'vw', 'ford', 'mitsubishi', 'kia', 'bmw', 'mercedes', 'audi',
  'suv', 'caminhonete', 'pickup', 'utilitário', 'utilitario', 'sedan', 'hatch',
  'fiorino', 'strada', 'toro', 'renegade', 'compass', 'pulse', 'mobi', 'argo',
  'onix', 'tracker', 'cruze', 'cobalt', 'hilux', 'corolla', 'civic', 'fit',
  'kwid', 'duster', 'sandero', 'logan', 'kicks', 'frontier', 'amarok',
  'saveiro', 'gol', 'polo', 'virtus', 'nivus', 't-cross', 'taos', 'tiguan',
  'offroad', 'off-road', 'motores', 'automóvel', 'automovel', 'concessionário',
]

export function detectAutomotiveContext(briefing: string, niche: string): boolean {
  const text = `${briefing} ${niche}`.toLowerCase()
  return AUTOMOTIVE_KEYWORDS.some(kw => text.includes(kw))
}

// ════════════════════════════════════════════════════════════════════
// FALLBACKS
// ════════════════════════════════════════════════════════════════════

const FALLBACK_GENERIC: ProductStagingResult = {
  product_detected: false,
  product_category: 'generic',
  product_main_color: 'unknown',
  product_luminance: 'medium',
  product_angle: 'front',
  product_crop_quality: 'good',
  background_removed: false,
  recommended_stage_style: 'CINEMATIC',
  recommended_layout: 'HERO_RIGHT',
  contrast_risk: 'medium',
  visual_priority_score: 70,
  is_automotive: false,
  needs_product_spotlight: false,
  text_zone: 'bottom',
  overlay_safe_percent: 30,
}

function buildAutomotiveFallback(subtype: VisualStyle = 'AUTOMOTIVE_PREMIUM'): ProductStagingResult {
  return {
    product_detected: true,
    product_category: 'vehicle',
    product_main_color: 'unknown',
    product_luminance: 'medium',
    product_angle: 'front_3_4',
    product_crop_quality: 'good',
    background_removed: false,
    recommended_stage_style: subtype,
    recommended_layout: 'HERO_RIGHT',
    contrast_risk: 'medium',
    visual_priority_score: 85,
    is_automotive: true,
    needs_product_spotlight: false,
    text_zone: 'bottom',
    overlay_safe_percent: 25,
  }
}

// ════════════════════════════════════════════════════════════════════
// SELEÇÃO DE PRESET AUTOMOTIVO
// ════════════════════════════════════════════════════════════════════

function selectAutomotiveStyle(briefing: string): VisualStyle {
  const t = briefing.toLowerCase()
  if (t.match(/bmw|mercedes|audi|lexus|volvo|luxury|premium.*veículo|veículo.*premium/)) return 'AUTOMOTIVE_LUXURY'
  if (t.match(/oferta|promoção|promocao|financiamento|parcela|entrada|taxa|desconto|preço|preco/)) return 'AUTOMOTIVE_OFFER'
  if (t.match(/urban|cidade|jovem|moderno|street|hip/)) return 'AUTOMOTIVE_URBAN'
  if (t.match(/sport|esport|performance|velocidade|turbo|potência|potencia/)) return 'AUTOMOTIVE_SPORT'
  if (t.match(/clean|minimal|branco|simples|clean|claro/)) return 'AUTOMOTIVE_CLEAN'
  return 'AUTOMOTIVE_PREMIUM'
}

// ════════════════════════════════════════════════════════════════════
// ANÁLISE PRINCIPAL — Usa Claude Haiku para analisar a imagem
// ════════════════════════════════════════════════════════════════════

export async function analyzeProductStaging(
  imageBase64: string,
  imageMime: 'image/jpeg' | 'image/png' | 'image/webp',
  briefing: string,
  anthropic: Anthropic,
): Promise<ProductStagingResult> {
  const isAutomotive = detectAutomotiveContext(briefing, '')
  const automotiveSubtype = isAutomotive ? selectAutomotiveStyle(briefing) : 'AUTOMOTIVE_PREMIUM'

  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 350,
      system: 'Premium art director analyzing product for social media ad. Return ONLY valid JSON, no explanation.',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: imageMime, data: imageBase64 },
          },
          {
            type: 'text',
            text: `Analyze for premium ad composition. Context: "${briefing.slice(0, 120)}"
Return JSON only:
{
  "product_detected": true,
  "product_category": "vehicle"|"electronics"|"food"|"fashion"|"person"|"service"|"generic",
  "product_main_color": "white/black/red/silver/blue/etc",
  "product_luminance": "high"|"medium"|"low",
  "product_angle": "front_3_4"|"side"|"front"|"rear_3_4"|"top_down"|"detail",
  "product_crop_quality": "good"|"acceptable"|"poor",
  "background_removed": true|false,
  "contrast_risk": "low"|"medium"|"high",
  "needs_product_spotlight": true|false,
  "visual_priority_score": 0-100
}`,
          },
        ],
      }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text : '{}'
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return isAutomotive ? buildAutomotiveFallback(automotiveSubtype) : FALLBACK_GENERIC

    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    const isVehicle = parsed.product_category === 'vehicle' || isAutomotive

    const isLightProduct = parsed.product_luminance === 'high' ||
      ['white', 'branco', 'branca', 'prata', 'silver', 'bege', 'creme', 'pearl', 'champagne']
        .some(c => String(parsed.product_main_color ?? '').toLowerCase().includes(c))

    let recommended_stage_style: VisualStyle = 'CINEMATIC'
    let recommended_layout: Layout = 'HERO_RIGHT'

    if (isVehicle) {
      recommended_stage_style = automotiveSubtype
      recommended_layout = 'HERO_RIGHT'
    }

    // Veículos/produtos claros têm risco médio em fundos escuros
    let contrast_risk = (parsed.contrast_risk as 'low' | 'medium' | 'high') ?? 'medium'
    if (isVehicle && isLightProduct && contrast_risk === 'low') contrast_risk = 'medium'

    // Quanto mais o produto ocupa a imagem, menos overlay pode cobrir
    const overlay_safe_percent = isVehicle ? 25 : (isLightProduct ? 28 : 32)

    return {
      product_detected: (parsed.product_detected as boolean) ?? true,
      product_category: (parsed.product_category as ProductStagingResult['product_category']) ?? 'generic',
      product_main_color: String(parsed.product_main_color ?? 'unknown'),
      product_luminance: (parsed.product_luminance as 'high' | 'medium' | 'low') ?? 'medium',
      product_angle: String(parsed.product_angle ?? 'front'),
      product_crop_quality: (parsed.product_crop_quality as 'good' | 'acceptable' | 'poor') ?? 'good',
      background_removed: (parsed.background_removed as boolean) ?? false,
      recommended_stage_style,
      recommended_layout,
      contrast_risk,
      visual_priority_score: (parsed.visual_priority_score as number) ?? 75,
      is_automotive: isVehicle,
      needs_product_spotlight: (parsed.needs_product_spotlight as boolean) ?? (contrast_risk === 'high'),
      text_zone: 'bottom',
      overlay_safe_percent,
    }
  } catch {
    return isAutomotive ? buildAutomotiveFallback(automotiveSubtype) : FALLBACK_GENERIC
  }
}

// ════════════════════════════════════════════════════════════════════
// SMART CONTRAST ENGINE — Verifica colisão visual produto × fundo
// ════════════════════════════════════════════════════════════════════

export interface ContrastAnalysis {
  product_background_contrast_score: number  // 0-100
  text_zone_risk: 'safe' | 'moderate' | 'risky'
  logo_zone_risk: 'safe' | 'moderate' | 'risky'
  corrections_needed: string[]
}

export function analyzeContrastRisk(staging: ProductStagingResult): ContrastAnalysis {
  const corrections: string[] = []
  let score = 100

  // Produto claro em fundo escuro = risco de desmaterialização
  if (staging.product_luminance === 'high' && staging.contrast_risk === 'high') {
    score -= 30
    corrections.push('spotlight_behind_product')
    corrections.push('increase_background_contrast')
  } else if (staging.product_luminance === 'high' && staging.contrast_risk === 'medium') {
    score -= 15
    corrections.push('subtle_product_shadow')
  }

  // Produto escuro em fundo escuro = invisível
  if (staging.product_luminance === 'low' && staging.contrast_risk !== 'low') {
    score -= 25
    corrections.push('lighten_background')
    corrections.push('add_rim_light_instruction')
  }

  // Produto com fundo não removido = colisão visual
  if (!staging.background_removed && staging.product_category === 'vehicle') {
    score -= 10
    corrections.push('background_removal_recommended')
  }

  const text_zone_risk: ContrastAnalysis['text_zone_risk'] =
    staging.contrast_risk === 'high' ? 'risky' :
    staging.contrast_risk === 'medium' ? 'moderate' : 'safe'

  return {
    product_background_contrast_score: Math.max(0, score),
    text_zone_risk,
    logo_zone_risk: staging.product_luminance === 'high' ? 'moderate' : 'safe',
    corrections_needed: corrections,
  }
}

// ════════════════════════════════════════════════════════════════════
// AUTOMOTIVE PROMPT DIRECTIVES — Injeção no Visual Prompt Engineer
// ════════════════════════════════════════════════════════════════════

export function buildAutomotivePromptDirectives(
  staging: ProductStagingResult,
  overlayPercent: number,
): string {
  const directives: string[] = [
    `VEHICLE IS THE ABSOLUTE HERO — it must dominate ${100 - overlayPercent}% of the visual.`,
    `CRITICAL: Dark overlay ONLY on bottom ${overlayPercent}% of image for text. Vehicle body must stay CLEAN and bright.`,
    `NO dark gradients, fog, or haze over the vehicle body.`,
    `The background must CONTRAST with the vehicle — if vehicle is ${staging.product_main_color}, use a contrasting background.`,
    `Professional automotive advertising photography. Vehicle as centerpiece.`,
  ]

  if (staging.needs_product_spotlight) {
    directives.push('Add dramatic rim lighting and subtle spotlight behind the vehicle to separate it from background.')
  }

  if (staging.product_luminance === 'high') {
    directives.push('Vehicle is light-colored — use dark or gradient background to create strong separation. No white-on-white.')
  }

  if (staging.product_luminance === 'low') {
    directives.push('Vehicle is dark — use lighter or colorful background with strong rim light to separate it visually.')
  }

  return directives.join(' ')
}

// ════════════════════════════════════════════════════════════════════
// VISUAL DEBUG LOG — Salvo no job para diagnóstico
// ════════════════════════════════════════════════════════════════════

export interface VisualDebugLog {
  composition_mode: string
  is_automotive: boolean
  style_selected: string
  layout_selected: string
  product_category: string
  product_luminance: string
  contrast_risk: string
  overlay_safe_percent: number
  needs_spotlight: boolean
  logo_mode?: string
  contrast_score?: number
  repair_attempts?: number
  corrections_applied?: string[]
}

export function buildDebugLog(
  staging: ProductStagingResult,
  style: string,
  layout: string,
  logoMode?: string,
  corrections?: string[],
): VisualDebugLog {
  const contrast = analyzeContrastRisk(staging)
  return {
    composition_mode: staging.is_automotive ? 'AUTOMOTIVE' : 'STANDARD',
    is_automotive: staging.is_automotive,
    style_selected: style,
    layout_selected: layout,
    product_category: staging.product_category,
    product_luminance: staging.product_luminance,
    contrast_risk: staging.contrast_risk,
    overlay_safe_percent: staging.overlay_safe_percent,
    needs_spotlight: staging.needs_product_spotlight,
    logo_mode: logoMode,
    contrast_score: contrast.product_background_contrast_score,
    repair_attempts: 0,
    corrections_applied: corrections ?? contrast.corrections_needed,
  }
}
