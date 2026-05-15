// ── Zé Premium — Prompt Builder ───────────────────────────────────────
// Gera prompts multimodais que instruem o modelo a compor headline,
// subheadline e CTA diretamente dentro da imagem gerada.
// Sem overlay, sem HTML, sem composição posterior.
//
// Ordem dos blocos:
//   0. FORMAT + TEXT SAFE AREA
//   1. PRODUCT / HERO SAFE AREA
//   2. LAYOUT COMPOSITION MODE
//   3. STYLE BLOCK
//   4. PRODUCT / NICHE BLOCK
//   5. MOOD + OBJECTIVE BLOCK
//   6. COPY BLOCK (headline, subheadline, CTA)
//   7. TYPOGRAPHY BLOCK
//   8. ATMOSPHERE + LIGHTING BLOCK
//   9. QUALITY BLOCK
//  10. NEGATIVE PROMPT BLOCK

import type { SocialFormat } from './social-formats'
import { buildSafeAreaGuidance, buildProductSafeAreaGuidance } from './safe-area-engine'
import { buildCompositionGuidance } from './layout-composition-engine'

export type ZePremiumNiche =
  | 'automotivo'
  | 'restaurante'
  | 'moda'
  | 'tecnologia'
  | 'energia_solar'
  | 'corporativo'
  | 'ecommerce'
  | 'educacao'

export type ZePremiumStyle =
  | 'premium_dark'
  | 'luxury'
  | 'modern_clean'
  | 'cinematic'
  | 'minimal'
  | 'aggressive_ads'
  | 'black_luxury'
  | 'automotive_premium'

interface StylePreset {
  style: string
  mood: string
  lighting: string
  composition: string
  atmosphere: string
  typography: string
  quality: string
}

