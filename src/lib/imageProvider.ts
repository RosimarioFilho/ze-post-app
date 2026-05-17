import { createClient } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────

export class NoProviderError extends Error {
  constructor() {
    super(
      'Nenhum provedor premium de imagem configurado. Configure GEMINI_IMAGE_API_KEY, FAL_KEY, IDEOGRAM_API_KEY, RECRAFT_API_KEY, STABILITY_API_KEY ou OPENAI_API_KEY.'
    )
    this.name = 'NoProviderError'
  }
}

export interface ImageResult {
  base64: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  provider: string
}

// ── Aspect ratio helpers ──────────────────────────────────────

interface AspectRatios {
  gemini: string
  ideogram: string
  recraftSize: string
  dalleSize: '1024x1024' | '1792x1024' | '1024x1792'
  falW: number
  falH: number
  stability: string
  gpt2W: number   // gpt-image-2: dimensões divisíveis por 16, aspect ratio exato
  gpt2H: number
}

function getAspectRatios(contentType: string): AspectRatios {
  const vertical = ['stories', 'reels']
  const horizontal = ['post_facebook', 'post_linkedin_imagem', 'youtube']

  if (vertical.includes(contentType)) {
    return { gemini: '9:16', ideogram: 'ASPECT_9_16', recraftSize: '1024x1820', dalleSize: '1024x1792', falW: 1024, falH: 1820, stability: '9:16', gpt2W: 1152, gpt2H: 2048 }
  }
  if (horizontal.includes(contentType)) {
    return { gemini: '16:9', ideogram: 'ASPECT_16_9', recraftSize: '1820x1024', dalleSize: '1792x1024', falW: 1820, falH: 1024, stability: '16:9', gpt2W: 2048, gpt2H: 1152 }
  }
  if (contentType === 'carrossel') {
    // 4:5 Instagram Carousel — Sharp compositor faz o resize final para 1080×1350
    return { gemini: '4:5', ideogram: 'ASPECT_4_5', recraftSize: '1024x1280', dalleSize: '1024x1792', falW: 1024, falH: 1280, stability: '4:5', gpt2W: 1280, gpt2H: 1600 }
  }
  // square: post_instagram, post_linkedin_texto, default
  return { gemini: '1:1', ideogram: 'ASPECT_1_1', recraftSize: '1024x1024', dalleSize: '1024x1024', falW: 1024, falH: 1024, stability: '1:1', gpt2W: 1024, gpt2H: 1024 }
}

// ── Fetch image URL as base64 ─────────────────────────────────

async function urlToBase64(url: string): Promise<{ base64: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const mimeType: 'image/png' | 'image/jpeg' | 'image/webp' =
    contentType.includes('png') ? 'image/png'
    : contentType.includes('webp') ? 'image/webp'
    : 'image/jpeg'
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return { base64, mimeType }
}

// ── Provider: Gemini Imagen 3 ─────────────────────────────────

async function geminiImageGen(prompt: string, aspectRatio: string): Promise<ImageResult> {
  const key = process.env.GEMINI_IMAGE_API_KEY!
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio, safetySetting: 'BLOCK_ONLY_HIGH' },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini Imagen error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const prediction = data.predictions?.[0]
  if (!prediction?.bytesBase64Encoded) throw new Error('Gemini Imagen: sem imagem na resposta')
  return { base64: prediction.bytesBase64Encoded, mimeType: 'image/png', provider: 'Gemini Imagen 3' }
}

// ── Provider: Fal.ai Flux Pro ─────────────────────────────────

async function falImageGen(prompt: string, W: number, H: number, productBase64?: string): Promise<ImageResult> {
  const key = process.env.FAL_KEY!
  const headers = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }

  let url: string
  let body: Record<string, unknown>

  if (productBase64) {
    // img-to-img: Flux Kontext Pro
    url = 'https://fal.run/fal-ai/flux-pro/kontext'
    body = {
      prompt,
      image_url: `data:image/png;base64,${productBase64}`,
      image_size: { width: W, height: H },
      num_inference_steps: 28,
      guidance_scale: 3.5,
    }
  } else {
    // txt-to-img: Flux Pro
    url = 'https://fal.run/fal-ai/flux-pro'
    body = {
      prompt,
      image_size: { width: W, height: H },
      num_inference_steps: 28,
      guidance_scale: 3.5,
    }
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Fal.ai error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const imageUrl = data.images?.[0]?.url
  if (!imageUrl) throw new Error('Fal.ai: sem imagem na resposta')
  const { base64, mimeType } = await urlToBase64(imageUrl)
  return { base64, mimeType, provider: productBase64 ? 'Fal.ai Flux Kontext Pro' : 'Fal.ai Flux Pro' }
}

