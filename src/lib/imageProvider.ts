import { createClient } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────

export class NoProviderError extends Error {
  constructor() {
    super(
      'Nenhum provedor premium de imagem configurado. Configure GEMINI_IMAGE_API_KEY, FAL_KEY, IDEOGRAM_API_KEY, RECRAFT_API_KEY ou OPENAI_API_KEY.'
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
}

function getAspectRatios(contentType: string): AspectRatios {
  const vertical = ['stories', 'reels']
  const horizontal = ['post_facebook', 'post_linkedin_imagem', 'youtube']

  if (vertical.includes(contentType)) {
    return { gemini: '9:16', ideogram: 'ASPECT_9_16', recraftSize: '1024x1820', dalleSize: '1024x1792', falW: 1024, falH: 1820 }
  }
  if (horizontal.includes(contentType)) {
    return { gemini: '16:9', ideogram: 'ASPECT_16_9', recraftSize: '1820x1024', dalleSize: '1792x1024', falW: 1820, falH: 1024 }
  }
  if (contentType === 'carrossel') {
    // 4:5 Instagram Carousel — Sharp compositor faz o resize final para 1080×1350
    return { gemini: '4:5', ideogram: 'ASPECT_4_5', recraftSize: '1024x1280', dalleSize: '1024x1792', falW: 1024, falH: 1280 }
  }
  // square: post_instagram, post_linkedin_texto, default
  return { gemini: '1:1', ideogram: 'ASPECT_1_1', recraftSize: '1024x1024', dalleSize: '1024x1024', falW: 1024, falH: 1024 }
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

// ── Provider: OpenAI gpt-image-1 ─────────────────────────────
// Com produto: usa /v1/images/edits (mantém produto na cena)
// Sem produto: usa /v1/images/generations

async function openaiImageGen(
  prompt: string,
  size: '1024x1024' | '1792x1024' | '1024x1792',
  productBase64?: string,
  productMime?: string,
): Promise<ImageResult> {
  const key = process.env.OPENAI_API_KEY!
  const gptSize =
    size === '1792x1024' ? '1536x1024'
    : size === '1024x1792' ? '1024x1536'
    : '1024x1024'

  if (productBase64) {
    // Edits endpoint: usa imagem do produto como base visual
    const form = new FormData()
    form.append('model', 'gpt-image-1')
    form.append('prompt', prompt)
    form.append('size', gptSize)
    form.append('n', '1')
    const mime = (productMime ?? 'image/png') as string
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
    const bytes = Buffer.from(productBase64, 'base64')
    const blob = new Blob([bytes], { type: mime })
    form.append('image[]', blob, `product.${ext}`)

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
    if (!res.ok) throw new Error(`OpenAI edits error ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const b64 = data.data?.[0]?.b64_json
    if (!b64) throw new Error('OpenAI edits: sem imagem na resposta')
    return { base64: b64, mimeType: 'image/png', provider: 'OpenAI gpt-image-1 (produto)' }
  }

  // Generations endpoint: sem produto
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size: gptSize }),
  })
  if (!res.ok) throw new Error(`OpenAI gpt-image-1 error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI: sem imagem na resposta')
  return { base64: b64, mimeType: 'image/png', provider: 'OpenAI gpt-image-1' }
}

// ── Main: provider selection ──────────────────────────────────

export async function generateImage(
  prompt: string,
  contentType: string,
  W: number,
  H: number,
  productBase64?: string,
  productMime?: string,
): Promise<ImageResult> {
  const ar = getAspectRatios(contentType)

  if (process.env.GEMINI_IMAGE_API_KEY) return geminiImageGen(prompt, ar.gemini)
  if (process.env.FAL_KEY) return falImageGen(prompt, ar.falW, ar.falH, productBase64)
  if (process.env.IDEOGRAM_API_KEY) return ideogramImageGen(prompt, ar.ideogram)
  if (process.env.RECRAFT_API_KEY) return recraftImageGen(prompt, ar.recraftSize)
  if (process.env.OPENAI_API_KEY) return openaiImageGen(prompt, ar.dalleSize, productBase64, productMime)

  throw new NoProviderError()
}

// ── Geração especializada para 9:16 vertical (Stories / Reels) ───────
// OpenAI gpt-image-1 NÃO suporta portrait 9:16 de forma confiável.
// Esta função força Fal.ai Flux Pro como provider primário para formatos
// verticais, garantindo dimensões corretas e composição portrait de qualidade.
//
// Hierarquia de fallback:
//   1. Fal.ai Flux Pro / Kontext (melhor para portrait 9:16)
//   2. Gemini Imagen 3 (suporte nativo a 9:16)
//   3. Ideogram v2 (aspect ratio explícito)
//   4. OpenAI gpt-image-1 (último recurso — qualidade limitada em portrait)

export async function generateImage916(
  prompt:        string,
  productBase64?: string,
  productMime?:  string,
): Promise<ImageResult> {
  // Dimensões para 9:16 portrait — Fal.ai suporta arbitrary sizes
  const W = 1024
  const H = 1792

  // 1. Fal.ai: melhor qualidade em portrait, suporta Kontext para produto
  if (process.env.FAL_KEY) return falImageGen(prompt, W, H, productBase64)

  // 2. Gemini Imagen 3: suporte nativo a 9:16
  if (process.env.GEMINI_IMAGE_API_KEY) return geminiImageGen(prompt, '9:16')

  // 3. Ideogram: aspect ratio explícito 9:16
  if (process.env.IDEOGRAM_API_KEY) return ideogramImageGen(prompt, 'ASPECT_9_16')

  // 4. OpenAI último recurso — usa portrait (1024x1536) mas com limitações conhecidas
  if (process.env.OPENAI_API_KEY) return openaiImageGen(prompt, '1024x1792', productBase64, productMime)

  throw new NoProviderError()
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
