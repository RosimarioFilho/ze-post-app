// ── Creative Engine v2 — Motor de Composição Visual Perceptivo ──────
// Sistema de direção de arte modular e inteligente para o Zé Post.
// Cada camada (layout, style, typography, effects, depth, subject)
// tem tokens concretos que guiam tanto o render SVG quanto o prompt de imagem.

// ════════════════════════════════════════════════════════════════════
// TIPOS BASE
// ════════════════════════════════════════════════════════════════════

export type Layout =
  | 'HERO_RIGHT'     // sujeito direita, texto embaixo-esquerda
  | 'HERO_LEFT'      // sujeito esquerda, texto embaixo-direita
  | 'CENTER_STACK'   // texto centralizado, composição simétrica
  | 'POSTER'         // headline enorme centralizada, visual de impacto
  | 'FOCUS_CENTER'   // headline topo, produto centro, CTA baixo
  | 'SPLIT_SCREEN'   // painel colorido esquerdo com texto, imagem à direita
  | 'DIAGONAL_FLOW'  // faixa diagonal dinâmica com texto
  | 'ASYMMETRIC'     // bloco de texto offset, gradiente assimétrico

export type VisualStyle =
  | 'CINEMATIC' | 'LUXURY' | 'SPORT' | 'TECH'
  | 'MINIMAL' | 'NEON' | 'CORPORATE' | 'EDITORIAL' | 'STREET'

export type Effect = 'EMBERS' | 'DUST' | 'LIGHT_LEAK' | 'GLOW' | 'GRAIN' | 'SMOKE'

export type TypographyBehavior =
  | 'BOLD_IMPACT' | 'ELEGANT' | 'CONDENSED' | 'STACKED' | 'FLOATING'

export interface CreativeDecision {
  layout: Layout
  style: VisualStyle
  effects: Effect[]
  typography: TypographyBehavior
  composition: string
  asset_strategy: 'PERSON_FOCUSED' | 'PRODUCT_HERO' | 'SCENE_DRIVEN' | 'ABSTRACT'
  mood: string
  depth: 'LOW' | 'MEDIUM' | 'HIGH'
  image_direction: string
}

// ════════════════════════════════════════════════════════════════════
// STYLE TOKEN SYSTEM — Tokens visuais reais por estilo
// ════════════════════════════════════════════════════════════════════

export interface StyleTokens {
  // Render SVG
  gradientAlpha: number       // opacidade máxima do gradiente de escurecimento
  gradientCoverage: number    // % do frame coberta pelo gradiente (0-100)
  overlayAlpha: number        // overlay de cor sólida sutil
  textShadow: boolean         // sombra nos textos
  accentOpacity: number
  vignette: boolean           // escurecimento de cantos
  vignetteIntensity: number   // 0-1
  atmosphericHaze: boolean    // névoa colorida de profundidade
  grainIntensity: number      // 0-1
  glowIntensity: number       // 0-1
  // Tipografia por estilo
  headlineCase: 'upper' | 'title' // all caps ou title case
  headlineOpacity: number     // 0-1
  sublineOpacity: number      // 0-1
  ctaStyle: 'filled' | 'outline' | 'ghost'
  spacingMode: 'compact' | 'balanced' | 'breathing' | 'generous'
  // Prompt de imagem
  contrast: 'low' | 'medium' | 'high' | 'ultra'
  saturation: 'muted' | 'natural' | 'rich' | 'vivid'
  lightingDesc: string
  cameraFeel: string
  imagePromptSuffix: string
}

