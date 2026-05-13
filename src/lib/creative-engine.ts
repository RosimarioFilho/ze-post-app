// ── Creative Engine — Design System Visual Modular ──────────────
// Separa decisões de layout/estilo/efeito/tipografia da geração de imagem.
// O pipeline chama um agente IA que retorna CreativeDecision e este módulo
// converte essa decisão em SVG concreto para composição com sharp.

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
  | 'CINEMATIC'   // alto contraste, overlay escuro, atmosfera dramática
  | 'LUXURY'      // overlay suave, tipografia refinada, minimalismo
  | 'SPORT'       // gradientes fortes, energia, contraste máximo
  | 'TECH'        // linhas limpas, overlay tech, cores frias
  | 'MINIMAL'     // overlay leve, muito espaço, clean
  | 'NEON'        // cores vibrantes, brilho, night vibes
  | 'CORPORATE'   // sóbrio, confiança, profissional
  | 'EDITORIAL'   // composição revista, sofisticado
  | 'STREET'      // raw, urbano, textura

export type Effect = 'EMBERS' | 'DUST' | 'LIGHT_LEAK' | 'GLOW' | 'GRAIN' | 'SMOKE'

export type TypographyBehavior =
  | 'BOLD_IMPACT'  // headline enorme, máximo impacto
  | 'ELEGANT'      // espaçamento generoso, refinado
  | 'CONDENSED'    // compacto e direto, tight spacing
  | 'STACKED'      // hierarquia clara em múltiplas linhas
  | 'FLOATING'     // fundo semi-transparente atrás do texto

export interface CreativeDecision {
  layout: Layout
  style: VisualStyle
  effects: Effect[]
  typography: TypographyBehavior
  composition: string
  asset_strategy: 'PERSON_FOCUSED' | 'PRODUCT_HERO' | 'SCENE_DRIVEN' | 'ABSTRACT'
  mood: string
  depth: 'LOW' | 'MEDIUM' | 'HIGH'
  image_direction: string  // instrução direta para o prompt de imagem
}

// ── Defaults por nicho ────────────────────────────────────────────
export const NICHE_DEFAULTS: Record<string, Partial<CreativeDecision>> = {
  academia:     { layout: 'HERO_RIGHT', style: 'SPORT',     effects: ['GLOW'],       typography: 'BOLD_IMPACT', depth: 'HIGH' },
  luxo:         { layout: 'CENTER_STACK', style: 'LUXURY',  effects: ['LIGHT_LEAK'], typography: 'ELEGANT',    depth: 'LOW'  },
  tech:         { layout: 'ASYMMETRIC',   style: 'TECH',    effects: ['GRAIN'],      typography: 'CONDENSED',  depth: 'MEDIUM' },
  alimentacao:  { layout: 'FOCUS_CENTER', style: 'MINIMAL', effects: [],             typography: 'STACKED',    depth: 'LOW'  },
  infantil:     { layout: 'POSTER',       style: 'MINIMAL', effects: [],             typography: 'BOLD_IMPACT', depth: 'LOW' },
  politica:     { layout: 'POSTER',       style: 'CORPORATE', effects: [],           typography: 'BOLD_IMPACT', depth: 'MEDIUM' },
  moda:         { layout: 'ASYMMETRIC',   style: 'EDITORIAL', effects: ['GRAIN'],    typography: 'ELEGANT',    depth: 'MEDIUM' },
  offroad:      { layout: 'DIAGONAL_FLOW', style: 'CINEMATIC', effects: ['GRAIN'],   typography: 'CONDENSED',  depth: 'HIGH' },
  concessionaria: { layout: 'HERO_RIGHT', style: 'CINEMATIC', effects: ['LIGHT_LEAK'], typography: 'BOLD_IMPACT', depth: 'HIGH' },
  servicos:     { layout: 'SPLIT_SCREEN', style: 'CORPORATE', effects: [],           typography: 'STACKED',    depth: 'MEDIUM' },
}

// ── Propriedades visuais por estilo ────────────────────────────────
interface StyleProps {
  gradientAlpha: number   // opacidade máxima do gradiente
  gradientCoverage: number // % de cobertura do gradiente (0-100)
  overlayAlpha: number    // opacidade do overlay de cor sólida
  textShadow: boolean
  accentOpacity: number
}