const STYLE_PRESETS: Record<ZePremiumStyle, StylePreset> = {
  automotive_premium: {
    style: 'premium automotive advertising campaign, luxury dealership visual, Jeep and BMW campaign aesthetic',
    mood: 'powerful, aspirational, high-status, cinematic drama, aggressive premium energy',
    lighting: 'dramatic automotive studio lighting, strong rim light outlining vehicle body panels, clean floor reflection, side spotlights creating depth',
    composition: 'hero vehicle positioned on right side filling 55% of frame, clear dark left panel for typography, depth of field background blur, product never obscured by text',
    atmosphere: 'deep black luxury background, subtle red accent gradient behind vehicle, professional premium showroom depth',
    typography: 'bold heavy advertising typeface, large headline left-aligned, clean white sans-serif letters with high contrast against dark background, modern premium typography hierarchy',
    quality: 'ultra realistic automotive photography render, campaign agency quality, hyper detailed, sharp vehicle details, professional social media advertising',
  },
  premium_dark: {
    style: 'premium dark advertising campaign, high-end brand visual, luxury commercial design',
    mood: 'sophisticated, powerful, premium quality, aspirational status',
    lighting: 'dramatic studio lighting, strong rim light, high contrast, deep controlled shadows',
    composition: 'product hero center-left composition, dark right panel for typography, clean negative space',
    atmosphere: 'deep black background, gold or silver metallic accent elements, luxury brand feel',
    typography: 'bold premium sans-serif typeface, large impactful headline, clean white text, strong typographic hierarchy',
    quality: 'ultra realistic premium product rendering, luxury brand campaign quality, hyper detailed, professional advertising',
  },
  luxury: {
    style: 'luxury brand advertising, high fashion editorial, Chanel and Louis Vuitton campaign level',
    mood: 'exclusive, timeless, prestigious, editorial elegance',
    lighting: 'soft luxury beauty lighting, even warm studio tones, no harsh shadows, sculpted highlights',
    composition: 'centered premium composition, editorial breathing space, subject commanding attention',
    atmosphere: 'champagne and gold tones, silky dark charcoal background, refined luxury depth',
    typography: 'elegant thin serif typeface for headline, refined spacing, sophisticated editorial typography, minimal and clean',
    quality: 'luxury editorial photography render, flawless premium quality, fashion campaign level',
  },
  modern_clean: {
    style: 'modern clean commercial advertising, Apple and Google campaign aesthetic, premium tech brand',
    mood: 'fresh, confident, innovative, trustworthy, forward-thinking',
    lighting: 'bright clean studio lighting, soft even shadows, crisp product edge definition',
    composition: 'product centered or left, clean white right panel area for typography, geometric balance',
    atmosphere: 'white or very light gray premium background, crisp product shadow, clean minimal environment',
    typography: 'clean modern geometric sans-serif, large confident headline, dark text on light background, Apple-style typography clarity',
    quality: 'studio product photography render, ultra clean sharp quality, professional brand campaign',
  },
  cinematic: {
    style: 'cinematic commercial film campaign, movie poster advertising aesthetic, Hollywood quality',
    mood: 'dramatic, epic, emotional, powerful storytelling, larger than life',
    lighting: 'cinematic volumetric rays, golden hour warm side light or cool blue dramatic moonlight, atmospheric haze depth',
    composition: 'wide cinematic feel adapted to format, rule of thirds, subject with dramatic environmental context, layered depth',
    atmosphere: 'cinematic color grade, teal and orange Hollywood palette or high contrast monochromatic, subtle film grain texture',
    typography: 'bold cinematic movie poster typeface, large dramatic headline, strong text shadow for readability, epic advertising scale',
    quality: 'cinema-grade photography render, blockbuster visual quality, ultra detailed, immersive scene',
  },
  minimal: {
    style: 'minimalist premium advertising, Scandinavian design aesthetic, refined simplicity campaign',
    mood: 'calm, focused, premium through restraint, clarity as luxury',
    lighting: 'flat even airy lighting, minimal cast shadows, clean ambient light',
    composition: 'product isolated with massive white breathing space, single focal point, zen compositional balance',
    atmosphere: 'pure white or warm cream background, single accent color element, refined spatial calm',
    typography: 'ultra thin light serif or minimal sans-serif, small precise headline, maximum negative space, whitespace as design',
    quality: 'minimalist product photography precision render, ultra clean flawless quality, editorial restraint',
  },
  aggressive_ads: {
    style: 'aggressive performance advertising, Nike and Red Bull campaign energy, sports brand impact',
    mood: 'explosive, raw power, in-your-face impact, adrenaline, victory',
    lighting: 'high contrast brutal dramatic lighting, harsh shadows, electric neon accents, energy sparks',
    composition: 'dynamic diagonal composition, extreme product angle, motion energy, explosive visual force',
    atmosphere: 'dark gritty urban background, electric colors, neon accent glows, high impact visual chaos controlled',
    typography: 'massive ultra-bold condensed headline, aggressive impact typeface, bright accent color, maximum visual weight',
    quality: 'high impact commercial photography render, sports brand quality, hyper dynamic and sharp, advertising energy',
  },
  black_luxury: {
    style: 'ultra luxury obsidian black advertising, Porsche and Rolex campaign level, invisible luxury premium',
    mood: 'ultra exclusive, dark seductive power, invisible status, obsidian elegance',
    lighting: 'precision rim lighting barely visible against black, dramatic edge highlights, deep controlled blacks',
    composition: 'subject emerging from pure darkness, low key dramatic placement, sculptural form emphasis',
    atmosphere: 'pure deep black background, chrome or gold metallic reflections, luxurious dark void',
    typography: 'ultra refined thin tracking-wide serif or premium sans-serif, minimal headline, gold or white text, maximum sophistication',
    quality: 'ultra premium luxury photography render, watchmaker precision quality, obsidian visual excellence',
  },
}

const NICHE_BOOSTERS: Record<ZePremiumNiche, string> = {
  automotivo:    'automotive vehicle as absolute hero subject, dealership professional campaign setting, car brand campaign visual language',
  restaurante:   'appetizing premium food or restaurant environment, culinary photography level, warm inviting ambiance',
  moda:          'fashion editorial context, clothing or accessories as hero, model lifestyle visual or product focus',
  tecnologia:    'technology product in clean premium setup, futuristic digital aesthetic, innovation visual language',
  energia_solar: 'solar panels or clean energy technology as hero, sustainability modern visual, clean renewable energy branding',
  corporativo:   'professional corporate brand context, business authority visual, trust and competence aesthetic',
  ecommerce:     'premium product packshot as hero, e-commerce campaign visual, clean brand presentation',
  educacao:      'educational brand context, knowledge and growth visual metaphor, modern professional learning aesthetic',
}