export const STYLE_TOKENS: Record<VisualStyle, StyleTokens> = {
  CINEMATIC: {
    gradientAlpha: 0.92, gradientCoverage: 62, overlayAlpha: 0.12, textShadow: true, accentOpacity: 1.0,
    vignette: true, vignetteIntensity: 0.50, atmosphericHaze: true, grainIntensity: 0.08, glowIntensity: 0.3,
    headlineCase: 'upper', headlineOpacity: 1.0, sublineOpacity: 0.88, ctaStyle: 'filled',
    spacingMode: 'balanced',
    contrast: 'high', saturation: 'rich',
    lightingDesc: 'dramatic side lighting, volumetric light rays, cinematic lens flare, golden hour warm tones',
    cameraFeel: 'anamorphic widescreen, shallow depth of field, bokeh background',
    imagePromptSuffix: 'cinematic color grading, film still aesthetic, golden ratio composition, anamorphic bokeh, dramatic atmosphere',
  },
  LUXURY: {
    gradientAlpha: 0.72, gradientCoverage: 42, overlayAlpha: 0.04, textShadow: false, accentOpacity: 0.88,
    vignette: false, vignetteIntensity: 0, atmosphericHaze: false, grainIntensity: 0, glowIntensity: 0.0,
    headlineCase: 'title', headlineOpacity: 1.0, sublineOpacity: 0.80, ctaStyle: 'outline',
    spacingMode: 'generous',
    contrast: 'medium', saturation: 'muted',
    lightingDesc: 'soft premium studio lighting, subtle gradient, no harsh shadows, even illumination',
    cameraFeel: 'medium format camera, creamy bokeh, precise focus',
    imagePromptSuffix: 'high-end commercial photography, editorial quality, generous negative space, minimal and elegant, luxury lifestyle aesthetic',
  },
  SPORT: {
    gradientAlpha: 0.95, gradientCoverage: 58, overlayAlpha: 0.18, textShadow: true, accentOpacity: 1.0,
    vignette: true, vignetteIntensity: 0.60, atmosphericHaze: true, grainIntensity: 0.07, glowIntensity: 0.55,
    headlineCase: 'upper', headlineOpacity: 1.0, sublineOpacity: 0.90, ctaStyle: 'filled',
    spacingMode: 'compact',
    contrast: 'ultra', saturation: 'vivid',
    lightingDesc: 'dramatic warm rim lighting from behind, high contrast, energy and motion',
    cameraFeel: 'action camera, dynamic low angle, freeze frame power',
    imagePromptSuffix: 'sports photography, dynamic power energy, athletic intensity, sweat and motion, high contrast cinematic',
  },
  TECH: {
    gradientAlpha: 0.88, gradientCoverage: 55, overlayAlpha: 0.10, textShadow: false, accentOpacity: 0.95,
    vignette: false, vignetteIntensity: 0, atmosphericHaze: false, grainIntensity: 0, glowIntensity: 0.45,
    headlineCase: 'upper', headlineOpacity: 1.0, sublineOpacity: 0.82, ctaStyle: 'filled',
    spacingMode: 'balanced',
    contrast: 'high', saturation: 'muted',
    lightingDesc: 'cool blue-cyan rim light, ambient LED glow, clean reflective surfaces, futuristic ambiance',
    cameraFeel: 'precise product photography, clean background, sharp edges',
    imagePromptSuffix: 'futuristic tech aesthetic, clean precise lines, glass and chrome reflections, blue-teal color palette, innovation',
  },
  MINIMAL: {
    gradientAlpha: 0.68, gradientCoverage: 38, overlayAlpha: 0.0, textShadow: false, accentOpacity: 0.85,
    vignette: false, vignetteIntensity: 0, atmosphericHaze: false, grainIntensity: 0, glowIntensity: 0.0,
    headlineCase: 'title', headlineOpacity: 1.0, sublineOpacity: 0.75, ctaStyle: 'filled',
    spacingMode: 'generous',
    contrast: 'low', saturation: 'muted',
    lightingDesc: 'natural even lighting, soft shadows, clean bright background',
    cameraFeel: 'clean composition, generous breathing space, minimalist framing',
    imagePromptSuffix: 'minimalist commercial photography, clean background, breathing space, refined simplicity',
  },
  NEON: {
    gradientAlpha: 0.92, gradientCoverage: 62, overlayAlpha: 0.22, textShadow: true, accentOpacity: 1.0,
    vignette: true, vignetteIntensity: 0.65, atmosphericHaze: true, grainIntensity: 0.12, glowIntensity: 0.80,
    headlineCase: 'upper', headlineOpacity: 1.0, sublineOpacity: 0.85, ctaStyle: 'filled',
    spacingMode: 'compact',
    contrast: 'ultra', saturation: 'vivid',
    lightingDesc: 'vibrant neon light, electric colors, night atmosphere, light trails and halos',
    cameraFeel: 'night photography, long exposure feel, neon reflections on wet surfaces',
    imagePromptSuffix: 'neon noir aesthetic, vibrant night lights, cyberpunk atmosphere, electric colors, dark moody background',
  },
  CORPORATE: {
    gradientAlpha: 0.80, gradientCoverage: 48, overlayAlpha: 0.08, textShadow: false, accentOpacity: 0.90,
    vignette: false, vignetteIntensity: 0, atmosphericHaze: false, grainIntensity: 0, glowIntensity: 0.0,
    headlineCase: 'title', headlineOpacity: 1.0, sublineOpacity: 0.80, ctaStyle: 'filled',
    spacingMode: 'balanced',
    contrast: 'medium', saturation: 'natural',
    lightingDesc: 'professional clean lighting, no harsh shadows, trustworthy brightness',
    cameraFeel: 'professional business photography, clean and polished',
    imagePromptSuffix: 'professional corporate photography, trustworthy and clean, polished business aesthetic',
  },
  EDITORIAL: {
    gradientAlpha: 0.76, gradientCoverage: 44, overlayAlpha: 0.06, textShadow: false, accentOpacity: 0.85,
    vignette: false, vignetteIntensity: 0, atmosphericHaze: false, grainIntensity: 0.05, glowIntensity: 0.08,
    headlineCase: 'title', headlineOpacity: 1.0, sublineOpacity: 0.78, ctaStyle: 'outline',
    spacingMode: 'breathing',
    contrast: 'medium', saturation: 'rich',
    lightingDesc: 'fashion editorial lighting, dramatic yet controlled, beauty light',
    cameraFeel: 'medium format editorial, sophisticated composition, magazine quality',
    imagePromptSuffix: 'editorial fashion photography, magazine quality, sophisticated and refined, art direction',
  },
  STREET: {
    gradientAlpha: 0.88, gradientCoverage: 56, overlayAlpha: 0.18, textShadow: true, accentOpacity: 0.95,
    vignette: true, vignetteIntensity: 0.45, atmosphericHaze: false, grainIntensity: 0.15, glowIntensity: 0.0,
    headlineCase: 'upper', headlineOpacity: 1.0, sublineOpacity: 0.85, ctaStyle: 'filled',
    spacingMode: 'compact',
    contrast: 'high', saturation: 'rich',
    lightingDesc: 'harsh urban natural light, high contrast street shadows, raw energy',
    cameraFeel: 'street photography style, reportage, authentic documentary feel',
    imagePromptSuffix: 'urban street photography, raw authentic energy, gritty atmosphere, documentary style, real people',
  },
}

// ════════════════════════════════════════════════════════════════════
// COMPOSITION RULES ENGINE — Regras espaciais por layout
// ════════════════════════════════════════════════════════════════════

export interface CompositionRules {
  subjectXZone: [number, number]   // posição horizontal do sujeito (0-1)
  textXZone: [number, number]      // zona horizontal do texto (0-1)
  textYZone: [number, number]      // zona vertical do texto (0-1, 0=topo)
  negativeSpaceTarget: number      // % desejada de espaço sem texto ou sujeito
  allowSubjectBleed: boolean       // sujeito pode ultrapassar borda inferior
  gradientZone: 'bottom' | 'left' | 'right' | 'dual-pole' | 'full'
  primaryFocusElement: 'SUBJECT' | 'HEADLINE'
  textCollisionBuffer: number      // px buffer entre sujeito e texto
  cameraInstruction: string        // instrução de composição para o prompt
  depthHint: string               // instrução de profundidade para o prompt
}