const STYLE_PROPS: Record<VisualStyle, StyleProps> = {
  CINEMATIC:  { gradientAlpha: 0.92, gradientCoverage: 60, overlayAlpha: 0.15, textShadow: true,  accentOpacity: 1.0 },
  LUXURY:     { gradientAlpha: 0.75, gradientCoverage: 45, overlayAlpha: 0.05, textShadow: false, accentOpacity: 0.9 },
  SPORT:      { gradientAlpha: 0.95, gradientCoverage: 55, overlayAlpha: 0.20, textShadow: true,  accentOpacity: 1.0 },
  TECH:       { gradientAlpha: 0.88, gradientCoverage: 55, overlayAlpha: 0.12, textShadow: false, accentOpacity: 0.95 },
  MINIMAL:    { gradientAlpha: 0.70, gradientCoverage: 40, overlayAlpha: 0.0,  textShadow: false, accentOpacity: 0.85 },
  NEON:       { gradientAlpha: 0.90, gradientCoverage: 60, overlayAlpha: 0.25, textShadow: true,  accentOpacity: 1.0 },
  CORPORATE:  { gradientAlpha: 0.82, gradientCoverage: 50, overlayAlpha: 0.10, textShadow: false, accentOpacity: 0.9 },
  EDITORIAL:  { gradientAlpha: 0.78, gradientCoverage: 45, overlayAlpha: 0.08, textShadow: false, accentOpacity: 0.85 },
  STREET:     { gradientAlpha: 0.88, gradientCoverage: 55, overlayAlpha: 0.20, textShadow: true,  accentOpacity: 0.95 },
}

// ── Multiplicadores de tipografia ─────────────────────────────────
interface TypoProps {
  headlineScale: number  // multiplicador do headlinePx base
  sublineScale: number
  letterSpacing: number  // em pixels, negativo = condensado
  lineHeightScale: number
  maxSublineLines: number
  floatBg: boolean       // fundo semi-transparente atrás do bloco
}

const TYPO_PROPS: Record<TypographyBehavior, TypoProps> = {
  BOLD_IMPACT: { headlineScale: 1.25, sublineScale: 0.45, letterSpacing: -2, lineHeightScale: 0.95, maxSublineLines: 2, floatBg: false },
  ELEGANT:     { headlineScale: 0.90, sublineScale: 0.55, letterSpacing:  2, lineHeightScale: 1.20, maxSublineLines: 3, floatBg: false },
  CONDENSED:   { headlineScale: 1.10, sublineScale: 0.48, letterSpacing: -3, lineHeightScale: 0.90, maxSublineLines: 2, floatBg: false },
  STACKED:     { headlineScale: 1.00, sublineScale: 0.52, letterSpacing:  0, lineHeightScale: 1.10, maxSublineLines: 3, floatBg: false },
  FLOATING:    { headlineScale: 1.00, sublineScale: 0.52, letterSpacing:  0, lineHeightScale: 1.10, maxSublineLines: 3, floatBg: true  },
}

// ── wrapText ──────────────────────────────────────────────────────
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

