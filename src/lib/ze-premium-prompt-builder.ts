// ── Zé Premium — Prompt Builder ───────────────────────────────────────
// Gera prompts visuais para o modelo multimodal.
// O texto (headline, CTA) é renderizado via CSS overlay + Canvas 2D
// no frontend — NÃO mais pedido ao modelo de imagem.
//
// Ordem dos blocos:
//   0. FORMAT + SAFE AREA
//   1. PRODUCT / HERO SAFE AREA
//   2. LAYOUT COMPOSITION MODE
//   3. STYLE BLOCK
//   4. PRODUCT / NICHE BLOCK
//   5. MOOD + OBJECTIVE BLOCK
//   6. ATMOSPHERE + LIGHTING BLOCK
//   7. QUALITY BLOCK
//   8. NEGATIVE PROMPT BLOCK

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
  hasProductImage: boolean
  format?: SocialFormat   // formato da mídia — define safe area e dimensões
  // Quando renderTextNatively=true (gpt-image-2), o copy é incluído no prompt
  // e renderizado pelo modelo com tipografia integrada ao layout.
  // Quando false (outros providers), o texto é aplicado via canvas no frontend.
  renderTextNatively?: boolean
  headline?:    string
  subheadline?: string
  cta?:         string
  // Logomarca da empresa — quando presente, instrui o modelo a posicioná-la no criativo
  companyName?: string
  hasLogoImage?: boolean   // true = logo foi passada como imagem para o modelo
}

export function buildZePremiumPrompt(input: ZePremiumPromptInput): string {
  const isVertical = input.format?.aspectRatio === '9:16'

  // 9:16 → prompt dedicado para Fal.ai Flux Pro (composição vertical nativa).
  // Não usa gpt-image-1 (limitações conhecidas com portrait).
  if (isVertical) {
    return buildVertical916Prompt(input)
  }

  // ── PROMPT PADRÃO para 1:1 e landscape ─────────────────────────────
  return buildStandardPrompt(input)
}

// ── Prompt para formatos verticais 9:16 (Fal.ai Flux Pro) ────────────
// Gerado para o Flux Pro via fal.ai — modelo que lida bem com portrait
// e composição vertical. SEM texto no prompt (renderizado via Canvas 2D).
function buildVertical916Prompt(input: ZePremiumPromptInput): string {
  const preset     = STYLE_PRESETS[input.style] ?? STYLE_PRESETS.premium_dark
  const nicheBoost = NICHE_BOOSTERS[input.niche] ?? ''
  const platform   = input.format?.label ?? 'Instagram Stories'

  // Referência ao produto
  // Nota: Fal.ai (Flux Kontext) recebe a imagem do produto via img-to-img e usa
  // "faithfully recreate". Outros providers (Stability AI, Gemini, Ideogram) recebem
  // apenas o prompt — nesse caso usamos nicheBoost para descrever o tipo de produto.
  const productRef = nicheBoost

  const parts: string[] = [

    // ── 1. FORMATO + CONTEXTO ───────────────────────────────────────
    `Tall vertical 9:16 portrait ${platform} premium advertising image`,

    // ── 2. LAYOUT (Flux entende composição vertical melhor) ─────────
    `Three-zone vertical layout: ` +
    `[ZONE A — top 15% of frame: empty clean space, no product, no text] ` +
    `[ZONE B — center of frame 15% to 62%: the complete product floating centered, ` +
    `fully visible with all sides inside the frame, surrounded by atmospheric depth] ` +
    `[ZONE C — bottom 38%: deep dark atmospheric gradient with no product overlap, ` +
    `clean space for text overlay]`,

    // ── 3. Produto ─────────────────────────────────────────────────
    `The product occupies roughly one third of the total image height — ` +
    `sized proportionally to fit entirely in Zone B with visible breathing space on all sides, ` +
    productRef,

    // ── 4. Estilo visual ───────────────────────────────────────────
    preset.style,
    preset.mood,
    preset.atmosphere,
    preset.lighting,

    // ── 5. Qualidade + Logo ────────────────────────────────────────
    preset.quality,
    input.renderTextNatively
      ? `ultra premium vertical advertising photograph, no watermark, no UI chrome elements`
      : `ultra premium vertical advertising photograph, no text, no watermark, no UI elements`,

    // Logo da empresa — posicionada no rodapé quando disponível
    ...(input.hasLogoImage ? [
      `The company logo (provided as reference image) should appear at the bottom of Zone C, ` +
      `centered or left-aligned, at approximately 10% of the image width, clearly legible against the background`,
    ] : []),

    // ── 6. Copy tipográfico (apenas quando gpt-image-2 renderiza o texto) ──
    ...(input.renderTextNatively && input.headline ? [
      `ADVERTISING COPY — render this text integrated into the design with professional typography: ` +
      `HEADLINE: "${input.headline}"` +
      (input.subheadline ? `, SUBHEADLINE: "${input.subheadline}"` : '') +
      (input.cta ? `, CTA BUTTON: "${input.cta}"` : ''),
      `Place headline in large bold premium typeface in Zone C (bottom area), ` +
      `subheadline below in smaller weight, CTA as a pill-shaped button at the bottom`,
    ] : []),

    // ── 7. Negativo ────────────────────────────────────────────────
    `avoid: product touching image borders, product cropped at any edge, ` +
    `vehicle filling entire frame top to bottom, product taller than 50% of image` +
    (input.renderTextNatively ? '' : `, any text or letters or numbers in the image`),
  ]

  return parts.join(', ')
}

