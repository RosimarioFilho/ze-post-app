// ── Zé Premium — Prompt Builder ───────────────────────────────────
// Transforma os campos do formulário em prompts cinematográficos modulares.
// Não usa coordinate engine nem CSS procedural — o modelo resolve a composição.

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
  quality: string
}

const STYLE_PRESETS: Record<ZePremiumStyle, StylePreset> = {
  automotive_premium: {
    style: 'premium automotive advertising campaign, dealership campaign photography',
    mood: 'powerful, aspirational, high-status, cinematic drama',
    lighting: 'dramatic automotive studio lighting, rim light on vehicle body panels, floor reflection, side spotlights',
    composition: 'hero vehicle as main subject filling 65% of frame, clear area for typography on left side, depth of field blur on background',
    atmosphere: 'deep black premium background, subtle red accent gradient, professional showroom feel',
    quality: 'ultra realistic automotive photography, agency campaign quality, hyper detailed, no text, no watermarks',
  },
  premium_dark: {
    style: 'premium dark advertising campaign, high-end brand visual',
    mood: 'sophisticated, powerful, premium quality, aspirational',
    lighting: 'dramatic studio lighting, rim light, strong contrast, deep shadows',
    composition: 'product hero center composition, clean negative space, depth and layering',
    atmosphere: 'deep black background, gold or silver metallic accents, luxury feel',
    quality: 'ultra realistic product photography, luxury brand quality, hyper detailed, no text, no watermarks',
  },
  luxury: {
    style: 'luxury brand advertising, high fashion commercial photography',
    mood: 'exclusive, elegant, timeless, prestigious',
    lighting: 'soft luxury studio lighting, beauty light, subtle warm tones, no harsh shadows',
    composition: 'centered premium composition, editorial balance, breathing space around subject',
    atmosphere: 'champagne and gold tones, silky dark background, refined elegance',
    quality: 'luxury commercial photography, fashion editorial quality, flawless, no text, no watermarks',
  },
  modern_clean: {
    style: 'modern clean commercial advertising, minimal premium brand',
    mood: 'fresh, confident, innovative, trustworthy',
    lighting: 'bright even studio lighting, soft shadows, clean white tones',
    composition: 'product centered, minimal clutter, lots of breathing room, geometric balance',
    atmosphere: 'white or light gray clean background, subtle product shadow, crisp edges',
    quality: 'high resolution product photography, studio clean quality, sharp, no text, no watermarks',
  },
  cinematic: {
    style: 'cinematic commercial film still, movie poster advertising aesthetic',
    mood: 'dramatic, epic, emotional, storytelling-focused',
    lighting: 'cinematic lighting, volumetric rays, golden hour warmth or cool blue dramatic, atmospheric haze',
    composition: 'wide cinematic frame, rule of thirds, subject with environmental context, depth layers',
    atmosphere: 'cinematic color grade, teal and orange palette or monochromatic drama, film grain texture',
    quality: 'cinema-grade photography, blockbuster quality, no text, no watermarks',
  },
  minimal: {
    style: 'minimalist premium advertising, Scandinavian design aesthetic',
    mood: 'clean, calm, focused, premium simplicity',
    lighting: 'flat even lighting, minimal shadows, airy and light feel',
    composition: 'product isolated, massive white space, single focal point, zen balance',
    atmosphere: 'pure white or cream background, single accent color, refined space',
    quality: 'minimalist product photography, precision quality, ultra clean, no text, no watermarks',
  },
  aggressive_ads: {
    style: 'aggressive performance advertising, sports brand campaign style',
    mood: 'bold, energetic, powerful, in-your-face impact',
    lighting: 'high contrast dramatic lighting, harsh shadows, neon or electric accents',
    composition: 'dynamic diagonal composition, extreme angles, explosive energy, motion blur',
    atmosphere: 'dark gritty background, electric colors, neon accents, urban energy',
    quality: 'high impact commercial photography, sports brand quality, hyper dynamic, no text, no watermarks',
  },
  black_luxury: {
    style: 'ultra luxury black advertising, supercar and watch brand aesthetic',
    mood: 'ultra exclusive, dark power, obsidian elegance, status symbol',
    lighting: 'precision rim lighting, dramatic edge light, deep blacks with controlled highlights',
    composition: 'subject emerging from darkness, low key dramatic, sculptural form focus',
    atmosphere: 'pure black background, metallic chrome or gold reflections, invisible luxury',
    quality: 'ultra premium commercial photography, watchmaker precision quality, no text, no watermarks',
  },
}

const NICHE_BOOSTERS: Record<ZePremiumNiche, string> = {
  automotivo: 'automotive vehicle prominently featured, dealership professional setting, car brand campaign quality',
  restaurante: 'appetizing food or restaurant ambiance, culinary photography, warm inviting atmosphere',
  moda: 'fashion editorial style, clothing or accessories featured, model or lifestyle context',
  tecnologia: 'technology product clean setup, futuristic digital aesthetic, innovation feel',
  energia_solar: 'solar energy technology, clean renewable energy visual, modern sustainability',
  corporativo: 'professional corporate brand, business context, authority and trust visual',
  ecommerce: 'product packshot premium, e-commerce hero image, clean brand presentation',
  educacao: 'educational brand visual, knowledge and growth symbolism, modern learning aesthetic',
}

export interface ZePremiumPromptInput {
  objective: string
  niche: ZePremiumNiche
  style: ZePremiumStyle
  cta?: string
  hasProductImage: boolean
  hasLogo: boolean
}

export function buildZePremiumPrompt(input: ZePremiumPromptInput): string {
  const preset = STYLE_PRESETS[input.style] ?? STYLE_PRESETS.premium_dark
  const nicheBoost = NICHE_BOOSTERS[input.niche] ?? ''

  const blocks: string[] = []

  // 1. STYLE BLOCK
  blocks.push(preset.style)

  // 2. PRODUCT BLOCK
  if (input.hasProductImage) {
    blocks.push(`product is the absolute hero of the composition, ${nicheBoost}`)
    blocks.push('preserve product exactly as provided in the reference image, do not alter product colors or shape')
  } else {
    blocks.push(nicheBoost)
  }

  // 3. MOOD BLOCK
  blocks.push(preset.mood)

  // 4. COMPOSITION BLOCK
  blocks.push(preset.composition)
  if (input.objective) {
    blocks.push(`campaign objective: ${input.objective}`)
  }

  // 5. ATMOSPHERE BLOCK
  blocks.push(preset.atmosphere)
  blocks.push(preset.lighting)

  // 6. CTA AREA BLOCK (reserva espaço visual para texto)
  if (input.cta) {
    blocks.push('leave clean dark area for text overlay, do not add any text or letters in the image')
  }

  // 7. QUALITY BLOCK
  blocks.push(preset.quality)
  blocks.push('social media advertising quality, 1:1 square format, professional campaign')

  return blocks.join(', ')
}