// ── SVG Defs: gradients e filters por layout/style/effects ─────────
function buildDefs(
  layout: Layout,
  style: VisualStyle,
  effects: Effect[],
  palette: Record<string, string>,
  W: number, H: number,
  gradientStart: number,  // % onde o gradiente começa a aparecer
): string {
  const sp = STYLE_PROPS[style] ?? STYLE_PROPS.CINEMATIC
  const alpha = sp.gradientAlpha

  // Gradiente principal varia por layout
  let gradientDef: string
  if (layout === 'SPLIT_SCREEN') {
    gradientDef = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(0,0,0,${alpha})"/>
      <stop offset="48%" stop-color="rgba(0,0,0,${(alpha * 0.7).toFixed(2)})"/>
      <stop offset="100%" stop-color="transparent"/>
    </linearGradient>`
  } else if (layout === 'FOCUS_CENTER') {
    // Gradiente duplo: topo + base, deixa centro limpo
    gradientDef = `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,${(alpha * 0.65).toFixed(2)})"/>
      <stop offset="22%" stop-color="transparent"/>
      <stop offset="70%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(0,0,0,${alpha})"/>
    </linearGradient>`
  } else if (layout === 'HERO_LEFT') {
    gradientDef = `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="${gradientStart}%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(0,0,0,${alpha})"/>
    </linearGradient>`
  } else {
    gradientDef = `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="${gradientStart}%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(0,0,0,${alpha})"/>
    </linearGradient>`
  }

  const filters: string[] = []

  if (effects.includes('GLOW')) {
    filters.push(`<filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`)
  }

  if (effects.includes('GRAIN')) {
    filters.push(`<filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.70" numOctaves="3" stitchTiles="stitch" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay"/>
    </filter>`)
  }

  if (effects.includes('LIGHT_LEAK')) {
    // Vazamento de luz quente no canto superior direito
    filters.push(`<radialGradient id="lightleak" cx="88%" cy="8%" r="45%">
      <stop offset="0%" stop-color="rgba(255,200,80,0.30)"/>
      <stop offset="55%" stop-color="rgba(255,120,40,0.12)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>`)
  }

  // Gradiente de accent para decoração (SPORT, NEON)
  if (['SPORT', 'NEON'].includes(style)) {
    const accent = palette.accent ?? '#fe7902'
    filters.push(`<linearGradient id="accentLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>`)
  }

  return `<defs>
  ${gradientDef}
  ${filters.join('\n  ')}
</defs>`
}

// ── Camadas de fundo/efeito (Layer 1-3, 6) ────────────────────────
function buildBackgroundLayers(
  layout: Layout,
  style: VisualStyle,
  effects: Effect[],
  palette: Record<string, string>,
  W: number, H: number,
): string {
  const layers: string[] = []
  const sp = STYLE_PROPS[style] ?? STYLE_PROPS.CINEMATIC

  // Layer 2: gradiente principal
  layers.push(`<rect width="${W}" height="${H}" fill="url(#g)"/>`)

  // Layer 2b: overlay de cor sólida sutil para estilo
  if (sp.overlayAlpha > 0) {
    const overlayColor = palette.gradient_from ?? palette.background ?? '#000000'
    layers.push(`<rect width="${W}" height="${H}" fill="${overlayColor}" opacity="${sp.overlayAlpha}"/>`)
  }

  // Layer 3: Light Leak
  if (effects.includes('LIGHT_LEAK')) {
    layers.push(`<rect width="${W}" height="${H}" fill="url(#lightleak)"/>`)
  }

  // Layer 6: Grain texture overlay
  if (effects.includes('GRAIN')) {
    layers.push(`<rect width="${W}" height="${H}" fill="white" filter="url(#grain)" opacity="0.08"/>`)
  }

  // Layout-specific geometric elements
  if (layout === 'SPLIT_SCREEN') {
    // Painel sólido na metade esquerda
    const panelColor = palette.background ?? palette.gradient_from ?? '#111111'
    layers.push(`<rect x="0" y="0" width="${Math.round(W * 0.48)}" height="${H}" fill="${panelColor}" opacity="0.88"/>`)
    // Linha vertical decorativa
    const accent = palette.accent ?? '#fe7902'
    layers.push(`<rect x="${Math.round(W * 0.48)}" y="${Math.round(H * 0.1)}" width="3" height="${Math.round(H * 0.8)}" fill="${accent}" opacity="0.7"/>`)
  }

  if (layout === 'DIAGONAL_FLOW') {
    // Faixa diagonal como elemento visual
    const accent = palette.accent ?? '#fe7902'
    const stripY = Math.round(H * 0.52)
    const stripH = Math.round(H * 0.42)
    layers.push(
      `<rect x="-${Math.round(W * 0.15)}" y="${stripY}" ` +
      `width="${Math.round(W * 1.35)}" height="${stripH}" ` +
      `fill="rgba(0,0,0,0.82)" transform="rotate(-7,${W / 2},${stripY + stripH / 2})"/>`,
      // Borda colorida na faixa
      `<rect x="-${Math.round(W * 0.15)}" y="${stripY}" ` +
      `width="${Math.round(W * 1.35)}" height="4" ` +
      `fill="${accent}" opacity="0.9" transform="rotate(-7,${W / 2},${stripY + stripH / 2})"/>`
    )
  }

  // Linha decorativa para SPORT/NEON
  if (['SPORT', 'NEON'].includes(style)) {
    const safeH = Math.round(W * 0.07)
    const lineY = Math.round(H * 0.58)
    layers.push(`<rect x="${safeH}" y="${lineY}" width="${Math.round(W * 0.35)}" height="3" fill="url(#accentLine)"/>`)
  }

  return layers.join('\n')
}

