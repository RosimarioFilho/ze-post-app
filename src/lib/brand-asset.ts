// ── Brand Asset Intelligence Engine ─────────────────────────────────
// Detecção automática de fundo, remoção e integração visual de logomarcas.
// O usuário NÃO precisa editar ou preparar assets — o sistema faz tudo.

import { createHash } from 'crypto'

// ════════════════════════════════════════════════════════════════════
// TIPOS
// ════════════════════════════════════════════════════════════════════

export type LogoBgType = 'transparent' | 'white' | 'black' | 'solid_color' | 'complex'
export type LogoMode   = 'FLOATING' | 'GLASS' | 'MINIMAL' | 'BADGE'

export interface LogoAnalysis {
  bgType: LogoBgType
  needsRemoval: boolean
  dominantBg: { r: number; g: number; b: number } | null
}

export interface PreparedLogo {
  buffer: Buffer
  analysis: LogoAnalysis
  mode: LogoMode
}

export type SharpLayer = { input: Buffer; top: number; left: number; blend: 'over' }

// ════════════════════════════════════════════════════════════════════
// BACKGROUND DETECTION — Amostragem de cantos para detectar fundo
// ════════════════════════════════════════════════════════════════════

function colorDist(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b)
}

async function sampleCorner(
  buffer: Buffer,
  left: number,
  top: number,
  size: number,
): Promise<{ r: number; g: number; b: number }> {
  try {
    const { default: sharp } = await import('sharp')
    const { data } = await sharp(buffer)
      .extract({ left: Math.max(0, left), top: Math.max(0, top), width: size, height: size })
      .flatten({ background: '#ffffff' })
      .resize(1, 1, { kernel: 'lanczos3' })
      .raw()
      .toBuffer({ resolveWithObject: true })
    return { r: (data as Buffer)[0], g: (data as Buffer)[1], b: (data as Buffer)[2] }
  } catch {
    return { r: 128, g: 128, b: 128 }
  }
}

export async function analyzeLogoBg(buffer: Buffer): Promise<LogoAnalysis> {
  const { default: sharp } = await import('sharp')
  const meta = await sharp(buffer).metadata()
  const w = meta.width  ?? 100
  const h = meta.height ?? 100

  // 1. Verifica se já possui transparência real (alpha < 128 em > 10% dos pixels)
  if (meta.hasAlpha) {
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const d = data as Buffer
    let transparentCount = 0
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] < 128) transparentCount++
    }
    if (transparentCount / (info.width * info.height) > 0.10) {
      return { bgType: 'transparent', needsRemoval: false, dominantBg: null }
    }
  }

  // 2. Amostra os 4 cantos (8% do menor lado, min 4px, max 20px)
  const s = Math.max(4, Math.min(20, Math.floor(Math.min(w, h) * 0.08)))
  const [tl, tr, bl, br] = await Promise.all([
    sampleCorner(buffer, 0,         0,         s),
    sampleCorner(buffer, w - s,     0,         s),
    sampleCorner(buffer, 0,         h - s,     s),
    sampleCorner(buffer, w - s,     h - s,     s),
  ])
  const corners = [tl, tr, bl, br]

  const WHITE = { r: 255, g: 255, b: 255 }
  const BLACK = { r: 0,   g: 0,   b: 0   }

  if (corners.every(c => colorDist(c, WHITE) < 30)) {
    return { bgType: 'white', needsRemoval: true, dominantBg: WHITE }
  }
  if (corners.every(c => colorDist(c, BLACK) < 25)) {
    return { bgType: 'black', needsRemoval: true, dominantBg: BLACK }
  }
  // Fundo sólido de outra cor (todos os cantos parecidos)
  if (corners.every(c => colorDist(c, tl) < 45)) {
    return { bgType: 'solid_color', needsRemoval: true, dominantBg: tl }
  }

  return { bgType: 'complex', needsRemoval: false, dominantBg: null }
}

// ════════════════════════════════════════════════════════════════════
// BACKGROUND REMOVAL — Local (sólidos) e via remove.bg API
// ════════════════════════════════════════════════════════════════════

