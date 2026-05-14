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
  style: string
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
  // Automotive: ALWAYS BADGE para garantir visibilidade em qualquer fundo
  if (style.startsWith('AUTOMOTIVE')) return 'BADGE'

  // Fundo complexo não removido → BADGE como fallback seguro (pill escura)
  if (analysis.bgType === 'complex') return 'BADGE'

  // Estilos premium + densidades suaves → MINIMAL (assinatura discreta)
  // Exceção: estilos de impacto alto → FLOATING sempre
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
      return { buffer: cached, analysis, mode: chooseLogoMode(analysis, style, emotionalDensity), style }
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
        return { buffer: processedBuf, analysis: clearedAnalysis, mode: chooseLogoMode(clearedAnalysis, style, emotionalDensity), style }
      }
    } else if (analysis.bgType === 'transparent') {
      // Já tem transparência → cacheia para próximas gerações
      await cacheProcessedLogo(processedBuf, logoUrl, supabase, companyId)
    }

    const mode = chooseLogoMode(analysis, style, emotionalDensity)
    return { buffer: processedBuf, analysis, mode, style }
  } catch (err) {
    console.warn('[brand-asset] prepareLogo falhou:', err)
    return null
  }
}

// ════════════════════════════════════════════════════════════════════
// LOGO COMPOSITE LAYERS — Constrói camadas sharp por modo
// ════════════════════════════════════════════════════════════════════

export async function buildLogoCompositeLayers(
  logo: PreparedLogo,
  placement: { x: number; y: number; targetW: number },
  W: number,
  H: number,
): Promise<SharpLayer[]> {
  const { default: sharp } = await import('sharp')
  const { buffer, mode } = logo

  // Logo Scale Intelligence: máx 18% da largura do canvas
  const maxW    = Math.min(placement.targetW, Math.round(W * 0.18), 180)
  const resized = await sharp(buffer)
    .resize(maxW, undefined, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .png()
    .toBuffer()

  const meta = await sharp(resized).metadata()
  const lw = meta.width  ?? maxW
  const lh = meta.height ?? Math.round(maxW * 0.5)

  // Clamp ao canvas
  const sx = Math.max(0, Math.min(placement.x, W - lw - 4))
  const sy = Math.max(0, Math.min(placement.y, H - lh - 4))

  const result: SharpLayer[] = []

  switch (mode) {
    // ── FLOATING: shadow natural, logo integrada organicamente ───
    case 'FLOATING': {
      const { data: ld, info: li } = await sharp(resized)
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const shadowData = Buffer.allocUnsafe((ld as Buffer).length)
      for (let i = 0; i < (ld as Buffer).length; i += 4) {
        shadowData[i] = shadowData[i + 1] = shadowData[i + 2] = 0
        shadowData[i + 3] = Math.round((ld as Buffer)[i + 3] * 0.55)
      }
      const shadowBuf = await sharp(shadowData, {
        raw: { width: li.width, height: li.height, channels: 4 },
      }).blur(7).png().toBuffer()

      const offset = Math.max(2, Math.round(lh * 0.05))
      result.push({ input: shadowBuf, top: Math.min(H - lh, sy + offset), left: Math.min(W - lw, sx + offset), blend: 'over' })
      result.push({ input: resized,   top: sy, left: sx, blend: 'over' })
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
      const bdX = Math.max(0, sx - bdPad)
      const bdY = Math.max(0, sy - bdPad)
      result.push({ input: glassBuf, top: bdY, left: bdX, blend: 'over' })
      result.push({ input: resized,  top: sy,  left: sx,  blend: 'over' })
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
      result.push({ input: minBuf, top: sy, left: sx, blend: 'over' })
      break
    }

    // ── BADGE: pill escura sólida (fallback sem transparência) ───
    case 'BADGE': {
      const isAutoStyle = logo.style.startsWith('AUTOMOTIVE')
      const bdPad = Math.round(Math.max(lw, lh) * 0.12)
      const bdW   = lw + bdPad * 2
      const bdH   = lh + bdPad * 2
      const bdR   = Math.round(bdH * 0.22)
      const bgOpacity   = isAutoStyle ? 0.70 : 0.55
      const accentStroke = isAutoStyle
        ? `<rect width="${bdW}" height="${bdH}" rx="${bdR}" ry="${bdR}" fill="none" stroke="#E30613" stroke-width="2" opacity="0.60"/>`
        : ''
      const badgeSvg = `<svg width="${bdW}" height="${bdH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${bdW}" height="${bdH}" rx="${bdR}" ry="${bdR}" fill="rgba(0,0,0,${bgOpacity})"/>
  ${accentStroke}
</svg>`
      const badgeBuf = await sharp(Buffer.from(badgeSvg)).png().toBuffer()
      const bdX = Math.max(0, sx - bdPad)
      const bdY = Math.max(0, sy - bdPad)
      result.push({ input: badgeBuf, top: bdY, left: bdX, blend: 'over' })
      result.push({ input: resized,  top: sy,  left: sx,  blend: 'over' })
      break
    }
  }

  return result
}