// Instruções de posicionamento tipográfico por estilo
const TYPOGRAPHY_PLACEMENT: Record<ZePremiumStyle, string> = {
  automotive_premium: 'place the headline text on the left dark panel area, bottom-left corner for CTA, text must be clearly readable, never overlap the vehicle',
  premium_dark:       'headline in upper or center-left area on dark background, CTA button at bottom, strong contrast text',
  luxury:             'headline centered or upper area, elegant spacing, text floats above subject with editorial grace',
  modern_clean:       'headline right side or bottom on clean background, clean dark text on light area, Apple-style placement',
  cinematic:          'large headline across bottom third in cinematic title position, CTA below, dramatic text drop shadow',
  minimal:            'small refined headline centered below product, very little text, maximum white space preserved',
  aggressive_ads:     'massive diagonal headline across frame, oversized aggressive placement, product and text in dynamic tension',
  black_luxury:       'minimal headline at bottom in tiny refined text, gold accent on ultra luxury black, whispered not shouted',
}

export interface ZePremiumPromptInput {
  objective: string
  niche: ZePremiumNiche
  style: ZePremiumStyle
  headline: string
  subheadline?: string
  cta?: string
  hasProductImage: boolean
  format?: SocialFormat   // formato da mídia — define safe area e dimensões
}

export function buildZePremiumPrompt(input: ZePremiumPromptInput): string {
  const isVertical = input.format?.aspectRatio === '9:16'

  // Formatos verticais usam uma estratégia de prompt completamente diferente.
  // Modelos de geração de imagem respondem a analogias visuais curtas,
  // NÃO a longas listas de regras técnicas com percentuais.
  if (isVertical) {
    return buildVertical916Prompt(input)
  }

  // ── PROMPT PADRÃO para 1:1 e landscape ─────────────────────────────
  return buildStandardPrompt(input)
}

// ── Prompt para formatos verticais 9:16 ──────────────────────────────
// Estratégia: CURTO, analogia visual, layout descrito narrativamente.
// O layout é a PRIMEIRA coisa — não enterrado no bloco 7.
function buildVertical916Prompt(input: ZePremiumPromptInput): string {
  const preset     = STYLE_PRESETS[input.style] ?? STYLE_PRESETS.premium_dark
  const nicheBoost = NICHE_BOOSTERS[input.niche] ?? ''
  const platform   = input.format?.label ?? 'Instagram Stories'

  // Bloco de copy da arte
  const copyLines: string[] = [
    `bold advertising headline text rendered inside the image reading exactly: "${input.headline}"`,
  ]
  if (input.subheadline?.trim()) {
    copyLines.push(`subheadline text below reading exactly: "${input.subheadline}"`)
  }
  if (input.cta?.trim()) {
    copyLines.push(`CTA button at bottom reading exactly: "${input.cta}"`)
  }

  // Referência ao produto
  const productRef = input.hasProductImage
    ? 'using the provided product reference image — preserve exact colors, shape and proportions, do not modify the product'
    : nicheBoost

  const parts: string[] = [

    // ── 1. LAYOUT — primeiro e mais importante ──────────────────────
    // Analogia visual simples: "magazine cover layout"
    `A premium vertical ${platform} advertisement designed like a luxury magazine cover or professional car dealer poster: ` +
    `the upper half of the image shows the complete product centered against a dramatic atmospheric background (the entire product fits inside the image with visible space around it), ` +
    `and the lower half shows the advertising text block with headline and CTA clearly readable`,

    // ── 2. Produto ─────────────────────────────────────────────────
    `Product shown as a full product shot — the complete object with all sides visible, nothing cropped, ` +
    `similar to how a product appears on a premium dealership catalog or magazine feature page, ` +
    productRef,

    // ── 3. Estilo visual ───────────────────────────────────────────
    preset.style,
    preset.mood,
    preset.atmosphere,
    preset.lighting,

    // ── 4. Copy integrada na imagem ────────────────────────────────
    copyLines.join(', '),
    `${preset.typography}, text placed in the lower section of the image, fully inside the frame`,
    `text uses a premium accent color that harmonizes with the scene — warm ivory, gold or white on dark backgrounds`,

    // ── 5. Qualidade ───────────────────────────────────────────────
    preset.quality,
    `complete professional advertising artwork for ${platform}, all text legible, no distorted letters`,

    // ── 6. Negativo — curto e direto ───────────────────────────────
    `avoid: cropped product, vehicle filling entire frame, wheels or roof cut off, ` +
    `text overlapping the product, text outside the image borders, letters cut at edges`,
  ]

  return parts.join(',\n')
}