// ── Bloco de texto (Layer 7-8) por layout/tipografia ─────────────
interface TextBlockOptions {
  layout: Layout
  style: VisualStyle
  typo: TypographyBehavior
  copy: { headline: string; subline: string; cta: string }
  palette: Record<string, string>
  fontFamily: string
  W: number
  H: number
  safeH: number     // padding horizontal safe area
  safeTop: number   // padding topo
  safeBot: number   // padding base
  glowEnabled: boolean
}

export function buildTextBlock(opts: TextBlockOptions): string {
  const { layout, style, typo, copy, palette, fontFamily, W, H, safeH, safeTop, safeBot, glowEnabled } = opts
  const tp = TYPO_PROPS[typo] ?? TYPO_PROPS.STACKED
  const sp = STYLE_PROPS[style] ?? STYLE_PROPS.CINEMATIC

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

  // Área de texto varia por layout
  const isRight = layout === 'HERO_LEFT'
  const isCentered = ['CENTER_STACK', 'POSTER'].includes(layout)
  const isSplit = layout === 'SPLIT_SCREEN'
  const isDiagonal = layout === 'DIAGONAL_FLOW'
  const isFocusTop = layout === 'FOCUS_CENTER'

  const textAnchor  = isCentered ? 'middle' : isRight ? 'end' : 'start'
  const maxTextW    = isSplit ? Math.round(W * 0.42) : W - safeH * 2
  const textX       = isCentered ? Math.round(W / 2)
                    : isRight    ? W - safeH
                    : isSplit    ? Math.round(W * 0.44)
                    : safeH

  const headlineLines = wrapText(
    copy.headline.toUpperCase(),
    maxTextW, headlinePx,
    isCentered ? 0.55 : 0.58,
    layout === 'POSTER' ? 2 : 3,
  )
  const sublineLines = wrapText(
    copy.subline,
    maxTextW, sublinePx,
    0.58,
    tp.maxSublineLines,
  )

  const headLineH = Math.round(headlinePx * tp.lineHeightScale * 1.05)
  const subLineH  = Math.round(sublinePx  * tp.lineHeightScale * 1.30)
  const ctaPadV   = Math.round(ctaPx * 0.65)
  const ctaPadH   = Math.round(ctaPx * 1.5)
  const ctaBoxH   = Math.round(ctaPx + ctaPadV * 2)
  const ctaBorderR = Math.round(ctaPx * 0.4)

  const textBlockH =
    headlineLines.length * headLineH
    + GAP
    + (sublineLines.length > 0 ? sublineLines.length * subLineH + Math.round(GAP * 1.5) : 0)
    + ctaBoxH

  // Posição Y inicial do bloco de texto
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

  // FLOATING: fundo semi-transparente atrás do bloco
  if (tp.floatBg) {
    const bgPad = Math.round(safeH * 0.5)
    const bgX = textX - (isCentered ? Math.round(maxTextW / 2) + bgPad : bgPad)
    const bgW = maxTextW + bgPad * 2
    parts.push(
      `<rect x="${bgX}" y="${startY - bgPad}" width="${bgW}" height="${textBlockH + bgPad * 2}" ` +
      `rx="8" ry="8" fill="rgba(0,0,0,0.55)"/>`
    )
  }

  let y = startY
  const glowAttr = glowEnabled ? ` filter="url(#glow)"` : ''
  const shadowAttr = sp.textShadow
    ? ` style="filter:drop-shadow(2px 2px 4px rgba(0,0,0,0.8))"`
    : ''

  // Headline
  for (const line of headlineLines) {
    parts.push(
      `<text x="${textX}" y="${y + Math.round(headlinePx * 0.82)}"` +
      ` font-family="${fontFamily}" font-size="${headlinePx}" font-weight="900"` +
      ` fill="white" letter-spacing="${tp.letterSpacing}" text-anchor="${textAnchor}"${glowAttr}${shadowAttr}>${esc(line)}</text>`
    )
    y += headLineH
  }
  y += GAP

  // Subline
  for (const line of sublineLines) {
    parts.push(
      `<text x="${textX}" y="${y + Math.round(sublinePx * 0.82)}"` +
      ` font-family="${fontFamily}" font-size="${sublinePx}"` +
      ` fill="rgba(255,255,255,0.90)" text-anchor="${textAnchor}"${shadowAttr}>${esc(line)}</text>`
    )
    y += subLineH
  }
  if (sublineLines.length > 0) y += Math.round(GAP * 1.5)

  // CTA
  const ctaTextW   = Math.round(copy.cta.length * ctaPx * 0.52)
  const ctaBoxW    = ctaTextW + ctaPadH * 2
  const ctaRectX   = isCentered ? Math.round(W / 2) - Math.round(ctaBoxW / 2)
                   : isRight    ? W - safeH - ctaBoxW
                   : isSplit    ? safeH
                   : safeH

  // Para FOCUS_CENTER: CTA vai para o rodapé, independente do headline
  const ctaY = isFocusTop ? H - safeBot - ctaBoxH : y

  parts.push(
    `<rect x="${ctaRectX}" y="${ctaY}" width="${ctaBoxW}" height="${ctaBoxH}"` +
    ` rx="${ctaBorderR}" ry="${ctaBorderR}" fill="${accent}"/>`,
    `<text x="${ctaRectX + Math.round(ctaBoxW / 2)}" y="${ctaY + Math.round(ctaBoxH * 0.67)}"` +
    ` font-family="${fontFamily}" font-size="${ctaPx}" font-weight="700"` +
    ` fill="${ctaColor}" text-anchor="middle" letter-spacing="1">${esc(copy.cta.toUpperCase())}</text>`
  )

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
  const sp = STYLE_PROPS[style] ?? STYLE_PROPS.CINEMATIC

  // Safe area
  const safeH   = Math.round(W * 0.07)
  const safeTop = Math.round(H * 0.10)
  const safeBot = Math.round(H * 0.10)

  // Calcular gradientStart com base no coverage do estilo
  const coverageFrom = 100 - sp.gradientCoverage
  const gradientStart = Math.max(0, coverageFrom)

  const defs = buildDefs(layout, style, effects, palette, W, H, gradientStart)
  const clipPathDef = buildClipPath(W, H, safeH, safeTop, safeBot)
  const bgLayers = buildBackgroundLayers(layout, style, effects, palette, W, H)
  const textBlock = buildTextBlock({
    layout, style, typo: typography,
    copy, palette, fontFamily,
    W, H, safeH, safeTop, safeBot,
    glowEnabled: effects.includes('GLOW'),
  })

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
${fontFaceStyle}
${defs}
<defs>${clipPathDef}</defs>
${bgLayers}
<g clip-path="url(#safeArea)">
${textBlock}
</g>
</svg>`
}

// ── Image direction por layout (para o prompt de imagem) ──────────
export function layoutImageHint(layout: Layout): string {
  const hints: Record<Layout, string> = {
    HERO_RIGHT:     'Subject positioned on the right third. Left side and bottom third are clear for text overlay.',
    HERO_LEFT:      'Subject positioned on the left third. Right side and bottom third are clear for text overlay.',
    CENTER_STACK:   'Subject centered. Bottom 40% clear and dark for text overlay.',
    POSTER:         'Full bleed dramatic composition. Bottom 50% must have dark area for large text overlay.',
    FOCUS_CENTER:   'Subject prominently centered in frame. Top 20% and bottom 20% slightly darker for text.',
    SPLIT_SCREEN:   'Subject on the right half, slightly offset right. Left half can be darker.',
    DIAGONAL_FLOW:  'Dynamic diagonal composition. Subject upper-right, lower-left area darker for text strip.',
    ASYMMETRIC:     'Asymmetric composition. Subject off-center. Bottom-left area dark for text block.',
  }
  return hints[layout] ?? ''
}