export const LAYOUT_RULES: Record<Layout, CompositionRules> = {
  HERO_RIGHT: {
    subjectXZone: [0.50, 1.00], textXZone: [0, 0.55], textYZone: [0.52, 1.0],
    negativeSpaceTarget: 0.30, allowSubjectBleed: true, gradientZone: 'bottom',
    primaryFocusElement: 'SUBJECT', textCollisionBuffer: 40,
    cameraInstruction: 'Subject positioned on the right half of frame, facing slightly left toward center. Bottom-left quadrant clear and dark for text overlay.',
    depthHint: 'Subject sharp in foreground, background slightly blurred with depth of field.',
  },
  HERO_LEFT: {
    subjectXZone: [0, 0.50], textXZone: [0.45, 1.0], textYZone: [0.52, 1.0],
    negativeSpaceTarget: 0.30, allowSubjectBleed: true, gradientZone: 'bottom',
    primaryFocusElement: 'SUBJECT', textCollisionBuffer: 40,
    cameraInstruction: 'Subject positioned on the left half of frame, facing slightly right. Bottom-right quadrant clear for text overlay.',
    depthHint: 'Subject sharp, background gently blurred.',
  },
  CENTER_STACK: {
    subjectXZone: [0.25, 0.75], textXZone: [0.10, 0.90], textYZone: [0.55, 1.0],
    negativeSpaceTarget: 0.35, allowSubjectBleed: false, gradientZone: 'bottom',
    primaryFocusElement: 'SUBJECT', textCollisionBuffer: 30,
    cameraInstruction: 'Subject centered in frame. Clear dark space at bottom 40% for text. Symmetrical composition.',
    depthHint: 'Centered composition, subject isolated against background with soft depth.',
  },
  POSTER: {
    subjectXZone: [0.10, 0.90], textXZone: [0.05, 0.95], textYZone: [0.48, 1.0],
    negativeSpaceTarget: 0.20, allowSubjectBleed: false, gradientZone: 'full',
    primaryFocusElement: 'HEADLINE', textCollisionBuffer: 50,
    cameraInstruction: 'Full bleed dramatic composition. Bottom 50% must have strong dark gradient for large text. Subject in upper half.',
    depthHint: 'Maximum visual impact. Strong contrast between subject and dark lower area.',
  },
  FOCUS_CENTER: {
    subjectXZone: [0.20, 0.80], textXZone: [0.05, 0.95], textYZone: [0, 0.22],
    negativeSpaceTarget: 0.30, allowSubjectBleed: false, gradientZone: 'dual-pole',
    primaryFocusElement: 'SUBJECT', textCollisionBuffer: 60,
    cameraInstruction: 'Subject large and centered. Top 15% and bottom 15% slightly darker for text strips. Product/person dominates center.',
    depthHint: 'Subject is primary focus. Background provides context without competing.',
  },
  SPLIT_SCREEN: {
    subjectXZone: [0.45, 1.00], textXZone: [0, 0.48], textYZone: [0.20, 0.85],
    negativeSpaceTarget: 0.35, allowSubjectBleed: false, gradientZone: 'left',
    primaryFocusElement: 'HEADLINE', textCollisionBuffer: 50,
    cameraInstruction: 'Subject positioned on the right 55% of frame. Left side slightly darker or blurred.',
    depthHint: 'Clear visual separation between text side and subject side.',
  },
  DIAGONAL_FLOW: {
    subjectXZone: [0.40, 1.00], textXZone: [0, 0.70], textYZone: [0.50, 0.90],
    negativeSpaceTarget: 0.25, allowSubjectBleed: true, gradientZone: 'full',
    primaryFocusElement: 'SUBJECT', textCollisionBuffer: 35,
    cameraInstruction: 'Dynamic diagonal composition. Subject upper-right. Lower-left diagonal area darker for text strip. Energy and movement.',
    depthHint: 'Diagonal visual flow from upper-right subject to lower-left text. Motion energy.',
  },
  ASYMMETRIC: {
    subjectXZone: [0.35, 1.00], textXZone: [0, 0.55], textYZone: [0.55, 0.95],
    negativeSpaceTarget: 0.30, allowSubjectBleed: true, gradientZone: 'bottom',
    primaryFocusElement: 'SUBJECT', textCollisionBuffer: 40,
    cameraInstruction: 'Off-center asymmetric composition. Subject slightly right of center. Bottom-left quadrant clear for text block.',
    depthHint: 'Tension between subject and empty space creates visual interest.',
  },
}

// ════════════════════════════════════════════════════════════════════
// SUBJECT PRIORITY ENGINE — Perfil de sujeito por nicho
// ════════════════════════════════════════════════════════════════════

export interface SubjectProfile {
  category: 'PERSON' | 'PRODUCT' | 'VEHICLE' | 'SCENE' | 'ABSTRACT'
  pose: string
  expression: string
  lighting: string
  cameraAngle: string
  backgroundTreatment: string
  energyLevel: 'calm' | 'moderate' | 'high' | 'extreme'
  forbiddenElements: string
}