// ── Prompt padrão para 1:1 e landscape ───────────────────────────────
function buildStandardPrompt(input: ZePremiumPromptInput): string {
  const preset     = STYLE_PRESETS[input.style] ?? STYLE_PRESETS.premium_dark
  const nicheBoost = NICHE_BOOSTERS[input.niche] ?? ''
  const typoPlace  = TYPOGRAPHY_PLACEMENT[input.style] ?? ''

  const blocks: string[] = []

  // ── 0. FORMAT + SAFE AREA ────────────────────────────────────────
  if (input.format) {
    blocks.push(buildSafeAreaGuidance(input.format))
  }

  // ── 1. PRODUCT SAFE AREA ─────────────────────────────────────────
  if (input.format) {
    blocks.push(buildProductSafeAreaGuidance(input.format))
  }

  // ── 2. COMPOSITION MODE ──────────────────────────────────────────
  if (input.format) {
    blocks.push(buildCompositionGuidance(input.format))
  }

  // ── 3. STYLE ─────────────────────────────────────────────────────
  blocks.push(preset.style)

  // ── 4. PRODUCT / NICHE ───────────────────────────────────────────
  if (input.hasProductImage) {
    blocks.push(`${nicheBoost}, product is the absolute visual hero of the composition`)
    blocks.push('preserve the product exactly as provided in the reference — do not alter colors, shape or proportions')
  } else {
    blocks.push(nicheBoost)
  }

  // ── 5. MOOD + OBJECTIVE ──────────────────────────────────────────
  blocks.push(preset.mood)
  if (input.objective) {
    blocks.push(`campaign message: ${input.objective}`)
  }

  // ── 6. COPY ──────────────────────────────────────────────────────
  const copyParts: string[] = []
  copyParts.push(`large bold advertising headline rendered directly in the image saying exactly: "${input.headline}"`)
  if (input.subheadline?.trim()) {
    copyParts.push(`smaller premium subheadline below saying exactly: "${input.subheadline}"`)
  }
  if (input.cta?.trim()) {
    copyParts.push(`modern premium CTA element at the bottom saying exactly: "${input.cta}"`)
  }
  copyParts.push(
    'headline accent color harmonizes with the artwork palette — ' +
    'warm ivory, gold or white on dark backgrounds for strong readability'
  )
  blocks.push(copyParts.join(', '))

  // ── 7. TYPOGRAPHY + PLACEMENT ────────────────────────────────────
  blocks.push(preset.typography)
  blocks.push(typoPlace)
  blocks.push('text perfectly legible, professional typesetting, no distorted letters')

  // ── 8. COMPOSITION + ATMOSPHERE ──────────────────────────────────
  blocks.push(preset.composition)
  blocks.push('product and typography coexist without competing — product is hero, text is supporting')
  blocks.push(preset.atmosphere)
  blocks.push(preset.lighting)

  // ── 9. QUALITY ───────────────────────────────────────────────────
  blocks.push(preset.quality)
  const platformLabel = input.format?.label ?? 'Instagram'
  blocks.push(
    `complete advertising piece ready for ${platformLabel}, ` +
    'professional campaign quality, photorealistic render, no lorem ipsum, ' +
    'all text within safe composition area'
  )

  // ── 10. NEGATIVE ─────────────────────────────────────────────────
  blocks.push(
    'avoid: cropped product, oversized vehicle filling entire frame, ' +
    'text outside safe margins, letters cut off at image border, ' +
    'CTA near bottom UI zone, distorted typography, cluttered layout'
  )

  return blocks.join(',\n')
}
