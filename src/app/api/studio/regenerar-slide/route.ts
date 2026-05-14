import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { readApiKey, AR_SIZES } from '@/lib/art-utils'
import { generateImage, uploadGeneratedImage } from '@/lib/imageProvider'
import type { CarouselSlideResult, CarouselNarrativePlan, SlideRole } from '@/types'
import {
  buildCompositeSVG, layoutImageHint, NICHE_DEFAULTS,
  buildImagePromptEnhancement, applyDecisionCorrections,
  NICHE_CREATIVE_DEFAULTS_V3, getLogoPlacement,
  type CreativeDecision, type Layout, type VisualStyle,
  type EyeFlowPattern, type EmotionalToken, type CameraType,
} from '@/lib/creative-engine'
import { prepareLogo, buildLogoCompositeLayers } from '@/lib/brand-asset'
import { getSlideLayoutVariations, getEnergyProgression } from '@/lib/carousel-engine'
import sharp from 'sharp'

function parseJson<T>(text: string, fallback: T): T {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return fallback
  try { return JSON.parse(m[0]) as T } catch { return fallback }
}

async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? 'image/jpeg'
    const mediaType = (ct.includes('png') ? 'image/png' : ct.includes('webp') ? 'image/webp' : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'
    const data = Buffer.from(await res.arrayBuffer()).toString('base64')
    return { data, mediaType }
  } catch { return null }
}

async function sharpComposite(
  imageBase64: string, copy: { headline: string; subline: string; cta: string },
  palette: Record<string, string>, W: number, H: number,
  googleFont: string | undefined, decision: CreativeDecision,
  logoLayers: Array<{ input: Buffer; top: number; left: number; blend: 'over' }>,
): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import('sharp')
    const imageBuffer = Buffer.from(imageBase64, 'base64')
    let fontFaceStyle = ''
    let activeFontFamily = 'Arial Black, Arial, sans-serif'
    if (googleFont) {
      try {
        const css = await fetch(
          `https://fonts.googleapis.com/css2?family=${encodeURIComponent(googleFont)}:wght@700&display=swap`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        ).then(r => r.ok ? r.text() : null)
        if (css) {
          const urlMatch = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/i)
          if (urlMatch) {
            const fontBuf = await fetch(urlMatch[1]).then(r => r.ok ? r.arrayBuffer() : null)
            if (fontBuf) {
              const mime = urlMatch[1].includes('.woff2') ? 'font/woff2' : 'font/ttf'
              fontFaceStyle = `<style>@font-face{font-family:'${googleFont}';src:url('data:${mime};base64,${Buffer.from(fontBuf).toString('base64')}');font-weight:700;}</style>`
              activeFontFamily = `'${googleFont}', Arial Black, Arial, sans-serif`
            }
          }
        }
      } catch { /* use default font */ }
    }
    const resized = await sharp(imageBuffer).resize(W, H, { fit: 'cover', position: 'center' }).png().toBuffer()
    const svg = buildCompositeSVG({ decision, copy, palette, W, H, fontFaceStyle, fontFamily: activeFontFamily })
    const svgBuffer = Buffer.from(svg)
    const layers: Array<{ input: Buffer; top: number; left: number; blend: 'over' }> = [
      { input: svgBuffer, top: 0, left: 0, blend: 'over' },
      ...logoLayers,
    ]
    return await sharp(resized).composite(layers).png().toBuffer()
  } catch (err) {
    console.warn('[regenerar-slide] sharp composite error:', err)
    return null
  }
}