export const NICHE_SUBJECT_PROFILES: Record<string, SubjectProfile> = {
  academia: {
    category: 'PERSON',
    pose: 'powerful athletic stance, muscles engaged, mid-action pose or strong determined position',
    expression: 'intense focus, determination, empowerment, confidence',
    lighting: 'dramatic warm rim light from behind, high contrast, skin glistening with effort',
    cameraAngle: 'slightly low angle hero shot, close-medium framing, dynamic perspective',
    backgroundTreatment: 'dark gym environment, bokeh equipment, atmospheric depth',
    energyLevel: 'extreme',
    forbiddenElements: 'casual or relaxed poses, soft flat lighting, generic stock photo feel',
  },
  concessionaria: {
    category: 'VEHICLE',
    pose: 'hero angle — 3/4 front view or dramatic low angle, showing full vehicle profile',
    expression: 'power, elegance and performance communicated through vehicle design',
    lighting: 'cinematic warm-golden or cool premium studio light, chrome reflections, dramatic shadows',
    cameraAngle: 'low angle looking up, wide angle to emphasize size and power',
    backgroundTreatment: 'dark studio or dramatic outdoor scene, atmospheric depth, subtle smoke or dust',
    energyLevel: 'high',
    forbiddenElements: 'flat side view, boring lot background, generic dealership photo',
  },
  offroad: {
    category: 'VEHICLE',
    pose: 'vehicle in action — climbing, dusty, or in dramatic terrain, showing capability',
    expression: 'raw power, adventure, freedom',
    lighting: 'golden hour or dramatic overcast, dust particles in light, harsh natural light',
    cameraAngle: 'dynamic low angle, motion capture feel',
    backgroundTreatment: 'dramatic landscape, mountain or mud terrain, dust and motion',
    energyLevel: 'extreme',
    forbiddenElements: 'clean showroom, paved roads, static poses',
  },
  luxo: {
    category: 'PRODUCT',
    pose: 'product elegantly isolated or in aspirational lifestyle context',
    expression: 'exclusivity, desire, refinement',
    lighting: 'soft premium studio lighting, subtle reflections, no harsh shadows',
    cameraAngle: 'medium close-up, slightly elevated, product as hero',
    backgroundTreatment: 'clean minimalist, subtle texture, negative space',
    energyLevel: 'calm',
    forbiddenElements: 'busy background, harsh lighting, generic placement, cluttered scene',
  },
  alimentacao: {
    category: 'PRODUCT',
    pose: 'food styled beautifully, ingredients visible, appetite appeal',
    expression: 'freshness, quality, deliciousness',
    lighting: 'warm natural light, food photography styling, beautiful shadows',
    cameraAngle: '45 degree overhead or eye level, close detail shots',
    backgroundTreatment: 'clean wooden or marble surface, complementary props',
    energyLevel: 'moderate',
    forbiddenElements: 'unappetizing angles, harsh flash, dirty surfaces',
  },
  moda: {
    category: 'PERSON',
    pose: 'editorial fashion pose, confident and stylized',
    expression: 'confidence, style, aspiration',
    lighting: 'fashion editorial lighting, controlled and dramatic',
    cameraAngle: 'full body or medium, editorial framing',
    backgroundTreatment: 'minimal clean or urban contextual background',
    energyLevel: 'high',
    forbiddenElements: 'generic poses, flat lighting, amateur composition',
  },
  tech: {
    category: 'PRODUCT',
    pose: 'device or interface shown clearly, possibly in use context',
    expression: 'innovation, precision, future',
    lighting: 'clean studio or blue-teal ambient, screen glow if applicable',
    cameraAngle: 'precise clean angle showing product clearly',
    backgroundTreatment: 'dark or clean background with subtle tech elements',
    energyLevel: 'moderate',
    forbiddenElements: 'busy backgrounds, amateur setup, cheap feel',
  },
  infantil: {
    category: 'PERSON',
    pose: 'happy child in safe playful context, genuine joy',
    expression: 'pure joy, safety, happiness',
    lighting: 'bright natural warm light, safe and friendly',
    cameraAngle: 'child eye level, welcoming perspective',
    backgroundTreatment: 'colorful safe environment, bright and clean',
    energyLevel: 'high',
    forbiddenElements: 'any adult content, dark atmosphere, unsafe settings',
  },
  politica: {
    category: 'PERSON',
    pose: 'confident leadership pose, approachable yet authoritative',
    expression: 'trustworthy, confident, representing the people',
    lighting: 'professional clean lighting, honest and direct',
    cameraAngle: 'eye level or slightly below, respectful perspective',
    backgroundTreatment: 'Brazilian flag, crowd, government context',
    energyLevel: 'moderate',
    forbiddenElements: 'informal poses, bad lighting, ambiguous expression',
  },
  servicos: {
    category: 'PERSON',
    pose: 'professional in work context, showing expertise and service',
    expression: 'professional, trustworthy, capable, friendly',
    lighting: 'clean professional lighting, bright and honest',
    cameraAngle: 'medium shot, professional and approachable',
    backgroundTreatment: 'relevant work environment, clean office or service setting',
    energyLevel: 'moderate',
    forbiddenElements: 'overly posed stock photo feel, generic corporate clichés',
  },
}

// ════════════════════════════════════════════════════════════════════
// NICHE DEFAULTS — Decisão padrão por nicho
// ════════════════════════════════════════════════════════════════════

export const NICHE_DEFAULTS: Record<string, Partial<CreativeDecision>> = {
  academia:       { layout: 'HERO_RIGHT',    style: 'SPORT',     effects: ['GLOW'],        typography: 'BOLD_IMPACT', depth: 'HIGH'   },
  luxo:           { layout: 'CENTER_STACK',  style: 'LUXURY',    effects: ['LIGHT_LEAK'],  typography: 'ELEGANT',    depth: 'LOW'    },
  tech:           { layout: 'ASYMMETRIC',    style: 'TECH',      effects: ['GRAIN'],       typography: 'CONDENSED',  depth: 'MEDIUM' },
  alimentacao:    { layout: 'FOCUS_CENTER',  style: 'MINIMAL',   effects: [],              typography: 'STACKED',    depth: 'LOW'    },
  infantil:       { layout: 'POSTER',        style: 'MINIMAL',   effects: [],              typography: 'BOLD_IMPACT', depth: 'LOW'   },
  politica:       { layout: 'POSTER',        style: 'CORPORATE', effects: [],              typography: 'BOLD_IMPACT', depth: 'MEDIUM' },
  moda:           { layout: 'ASYMMETRIC',    style: 'EDITORIAL', effects: ['GRAIN'],       typography: 'ELEGANT',    depth: 'MEDIUM' },
  offroad:        { layout: 'DIAGONAL_FLOW', style: 'CINEMATIC', effects: ['GRAIN'],       typography: 'CONDENSED',  depth: 'HIGH'   },
  concessionaria: { layout: 'HERO_RIGHT',    style: 'CINEMATIC', effects: ['LIGHT_LEAK'],  typography: 'BOLD_IMPACT', depth: 'HIGH'  },
  servicos:       { layout: 'SPLIT_SCREEN',  style: 'CORPORATE', effects: [],              typography: 'STACKED',    depth: 'MEDIUM' },
}