// Remoção local pixel-a-pixel para fundos sólidos (sem API)
export async function removeSimpleBg(
  buffer: Buffer,
  bgColor: { r: number; g: number; b: number },
  tolerance = 28,
): Promise<Buffer> {
  const { default: sharp } = await import('sharp')
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const d = Buffer.from(data as Buffer)
  const { r: br, g: bg, b: bb } = bgColor

  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb)
    if (dist < tolerance * 3) {
      // Soft alpha falloff nas bordas para evitar serrilhado
      const alpha = dist < tolerance
        ? 0
        : Math.round(((dist - tolerance) / (tolerance * 2)) * 255)
      d[i + 3] = Math.min(d[i + 3], alpha)
    }
  }

  return sharp(d, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer()
}

// Remoção via remove.bg API (melhor qualidade para logos complexas)
export async function removeViaRemoveBg(
  buffer: Buffer,
  apiKey: string,
): Promise<Buffer | null> {
  try {
    const form = new FormData()
    const logoBlob = new Blob([new Uint8Array(buffer)], { type: 'image/png' })
    form.append('image_file', logoBlob, 'logo.png')
    form.append('size', 'auto')

    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form as BodyInit,
    })

    if (!res.ok) {
      console.warn('[brand-asset] remove.bg status:', res.status)
      return null
    }
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    console.warn('[brand-asset] remove.bg erro:', err)
    return null
  }
}

// ════════════════════════════════════════════════════════════════════
// CACHE — Supabase Storage (evita re-processar a mesma logo)
// ════════════════════════════════════════════════════════════════════