async function runSlideRegeneration({
  jobId, slideIndex, supabase, anthropic,
}: {
  jobId: string
  slideIndex: number
  supabase: Awaited<ReturnType<typeof createClient>>
  anthropic: Anthropic
}) {
  // Carrega job completo
  const { data: job } = await supabase
    .from('creative_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (!job) return

  const slideResults: CarouselSlideResult[] = job.carousel_slides ?? []
  const idx = slideIndex - 1
  if (idx < 0 || idx >= slideResults.length) return

  const narrativePlan: CarouselNarrativePlan = job.carousel_plan
  const slidePlan = narrativePlan?.slides?.[idx]
  if (!slidePlan) return

  const companyId = job.company_id
  const palette: Record<string, string> = job.palette ?? {}
  const creativeBrief = job.creative_brief ?? {}
  const contentType = job.content_type ?? 'carrossel'
  const [W, H] = AR_SIZES[contentType as keyof typeof AR_SIZES] ?? [1080, 1350]
  const totalSlides = job.carousel_slide_count ?? 5

  const layouts = getSlideLayoutVariations(totalSlides)
  const energies = getEnergyProgression(totalSlides)
  const slideLayout = layouts[idx]
  const slideEnergy = energies[idx]

  // Marca como gerando
  slideResults[idx] = { ...slideResults[idx], status: 'generating' }
  await supabase.from('creative_jobs').update({
    carousel_slides: slideResults,
    current_agent: `Regenerando Slide ${slideIndex}/${totalSlides}`,
  }).eq('id', jobId)

  // Copy existente do slide (já tinha sido gerado, reutiliza)
  const existingCopy = slideResults[idx].copyOutput ?? {}
  const slideCopy = {
    headline: existingCopy.headline ?? slidePlan.headline,
    subline: existingCopy.subline ?? slidePlan.subline,
    cta: existingCopy.cta ?? (slidePlan.cta ?? ''),
    caption: existingCopy.caption ?? '',
  }

  // Creative Decision
  const niche = (creativeBrief as Record<string, string>).niche ?? ''
  const nicheDefaults = NICHE_DEFAULTS[niche] ?? NICHE_DEFAULTS['default']
  const nicheV3Defaults = NICHE_CREATIVE_DEFAULTS_V3?.[niche] ?? null

  const rawDecision: CreativeDecision = {
    layout: slideLayout as Layout,
    style: (nicheDefaults.style ?? 'CINEMATIC') as VisualStyle,
    effects: [],
    typography: (nicheDefaults.typography ?? 'STACKED') as import('@/lib/creative-engine').TypographyBehavior,
    composition: (creativeBrief as Record<string, string>).composition ?? '',
    asset_strategy: 'PRODUCT_HERO',
    mood: (creativeBrief as Record<string, string>).campaign_emotion ?? '',
    depth: 'MEDIUM',
    image_direction: '',
    eye_flow: (nicheV3Defaults?.eye_flow ?? 'HERO_TO_CTA') as EyeFlowPattern,
    emotional_density: slideEnergy as EmotionalToken,
    camera_type: (nicheV3Defaults?.camera_type ?? 'CENTER_HERO') as CameraType,
  }
  const correctedDecision = applyDecisionCorrections(rawDecision)

  // Prompt visual
  const layoutHint = layoutImageHint(correctedDecision.layout)
  const promptEnhancement = buildImagePromptEnhancement(correctedDecision, niche)
  const { data: company } = await supabase.from('companies').select('name, niche, logo_url').eq('id', companyId).single()
  const companyName = company?.name ?? ''
  const companyLogoUrl = company?.logo_url ?? null

  const logoPlacement = companyLogoUrl ? getLogoPlacement(correctedDecision.layout, W, H) : null
  const logoNote = logoPlacement ? `\nLogo will be placed at ${logoPlacement.corner} corner — keep that area clean.` : ''

  const productImageUrl = job.product_image_nobg_url ?? job.product_image_url ?? null
  let productBase64: string | undefined
  let productMime: 'image/jpeg' | 'image/png' | 'image/webp' | undefined
  if (productImageUrl) {
    const imgData = await fetchImageAsBase64(productImageUrl)
    if (imgData) { productBase64 = imgData.data; productMime = imgData.mediaType }
  }

  let imagePrompt = `${creativeBrief.photography_style ?? 'commercial photography'}, ${creativeBrief.lighting ?? 'studio lighting'}, carousel slide ${slideIndex}/${totalSlides} role: ${slidePlan.role}, ${layoutHint}, ${promptEnhancement}${logoNote}. No text, no watermarks.`

  try {
    const promptRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      system: 'Expert Visual Prompt Engineer. Return ONLY a prompt in English (60-80 words). No explanations.',
      messages: [{ role: 'user', content: `Carousel slide ${slideIndex}/${totalSlides} — Role: ${slidePlan.role}
Company: ${companyName} | Objective: ${slidePlan.objective}
Visual style: ${creativeBrief.visual_style ?? ''} | Energy: ${slideEnergy}
Layout: ${slideLayout} — ${layoutHint}
${productBase64 ? 'A product image is provided — place it PROMINENTLY.' : ''}${logoNote}
End with: "commercial advertising photography, no text, no watermarks"` }],
    })
    imagePrompt = promptRes.content[0].type === 'text' ? promptRes.content[0].text.trim() : imagePrompt
  } catch { /* use fallback prompt */ }

  // Gera imagem
  const imageResult = await generateImage(imagePrompt, contentType, W, H, productBase64, productMime)
  const rawImageUrl = await uploadGeneratedImage(
    imageResult.base64, imageResult.mimeType, supabase, companyId, jobId, `_slide${slideIndex}v2`
  )

  // Prepara logo
  let logoLayers: Array<{ input: Buffer; top: number; left: number; blend: 'over' }> = []
  if (companyLogoUrl) {
    try {
      const removeBgKey = process.env.REMOVE_BG_API_KEY
      const prepared = await prepareLogo(companyLogoUrl, supabase, companyId, correctedDecision.style, correctedDecision.emotional_density, removeBgKey)
      if (prepared) {
        const placement = getLogoPlacement(correctedDecision.layout, W, H)
        logoLayers = await buildLogoCompositeLayers(prepared, placement, W, H)
      }
    } catch { /* sem logo */ }
  }

  // Detecta font
  const detectedFont = (job.vision_analysis as Record<string, unknown> | null)?.typography
    ? ((job.vision_analysis as Record<string, unknown>).typography as Record<string, string>)?.google_font
    : undefined

  // Composição
  let finalSlideUrl = rawImageUrl
  const compositeBuffer = await sharpComposite(
    imageResult.base64,
    { headline: slideCopy.headline, subline: slideCopy.subline, cta: slideCopy.cta },
    palette, W, H, detectedFont, correctedDecision, logoLayers,
  )
  if (compositeBuffer) {
    const storagePath = `${companyId}/composites/${jobId}_slide${slideIndex}.png`
    const { error } = await supabase.storage.from('media').upload(storagePath, compositeBuffer, { contentType: 'image/png', upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(storagePath)
      finalSlideUrl = publicUrl
    }
  }

  // Atualiza slide
  slideResults[idx] = {
    index: slideIndex,
    role: slidePlan.role as SlideRole,
    url: finalSlideUrl ?? '',
    copyOutput: slideCopy,
    score: 78,
    status: 'done',
    layoutUsed: correctedDecision.layout,
    styleUsed: correctedDecision.style,
  }

  const allDone = slideResults.every(s => s.status === 'done' || s.status === 'failed')
  await supabase.from('creative_jobs').update({
    carousel_slides: slideResults,
    current_agent: null,
    ...(allDone ? { status: 'done' } : {}),
  }).eq('id', jobId)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiKey = readApiKey()
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

  const { jobId, slideIndex } = await req.json()
  if (!jobId || !slideIndex) return NextResponse.json({ error: 'jobId e slideIndex são obrigatórios' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey })

  runSlideRegeneration({ jobId, slideIndex, supabase, anthropic }).catch(err => {
    console.error('[regenerar-slide] fatal error:', err)
    supabase.from('creative_jobs').update({
      carousel_slides: supabase.from('creative_jobs').select('carousel_slides').eq('id', jobId),
    }).eq('id', jobId)
  })

  return NextResponse.json({ success: true })
}