// ════════════════════════════════════════════════════════════════════
// VISUAL COHERENCE SCORER — Validação e auto-correção da decisão
// ════════════════════════════════════════════════════════════════════

// Pares incompatíveis → penalidade + correção aplicada à decisão
interface CoherenceRule {
  condition: (d: CreativeDecision) => boolean
  penalty: number
  reason: string
  apply: (d: CreativeDecision) => Partial<CreativeDecision>
}

const INCOHERENCE_RULES: CoherenceRule[] = [
  {
    condition: d => d.style === 'LUXURY' && d.typography === 'BOLD_IMPACT',
    penalty: 25, reason: 'LUXURY requer tipografia refinada',
    apply: () => ({ typography: 'ELEGANT' as TypographyBehavior }),
  },
  {
    condition: d => d.style === 'LUXURY' && d.layout === 'DIAGONAL_FLOW',
    penalty: 20, reason: 'LUXURY não combina com layout dinâmico/diagonal',
    apply: () => ({ layout: 'CENTER_STACK' as Layout }),
  },
  {
    condition: d => d.style === 'LUXURY' && d.effects.includes('GLOW'),
    penalty: 15, reason: 'LUXURY não usa efeito GLOW excessivo',
    apply: d => ({ effects: d.effects.filter(e => e !== 'GLOW') }),
  },
  {
    condition: d => d.style === 'MINIMAL' && d.effects.length > 1,
    penalty: 20, reason: 'MINIMAL deve ter poucos ou nenhum efeito',
    apply: () => ({ effects: [] as Effect[] }),
  },
  {
    condition: d => d.style === 'CORPORATE' && (['NEON', 'GLOW'] as Effect[]).some(e => d.effects.includes(e)),
    penalty: 20, reason: 'CORPORATE não usa efeitos chamativos',
    apply: () => ({ effects: [] as Effect[] }),
  },
  {
    condition: d => d.style === 'SPORT' && d.typography === 'ELEGANT',
    penalty: 18, reason: 'SPORT requer tipografia de impacto',
    apply: () => ({ typography: 'BOLD_IMPACT' as TypographyBehavior }),
  },
  {
    condition: d => d.style === 'EDITORIAL' && d.typography === 'BOLD_IMPACT',
    penalty: 15, reason: 'EDITORIAL prefere tipografia refinada',
    apply: () => ({ typography: 'ELEGANT' as TypographyBehavior }),
  },
  {
    condition: d => d.effects.length > 2,
    penalty: 15, reason: 'Máximo de 2 efeitos por arte',
    apply: d => ({ effects: d.effects.slice(0, 2) }),
  },
  {
    condition: d => d.layout === 'POSTER' && d.typography === 'FLOATING',
    penalty: 12, reason: 'POSTER não combina com FLOATING',
    apply: () => ({ typography: 'BOLD_IMPACT' as TypographyBehavior }),
  },
]

export function scoreCreativeDecision(decision: CreativeDecision): {
  score: number
  corrections: Partial<CreativeDecision>
  reasons: string[]
} {
  let score = 100
  let corrections: Partial<CreativeDecision> = {}
  const reasons: string[] = []

  for (const rule of INCOHERENCE_RULES) {
    if (rule.condition(decision)) {
      score -= rule.penalty
      reasons.push(rule.reason)
      corrections = { ...corrections, ...rule.apply({ ...decision, ...corrections } as CreativeDecision) }
    }
  }

  return { score: Math.max(0, score), corrections, reasons }
}

export function applyDecisionCorrections(decision: CreativeDecision): CreativeDecision {
  const { corrections } = scoreCreativeDecision(decision)
  return { ...decision, ...corrections }
}

// ════════════════════════════════════════════════════════════════════
// IMAGE PROMPT ENHANCEMENT — Direção fotográfica rica
// ════════════════════════════════════════════════════════════════════

export function buildImagePromptEnhancement(
  decision: CreativeDecision,
  niche: string,
): string {
  const tokens = STYLE_TOKENS[decision.style] ?? STYLE_TOKENS.CINEMATIC
  const rules  = LAYOUT_RULES[decision.layout] ?? LAYOUT_RULES.HERO_RIGHT
  const profile = NICHE_SUBJECT_PROFILES[niche]

  const parts: string[] = []

  // Contribution 1: Style tokens
  parts.push(tokens.imagePromptSuffix)

  // Contribution 2: Composition rules
  parts.push(rules.cameraInstruction)
  parts.push(rules.depthHint)

  // Contribution 3: Subject profile (se existir)
  if (profile) {
    parts.push(`Lighting: ${profile.lighting}`)
    parts.push(`Camera: ${profile.cameraAngle}`)
    if (decision.asset_strategy === 'PERSON_FOCUSED' || profile.category === 'PERSON') {
      parts.push(`Pose: ${profile.pose}`)
      parts.push(`Expression: ${profile.expression}`)
    }
    parts.push(`Background: ${profile.backgroundTreatment}`)
    if (profile.forbiddenElements) {
      parts.push(`Avoid: ${profile.forbiddenElements}`)
    }
  }

  // Contribution 4: Depth tokens
  if (tokens.atmosphericHaze) parts.push('atmospheric depth haze, background separation from foreground')
  if (tokens.vignette) parts.push('natural cinematic vignette on edges')

  return parts.filter(Boolean).join('. ')
}

// ════════════════════════════════════════════════════════════════════
// TYPOGRAPHY BEHAVIOR — Multiplicadores e comportamento
// ════════════════════════════════════════════════════════════════════

interface TypoProps {
  headlineScale: number
  sublineScale: number
  letterSpacing: number
  lineHeightScale: number
  maxSublineLines: number
  floatBg: boolean
}

