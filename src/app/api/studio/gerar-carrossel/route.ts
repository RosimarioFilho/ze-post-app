// v1.2 — Product Staging Engine + Automotive Composition Mode
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { readApiKey, AR_SIZES } from '@/lib/art-utils'
import { generateImage, uploadGeneratedImage } from '@/lib/imageProvider'
import type { CreativeBrief, CarouselSlideResult, SlideRole } from '@/types'
import {
  buildCompositeSVG, layoutImageHint, NICHE_DEFAULTS,
  buildImagePromptEnhancement, applyDecisionCorrections, scorePerceptualQuality,
  NICHE_CREATIVE_DEFAULTS_V3, getLogoPlacement,
  type CreativeDecision, type Layout, type VisualStyle, type TypographyBehavior,
  type EyeFlowPattern, type EmotionalToken, type CameraType,
} from '@/lib/creative-engine'
import {
  prepareLogo, buildLogoCompositeLayers,
  type SharpLayer,
} from '@/lib/brand-asset'
import {
  planCarouselNarrative,
  getSlideLayoutVariations,
  getEnergyProgression,
  validateCarouselConsistency,
  scoreCarousel,
} from '@/lib/carousel-engine'
import {
  analyzeProductStaging, detectAutomotiveContext,
  buildAutomotivePromptDirectives,
  type ProductStagingResult,
} from '@/lib/product-staging'

// ── Retry (igual ao gerar-arte) ───────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, retries = 5, baseDelay = 5000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const status = (err as { status?: number }).status
      const isTransient =
        status === 529 || status === 500 || status === 503
        || msg.includes('529') || msg.includes('overloaded') || msg.includes('overloaded_error')
        || msg.includes('500') || msg.includes('503')
      if (isTransient && attempt < retries) {
        const base = baseDelay * Math.pow(2, attempt)
        const jitter = base * (0.7 + Math.random() * 0.3)
        console.warn(`[carousel] Anthropic overloaded (attempt ${attempt + 1}/${retries}), aguardando ${Math.round(jitter / 1000)}s...`)
        await new Promise(r => setTimeout(r, jitter))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

function parseJson<T>(text: string, fallback: T): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return fallback
  try { return JSON.parse(jsonMatch[0]) as T } catch { return fallback }
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const mediaType = contentType.includes('png') ? 'image/png' as const
      : contentType.includes('gif') ? 'image/gif' as const
      : contentType.includes('webp') ? 'image/webp' as const
      : 'image/jpeg' as const
    const data = Buffer.from(await res.arrayBuffer()).toString('base64')
    return { data, mediaType }
  } catch { return null }
}

async function updateJob(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
  data: Record<string, unknown>,
) {
  await supabase.from('creative_jobs').update(data).eq('id', jobId)
}

// ── Shared helpers from gerar-arte ────────────────────────────

async function downloadGoogleFont(family: string, weight = '700'): Promise<string | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    ).then(r => r.ok ? r.text() : null)
    if (!css) return null
    const urlMatch = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/i)
    if (!urlMatch) return null
    const fontBuf = await fetch(urlMatch[1]).then(r => r.ok ? r.arrayBuffer() : null)
    if (!fontBuf) return null
    const mime = urlMatch[1].includes('.woff2') ? 'font/woff2' : urlMatch[1].includes('.woff') ? 'font/woff' : 'font/ttf'
    return `data:${mime};base64,${Buffer.from(fontBuf).toString('base64')}`
  } catch { return null }
}

async function sharpComposite(
  imageBase64: string,
  copy: { headline: string; subline: string; cta: string; preHeadline?: string },
  palette: Record<string, string>,
  W: number, H: number,
  googleFont?: string,
  decision?: CreativeDecision,
  logoLayers?: SharpLayer[],
): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import('sharp')
    const imageBuffer = Buffer.from(imageBase64, 'base64')

    let fontFaceStyle = ''
    let activeFontFamily = 'Arial Black, Arial, sans-serif'
    if (googleFont) {
      const fontDataUri = await downloadGoogleFont(googleFont, '700')
      if (fontDataUri) {
        fontFaceStyle = `<style>@font-face{font-family:'${googleFont}';src:url('${fontDataUri}');font-weight:700;}</style>`
        activeFontFamily = `'${googleFont}', Arial Black, Arial, sans-serif`
      }
    }

    const activeDecision: CreativeDecision = decision ?? {
      layout: 'HERO_RIGHT', style: 'CINEMATIC', effects: [],
      typography: 'STACKED', composition: 'default', asset_strategy: 'PRODUCT_HERO',
      mood: 'professional', depth: 'MEDIUM', image_direction: '',
    }

    const svg = buildCompositeSVG({
      decision: activeDecision, copy, palette, W, H, fontFaceStyle, fontFamily: activeFontFamily,
    })

    const layers: Parameters<ReturnType<typeof sharp>['composite']>[0] = [
      { input: Buffer.from(svg), top: 0, left: 0 },
      ...(logoLayers ?? []),
    ]

    return await sharp(imageBuffer)
      .resize(W, H, { fit: 'cover', position: 'centre' })
      .composite(layers)
      .png()
      .toBuffer()
  } catch (err) {
    console.warn('[carousel] sharp composite error:', err)
    return null
  }
}