// ── Prompt padrão para 1:1 e landscape ───────────────────────────────
function buildStandardPrompt(input: ZePremiumPromptInput): string {
  const preset     = STYLE_PRESETS[input.style] ?? STYLE_PRESETS.premium_dark
  const nicheBoost = NICHE_BOOSTERS[input.niche] ?? ''

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

  // ── 6. ATMOSPHERE + LIGHTING ─────────────────────────────────────
  blocks.push(preset.composition)
  blocks.push(preset.atmosphere)
  blocks.push(preset.lighting)
  // Reservar área limpa no lado esquerdo/inferior para overlay de texto
  blocks.push(
    'the left third or lower area of the composition should have a clean dark atmospheric gradient ' +
    'that allows text to be overlaid with high readability — no busy details in that zone'
  )

  // ── 7. QUALITY ───────────────────────────────────────────────────
  blocks.push(preset.quality)
  const platformLabel = input.format?.label ?? 'Instagram'
  blocks.push(
    `complete advertising visual for ${platformLabel}, ` +
    'professional campaign quality, photorealistic render' +
    (input.renderTextNatively ? '' : ', no text rendered in the image')
  )

  // Logo da empresa — posicionada no canto inferior quando disponível
  if (input.hasLogoImage) {
    blocks.push(
      'The company logo (provided as reference image) should appear at the bottom-left or bottom-right corner, ' +
      'at approximately 12% of the image width, clearly visible against the background'
    )
  }

  // ── 7b. COPY (apenas quando gpt-image-2 renderiza o texto) ───────
  if (input.renderTextNatively && input.headline) {
    blocks.push(
      `ADVERTISING COPY — render integrated with premium typography: ` +
      `HEADLINE: "${input.headline}"` +
      (input.subheadline ? `, SUBHEADLINE: "${input.subheadline}"` : '') +
      (input.cta ? `, CTA: "${input.cta}"` : '')
    )
    blocks.push(
      'Place headline in large bold typeface in the lower-left clean area, ' +
      'subheadline below in lighter weight, CTA as a pill/button at the bottom'
    )
  }

  // ── 8. NEGATIVE ──────────────────────────────────────────────────
  blocks.push(
    'avoid: cropped product, oversized vehicle filling entire frame' +
    (input.renderTextNatively
      ? ', cluttered busy layout'
      : ', any text or letters or typography rendered inside the image, cluttered busy layout')
  )

  return blocks.join(',\n')
}