const TYPO_PROPS: Record<TypographyBehavior, TypoProps> = {
  BOLD_IMPACT: { headlineScale: 1.25, sublineScale: 0.45, letterSpacing: -2, lineHeightScale: 0.95, maxSublineLines: 2, floatBg: false },
  ELEGANT:     { headlineScale: 0.90, sublineScale: 0.55, letterSpacing:  2, lineHeightScale: 1.20, maxSublineLines: 3, floatBg: false },
  CONDENSED:   { headlineScale: 1.10, sublineScale: 0.48, letterSpacing: -3, lineHeightScale: 0.90, maxSublineLines: 2, floatBg: false },
  STACKED:     { headlineScale: 1.00, sublineScale: 0.52, letterSpacing:  0, lineHeightScale: 1.10, maxSublineLines: 3, floatBg: false },
  FLOATING:    { headlineScale: 1.00, sublineScale: 0.52, letterSpacing:  0, lineHeightScale: 1.10, maxSublineLines: 3, floatBg: true  },
}

// ════════════════════════════════════════════════════════════════════
// SVG BUILDING — Render visual modular com camadas
// ════════════════════════════════════════════════════════════════════

function wrapText(text: string, maxWidth: number, fontSize: number, charWidth = 0.58, maxLines = 0): string[] {
  const charsPerLine = Math.floor(maxWidth / (fontSize * charWidth))
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > charsPerLine && current) {
      lines.push(current)
      if (maxLines > 0 && lines.length >= maxLines) return lines
      current = word
    } else {
      current = next
    }
  }
  if (current && (maxLines === 0 || lines.length < maxLines)) lines.push(current)
  return lines
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function applyCase(text: string, headlineCase: 'upper' | 'title'): string {
  if (headlineCase === 'upper') return text.toUpperCase()
  return text.replace(/\b\w/g, c => c.toUpperCase())
}

// ── Layer 0: SVG Defs (gradients, filters) ────────────────────────
function buildDefs(
  layout: Layout,
  tokens: StyleTokens,
  effects: Effect[],
  palette: Record<string, string>,
  W: number, H: number,
  gradientStart: number,
): string {
  const alpha = tokens.gradientAlpha

  let gradientDef: string
  if (layout === 'SPLIT_SCREEN') {
    gradientDef = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(0,0,0,${alpha})"/>
      <stop offset="48%" stop-color="rgba(0,0,0,${(alpha * 0.7).toFixed(2)})"/>
      <stop offset="100%" stop-color="transparent"/>
    </linearGradient>`
  } else if (layout === 'FOCUS_CENTER') {
    gradientDef = `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,${(alpha * 0.65).toFixed(2)})"/>
      <stop offset="22%" stop-color="transparent"/>
      <stop offset="70%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(0,0,0,${alpha})"/>
    </linearGradient>`
  } else {
    gradientDef = `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="${gradientStart}%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(0,0,0,${alpha})"/>
    </linearGradient>`
  }

  const defs: string[] = [gradientDef]

  // Vignette (CINEMATIC, SPORT, NEON, STREET)
  if (tokens.vignette && tokens.vignetteIntensity > 0) {
    defs.push(`<radialGradient id="vignette" cx="50%" cy="50%" r="70%" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(0,0,0,${tokens.vignetteIntensity.toFixed(2)})"/>
    </radialGradient>`)
  }

  // Atmospheric haze (névoa colorida de profundidade)
  if (tokens.atmosphericHaze) {
    const hazeColor = palette.gradient_from ?? palette.background ?? '#000000'
    defs.push(`<radialGradient id="haze" cx="50%" cy="0%" r="80%" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="${hazeColor}" stop-opacity="0.0"/>
      <stop offset="100%" stop-color="${hazeColor}" stop-opacity="0.18"/>
    </radialGradient>`)
  }

  // GLOW filter
  if (effects.includes('GLOW') || tokens.glowIntensity > 0) {
    const spread = Math.round(3 + tokens.glowIntensity * 5)
    defs.push(`<filter id="glow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="${spread}" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`)
  }

  // GRAIN filter
  if (effects.includes('GRAIN') || tokens.grainIntensity > 0) {
    defs.push(`<filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" stitchTiles="stitch" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay"/>
    </filter>`)
  }

  // LIGHT_LEAK
  if (effects.includes('LIGHT_LEAK')) {
    defs.push(`<radialGradient id="lightleak" cx="88%" cy="8%" r="48%">
      <stop offset="0%" stop-color="rgba(255,200,80,0.32)"/>
      <stop offset="55%" stop-color="rgba(255,120,40,0.14)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>`)
  }

  // Accent gradient para decoração (SPORT, NEON)
  if (['SPORT', 'NEON'].includes('')) { /* placeholder */ }
  const accent = palette.accent ?? '#fe7902'
  defs.push(`<linearGradient id="accentFade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${accent}" stop-opacity="0.9"/>
    <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
  </linearGradient>`)

  return `<defs>\n${defs.join('\n')}\n</defs>`
}