async function removeBackgroundAndUpload(
  imageUrl: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  jobId: string,
): Promise<string | null> {
  const apiKey = process.env.REMOVE_BG_API_KEY
  if (!apiKey) return null
  try {
    const form = new FormData()
    form.append('image_url', imageUrl)
    form.append('size', 'auto')
    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST', headers: { 'X-Api-Key': apiKey }, body: form,
    })
    if (!res.ok) { console.warn('[carousel] remove.bg failed:', res.status); return null }
    const pngBytes = await res.arrayBuffer()
    const pngBlob = new Blob([pngBytes], { type: 'image/png' })
    const storagePath = `${companyId}/nobg/${jobId}.png`
    const { error } = await supabase.storage.from('media').upload(storagePath, pngBlob, { contentType: 'image/png', upsert: true })
    if (error) { console.warn('[carousel] nobg upload error:', error); return null }
    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(storagePath)
    return publicUrl
  } catch (err) {
    console.warn('[carousel] removeBackground error:', err)
    return null
  }
}

// ── POST handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiKey = readApiKey()
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

  const { companyId, contentType, briefing, productImageUrl, hasTransparentBg, referenceImageUrl, slideCount } = await req.json()
  if (!companyId || !briefing)
    return NextResponse.json({ error: 'companyId e briefing são obrigatórios' }, { status: 400 })

  const totalSlides: number = Math.max(3, Math.min(10, slideCount ?? 5))

  const { data: job, error: jobErr } = await supabase
    .from('creative_jobs')
    .insert({
      company_id: companyId,
      created_by: user.id,
      content_type: contentType ?? 'carrossel',
      briefing,
      product_image_url: productImageUrl ?? null,
      status: 'pending',
      progress_pct: 0,
      is_carousel: true,
      carousel_slide_count: totalSlides,
      carousel_slides: [],
    })
    .select('id')
    .single()

  if (jobErr || !job) return NextResponse.json({ error: 'Erro ao criar job' }, { status: 500 })

  const jobId = job.id

  runCarouselPipeline({
    jobId, companyId, contentType: contentType ?? 'carrossel', briefing,
    productImageUrl, hasTransparentBg: !!hasTransparentBg, referenceImageUrl,
    totalSlides, supabase, anthropic: new Anthropic({ apiKey }),
  }).catch(err => {
    console.error('[carousel] pipeline fatal error:', err)
    supabase.from('creative_jobs').update({ status: 'failed', error_message: String(err) }).eq('id', jobId)
  })

  return NextResponse.json({ jobId })
}

// ── Carousel Pipeline ─────────────────────────────────────────

interface CarouselCtx {
  jobId: string; companyId: string; contentType: string; briefing: string
  productImageUrl?: string; hasTransparentBg?: boolean; referenceImageUrl?: string
  totalSlides: number
  supabase: Awaited<ReturnType<typeof createClient>>; anthropic: Anthropic
}

