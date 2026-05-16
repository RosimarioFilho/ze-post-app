// ── Text Overlay Engine ───────────────────────────────────────────────
// Responsável por renderizar headline, subheadline e CTA SOBRE a imagem
// gerada — separando o texto da geração de imagem para garantia 100%.
//
// Dois modos:
//   1. getTextOverlayPreviewStyles() → CSS inline para preview no browser
//   2. drawTextOnCanvas()            → Canvas 2D para export em alta resolução

import type { SocialFormatId } from './social-formats'
import { SOCIAL_FORMATS }      from './social-formats'
import type { ZePremiumStyle } from './ze-premium-prompt-builder'

// ── Tipos ─────────────────────────────────────────────────────────────

export interface CopyData {
  headline:    string
  subheadline: string | null
  cta:         string | null
}

export interface TextOverlayPreviewStyles {
  container: React.CSSProperties
  headline:  React.CSSProperties
  subline:   React.CSSProperties
  cta:       React.CSSProperties
}

// ── Paleta por estilo ─────────────────────────────────────────────────

interface StyleTokens {
  fontFamily:    string
  headlineWeight: number
  isUppercase:   boolean
  letterSpacing: string
}

function getStyleTokens(style: ZePremiumStyle): StyleTokens {
  switch (style) {
    case 'luxury':
    case 'black_luxury':
      return { fontFamily: "Georgia, 'Times New Roman', serif", headlineWeight: 400, isUppercase: false, letterSpacing: '0.06em' }
    case 'minimal':
      return { fontFamily: "system-ui, -apple-system, sans-serif",  headlineWeight: 300, isUppercase: false, letterSpacing: '0.10em' }
    case 'aggressive_ads':
      return { fontFamily: "system-ui, -apple-system, sans-serif",  headlineWeight: 900, isUppercase: true,  letterSpacing: '-0.01em' }
    default:
      return { fontFamily: "system-ui, -apple-system, sans-serif",  headlineWeight: 800, isUppercase: true,  letterSpacing: '-0.01em' }
  }
}

// ── 1. CSS PREVIEW STYLES ─────────────────────────────────────────────
// Usado no preview do browser — posicionamento relativo ao container da imagem

export function getTextOverlayPreviewStyles(
  formatId: SocialFormatId,
  style:    ZePremiumStyle,
): TextOverlayPreviewStyles {
  const format  = SOCIAL_FORMATS[formatId]
  const tokens  = getStyleTokens(style)
  const safe    = format.safeArea

  const isVertical = format.genH > format.genW
  const isWide     = format.genW > format.genH

  const textShadow = '0 2px 20px rgba(0,0,0,0.95), 0 1px 6px rgba(0,0,0,0.7)'

  const headlineBase: React.CSSProperties = {
    fontFamily:    tokens.fontFamily,
    fontWeight:    tokens.headlineWeight,
    color:         '#ffffff',
    textShadow,
    lineHeight:    1.08,
    marginBottom:  '0.3em',
    textTransform: tokens.isUppercase ? 'uppercase' : 'none',
    letterSpacing: tokens.letterSpacing,
    overflowWrap:  'break-word',
    wordBreak:     'break-word',
  }

  const sublineBase: React.CSSProperties = {
    fontFamily:   tokens.fontFamily,
    fontWeight:   400,
    color:        'rgba(255,255,255,0.85)',
    textShadow:   '0 1px 10px rgba(0,0,0,0.8)',
    lineHeight:   1.4,
    marginBottom: '0.6em',
    letterSpacing: '0.01em',
    overflowWrap: 'break-word',
    wordBreak:    'break-word',
  }

  const ctaBase: React.CSSProperties = {
    fontFamily:    tokens.fontFamily,
    fontWeight:    700,
    background:    'rgba(0,0,0,0.55)',
    color:         '#ffffff',
    borderRadius:  '999px',
    border:        '1px solid rgba(255,255,255,0.35)',
    display:       'inline-block',
    letterSpacing: '0.04em',
    textShadow:    'none',
    overflowWrap:  'break-word',
    wordBreak:     'break-word',
  }

  // ── Vertical 9:16 ────────────────────────────────────────────────
  if (isVertical) {
    const sidePct  = `${safe.left + 3}%`
    const botPct   = `${safe.bottom + 5}%`
    return {
      container: {
        position:      'absolute',
        inset:         0,
        display:       'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding:       `0 ${sidePct} ${botPct} ${sidePct}`,
        pointerEvents: 'none',
      },
      headline: { ...headlineBase, fontSize: 'clamp(1.4rem, 7.5cqw, 2.6rem)' },
      subline:  { ...sublineBase,  fontSize: 'clamp(0.8rem, 3.2cqw, 1.1rem)' },
      cta:      { ...ctaBase,      fontSize: 'clamp(0.7rem, 2.8cqw, 0.95rem)', padding: '0.45em 1.3em' },
    }
  }

  // ── Wide 16:9 / 1.91:1 ───────────────────────────────────────────
  if (isWide) {
    const sidePct = `${safe.left + 2}%`
    const botPct  = `${safe.bottom + 4}%`
    return {
      container: {
        position:       'absolute',
        inset:          0,
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'flex-end',
        alignItems:     'flex-start',
        padding:        `${safe.top}% 52% ${botPct} ${sidePct}`,
        pointerEvents:  'none',
      },
      headline: { ...headlineBase, fontSize: 'clamp(1rem, 4.5cqw, 1.9rem)' },
      subline:  { ...sublineBase,  fontSize: 'clamp(0.7rem, 2cqw, 0.9rem)' },
      cta:      { ...ctaBase,      fontSize: 'clamp(0.65rem, 1.8cqw, 0.82rem)', padding: '0.4em 1.1em' },
    }
  }

  // ── Square 1:1 ───────────────────────────────────────────────────
  const sidePct = `${safe.left + 2}%`
  const botPct  = `${safe.bottom + 4}%`
  return {
    container: {
      position:       'absolute',
      inset:          0,
      display:        'flex',
      flexDirection:  'column',
      justifyContent: 'flex-end',
      alignItems:     'flex-start',
      padding:        `${safe.top}% 52% ${botPct} ${sidePct}`,
      pointerEvents:  'none',
    },
    headline: { ...headlineBase, fontSize: 'clamp(1.1rem, 5cqw, 2rem)' },
    subline:  { ...sublineBase,  fontSize: 'clamp(0.75rem, 2.5cqw, 1rem)' },
    cta:      { ...ctaBase,      fontSize: 'clamp(0.68rem, 2cqw, 0.88rem)', padding: '0.42em 1.2em' },
  }
}