// ── Layers 1-6: Background, gradients, effects ────────────────────
function buildBackgroundLayers(
  layout: Layout,
  style: VisualStyle,
  tokens: StyleTokens,
  effects: Effect[],
  palette: Record<string, string>,
  W: number, H: number,
): string {
  const layers: string[] = []

  // Layer 2: gradiente principal de escurecimento
  layers.push(`<rect width="${W}" height="${H}" fill="url(#g)"/>`)

  // Layer 2b: overlay de cor sólida sutil (profundidade)
  if (tokens.overlayAlpha > 0) {
    const overlayColor = palette.gradient_from ?? palette.background ?? '#000000'
    layers.push(`<rect width="${W}" height="${H}" fill="${overlayColor}" opacity="${tokens.overlayAlpha}"/>`)
  }

  // Layer 3: Vignette (cantos escuros, profundidade cinematográfica)
  if (tokens.vignette) {
    layers.push(`<rect width="${W}" height="${H}" fill="url(#vignette)"/>`)
  }

  // Layer 3b: Atmospheric haze (névoa de profundidade)
  if (tokens.atmosphericHaze) {
    layers.push(`<rect width="${W}" height="${H}" fill="url(#haze)"/>`)
  }

  // Layer 4: Light Leak
  if (effects.includes('LIGHT_LEAK')) {
    layers.push(`<rect width="${W}" height="${H}" fill="url(#lightleak)"/>`)
  }

  // Layer 6: Grain texture overlay
  const grainIntensity = effects.includes('GRAIN') ? 0.10 : tokens.grainIntensity
  if (grainIntensity > 0) {
    layers.push(`<rect width="${W}" height="${H}" fill="white" filter="url(#grain)" opacity="${grainIntensity.toFixed(2)}"/>`)
  }

  // Layout-specific geometric elements
  if (layout === 'SPLIT_SCREEN') {
    const panelColor = palette.background ?? palette.gradient_from ?? '#111111'
    const accent = palette.accent ?? '#fe7902'
    layers.push(
      `<rect x="0" y="0" width="${Math.round(W * 0.48)}" height="${H}" fill="${panelColor}" opacity="0.88"/>`,
      `<rect x="${Math.round(W * 0.48)}" y="${Math.round(H * 0.10)}" width="3" height="${Math.round(H * 0.80)}" fill="${accent}" opacity="0.75"/>`,
    )
  }

  if (layout === 'DIAGONAL_FLOW') {
    const accent = palette.accent ?? '#fe7902'
    const stripY = Math.round(H * 0.52)
    const stripH = Math.round(H * 0.42)
    const cx = W / 2
    const cy = stripY + stripH / 2
    layers.push(
      `<rect x="-${Math.round(W * 0.15)}" y="${stripY}" width="${Math.round(W * 1.35)}" height="${stripH}" fill="rgba(0,0,0,0.84)" transform="rotate(-7,${cx},${cy})"/>`,
      `<rect x="-${Math.round(W * 0.15)}" y="${stripY}" width="${Math.round(W * 1.35)}" height="4" fill="${accent}" opacity="0.90" transform="rotate(-7,${cx},${cy})"/>`,
    )
  }

  // Accent line decorativa (SPORT, NEON, CINEMATIC)
  if (['SPORT', 'NEON', 'CINEMATIC'].includes(style)) {
    const safeH = Math.round(W * 0.07)
    const lineY = Math.round(H * 0.575)
    layers.push(`<rect x="${safeH}" y="${lineY}" width="${Math.round(W * 0.32)}" height="3" fill="url(#accentFade)"/>`)
  }

  return layers.join('\n')
}

// ── Layer 7-8: Text block com hierarquia visual ───────────────────
interface TextBlockOptions {
  layout: Layout
  tokens: StyleTokens
  typo: TypographyBehavior
  copy: { headline: string; subline: string; cta: string }
  palette: Record<string, string>
  fontFamily: string
  W: number
  H: number
  safeH: number
  safeTop: number
  safeBot: number
  glowEnabled: boolean
}