function logoHash(url: string): string {
  return createHash('md5').update(url).digest('hex').slice(0, 16)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCachedProcessedLogo(
  originalUrl: string,
  supabase: any,
  companyId: string,
): Promise<Buffer | null> {
  try {
    const path = `${companyId}/logos/processed/${logoHash(originalUrl)}.png`
    const { data } = await supabase.storage.from('media').download(path)
    if (!data) return null
    return Buffer.from(await (data as Blob).arrayBuffer())
  } catch {
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cacheProcessedLogo(
  buffer: Buffer,
  originalUrl: string,
  supabase: any,
  companyId: string,
): Promise<void> {
  try {
    const path = `${companyId}/logos/processed/${logoHash(originalUrl)}.png`
    await supabase.storage.from('media').upload(path, buffer, {
      contentType: 'image/png',
      upsert: true,
    })
  } catch (err) {
    console.warn('[brand-asset] cache logo falhou:', err)
  }
}

// ════════════════════════════════════════════════════════════════════
// LOGO MODE SELECTOR — Escolhe integração baseado no estilo criativo
// ════════════════════════════════════════════════════════════════════

export function chooseLogoMode(
  analysis: LogoAnalysis,
  style: string,
  emotionalDensity: string | undefined,
): LogoMode {
  // Fundo complexo não removido → BADGE como fallback seguro (pill escura)
  if (analysis.bgType === 'complex') return 'BADGE'

  // Estilos premium + densidades suaves → MINIMAL (assinatura discreta)
  if (
    ['LUXURY', 'EDITORIAL', 'MINIMAL'].includes(style) &&
    ['PREMIUM', 'CLEAN', 'MINIMAL', 'SOFT'].includes(emotionalDensity ?? '')
  ) return 'MINIMAL'

  // Tech/Corporate com logo transparente → GLASS (glassmorphism elegante)
  if (['TECH', 'CORPORATE'].includes(style) && analysis.bgType === 'transparent') return 'GLASS'

  // Padrão: FLOATING com shadow natural (integração real na campanha)
  return 'FLOATING'
}

// ════════════════════════════════════════════════════════════════════
// PREPARAÇÃO ORQUESTRADA — Download → Análise → Remoção → Cache
// ════════════════════════════════════════════════════════════════════

export async function prepareLogo(
  logoUrl: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  companyId: string,
  style: string,
  emotionalDensity: string | undefined,
  removeBgApiKey?: string,
): Promise<PreparedLogo | null> {
  try {
    // 1. Cache hit → usa versão já processada
    const cached = await getCachedProcessedLogo(logoUrl, supabase, companyId)
    if (cached) {
      const analysis: LogoAnalysis = { bgType: 'transparent', needsRemoval: false, dominantBg: null }
      return { buffer: cached, analysis, mode: chooseLogoMode(analysis, style, emotionalDensity) }
    }

    // 2. Baixa original
    const logoRes = await fetch(logoUrl)
    if (!logoRes.ok) return null
    const originalBuf = Buffer.from(await logoRes.arrayBuffer())

    // 3. Analisa fundo
    const analysis = await analyzeLogoBg(originalBuf)
    let processedBuf = originalBuf

    // 4. Remove fundo se necessário
    if (analysis.needsRemoval) {
      let removed: Buffer | null = null

      // remove.bg API primeiro (recorte mais limpo)
      if (removeBgApiKey) {
        removed = await removeViaRemoveBg(originalBuf, removeBgApiKey)
      }

      // Fallback: remoção local por cor dominante (sólidos simples)
      if (!removed && analysis.dominantBg) {
        removed = await removeSimpleBg(originalBuf, analysis.dominantBg)
        console.log(`[brand-asset] remoção local aplicada (bg: ${analysis.bgType})`)
      }

      if (removed) {
        processedBuf = Buffer.from(removed)
        const clearedAnalysis: LogoAnalysis = { bgType: 'transparent', needsRemoval: false, dominantBg: null }
        await cacheProcessedLogo(processedBuf, logoUrl, supabase, companyId)
        return { buffer: processedBuf, analysis: clearedAnalysis, mode: chooseLogoMode(clearedAnalysis, style, emotionalDensity) }
      }
    } else if (analysis.bgType === 'transparent') {
      // Já tem transparência → cacheia para próximas gerações
      await cacheProcessedLogo(processedBuf, logoUrl, supabase, companyId)
    }

    const mode = chooseLogoMode(analysis, style, emotionalDensity)
    return { buffer: processedBuf, analysis, mode }
  } catch (err) {
    console.warn('[brand-asset] prepareLogo falhou:', err)
    return null
  }
}

// ════════════════════════════════════════════════════════════════════
// OPTICAL LOGO PLACEMENT — Proeminência, sombra contextual, zona silenciosa
// ════════════════════════════════════════════════════════════════════

// Percentual máximo de largura do canvas por nicho
const NICHE_LOGO_PROMINENCE: Record<string, number> = {
  luxo:        0.13,
  moda:        0.14,
  editorial:   0.13,
  beleza:      0.15,
  tecnologia:  0.17,
  imobiliaria: 0.17,
  servicos:    0.18,
  alimentacao: 0.18,
  educacao:    0.18,
  academia:    0.20,
  offroad:     0.20,
  ecommerce:   0.20,
  infantil:    0.19,
  eventos:     0.22,
  politica:    0.24,
}

// Sombra contextual por estilo + densidade emocional
function getContextualShadowColor(
  style: string,
  emotionalDensity?: string,
): { r: number; g: number; b: number; alpha: number } {
  const styleBase: Record<string, { r: number; g: number; b: number }> = {
    CINEMATIC:  { r: 20, g: 10, b: 5  },
    TECH:       { r: 0,  g: 8,  b: 20 },
    LUXURY:     { r: 5,  g: 5,  b: 5  },
    NEON:       { r: 0,  g: 0,  b: 15 },
    SPORT:      { r: 15, g: 5,  b: 0  },
    EDITORIAL:  { r: 5,  g: 5,  b: 8  },
    CORPORATE:  { r: 0,  g: 5,  b: 12 },
    MINIMAL:    { r: 0,  g: 0,  b: 0  },
    STREET:     { r: 8,  g: 5,  b: 0  },
  }
  const alphaMap: Record<string, number> = {
    AGGRESSIVE: 0.70, ENERGETIC: 0.60, PREMIUM: 0.40,
    CLEAN: 0.35, CORPORATE: 0.45, URBAN: 0.65,
    CINEMATIC: 0.55, DRAMATIC: 0.70, MINIMAL: 0.30, SOFT: 0.35,
  }
  return {
    ...(styleBase[style] ?? { r: 0, g: 0, b: 0 }),
    alpha: alphaMap[emotionalDensity ?? ''] ?? 0.55,
  }
}

// Padding adaptativo por modo e densidade emocional
function getAdaptivePadding(mode: LogoMode, emotionalDensity?: string): number {
  const base: Record<LogoMode, number> = { FLOATING: 24, GLASS: 20, MINIMAL: 28, BADGE: 18 }
  const mult: Record<string, number> = {
    PREMIUM: 1.30, MINIMAL: 1.40, SOFT: 1.25,
    AGGRESSIVE: 0.85, ENERGETIC: 0.90,
  }
  return Math.round(base[mode] * (mult[emotionalDensity ?? ''] ?? 1.0))
}

// Converte corner + dimensões → coordenadas absolutas
function cornerToXY(
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  lw: number, lh: number, W: number, H: number, pad: number,
): { x: number; y: number } {
  if (corner === 'top-left')    return { x: pad,           y: pad          }
  if (corner === 'top-right')   return { x: W - pad - lw,  y: pad          }
  if (corner === 'bottom-left') return { x: pad,           y: H - pad - lh }
  return                               { x: W - pad - lw,  y: H - pad - lh }
}

export interface LogoRenderOptions {
  imageBuffer?: Buffer
  palette?: Record<string, string>
  style?: string
  emotionalDensity?: string
  niche?: string
  layout?: string
}

// Zonas de texto por layout (coordenadas relativas 0–1)
type TextZone = { x: number; y: number; w: number; h: number }
const LAYOUT_TEXT_ZONES: Record<string, TextZone[]> = {
  HERO_RIGHT:    [{ x: 0,    y: 0.55, w: 0.55, h: 0.45 }],
  HERO_LEFT:     [{ x: 0.45, y: 0.55, w: 0.55, h: 0.45 }],
  CENTER_STACK:  [{ x: 0.10, y: 0.35, w: 0.80, h: 0.50 }],
  POSTER:        [{ x: 0.05, y: 0.20, w: 0.90, h: 0.60 }],
  FOCUS_CENTER:  [{ x: 0.05, y: 0.05, w: 0.90, h: 0.25 }, { x: 0.05, y: 0.75, w: 0.90, h: 0.20 }],
  SPLIT_SCREEN:  [{ x: 0,    y: 0.20, w: 0.50, h: 0.60 }],
  DIAGONAL_FLOW: [{ x: 0.05, y: 0.40, w: 0.90, h: 0.45 }],
  ASYMMETRIC:    [{ x: 0.45, y: 0.30, w: 0.50, h: 0.55 }],
}

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
const ALL_CORNERS: Corner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

// Descarta corners que sobreponham zonas de texto do layout
function filterTextConflicts(
  candidates: Corner[],
  layout: string,
  W: number, H: number,
  logoW: number, logoH: number,
  pad: number,
): Corner[] {
  const zones = LAYOUT_TEXT_ZONES[layout] ?? []
  if (!zones.length) return candidates

  return candidates.filter(corner => {
    const { x, y } = cornerToXY(corner, logoW, logoH, W, H, pad)
    const lr = { x: x / W, y: y / H, w: logoW / W, h: logoH / H }
    return !zones.some(z =>
      lr.x < z.x + z.w && lr.x + lr.w > z.x &&
      lr.y < z.y + z.h && lr.y + lr.h > z.y,
    )
  })
}

// Analisa variância de pixels para encontrar a zona mais silenciosa
async function findSilentZone(
  imageBuffer: Buffer,
  candidates: Corner[],
  logoW: number, logoH: number,
  W: number, H: number,
  pad: number,
): Promise<Corner> {
  if (candidates.length === 1) return candidates[0]
  try {
    const { default: sharp } = await import('sharp')
    const S = 20 // miniatura 20×20 para análise rápida

    const scored: Array<{ corner: Corner; score: number }> = []
    for (const corner of candidates) {
      const { x, y } = cornerToXY(corner, logoW, logoH, W, H, pad)
      const pW = Math.min(Math.max(logoW, 40), W - x)
      const pH = Math.min(Math.max(logoH, 40), H - y)
      if (pW <= 0 || pH <= 0) { scored.push({ corner, score: 9999 }); continue }

      try {
        const { data } = await sharp(imageBuffer)
          .extract({ left: Math.max(0, x), top: Math.max(0, y), width: pW, height: pH })
          .resize(S, S, { fit: 'fill' })
          .grayscale()
          .raw()
          .toBuffer({ resolveWithObject: true })
        const buf = data as Buffer
        const mean = buf.reduce((s, v) => s + v, 0) / buf.length
        const variance = buf.reduce((s, v) => s + (v - mean) ** 2, 0) / buf.length
        // Penaliza zonas muito claras (baixo contraste para logo)
        const brightPenalty = mean > 200 ? (mean - 200) * 2 : 0
        scored.push({ corner, score: variance + brightPenalty })
      } catch {
        scored.push({ corner, score: 9999 })
      }
    }
    scored.sort((a, b) => a.score - b.score)
    return scored[0].corner
  } catch {
    return candidates[0]
  }
}

// Score de coesão entre logo, modo e posição — para diagnóstico
export function scoreLogoCohesion(
  analysis: LogoAnalysis,
  mode: LogoMode,
  corner: string,
  layout: string,
  eyeFlow?: string,
): { score: number; issues: string[] } {
  const issues: string[] = []
  let score = 100

  if (analysis.bgType === 'complex' && mode === 'MINIMAL') {
    issues.push('Logo complexa em MINIMAL: pode parecer "colada"')
    score -= 20
  }
  if (layout === 'SPLIT_SCREEN' && corner !== 'top-left') {
    issues.push('SPLIT_SCREEN: logo fora do painel de marca')
    score -= 10
  }
  if (eyeFlow === 'FACE_TO_HEADLINE' && (corner === 'top-left' || corner === 'top-right')) {
    issues.push('FACE_TO_HEADLINE: logo compete com rosto no topo')
    score -= 8
  }
  if (analysis.bgType === 'transparent' && mode === 'BADGE') {
    issues.push('Logo transparente em BADGE: FLOATING seria melhor')
    score -= 5
  }

  return { score: Math.max(0, score), issues }
}

// ════════════════════════════════════════════════════════════════════
// LOGO COMPOSITE LAYERS — Constrói camadas sharp por modo
// ════════════════════════════════════════════════════════════════════

export async function buildLogoCompositeLayers(
  logo: PreparedLogo,
  placement: { corner?: Corner; x: number; y: number; targetW: number },
  W: number,
  H: number,
  options?: LogoRenderOptions,
): Promise<SharpLayer[]> {
  const { default: sharp } = await import('sharp')
  const { buffer, mode } = logo

  // Logo Scale Intelligence: proeminência por nicho + teto absoluto 180px
  const nichePct = NICHE_LOGO_PROMINENCE[options?.niche ?? ''] ?? 0.18
  const maxW = Math.min(placement.targetW, Math.round(W * nichePct), 180)
  const resized = await sharp(buffer)
    .resize(maxW, undefined, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .png()
    .toBuffer()

  const meta = await sharp(resized).metadata()
  const lw = meta.width  ?? maxW
  const lh = meta.height ?? Math.round(maxW * 0.5)

  // Padding adaptativo por modo e densidade emocional
  const pad = getAdaptivePadding(mode, options?.emotionalDensity)

  // ── Optical Placement: silent zone + filtro de conflito de texto ─
  let chosenCorner: Corner = placement.corner ?? 'top-right'
  if (options?.imageBuffer && options?.layout) {
    const candidates = filterTextConflicts(
      ALL_CORNERS, options.layout, W, H, lw, lh, pad,
    )
    const safe = candidates.length > 0 ? candidates : ALL_CORNERS
    // Prefere o corner original se ele não conflita; senão busca zona silenciosa
    if (safe.includes(chosenCorner)) {
      const bestByVariance = await findSilentZone(options.imageBuffer, [chosenCorner, ...safe.filter(c => c !== chosenCorner)], lw, lh, W, H, pad)
      // Só troca se o ganho de silêncio for significativo (já analisou todos os safe)
      chosenCorner = bestByVariance
    } else {
      chosenCorner = await findSilentZone(options.imageBuffer, safe, lw, lh, W, H, pad)
    }
  }

  const { x: sx, y: sy } = cornerToXY(chosenCorner, lw, lh, W, H, pad)
  const clampedSx = Math.max(0, Math.min(sx, W - lw - 4))
  const clampedSy = Math.max(0, Math.min(sy, H - lh - 4))

  const result: SharpLayer[] = []

  switch (mode) {
    // ── FLOATING: sombra contextual por estilo + densidade ───────
    case 'FLOATING': {
      const shadow = getContextualShadowColor(options?.style ?? '', options?.emotionalDensity)
      const { data: ld, info: li } = await sharp(resized)
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const shadowData = Buffer.allocUnsafe((ld as Buffer).length)
      for (let i = 0; i < (ld as Buffer).length; i += 4) {
        shadowData[i]     = shadow.r
        shadowData[i + 1] = shadow.g
        shadowData[i + 2] = shadow.b
        shadowData[i + 3] = Math.round((ld as Buffer)[i + 3] * shadow.alpha)
      }
      const shadowBuf = await sharp(shadowData, {
        raw: { width: li.width, height: li.height, channels: 4 },
      }).blur(7).png().toBuffer()

      const offset = Math.max(2, Math.round(lh * 0.05))
      result.push({ input: shadowBuf, top: Math.min(H - lh, clampedSy + offset), left: Math.min(W - lw, clampedSx + offset), blend: 'over' })
      result.push({ input: resized,   top: clampedSy, left: clampedSx, blend: 'over' })
      break
    }

    // ── GLASS: glassmorphism para fundo muito complexo ───────────
    case 'GLASS': {
      const bdPad = Math.round(Math.max(lw, lh) * 0.18)
      const bdW   = lw + bdPad * 2
      const bdH   = lh + bdPad * 2
      const bdR   = Math.round(bdH * 0.30)
      const glassSvg = `<svg width="${bdW}" height="${bdH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${bdW}" height="${bdH}" rx="${bdR}" ry="${bdR}"
        fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
</svg>`
      const glassBuf = await sharp(Buffer.from(glassSvg)).png().toBuffer()
      const bdX = Math.max(0, clampedSx - bdPad)
      const bdY = Math.max(0, clampedSy - bdPad)
      result.push({ input: glassBuf, top: bdY,        left: bdX,        blend: 'over' })
      result.push({ input: resized,  top: clampedSy,  left: clampedSx,  blend: 'over' })
      break
    }

    // ── MINIMAL: assinatura discreta, 78% opacidade ──────────────
    case 'MINIMAL': {
      const { data: ld, info: li } = await sharp(resized)
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const opacityData = Buffer.from(ld as Buffer)
      for (let i = 3; i < opacityData.length; i += 4) {
        opacityData[i] = Math.round(opacityData[i] * 0.78)
      }
      const minBuf = await sharp(opacityData, {
        raw: { width: li.width, height: li.height, channels: 4 },
      }).png().toBuffer()
      result.push({ input: minBuf, top: clampedSy, left: clampedSx, blend: 'over' })
      break
    }

    // ── BADGE: pill escura sólida (fallback sem transparência) ───
    case 'BADGE': {
      const bdPad = Math.round(Math.max(lw, lh) * 0.14)
      const bdW   = lw + bdPad * 2
      const bdH   = lh + bdPad * 2
      const bdR   = Math.round(bdH * 0.28)
      const badgeSvg = `<svg width="${bdW}" height="${bdH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${bdW}" height="${bdH}" rx="${bdR}" ry="${bdR}" fill="rgba(0,0,0,0.55)"/>
</svg>`
      const badgeBuf = await sharp(Buffer.from(badgeSvg)).png().toBuffer()
      const bdX = Math.max(0, clampedSx - bdPad)
      const bdY = Math.max(0, clampedSy - bdPad)
      result.push({ input: badgeBuf, top: bdY,        left: bdX,        blend: 'over' })
      result.push({ input: resized,  top: clampedSy,  left: clampedSx,  blend: 'over' })
      break
    }
  }

  return result
}