// ── 2. CANVAS 2D DRAW — Export em alta resolução ─────────────────────
// Usa a Canvas 2D API nativa para renderizar o texto sobre a imagem real
// (sem html2canvas, sem dependências extras).

function wrapText(
  ctx:      CanvasRenderingContext2D,
  text:     string,
  maxWidth: number,
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

export function drawTextOnCanvas(
  ctx:      CanvasRenderingContext2D,
  w:        number,
  h:        number,
  formatId: SocialFormatId,
  style:    ZePremiumStyle,
  copy:     CopyData,
): void {
  const format     = SOCIAL_FORMATS[formatId]
  const tokens     = getStyleTokens(style)
  const safe       = format.safeArea
  const isVertical = h > w
  const isWide     = w > h

  // Margens em pixels (baseadas na safe area do formato)
  const sidePx   = Math.round(w * (safe.left   + 3) / 100)
  const botPx    = Math.round(h * ((isVertical ? safe.bottom + 5 : safe.bottom + 4)) / 100)
  const maxWidth = isWide || !isVertical
    ? Math.round(w * 0.44)   // reserva metade direita para o produto
    : w - sidePx * 2

  // Tamanhos de fonte relativos à largura da imagem
  const hSize  = Math.round(isVertical ? w * 0.082 : w * 0.055)
  const sSize  = Math.round(hSize * 0.48)
  const cSize  = Math.round(hSize * 0.42)

  // Configurações de sombra para legibilidade
  ctx.save()
  ctx.shadowColor  = 'rgba(0,0,0,0.95)'
  ctx.shadowBlur   = Math.round(hSize * 0.5)
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = Math.round(hSize * 0.05)

  // ── Posição base: começar pelo Y de baixo para cima ────────────────
  let y = h - botPx

  // ── CTA (mais baixo) ───────────────────────────────────────────────
  if (copy.cta) {
    ctx.font      = `700 ${cSize}px ${tokens.fontFamily}`
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.shadowBlur = Math.round(cSize * 0.4)
    ctx.fillText(copy.cta, sidePx, y)
    y -= Math.round(cSize * 1.9)
  }

  // ── Subheadline ────────────────────────────────────────────────────
  if (copy.subheadline) {
    ctx.font      = `400 ${sSize}px ${tokens.fontFamily}`
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.shadowBlur = Math.round(sSize * 0.5)
    const sLines = wrapText(ctx, copy.subheadline, maxWidth)
    for (let i = sLines.length - 1; i >= 0; i--) {
      ctx.fillText(sLines[i], sidePx, y)
      y -= Math.round(sSize * 1.5)
    }
    y -= Math.round(sSize * 0.3)
  }

  // ── Headline ───────────────────────────────────────────────────────
  const headText = tokens.isUppercase ? copy.headline.toUpperCase() : copy.headline
  ctx.font       = `${tokens.headlineWeight} ${hSize}px ${tokens.fontFamily}`
  ctx.fillStyle  = '#ffffff'
  ctx.shadowBlur = Math.round(hSize * 0.6)
  const hLines   = wrapText(ctx, headText, maxWidth)
  for (let i = hLines.length - 1; i >= 0; i--) {
    ctx.fillText(hLines[i], sidePx, y)
    y -= Math.round(hSize * 1.12)
  }

  ctx.restore()
}