// ── Provider: Ideogram v2 ─────────────────────────────────────

async function ideogramImageGen(prompt: string, aspectRatio: string): Promise<ImageResult> {
  const key = process.env.IDEOGRAM_API_KEY!
  const res = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: { 'Api-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_request: {
        prompt,
        aspect_ratio: aspectRatio,
        model: 'V_2',
        magic_prompt_option: 'AUTO',
      },
    }),
  })
  if (!res.ok) throw new Error(`Ideogram error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const imageUrl = data.data?.[0]?.url
  if (!imageUrl) throw new Error('Ideogram: sem imagem na resposta')
  const { base64, mimeType } = await urlToBase64(imageUrl)
  return { base64, mimeType, provider: 'Ideogram v2' }
}

// ── Provider: Recraft v3 ──────────────────────────────────────

async function recraftImageGen(prompt: string, size: string): Promise<ImageResult> {
  const key = process.env.RECRAFT_API_KEY!
  const res = await fetch('https://external.api.recraft.ai/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, style: 'realistic_image', size, n: 1 }),
  })
  if (!res.ok) throw new Error(`Recraft error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const imageUrl = data.data?.[0]?.url
  if (!imageUrl) throw new Error('Recraft: sem imagem na resposta')
  const { base64, mimeType } = await urlToBase64(imageUrl)
  return { base64, mimeType, provider: 'Recraft v3' }
}

// ── Provider: Stability AI ───────────────────────────────────
// Sempre usa Stable Image Core (txt-to-img) com aspect_ratio nativo.
// SD3.5 img-to-img NÃO é adequado para composições publicitárias — ele
// transforma a foto do produto em vez de criar uma cena nova com o produto
// bem posicionado. O prompt já descreve o estilo, nicho e layout 3-zonas.
// Referência de produto (productBase64) é ignorada na API; o prompt descreve
// o tipo de produto pelo nicho selecionado.