export function buildTextBlock(opts: TextBlockOptions): string {
  const { layout, tokens, typo, copy, palette, fontFamily, W, H, safeH, safeTop, safeBot, glowEnabled } = opts
  const tp = TYPO_PROPS[typo] ?? TYPO_PROPS.STACKED

  const base = Math.min(W, H)
  const isVertical = H / W >= 1.4
  const isSquare = Math.abs(H / W - 1) < 0.15

  const baseHeadlinePx = Math.round(base / (isVertical ? 14 : isSquare ? 14 : 16))
  const headlinePx = Math.round(baseHeadlinePx * tp.headlineScale)
  const sublinePx  = Math.round(baseHeadlinePx * tp.sublineScale)
  const ctaPx      = Math.round(baseHeadlinePx * 0.36)
  const GAP        = Math.round(safeH * 0.40)

  const accent   = palette.accent ?? palette.cta_bg ?? '#fe7902'
  const ctaColor = palette.cta_text ?? '#ffffff'

  const isCentered = ['CENTER_STACK', 'POSTER'].includes(layout)
  const isRight    = layout === 'HERO_LEFT'
  const isSplit    = layout === 'SPLIT_SCREEN'
  const isDiagonal = layout === 'DIAGONAL_FLOW'
  const isFocusTop = layout === 'FOCUS_CENTER'

  const textAnchor = isCentered ? 'middle' : isRight ? 'end' : 'start'
  const maxTextW   = isSplit ? Math.round(W * 0.42) : W - safeH * 2
  const textX      = isCentered ? Math.round(W / 2)
                   : isRight    ? W - safeH
                   : isSplit    ? Math.round(W * 0.44)
                   : safeH

  const headlineText = applyCase(copy.headline, tokens.headlineCase)
  const headlineLines = wrapText(headlineText, maxTextW, headlinePx, isCentered ? 0.55 : 0.58, layout === 'POSTER' ? 2 : 3)
  const sublineLines  = wrapText(copy.subline,  maxTextW, sublinePx, 0.58, tp.maxSublineLines)

  const headLineH   = Math.round(headlinePx * tp.lineHeightScale * 1.05)
  const subLineH    = Math.round(sublinePx  * tp.lineHeightScale * 1.30)
  const ctaPadV     = Math.round(ctaPx * 0.65)
  const ctaPadH     = Math.round(ctaPx * 1.5)
  const ctaBoxH     = Math.round(ctaPx + ctaPadV * 2)
  const ctaBorderR  = Math.round(ctaPx * 0.4)

  const textBlockH =
    headlineLines.length * headLineH + GAP
    + (sublineLines.length > 0 ? sublineLines.length * subLineH + Math.round(GAP * 1.5) : 0)
    + ctaBoxH

  let startY: number
  if (isFocusTop) {
    startY = safeTop + Math.round(H * 0.02)
  } else if (isDiagonal) {
    startY = Math.round(H * 0.56)
  } else {
    startY = H - safeBot - textBlockH
    const minY = safeTop + Math.round(H * 0.22)
    if (startY < minY) startY = minY
  }

  const parts: string[] = []

  // FLOATING: fundo semi-transparente (Hierarquia: fundo < texto)
  if (tp.floatBg) {
    const bgPad = Math.round(safeH * 0.5)
    const bgX = textX - (isCentered ? Math.round(maxTextW / 2) + bgPad : bgPad)
    parts.push(
      `<rect x="${bgX}" y="${startY - bgPad}" width="${maxTextW + bgPad * 2}" height="${textBlockH + bgPad * 2}" ` +
      `rx="10" ry="10" fill="rgba(0,0,0,0.58)"/>`
    )
  }

  let y = startY

  // ── Visual Hierarchy: PRIMARY (headline) ────────────────────────
  const glowAttr   = glowEnabled ? ` filter="url(#glow)"` : ''
  const shadowStyle = tokens.textShadow
    ? ` style="filter:drop-shadow(2px 3px 5px rgba(0,0,0,0.9))"`
    : ''

  for (const line of headlineLines) {
    parts.push(
      `<text x="${textX}" y="${y + Math.round(headlinePx * 0.82)}"` +
      ` font-family="${fontFamily}" font-size="${headlinePx}" font-weight="900"` +
      ` fill="rgba(255,255,255,${tokens.headlineOpacity})" letter-spacing="${tp.letterSpacing}"` +
      ` text-anchor="${textAnchor}"${glowAttr}${shadowStyle}>${esc(line)}</text>`
    )
    y += headLineH
  }
  y += GAP

  // ── Visual Hierarchy: SECONDARY (subline) ───────────────────────
  for (const line of sublineLines) {
    parts.push(
      `<text x="${textX}" y="${y + Math.round(sublinePx * 0.82)}"` +
      ` font-family="${fontFamily}" font-size="${sublinePx}" font-weight="400"` +
      ` fill="rgba(255,255,255,${tokens.sublineOpacity})" text-anchor="${textAnchor}">${esc(line)}</text>`
    )
    y += subLineH
  }
  if (sublineLines.length > 0) y += Math.round(GAP * 1.5)

  // ── Visual Hierarchy: TERTIARY (CTA) ────────────────────────────
  const ctaTextW  = Math.round(copy.cta.length * ctaPx * 0.52)
  const ctaBoxW   = ctaTextW + ctaPadH * 2
  const ctaRectX  = isCentered ? Math.round(W / 2) - Math.round(ctaBoxW / 2)
                  : isRight    ? W - safeH - ctaBoxW
                  : safeH
  const ctaY      = isFocusTop ? H - safeBot - ctaBoxH : y

  if (tokens.ctaStyle === 'outline') {
    // CTA estilo outline (LUXURY, EDITORIAL)
    parts.push(
      `<rect x="${ctaRectX}" y="${ctaY}" width="${ctaBoxW}" height="${ctaBoxH}"` +
      ` rx="${ctaBorderR}" ry="${ctaBorderR}" fill="transparent" stroke="${accent}" stroke-width="2"/>`,
      `<text x="${ctaRectX + Math.round(ctaBoxW / 2)}" y="${ctaY + Math.round(ctaBoxH * 0.67)}"` +
      ` font-family="${fontFamily}" font-size="${ctaPx}" font-weight="600"` +
      ` fill="${accent}" text-anchor="middle" letter-spacing="2">${esc(copy.cta.toUpperCase())}</text>`
    )
  } else {
    // CTA estilo filled (padrão)
    parts.push(
      `<rect x="${ctaRectX}" y="${ctaY}" width="${ctaBoxW}" height="${ctaBoxH}"` +
      ` rx="${ctaBorderR}" ry="${ctaBorderR}" fill="${accent}"/>`,
      `<text x="${ctaRectX + Math.round(ctaBoxW / 2)}" y="${ctaY + Math.round(ctaBoxH * 0.67)}"` +
      ` font-family="${fontFamily}" font-size="${ctaPx}" font-weight="700"` +
      ` fill="${ctaColor}" text-anchor="middle" letter-spacing="1">${esc(copy.cta.toUpperCase())}</text>`
    )
  }

  return parts.join('\n')
}

// ── Safe area clip ────────────────────────────────────────────────
function buildClipPath(W: number, H: number, safeH: number, safeTop: number, safeBot: number): string {
  return `<clipPath id="safeArea">
    <rect x="${safeH}" y="${safeTop}" width="${W - safeH * 2}" height="${H - safeTop - safeBot}"/>
  </clipPath>`
}

// ── Main SVG builder ──────────────────────────────────────────────
export function buildCompositeSVG(opts: {
  decision: CreativeDecision
  copy: { headline: string; subline: string; cta: string }
  palette: Record<string, string>
  W: number
  H: number
  fontFaceStyle: string
  fontFamily: string
}): string {
  const { decision, copy, palette, W, H, fontFaceStyle, fontFamily } = opts
  const { layout, style, effects, typography } = decision
  const tokens = STYLE_TOKENS[style] ?? STYLE_TOKENS.CINEMATIC

  // Safe area — Instagram/TikTok: 7% lados, 10% topo/base
  const safeH   = Math.round(W * 0.07)
  const safeTop = Math.round(H * 0.10)
  const safeBot = Math.round(H * 0.10)

  const gradientStart = Math.max(0, 100 - tokens.gradientCoverage)

  const defs      = buildDefs(layout, tokens, effects, palette, W, H, gradientStart)
  const clipDef   = buildClipPath(W, H, safeH, safeTop, safeBot)
  const bgLayers  = buildBackgroundLayers(layout, style, tokens, effects, palette, W, H)
  const textBlock = buildTextBlock({
    layout, tokens, typo: typography,
    copy, palette, fontFamily,
    W, H, safeH, safeTop, safeBot,
    glowEnabled: effects.includes('GLOW') || tokens.glowIntensity > 0.4,
  })

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
${fontFaceStyle}
${defs}
<defs>${clipDef}</defs>
${bgLayers}
<g clip-path="url(#safeArea)">
${textBlock}
</g>
</svg>`
}

// ── Layout image hint (para o prompt de imagem) ───────────────────
export function layoutImageHint(layout: Layout): string {
  return LAYOUT_RULES[layout]?.cameraInstruction ?? ''
}