async function runCarouselPipeline(ctx: CarouselCtx) {
  const { jobId, companyId, contentType, briefing, hasTransparentBg, referenceImageUrl, totalSlides, supabase, anthropic } = ctx
  let { productImageUrl } = ctx

  const [W, H] = AR_SIZES['carrossel'] // 1080×1350

  const [{ data: company }, { data: brandKit }] = await Promise.all([
    supabase.from('companies').select('name, primary_color, secondary_color, logo_url, niche').eq('id', companyId).single(),
    supabase.from('brand_kits').select('*').eq('company_id', companyId).maybeSingle(),
  ])

  const pc = company?.primary_color ?? '#052d64'
  const sc = company?.secondary_color ?? '#fe7902'
  const companyName = company?.name ?? 'Sua Empresa'
  const companyLogoUrl = company?.logo_url ?? null
  const niche = company?.niche ?? 'servicos'
  const toneOfVoice = brandKit?.tone_of_voice ?? 'profissional'
  const preferredCtas = (brandKit?.preferred_ctas ?? ['Saiba mais', 'Aproveite']).join(', ')

  try {
    // ── Passo 1: Background Removal (produto) ────────────────
    if (productImageUrl) {
      await updateJob(supabase, jobId, { status: 'bg_removing', current_agent: 'Background Remover', progress_pct: 3 })
      if (!hasTransparentBg) {
        const nobgUrl = await removeBackgroundAndUpload(productImageUrl, supabase, companyId, jobId)
        if (nobgUrl) { productImageUrl = nobgUrl; await updateJob(supabase, jobId, { product_image_nobg_url: nobgUrl }) }
      }
    }

    // ── Passo 1.5: Product Staging Analysis ─────────────────────
    let stagingResult: ProductStagingResult | null = null
    const isAutomotiveContext = detectAutomotiveContext(briefing, niche)

    if (productImageUrl) {
      try {
        const imgForStaging = await fetchImageAsBase64(productImageUrl)
        if (imgForStaging && (imgForStaging.mediaType === 'image/jpeg' || imgForStaging.mediaType === 'image/png' || imgForStaging.mediaType === 'image/webp')) {
          stagingResult = await analyzeProductStaging(
            imgForStaging.data,
            imgForStaging.mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
            briefing,
            anthropic,
          )
          console.log(`[carousel] Product Staging: automotive=${stagingResult.is_automotive} style=${stagingResult.recommended_stage_style}`)
        }
      } catch (err) {
        console.warn('[carousel] Product Staging falhou (non-fatal):', err)
      }
    }
    // Se niche/briefing tem contexto automotivo, garante is_automotive=true
    if (isAutomotiveContext) {
      if (!stagingResult) {
        stagingResult = {
          product_detected: true, product_category: 'vehicle',
          product_main_color: 'unknown', product_luminance: 'medium',
          product_angle: 'front_3_4', product_crop_quality: 'good',
          background_removed: !!productImageUrl,
          recommended_stage_style: 'AUTOMOTIVE_PREMIUM', recommended_layout: 'HERO_RIGHT',
          contrast_risk: 'medium', visual_priority_score: 85,
          is_automotive: true, needs_product_spotlight: false,
          text_zone: 'bottom', overlay_safe_percent: 26,
        }
      } else if (!stagingResult.is_automotive) {
        stagingResult = { ...stagingResult, is_automotive: true, recommended_stage_style: 'AUTOMOTIVE_PREMIUM', overlay_safe_percent: 26 }
      }
    }

    // ── Passo 2: Vision Analyzer ─────────────────────────────
    let visionAnalysis: Record<string, unknown> = {}
    let referenceStyle = ''

    if (productImageUrl || referenceImageUrl) {
      await updateJob(supabase, jobId, { status: 'analyzing', current_agent: 'Vision Analyzer', progress_pct: 6 })

      if (productImageUrl) {
        try {
          const imgBase64 = await fetchImageAsBase64(productImageUrl)
          if (imgBase64) {
            const visionRes = await withRetry(() => anthropic.messages.create({
              model: 'claude-sonnet-4-6', max_tokens: 1024,
              system: `Analista Visual de marketing. Retorne APENAS JSON puro:
{"product_type":"","dominant_colors":[],"secondary_colors":[],"has_face":false,"has_person":false,"object_position":"center","background_type":"clean","best_text_area":"bottom","suggested_visual_style":"premium","product_description":"","observations":"","typography":{"detected":false,"style":"sans-serif","weight":"bold","personality":"modern","google_font":"Montserrat"}}`,
              messages: [{ role: 'user', content: [
                { type: 'image', source: { type: 'base64', media_type: imgBase64.mediaType, data: imgBase64.data } },
                { type: 'text', text: `Analise este produto para um carrossel Instagram. Nicho: ${niche}.` },
              ]}],
            }))
            visionAnalysis = parseJson(visionRes.content[0].type === 'text' ? visionRes.content[0].text : '{}', {})
            await updateJob(supabase, jobId, { vision_analysis: visionAnalysis })
          }
        } catch (err) {
          console.warn('[carousel] Vision Analyzer falhou:', err)
          visionAnalysis = { observations: 'Análise visual indisponível' }
        }
      }

      if (referenceImageUrl) {
        try {
          const refBase64 = await fetchImageAsBase64(referenceImageUrl)
          if (refBase64) {
            const refRes = await withRetry(() => anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001', max_tokens: 512,
              system: `Analise esta imagem de referência e retorne APENAS JSON puro:
{"visual_style":"","composition":"","lighting":"","color_palette":"","typography":{"detected":false,"style":"sans-serif","weight":"bold","personality":"modern","google_font":"Montserrat"}}`,
              messages: [{ role: 'user', content: [
                { type: 'image', source: { type: 'base64', media_type: refBase64.mediaType, data: refBase64.data } },
                { type: 'text', text: 'Analise o estilo visual desta imagem de referência.' },
              ]}],
            }))
            const rawRef = refRes.content[0].type === 'text' ? refRes.content[0].text : '{}'
            const refJson = parseJson<Record<string, unknown>>(rawRef, {})
            referenceStyle = [refJson.visual_style, refJson.composition, refJson.lighting, refJson.color_palette]
              .filter(Boolean).join(' ') || rawRef
            const refTypo = refJson.typography as { google_font?: string } | undefined
            if (refTypo?.google_font && !visionAnalysis.typography) {
              (visionAnalysis as Record<string, unknown>).typography = refTypo
            }
          }
        } catch (err) { console.warn('[carousel] Reference style failed:', err) }
      }
    }

    // ── Passo 3: Palette Intelligence ────────────────────────
    await updateJob(supabase, jobId, { status: 'palette_extracting', current_agent: 'Palette Intelligence', progress_pct: 10 })

    const paletteRes = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 512,
      system: `Especialista em paleta de cores. Retorne APENAS JSON puro:
{"background":"#hex","text_primary":"#hex","text_secondary":"#hex","accent":"#hex","cta_bg":"#hex","cta_text":"#hex","gradient_from":"#hex","gradient_to":"#hex"}`,
      messages: [{ role: 'user', content: `Cor primária: ${pc}\nCor secundária: ${sc}\nAnálise visual: ${JSON.stringify(visionAnalysis)}\nNicho: ${niche}\nTom: ${toneOfVoice}\nFormato: carrossel Instagram 4:5` }],
    }))
    const palette = parseJson<Record<string, string>>(
      paletteRes.content[0].type === 'text' ? paletteRes.content[0].text : '{}',
      { background: pc, text_primary: '#ffffff', accent: sc, cta_bg: sc, cta_text: '#ffffff' }
    )
    await updateJob(supabase, jobId, { palette })

    // ── Passo 4: Estrategista ────────────────────────────────
    await updateJob(supabase, jobId, { status: 'strategizing', current_agent: 'Estrategista', progress_pct: 14 })

    const stratRes = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 512,
      system: `Retorne APENAS JSON puro:
{"objective":"","target_audience":"","main_promise":"","main_pain":"","main_benefit":"","angle":"","tone":""}`,
      messages: [{ role: 'user', content: `Briefing: ${briefing}\nEmpresa: ${companyName}\nNicho: ${niche}\nTom: ${toneOfVoice}\nFormato: carrossel Instagram (${totalSlides} slides)` }],
    }))
    const strategy = parseJson<Record<string, string>>(
      stratRes.content[0].type === 'text' ? stratRes.content[0].text : '{}',
      { angle: briefing, tone: toneOfVoice }
    )
    await updateJob(supabase, jobId, { strategy })

    // ── Passo 5: Copywriter (copy geral) ─────────────────────
    await updateJob(supabase, jobId, { status: 'copywriting', current_agent: 'Copywriter', progress_pct: 18 })

    const copyRes = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 512,
      system: `Retorne APENAS JSON puro:
{"headline":"","subline":"","cta":"","caption":""}
REGRAS:
- Headline: máximo 4 palavras fortes (máx 22 caracteres) — será o gancho do slide 1
- Subline: máx 8 palavras, benefício central da campanha
- CTA: CTA contextual para o último slide (2-5 palavras, humano e persuasivo)
- Caption: legenda para o post completo`,
      messages: [{ role: 'user', content: `Estratégia: ${JSON.stringify(strategy)}\nBriefing: ${briefing}\nEmpresa: ${companyName}\nCTAs da marca: ${preferredCtas}\nNicho: ${niche}\nFormato: carrossel ${totalSlides} slides` }],
    }))
    const campaignCopy = parseJson<{ headline: string; subline: string; cta: string; caption: string }>(
      copyRes.content[0].type === 'text' ? copyRes.content[0].text : '{}',
      { headline: 'OFERTA ESPECIAL', subline: strategy.main_promise ?? '', cta: 'Saiba mais', caption: briefing }
    )
    await updateJob(supabase, jobId, { copy_output: campaignCopy })

    // ── Passo 6: Diretor Criativo ─────────────────────────────
    await updateJob(supabase, jobId, { status: 'creative_directing', current_agent: 'Diretor Criativo IA', progress_pct: 22 })

    const NICHE_ARCHETYPES_FALLBACK = {
      archetype: 'profissional_moderno',
      campaign_emotion: 'confiança + solução',
      visual_style: 'profissional moderno e limpo',
      photography_style: 'produto em destaque com fundo limpo',
      lighting: 'luz natural suave',
      color_mood: 'cores da marca com fundo clean',
      forbidden: [] as string[],
      required: ['produto em destaque'] as string[],
      content_safety: 'safe_for_all' as const,
    }

    const creativeDirRes = await withRetry(() => anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 1024,
      system: `Diretor Criativo sênior para carrosséis Instagram premium. Retorne APENAS JSON com esta estrutura exata:
{"niche_key":"","archetype":"","campaign_emotion":"","target_audience":"","visual_style":"","photography_style":"","lighting":"","composition":"","color_mood":"","forbidden_elements":[],"required_elements":[],"content_safety":"safe_for_all"}
O estilo visual DEVE ser coerente em todos os ${totalSlides} slides do carrossel.`,
      messages: [{ role: 'user', content: `Empresa: ${companyName}\nNicho: ${niche}\nCores: primária=${pc} secundária=${sc}\nFormato: carrossel Instagram ${totalSlides} slides (1080×1350px, 4:5)\nBriefing: ${briefing}\nEstratégia: ${JSON.stringify(strategy)}\nCopy: ${JSON.stringify(campaignCopy)}\nPaleta: ${JSON.stringify(palette)}\nTem produto: ${!!productImageUrl}\nAnálise: ${JSON.stringify(visionAnalysis)}` }],
    }))
    const creativeBrief: CreativeBrief = parseJson<CreativeBrief>(
      creativeDirRes.content[0].type === 'text' ? creativeDirRes.content[0].text : '{}',
      {
        niche_key: niche, archetype: NICHE_ARCHETYPES_FALLBACK.archetype,
        campaign_emotion: NICHE_ARCHETYPES_FALLBACK.campaign_emotion,
        target_audience: strategy.target_audience ?? 'público geral',
        visual_style: NICHE_ARCHETYPES_FALLBACK.visual_style,
        photography_style: NICHE_ARCHETYPES_FALLBACK.photography_style,
        lighting: NICHE_ARCHETYPES_FALLBACK.lighting,
        composition: 'produto centralizado, espaço para texto',
        color_mood: NICHE_ARCHETYPES_FALLBACK.color_mood,
        forbidden_elements: NICHE_ARCHETYPES_FALLBACK.forbidden,
        required_elements: NICHE_ARCHETYPES_FALLBACK.required,
        content_safety: NICHE_ARCHETYPES_FALLBACK.content_safety,
      }
    )
    await updateJob(supabase, jobId, { creative_brief: creativeBrief })

    // ── Passo 7: Planejador de Narrativa ──────────────────────
    await updateJob(supabase, jobId, { status: 'carousel_planning', current_agent: 'Planejador de Narrativa', progress_pct: 28 })

    const narrativePlan = await planCarouselNarrative(
      anthropic, briefing,
      { name: companyName, niche, primary_color: pc },
      strategy,
      { headline: campaignCopy.headline, cta: campaignCopy.cta },
      totalSlides,
    )
    await updateJob(supabase, jobId, { carousel_plan: narrativePlan })

    // ── Passo 8: Preparar Logo (uma única vez) ────────────────
    let logoLayersCache: SharpLayer[] | undefined
    let logoLayoutCache: Layout = 'HERO_RIGHT'

    if (companyLogoUrl) {
      try {
        const removeBgKey = process.env.REMOVE_BG_API_KEY
        const initStyle = stagingResult?.is_automotive ? stagingResult.recommended_stage_style : 'CINEMATIC'
        const initDensity = stagingResult?.is_automotive ? 'PREMIUM' : 'ENERGETIC'
        const prepared = await prepareLogo(
          companyLogoUrl, supabase, companyId,
          initStyle, initDensity, removeBgKey,
        )
        if (prepared) {
          const placement = getLogoPlacement('HERO_RIGHT', W, H, stagingResult?.is_automotive)
          logoLayersCache = await buildLogoCompositeLayers(prepared, placement, W, H)
          console.log(`[carousel] logo pronta: mode=${prepared.mode}`)
        }
      } catch (logoErr) {
        console.warn('[carousel] brand-asset skip:', logoErr)
      }
    }

    // Detecta fonte uma única vez
    const detectedFont = (visionAnalysis.typography as { google_font?: string })?.google_font ?? undefined

    // Prepara produto base64 para geração (compartilhado)
    let productBase64ForGen: string | undefined
    let productMimeForGen: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | undefined
    if (productImageUrl) {
      const imgData = await fetchImageAsBase64(productImageUrl)
      if (imgData) { productBase64ForGen = imgData.data; productMimeForGen = imgData.mediaType }
    }

    const layouts = getSlideLayoutVariations(totalSlides)
    const energies = getEnergyProgression(totalSlides)
    const nicheDefaults = NICHE_DEFAULTS[niche] ?? NICHE_DEFAULTS['servicos'] ?? {}
    const nicheV3Defaults = NICHE_CREATIVE_DEFAULTS_V3[niche] ?? NICHE_CREATIVE_DEFAULTS_V3['servicos']

    // Inicializa array de slides
    const slideResults: CarouselSlideResult[] = narrativePlan.slides.map(s => ({
      index: s.index,
      role: s.role as SlideRole,
      url: '',
      copyOutput: { headline: s.headline, subline: s.subline, cta: s.cta },
      score: 0,
      status: 'pending',
    }))
    await updateJob(supabase, jobId, { carousel_slides: slideResults })

    // ── Passo 9: Loop por slide ───────────────────────────────
    await updateJob(supabase, jobId, { status: 'carousel_generating' })

    for (let i = 0; i < totalSlides; i++) {
      const slidePlan = narrativePlan.slides[i]
      const slideLayout = layouts[i]
      const slideEnergy = energies[i]
      const slideIndex = i + 1
      const progress = Math.round(30 + (i / totalSlides) * 65)

      // Guarda defensiva: não deve acontecer após as correções no carousel-engine,
      // mas evita crash se o plano vier com menos slides que o esperado
      if (!slidePlan) {
        console.warn(`[carousel] slide ${slideIndex} sem plano — pulando`)
        slideResults[i] = { ...slideResults[i], status: 'failed', errorMessage: 'Plano de narrativa ausente para este slide' }
        await updateJob(supabase, jobId, { carousel_slides: slideResults })
        continue
      }

      await updateJob(supabase, jobId, {
        current_agent: `Slide ${slideIndex}/${totalSlides} — ${slidePlan.role}`,
        progress_pct: progress,
      })

      // Marca slide como gerando
      slideResults[i] = { ...slideResults[i], status: 'generating' }
      await updateJob(supabase, jobId, { carousel_slides: slideResults })

      try {
        // ── 9a: Copywriter slide-específico ──
        const isAutoSlide = stagingResult?.is_automotive
        const slideCopySystem = isAutoSlide
          ? `Retorne APENAS JSON puro:
{"preHeadline":"","headline":"","subline":"","cta":"","caption":""}
MODO AUTOMOTIVO — REGRAS:
- preHeadline: modelo + ano do veículo (ex: "FIORINO 2026"). MAIÚSCULAS.
- headline: tagline impactante em 2 linhas separadas por \\n. ÚLTIMA linha em destaque accent. MAIÚSCULAS.
- subline: frase curta de benefício + pipe + 3 benefícios (máx 3 palavras cada). Ex: "Performance incomparável. | POTÊNCIA REAL | BAIXO CONSUMO | ALTA DURABILIDADE"
- cta: número de WhatsApp extraído do briefing OU "AGENDE SEU TEST DRIVE" se role=CTA, senão número.
- caption: legenda com emojis e hashtags automotivas.`
          : `Retorne APENAS JSON puro:
{"headline":"","subline":"","cta":"","caption":""}
Headline: máx 4 palavras impactantes (máx 22 chars)
Subline: máx 8 palavras focadas no objetivo do slide
CTA: só para o slide final (2-5 palavras)`

        const slideCopyRes = await withRetry(() => anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001', max_tokens: 400,
          system: slideCopySystem,
          messages: [{ role: 'user', content: `Slide ${slideIndex}/${totalSlides} — Role: ${slidePlan.role}
Objetivo: ${slidePlan.objective}
Rascunho headline: "${slidePlan.headline}"
Rascunho subline: "${slidePlan.subline}"
${slidePlan.cta ? `CTA sugerido: "${slidePlan.cta}"` : ''}
Empresa: ${companyName} | Nicho: ${niche}
Copy geral da campanha: ${JSON.stringify(campaignCopy)}
Tom: ${toneOfVoice}` }],
        }))
        const slideCopyRaw = parseJson<{ headline: string; subline: string; cta: string; caption: string; preHeadline?: string }>(
          slideCopyRes.content[0].type === 'text' ? slideCopyRes.content[0].text : '{}',
          { headline: slidePlan.headline, subline: slidePlan.subline, cta: slidePlan.cta ?? '', caption: '' }
        )
        const slideCopy = { ...slideCopyRaw }

        // ── 9b: Creative Decision Engine (layout+energia por slide) ──
        const slideStyleDefault = stagingResult?.is_automotive
          ? (stagingResult.recommended_stage_style as VisualStyle)
          : (nicheDefaults.style ?? 'CINEMATIC') as VisualStyle
        const automotiveNote = stagingResult?.is_automotive
          ? `\nMODO AUTOMOTIVO: use style="${slideStyleDefault}", effects=[], emotional_density PREMIUM ou CINEMATIC.`
          : ''

        const decisionRes = await withRetry(() => anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001', max_tokens: 512,
          system: `Retorne APENAS JSON puro:
{"layout":"${slideLayout}","style":"${slideStyleDefault}","effects":[],"typography":"STACKED","composition":"","asset_strategy":"PRODUCT_HERO","mood":"","depth":"MEDIUM","image_direction":"","eye_flow":"HERO_TO_CTA","emotional_density":"${slideEnergy}","camera_type":"CENTER_HERO"}
O layout JÁ está definido como "${slideLayout}" — não altere. Defina os outros campos.`,
          messages: [{ role: 'user', content: `Slide ${slideIndex}/${totalSlides} — Role: ${slidePlan.role}
Nicho: ${niche}
Emoção da campanha: ${creativeBrief.campaign_emotion}
Estilo visual: ${creativeBrief.visual_style}
Objetivo do slide: ${slidePlan.objective}
Energia: ${slideEnergy}
Formato: ${W}×${H}px (4:5 carrossel)
Default v3: ${JSON.stringify(nicheV3Defaults)}${automotiveNote}` }],
        }))
        const rawDecision = parseJson<CreativeDecision>(
          decisionRes.content[0].type === 'text' ? decisionRes.content[0].text : '{}',
          {
            layout: slideLayout as Layout,
            style: slideStyleDefault,
            effects: [],
            typography: (nicheDefaults.typography ?? 'STACKED') as TypographyBehavior,
            composition: creativeBrief.composition,
            asset_strategy: 'PRODUCT_HERO',
            mood: creativeBrief.campaign_emotion,
            depth: 'MEDIUM',
            image_direction: '',
            eye_flow: (nicheV3Defaults?.eye_flow ?? 'HERO_TO_CTA') as EyeFlowPattern,
            emotional_density: slideEnergy as EmotionalToken,
            camera_type: (nicheV3Defaults?.camera_type ?? 'CENTER_HERO') as CameraType,
          }
        )
        // Força o layout correto mesmo se o modelo ignorou
        rawDecision.layout = slideLayout as Layout
        rawDecision.emotional_density = slideEnergy as EmotionalToken
        // Força estilo automotivo
        if (stagingResult?.is_automotive && !(rawDecision.style as string).startsWith('AUTOMOTIVE')) {
          rawDecision.style = slideStyleDefault
          rawDecision.effects = []
        }

        const correctedDecision = applyDecisionCorrections(rawDecision)
        const perceptualScore = scorePerceptualQuality(correctedDecision)
        console.log(`[carousel] Slide ${slideIndex} Visual Score: ${perceptualScore.score} style=${correctedDecision.style}`)

        // ── 9c: Visual Prompt Engineer ──
        const productDesc = visionAnalysis.product_description
          ? `The EXACT product to feature: ${visionAnalysis.product_description}. Place it PROMINENTLY.`
          : productImageUrl ? 'A product is provided. Place it PROMINENTLY as the hero.' : ''
        const referenceNote = referenceStyle ? `\nVisual reference style: ${referenceStyle}` : ''
        const layoutHint = layoutImageHint(correctedDecision.layout)
        const promptEnhancement = buildImagePromptEnhancement(correctedDecision, niche)
        const logoPlacement = companyLogoUrl ? getLogoPlacement(correctedDecision.layout, W, H, stagingResult?.is_automotive) : null
        const logoNote = logoPlacement
          ? `\nLogo will be placed at ${logoPlacement.corner} corner — keep that area clean.`
          : ''
        const automotiveDirectives = stagingResult?.is_automotive
          ? `\nAUTOMOTIVE ART DIRECTION: ${buildAutomotivePromptDirectives(stagingResult, stagingResult.overlay_safe_percent)}`
          : ''

        const promptEngineerRes = await withRetry(() => anthropic.messages.create({
          model: 'claude-sonnet-4-6', max_tokens: 500,
          system: `Expert Visual Prompt Engineer for AI image generation.
Create a single highly detailed commercial advertising photography prompt in English.
CRITICAL: Describe ONLY the scene. NO text, words, headlines, logos or typography in the prompt — text is added as overlay.
${stagingResult?.is_automotive ? 'You are specialized in PREMIUM AUTOMOTIVE ADVERTISING. The vehicle MUST be the undisputed hero — never allow dark overlays or fog to obscure the vehicle body.' : ''}
Return ONLY the prompt text. No explanations, no JSON, no markdown.`,
          messages: [{ role: 'user', content: `Carousel slide ${slideIndex}/${totalSlides} — Role: ${slidePlan.role}
Company: ${companyName} | Briefing: "${briefing}"
Slide objective: ${slidePlan.objective}
${productDesc}
Visual style: ${creativeBrief.visual_style}
Photography: ${creativeBrief.photography_style}
Lighting: ${creativeBrief.lighting}
Color mood: ${creativeBrief.color_mood}
Layout: ${correctedDecision.layout} — ${layoutHint}
Style: ${correctedDecision.style} | Energy: ${slideEnergy}
Required elements: ${creativeBrief.required_elements.join(', ')}
Forbidden: ${creativeBrief.forbidden_elements.join(', ')}
Dimensions: ${W}×${H}px (4:5)${referenceNote}${logoNote}${automotiveDirectives}
Photographic guidance: ${promptEnhancement}
${correctedDecision.image_direction ? `Direction: ${correctedDecision.image_direction}` : ''}

RULES:
- Maintain visual consistency with the campaign (same style/lighting/palette)
- Vary composition from other slides: ${slideLayout} layout
- 60-80 words, photographic/cinematography terminology
- End with: "commercial advertising photography, studio quality, sharp focus, no text, no watermarks"` }],
        }))

        const imagePrompt = promptEngineerRes.content[0].type === 'text'
          ? promptEngineerRes.content[0].text.trim()
          : `${creativeBrief.photography_style}, ${creativeBrief.lighting}, commercial advertising photography, no text, no watermarks`

        // ── 9d: Image Generation ──
        const imageResult = await generateImage(imagePrompt, 'carrossel', W, H, productBase64ForGen, productMimeForGen)
        const rawImageUrl = await uploadGeneratedImage(
          imageResult.base64, imageResult.mimeType, supabase, companyId, jobId, `_slide${slideIndex}`
        )

        // ── 9e: Visual Review (1 tentativa de refinamento) ──
        let currentImageBase64 = imageResult.base64
        let currentImageMime = imageResult.mimeType
        let currentImageUrl = rawImageUrl
        let finalScore = 75

        try {
          const critiqueRes = await withRetry(() => anthropic.messages.create({
            model: 'claude-sonnet-4-6', max_tokens: 400,
            system: `Avaliador de imagens publicitárias. Retorne APENAS JSON:
{"score":0,"passed":false,"issues":[{"rule":"","severity":"high","suggestion":""}]}`,
            messages: [{ role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: currentImageMime, data: currentImageBase64 } },
              { type: 'text', text: `Avalie slide ${slideIndex}/${totalSlides} (role: ${slidePlan.role}) do carrossel.
Critérios: qualidade técnica (0-30) + estilo correto para nicho "${niche}" (0-25) + impacto visual (0-25) + espaço para texto (0-20).
passed = score >= 65` },
            ]}],
          }))
          const critique = parseJson<{ score: number; passed: boolean; issues: Array<{ rule: string; suggestion: string }> }>(
            critiqueRes.content[0].type === 'text' ? critiqueRes.content[0].text : '{}',
            { score: 75, passed: true, issues: [] }
          )
          finalScore = typeof critique.score === 'number' ? critique.score : 75

          // Regenera uma vez se score baixo
          if (!critique.passed && finalScore < 65) {
            const issuesList = (critique.issues ?? []).map(i => `- ${i.rule}: ${i.suggestion}`).join('\n')
            const refinedRes = await withRetry(() => anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001', max_tokens: 300,
              system: 'Refine the image prompt to fix the issues. Return ONLY the improved prompt.',
              messages: [{ role: 'user', content: `Original: "${imagePrompt}"\n\nFix:\n${issuesList}\n\n60-80 words. End with "commercial advertising photography, no text, no watermarks"` }],
            }))
            const refinedPrompt = refinedRes.content[0].type === 'text' ? refinedRes.content[0].text.trim() : imagePrompt
            const newResult = await generateImage(refinedPrompt, 'carrossel', W, H, productBase64ForGen)
            const newUrl = await uploadGeneratedImage(newResult.base64, newResult.mimeType, supabase, companyId, jobId, `_slide${slideIndex}v2`)
            currentImageBase64 = newResult.base64
            currentImageMime = newResult.mimeType
            currentImageUrl = newUrl
            finalScore = 70
          }
        } catch (critiqueErr) {
          console.warn(`[carousel] Visual Review slide ${slideIndex} falhou:`, critiqueErr)
          finalScore = 80
        }

        // ── 9f: Sharp Compositor ──
        let finalSlideUrl = currentImageUrl

        if (currentImageBase64) {
          // Atualiza logo layers para o layout correto deste slide
          let slideLogoLayers = logoLayersCache
          if (companyLogoUrl && correctedDecision.layout !== logoLayoutCache) {
            try {
              const removeBgKey = process.env.REMOVE_BG_API_KEY
              const prepared = await prepareLogo(
                companyLogoUrl, supabase, companyId,
                correctedDecision.style, correctedDecision.emotional_density, removeBgKey,
              )
              if (prepared) {
                const placement = getLogoPlacement(correctedDecision.layout, W, H)
                slideLogoLayers = await buildLogoCompositeLayers(prepared, placement, W, H)
                logoLayoutCache = correctedDecision.layout
              }
            } catch { /* usa o cache anterior */ }
          }

          try {
            const compositeBuffer = await sharpComposite(
              currentImageBase64,
              { headline: slideCopy.headline, subline: slideCopy.subline, cta: slideCopy.cta, preHeadline: slideCopy.preHeadline },
              palette, W, H, detectedFont, correctedDecision, slideLogoLayers,
            )
            if (compositeBuffer) {
              const storagePath = `${companyId}/composites/${jobId}_slide${slideIndex}.png`
              const { error } = await supabase.storage
                .from('media')
                .upload(storagePath, compositeBuffer, { contentType: 'image/png', upsert: true })
              if (!error) {
                const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(storagePath)
                finalSlideUrl = publicUrl
              }
            }
          } catch (compErr) {
            console.warn(`[carousel] Composição slide ${slideIndex} falhou:`, compErr)
          }
        }

        // ── Atualiza slide no array ──
        slideResults[i] = {
          index: slideIndex,
          role: slidePlan.role as SlideRole,
          url: finalSlideUrl ?? '',
          copyOutput: {
            headline: slideCopy.headline,
            subline: slideCopy.subline,
            cta: slideCopy.cta || undefined,
            caption: slideCopy.caption || undefined,
          },
          score: finalScore,
          status: 'done',
          layoutUsed: correctedDecision.layout,
          styleUsed: correctedDecision.style,
        }

      } catch (slideErr) {
        console.error(`[carousel] Slide ${slideIndex} falhou:`, slideErr)
        slideResults[i] = {
          ...slideResults[i],
          status: 'failed',
          errorMessage: String(slideErr),
        }
        // Slide 1 (HOOK) crítico — aborta o job
        if (slideIndex === 1) {
          await updateJob(supabase, jobId, {
            carousel_slides: slideResults,
            status: 'failed',
            error_message: `Slide 1 (HOOK) falhou: ${String(slideErr)}`,
          })
          return
        }
      }

      // Salva progresso incremental após cada slide
      await updateJob(supabase, jobId, { carousel_slides: slideResults })
    }

    // ── Passo 10: Validação e Score final ─────────────────────
    const { issues: consistencyIssues } = validateCarouselConsistency(slideResults, totalSlides)
    if (consistencyIssues.length > 0) {
      console.warn('[carousel] Consistency issues:', consistencyIssues)
    }

    const { overallScore } = scoreCarousel(narrativePlan, slideResults)

    await updateJob(supabase, jobId, {
      status: 'done',
      current_agent: null,
      progress_pct: 100,
      visual_score: overallScore,
      carousel_slides: slideResults,
      // Usa o URL do primeiro slide como thumbnail no final_png_url
      final_png_url: slideResults.find(s => s.status === 'done')?.url ?? null,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[carousel] pipeline error:', err)
    await updateJob(supabase, jobId, { status: 'failed', error_message: msg })
  }
}