async function stabilityImageGen(
  prompt: string,
  aspectRatio: string,
): Promise<ImageResult> {
  const key = process.env.STABILITY_API_KEY!
  const form = new FormData()
  form.append('prompt', prompt)
  form.append('aspect_ratio', aspectRatio)
  form.append('output_format', 'png')

  const res = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
    body: form,
  })

  if (!res.ok) throw new Error(`Stability AI error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const base64 = data.image
  if (!base64) throw new Error('Stability AI: sem imagem na resposta')
  return { base64, mimeType: 'image/png', provider: 'Stability AI Core' }
}

// ── Provider: OpenAI gpt-image-2 ─────────────────────────────
// Lançado em abril/2026 — suporta dimensões arbitrárias (múltiplos de 16),
// incluindo 9:16 portrait nativo. Renderiza texto com ~99% de acurácia.
// Com produto: usa /v1/images/edits (mantém produto na cena)
// Sem produto: usa /v1/images/generations

// Arredonda para múltiplo de 16 (requisito do gpt-image-2)
function snapTo16(n: number): number {
  return Math.round(n / 16) * 16
}

async function openaiImageGen(
  prompt: string,
  width: number,
  height: number,
  productBase64?: string,
  productMime?: string,
  logoBase64?: string,
): Promise<ImageResult> {
  const key  = process.env.OPENAI_API_KEY!
  const w    = snapTo16(width)
  const h    = snapTo16(height)
  const size = `${w}x${h}`

  // Usa edits endpoint quando há produto ou logo como referência visual
  if (productBase64 || logoBase64) {
    const form = new FormData()
    form.append('model', 'gpt-image-2')
    form.append('prompt', prompt)
    form.append('size', size)
    form.append('n', '1')

    // Produto como primeira imagem de referência
    if (productBase64) {
      const mime  = (productMime ?? 'image/png') as string
      const ext   = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
      const bytes = Buffer.from(productBase64, 'base64')
      const blob  = new Blob([bytes], { type: mime })
      form.append('image[]', blob, `product.${ext}`)
    }

    // Logo da empresa como segunda imagem de referência
    if (logoBase64) {
      const logoBytes = Buffer.from(logoBase64, 'base64')
      const logoBlob  = new Blob([logoBytes], { type: 'image/png' })
      form.append('image[]', logoBlob, 'logo.png')
    }

    const providerLabel =
      productBase64 && logoBase64 ? 'OpenAI gpt-image-2 (produto + logo)' :
      productBase64               ? 'OpenAI gpt-image-2 (produto)' :
                                    'OpenAI gpt-image-2 (logo)'

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
    if (!res.ok) throw new Error(`OpenAI edits error ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const b64  = data.data?.[0]?.b64_json
    if (!b64) throw new Error('OpenAI edits: sem imagem na resposta')
    return { base64: b64, mimeType: 'image/png', provider: providerLabel }
  }

  // Generations endpoint: sem produto e sem logo
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size }),
  })
  if (!res.ok) throw new Error(`OpenAI gpt-image-2 error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const b64  = data.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI gpt-image-2: sem imagem na resposta')
  return { base64: b64, mimeType: 'image/png', provider: 'OpenAI gpt-image-2' }
}

// ── Main: provider selection ──────────────────────────────────

export async function generateImage(
  prompt: string,
  contentType: string,
  W: number,
  H: number,
  productBase64?: string,
  productMime?: string,
  logoBase64?: string,
): Promise<ImageResult> {
  const ar = getAspectRatios(contentType)

  // Provider único: gpt-image-2
  // Outros providers (Gemini, Fal.ai, Ideogram, Recraft, Stability AI) podem ser
  // reativados aqui futuramente conforme necessidade.
  if (process.env.OPENAI_API_KEY) return openaiImageGen(prompt, ar.gpt2W, ar.gpt2H, productBase64, productMime, logoBase64)

  throw new NoProviderError()
}

// ── Geração especializada para 9:16 vertical (Stories / Reels) ───────
// Providers validados para composição portrait 9:16 com qualidade publicitária:
//
//   1. Fal.ai Flux Pro / Kontext  — MELHOR: composição portrait nativa,
//      suporta img-to-img com produto via Flux Kontext Pro.
//   2. Gemini Imagen 3            — suporte nativo a 9:16, boa qualidade.
//   3. Ideogram v2                — aspect ratio explícito, segue prompt bem.
//
// Providers NÃO adequados para 9:16 publicitário (removidos desta rota):
//   ✗ Stability AI Core  — ignora prompts complexos, gera sujeitos errados
//   ✗ OpenAI gpt-image-1 — não suporta portrait 9:16 de forma confiável
//
// Configure FAL_KEY no .env.local para ativar a melhor qualidade.

export async function generateImage916(
  prompt:         string,
  productBase64?: string,
  productMime?:   string,
  logoBase64?:    string,
): Promise<ImageResult> {
  // Provider único: gpt-image-2 a 1152×2048 (9:16 nativo, renderiza texto com ~99% acurácia)
  // Outros providers (Fal.ai, Gemini, Ideogram) podem ser reativados futuramente.
  if (process.env.OPENAI_API_KEY) return openaiImageGen(prompt, 1152, 2048, productBase64, productMime, logoBase64)

  throw new NoProviderError()
}

// ── Detecção de provider ativo ────────────────────────────────
// Permite ao route.ts saber qual provider será usado ANTES de chamar generateImage,
// para adaptar o prompt (ex: incluir copy textual quando gpt-image-2 for usado).

export function willUseGPTImage2(_isVertical9x16: boolean): boolean {
  // gpt-image-2 é o único provider ativo
  return !!process.env.OPENAI_API_KEY
}

// ── Upload to Supabase Storage ────────────────────────────────

export async function uploadGeneratedImage(
  base64: string,
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp',
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  jobId: string,
  suffix = '',
): Promise<string | null> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const storagePath = `${companyId}/generated/${jobId}${suffix}.${ext}`
  const bytes = Buffer.from(base64, 'base64')

  const { error } = await supabase.storage
    .from('media')
    .upload(storagePath, bytes, { contentType: mimeType, upsert: true })

  if (error) {
    console.warn('[imageProvider] upload error:', error)
    return null
  }

  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(storagePath)
  return publicUrl
}
