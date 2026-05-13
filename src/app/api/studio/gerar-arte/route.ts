import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { readApiKey, AR_SIZES } from '@/lib/art-utils'
import { generateImage, uploadGeneratedImage, NoProviderError } from '@/lib/imageProvider'
import type { CreativeBrief } from '@/types'
import {
  buildCompositeSVG, layoutImageHint, NICHE_DEFAULTS,
  buildImagePromptEnhancement, applyDecisionCorrections,
  NICHE_CREATIVE_DEFAULTS_V3, getLogoPlacement,
  type CreativeDecision, type Layout, type VisualStyle, type TypographyBehavior,
  type EyeFlowPattern, type EmotionalToken, type CameraType,
} from '@/lib/creative-engine'

// ── Retry (trata 529 overloaded e 500 transientes) ────────────
// 5 tentativas, backoff exponencial com jitter: ~5s, 10s, 20s, 40s, 80s

async function withRetry<T>(fn: () => Promise<T>, retries = 5, baseDelay = 5000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Verifica status code via propriedade da SDK ou via texto da mensagem
      const status = (err as { status?: number }).status
      const isTransient =
        status === 529 || status === 500 || status === 503
        || msg.includes('529') || msg.includes('overloaded') || msg.includes('overloaded_error')
        || msg.includes('500') || msg.includes('503')
      if (isTransient && attempt < retries) {
        // Jitter: delay base × 2^attempt + random 0-30%
        const base = baseDelay * Math.pow(2, attempt)
        const jitter = base * (0.7 + Math.random() * 0.3)
        console.warn(`[studio] Anthropic overloaded (attempt ${attempt + 1}/${retries}), aguardando ${Math.round(jitter / 1000)}s...`)
        await new Promise(r => setTimeout(r, jitter))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

// ── Helpers ───────────────────────────────────────────────────

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

// ── Sharp Composite (text overlay server-side) ────────────────

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
  copy: { headline: string; subline: string; cta: string },
  palette: Record<string, string>,
  W: number, H: number,
  googleFont?: string,
  decision?: CreativeDecision,
  logoUrl?: string,
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

    // Fallback: decisão padrão se não fornecida
    const activeDecision: CreativeDecision = decision ?? {
      layout: 'HERO_RIGHT', style: 'CINEMATIC', effects: [],
      typography: 'STACKED', composition: 'default', asset_strategy: 'PRODUCT_HERO',
      mood: 'professional', depth: 'MEDIUM', image_direction: '',
    }

    const svg = buildCompositeSVG({
      decision: activeDecision, copy, palette, W, H, fontFaceStyle, fontFamily: activeFontFamily,
    })

    // Camadas de composição: imagem base → overlay SVG → logo (se existir)
    const layers: Parameters<ReturnType<typeof sharp>['composite']>[0] = [
      { input: Buffer.from(svg), top: 0, left: 0 },
    ]

    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl)
        if (logoRes.ok) {
          const logoBuf = Buffer.from(await logoRes.arrayBuffer())
          const placement = getLogoPlacement(activeDecision.layout, W, H)

          // Redimensiona logo mantendo proporção, sem fundo (PNG transparente)
          const logoResized = await sharp(logoBuf)
            .resize(placement.targetW, undefined, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer()

          // Garante que x e y não saem do canvas
          const meta = await sharp(logoResized).metadata()
          const lw = meta.width ?? placement.targetW
          const lh = meta.height ?? Math.round(placement.targetW * 0.5)
          const safeX = Math.max(0, Math.min(placement.x, W - lw))
          const safeY = Math.max(0, Math.min(placement.y, H - lh))

          layers.push({ input: logoResized, top: safeY, left: safeX, blend: 'over' })
          console.log(`[studio] logo composto: ${placement.corner} (${safeX},${safeY}) ${lw}×${lh}px`)
        }
      } catch (logoErr) {
        console.warn('[studio] logo composite skip:', logoErr)
      }
    }

    return await sharp(imageBuffer)
      .resize(W, H, { fit: 'cover', position: 'centre' })
      .composite(layers)
      .png()
      .toBuffer()
  } catch (err) {
    console.warn('[studio] sharp composite error:', err)
    return null
  }
}

async function uploadCompositePng(
  pngBytes: Buffer,
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  jobId: string,
): Promise<string | null> {
  const storagePath = `${companyId}/composites/${jobId}.png`
  const { error } = await supabase.storage
    .from('media')
    .upload(storagePath, pngBytes, { contentType: 'image/png', upsert: true })
  if (error) { console.warn('[studio] composite upload error:', error); return null }
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(storagePath)
  return publicUrl
}

// ── Background Removal ────────────────────────────────────────

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
    if (!res.ok) { console.warn('[studio] remove.bg failed:', res.status); return null }
    const pngBytes = await res.arrayBuffer()
    const pngBlob = new Blob([pngBytes], { type: 'image/png' })
    const storagePath = `${companyId}/nobg/${jobId}.png`
    const { error } = await supabase.storage.from('media').upload(storagePath, pngBlob, { contentType: 'image/png', upsert: true })
    if (error) { console.warn('[studio] nobg upload error:', error); return null }
    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(storagePath)
    return publicUrl
  } catch (err) {
    console.warn('[studio] removeBackground error:', err)
    return null
  }
}

// ── Niche Archetypes ──────────────────────────────────────────

const NICHE_ARCHETYPES: Record<string, {
  archetype: string; campaign_emotion: string; visual_style: string
  photography_style: string; lighting: string; color_mood: string
  forbidden: string[]; required: string[]
  content_safety: 'safe_for_all' | 'general_adult'
}> = {
  academia: {
    archetype: 'neon_agressivo', campaign_emotion: 'urgência + conquista',
    visual_style: 'cinematográfico escuro com neon',
    photography_style: 'atleta em ação musculosa, suor, determinação',
    lighting: 'luz lateral dura com halo neon verde ou azul',
    color_mood: 'escuro (quase preto) com neon vibrante',
    forbidden: ['criança', 'alimentos', 'animais'], required: ['pessoa ativa', 'ambiente fitness'],
    content_safety: 'general_adult',
  },
  infantil: {
    archetype: 'colorido_alegre', campaign_emotion: 'alegria + segurança',
    visual_style: 'pastel vibrante limpo',
    photography_style: 'criança feliz sorrindo, brinquedos coloridos, ambiente seguro',
    lighting: 'luz natural suave e uniforme', color_mood: 'cores primárias vibrantes fundo claro',
    forbidden: ['violência', 'sensual', 'adulto', 'álcool', 'cigarro', 'moda masculina genérica', 'poses de influencer'],
    required: ['criança sorridente', 'ambiente seguro', 'cores alegres'],
    content_safety: 'safe_for_all',
  },
  luxo: {
    archetype: 'luxo_minimalista', campaign_emotion: 'exclusividade + desejo',
    visual_style: 'editorial minimalista premium',
    photography_style: 'produto isolado sobre superfície elegante, reflexo suave',
    lighting: 'luz de estúdio suave lateral, sombras limpas', color_mood: 'preto ou branco com dourado sutil',
    forbidden: ['lotação', 'cores berrantes', 'elementos infantis'],
    required: ['espaço em branco', 'produto central', 'acabamento premium'],
    content_safety: 'general_adult',
  },
  politica: {
    archetype: 'institucional_impactante', campaign_emotion: 'confiança + liderança',
    visual_style: 'fotográfico sério com overlay de cor sólida',
    photography_style: 'líder em pose confiante, bandeira ao fundo, multidão',
    lighting: 'luz frontal profissional, sem sombras dramáticas',
    color_mood: 'cores da bandeira ou da campanha com overlay escuro',
    forbidden: ['humor', 'cores excessivas', 'animação'], required: ['rosto do candidato', 'número eleitoral'],
    content_safety: 'safe_for_all',
  },
  offroad: {
    archetype: 'aventura_bruto', campaign_emotion: 'liberdade + adrenalina',
    visual_style: 'fotográfico selvagem com grain cinematográfico',
    photography_style: 'veículo em trilha de terra/lama, pôr do sol dramático',
    lighting: 'luz dourada de pôr do sol ou tempestade', color_mood: 'terroso cálido com laranja e marrom',
    forbidden: ['cidade', 'fundo branco', 'elegância'], required: ['natureza', 'veículo off-road', 'terreno irregular'],
    content_safety: 'general_adult',
  },
  tecnologia: {
    archetype: 'tech_futurista', campaign_emotion: 'inovação + poder',
    visual_style: 'futurista com glow neon azul',
    photography_style: 'dispositivo ou interface com fundo escuro, luzes neon',
    lighting: 'luz ambiente escura com pontos de luz neon azul', color_mood: 'preto profundo com azul neon e ciano',
    forbidden: ['rural', 'vintage', 'quente'], required: ['tecnologia', 'interface digital', 'fundo escuro'],
    content_safety: 'general_adult',
  },
  eventos: {
    archetype: 'eventos_explosivo', campaign_emotion: 'euforia + não pode perder',
    visual_style: 'vibrante festival com cores saturadas',
    photography_style: 'multidão animada, palco com luzes coloridas, efeitos de luz',
    lighting: 'luzes de palco coloridas, fumaça dramática',
    color_mood: 'gradiente angular de cores vibrantes (rosa, roxo, laranja)',
    forbidden: ['silêncio', 'minimalismo', 'tons apagados'], required: ['energia', 'pessoas animadas', 'luzes coloridas'],
    content_safety: 'general_adult',
  },
  beleza: {
    archetype: 'beleza_editorial', campaign_emotion: 'desejo + autoconfiança',
    visual_style: 'editorial moda suave e elegante',
    photography_style: 'produto de beleza em close-up com textura de pele, floral sutil',
    lighting: 'luz difusa suave de estúdio, tons quentes', color_mood: 'nude, rosa claro, dourado suave',
    forbidden: ['bruto', 'escuro demais', 'masculino agressivo'],
    required: ['produto em destaque', 'estética limpa', 'luz suave'],
    content_safety: 'general_adult',
  },
  alimentacao: {
    archetype: 'food_apetitoso', campaign_emotion: 'fome + desejo imediato',
    visual_style: 'food photography apetitosa e quente',
    photography_style: 'comida em close-up com vapor, texturas, cores saturadas',
    lighting: 'luz quente lateral de janela ou vela, sombras suaves',
    color_mood: 'tons quentes terrosos com vermelho e laranja',
    forbidden: ['frio', 'azul dominante', 'alimentos com aspecto ruim'],
    required: ['comida apetitosa', 'textura visível', 'iluminação quente'],
    content_safety: 'safe_for_all',
  },
  servicos: {
    archetype: 'servicos_profissional', campaign_emotion: 'confiança + solução',
    visual_style: 'profissional moderno e limpo',
    photography_style: 'profissional sorridente em ambiente de trabalho moderno',
    lighting: 'luz natural de escritório ou estúdio neutro', color_mood: 'azul corporativo com branco e cinza',
    forbidden: ['caótico', 'muito dark', 'animação excessiva'],
    required: ['rosto humano', 'ambiente profissional', 'clareza visual'],
    content_safety: 'safe_for_all',
  },
  imobiliaria: {
    archetype: 'imovel_aspiracional', campaign_emotion: 'sonho + realização',
    visual_style: 'fotográfico arquitetural premium',
    photography_style: 'imóvel em ângulo amplo, luz natural, acabamento visto',
    lighting: 'luz natural abundante, golden hour exterior',
    color_mood: 'branco e bege com verde natural ou azul céu',
    forbidden: ['escuro', 'bagunçado', 'animação infantil'],
    required: ['espaço amplo', 'luz natural', 'acabamento visível'],
    content_safety: 'safe_for_all',
  },
  educacao: {
    archetype: 'educacao_inspirador', campaign_emotion: 'crescimento + possibilidade',
    visual_style: 'inspirador e acolhedor com cores vivas',
    photography_style: 'pessoa estudando ou ensinando com sorriso, ambiente de aprendizado',
    lighting: 'luz natural alegre e uniforme', color_mood: 'amarelo, azul e verde vibrantes com fundo branco',
    forbidden: ['violência', 'sensual', 'adulto', 'poses de influencer'],
    required: ['aprendizado', 'pessoas sorridentes', 'ambiente organizado'],
    content_safety: 'safe_for_all',
  },
  ecommerce: {
    archetype: 'ecommerce_conversao', campaign_emotion: 'urgência + oferta irresistível',
    visual_style: 'produto hero com selos de oferta',
    photography_style: 'produto em fundo limpo com sombra, etiqueta de preço visível',
    lighting: 'luz de estúdio limpa e uniforme', color_mood: 'vermelho, laranja ou verde com branco, cores de ação',
    forbidden: ['vago', 'sem produto', 'cores apagadas'],
    required: ['produto em destaque', 'preço ou desconto', 'senso de urgência'],
    content_safety: 'safe_for_all',
  },
  moda: {
    archetype: 'moda_editorial', campaign_emotion: 'aspiração + identidade',
    visual_style: 'editorial de moda assimétrico e ousado',
    photography_style: 'modelo em pose editorial, roupa em destaque, fundo minimalista',
    lighting: 'luz dramática lateral ou front-fill suave',
    color_mood: 'monocromático ou paleta limitada de 2 cores fortes',
    forbidden: ['genérico', 'bagunçado', 'excesso de elementos'],
    required: ['roupa bem visível', 'pose editorial', 'fundo limpo'],
    content_safety: 'general_adult',
  },
}

// ── Main Orchestration ────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiKey = readApiKey()
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

  const { companyId, contentType, briefing, productImageUrl, hasTransparentBg, referenceImageUrl } = await req.json()
  if (!companyId || !contentType || !briefing)
    return NextResponse.json({ error: 'companyId, contentType e briefing são obrigatórios' }, { status: 400 })

  const { data: job, error: jobErr } = await supabase
    .from('creative_jobs')
    .insert({ company_id: companyId, created_by: user.id, content_type: contentType, briefing, product_image_url: productImageUrl ?? null, status: 'pending', progress_pct: 0 })
    .select('id')
    .single()

  if (jobErr || !job) return NextResponse.json({ error: 'Erro ao criar job' }, { status: 500 })

  const jobId = job.id

  runPipeline({ jobId, companyId, contentType, briefing, productImageUrl, hasTransparentBg: !!hasTransparentBg, referenceImageUrl, supabase, anthropic: new Anthropic({ apiKey }) })
    .catch(err => {
      console.error('[studio] pipeline fatal error:', err)
      supabase.from('creative_jobs').update({ status: 'failed', error_message: String(err) }).eq('id', jobId)
    })

  return NextResponse.json({ jobId })
}

// ── Pipeline ─────────────────────────────────────────────────

interface PipelineCtx {
  jobId: string; companyId: string; contentType: string; briefing: string
  productImageUrl?: string; hasTransparentBg?: boolean; referenceImageUrl?: string
  supabase: Awaited<ReturnType<typeof createClient>>; anthropic: Anthropic
}

async function runPipeline(ctx: PipelineCtx) {
  const { jobId, companyId, contentType, briefing, hasTransparentBg, referenceImageUrl, supabase, anthropic } = ctx
  let { productImageUrl } = ctx

  const [W, H] = AR_SIZES[contentType] ?? [1080, 1080]

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
    // ── Passo 1: Background Removal ──────────────────────────
    if (productImageUrl) {
      await updateJob(supabase, jobId, { status: 'bg_removing', current_agent: 'Background Remover', progress_pct: 5 })
      if (!hasTransparentBg) {
        const nobgUrl = await removeBackgroundAndUpload(productImageUrl, supabase, companyId, jobId)
        if (nobgUrl) { productImageUrl = nobgUrl; await updateJob(supabase, jobId, { product_image_nobg_url: nobgUrl }) }
      }
    }

    // ── Passo 2: Vision Analyzer ─────────────────────────────
    let visionAnalysis: Record<string, unknown> = {}
    let referenceStyle = ''

    if (productImageUrl || referenceImageUrl) {
      await updateJob(supabase, jobId, { status: 'analyzing', current_agent: 'Vision Analyzer', progress_pct: 15 })

      if (productImageUrl) {
        try {
          const imgBase64 = await fetchImageAsBase64(productImageUrl)
          if (imgBase64) {
            const visionRes = await withRetry(() => anthropic.messages.create({
              model: 'claude-sonnet-4-6', max_tokens: 1024,
              system: `Analista Visual de marketing. Retorne APENAS JSON puro:
{"product_type":"","dominant_colors":[],"secondary_colors":[],"has_face":false,"has_person":false,"object_position":"center","background_type":"clean","best_text_area":"bottom","suggested_visual_style":"premium","product_description":"","observations":"","typography":{"detected":false,"style":"sans-serif","weight":"bold","personality":"modern","google_font":"Montserrat"}}
Se houver texto visível no produto/embalagem, detecte a tipografia e sugira o Google Font mais próximo. Se não houver texto, sugira um Google Font adequado ao estilo e nicho do produto (ex: luxo→Playfair Display, tech→Space Grotesk, sport→Barlow Condensed, food→Poppins, kids→Nunito).`,
              messages: [{ role: 'user', content: [
                { type: 'image', source: { type: 'base64', media_type: imgBase64.mediaType, data: imgBase64.data } },
                { type: 'text', text: `Analise este produto. Nicho: ${niche}.` },
              ]}],
            }))
            visionAnalysis = parseJson(visionRes.content[0].type === 'text' ? visionRes.content[0].text : '{}', {})
            await updateJob(supabase, jobId, { vision_analysis: visionAnalysis })
          }
        } catch (err) {
          console.warn('[studio] Vision Analyzer falhou:', err)
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
{"visual_style":"","composition":"","lighting":"","color_palette":"","typography":{"detected":false,"style":"sans-serif","weight":"bold","personality":"modern","google_font":"Montserrat"}}
Se houver texto visível na imagem, detecte a tipografia e sugira o Google Font mais próximo no campo google_font. Se não houver texto, sugira um Google Font que combine com o estilo visual da imagem.`,
              messages: [{ role: 'user', content: [
                { type: 'image', source: { type: 'base64', media_type: refBase64.mediaType, data: refBase64.data } },
                { type: 'text', text: 'Analise o estilo visual e tipografia desta imagem de referência.' },
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
        } catch (err) { console.warn('[studio] Reference style failed:', err) }
      }
    }

    // ── Passo 3: Palette Intelligence ────────────────────────
    await updateJob(supabase, jobId, { status: 'palette_extracting', current_agent: 'Palette Intelligence', progress_pct: 25 })

    const paletteRes = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 512,
      system: `Especialista em paleta de cores. Retorne APENAS JSON puro:
{"background":"#hex","text_primary":"#hex","text_secondary":"#hex","accent":"#hex","cta_bg":"#hex","cta_text":"#hex","gradient_from":"#hex","gradient_to":"#hex"}`,
      messages: [{ role: 'user', content: `Cor primária: ${pc}\nCor secundária: ${sc}\nAnálise visual: ${JSON.stringify(visionAnalysis)}\nNicho: ${niche}\nTom: ${toneOfVoice}` }],
    }))
    const palette = parseJson<Record<string, string>>(
      paletteRes.content[0].type === 'text' ? paletteRes.content[0].text : '{}',
      { background: pc, text_primary: '#ffffff', accent: sc, cta_bg: sc, cta_text: '#ffffff' }
    )
    await updateJob(supabase, jobId, { palette })

    // ── Passo 4: Estrategista ────────────────────────────────
    await updateJob(supabase, jobId, { status: 'strategizing', current_agent: 'Estrategista', progress_pct: 35 })

    const stratRes = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 512,
      system: `Retorne APENAS JSON puro:
{"objective":"","target_audience":"","main_promise":"","main_pain":"","main_benefit":"","angle":"","tone":""}`,
      messages: [{ role: 'user', content: `Briefing: ${briefing}\nEmpresa: ${companyName}\nNicho: ${niche}\nTom: ${toneOfVoice}\nFormato: ${contentType}` }],
    }))
    const strategy = parseJson<Record<string, string>>(
      stratRes.content[0].type === 'text' ? stratRes.content[0].text : '{}',
      { angle: briefing, tone: toneOfVoice }
    )
    await updateJob(supabase, jobId, { strategy })

    // ── Passo 5: Copywriter ──────────────────────────────────
    await updateJob(supabase, jobId, { status: 'copywriting', current_agent: 'Copywriter', progress_pct: 45 })

    const copyRes = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 512,
      system: `Retorne APENAS JSON puro:
{"headline":"","subline":"","cta":"","caption":""}
REGRAS OBRIGATÓRIAS:
- Headline: máximo 4 palavras fortes (máx 22 caracteres). O produto é o destaque visual — a headline complementa, não domina.
- Subline: máx 8 palavras, uma frase de benefício.
- CTA: 2-3 palavras diretas.
- Caption: texto para legenda com emojis e hashtags.`,
      messages: [{ role: 'user', content: `Estratégia: ${JSON.stringify(strategy)}\nBriefing: ${briefing}\nEmpresa: ${companyName}\nCTAs da marca: ${preferredCtas}\nNicho: ${niche}` }],
    }))
    const copyOutput = parseJson<{ headline: string; subline: string; cta: string; caption: string }>(
      copyRes.content[0].type === 'text' ? copyRes.content[0].text : '{}',
      { headline: briefing.slice(0, 30), subline: '', cta: 'Saiba mais', caption: briefing }
    )
    await updateJob(supabase, jobId, { copy_output: copyOutput })

    // ── Passo 6: Diretor Criativo IA ─────────────────────────
    await updateJob(supabase, jobId, { status: 'creative_directing', current_agent: 'Diretor Criativo IA', progress_pct: 55 })

    const baseArchetype = NICHE_ARCHETYPES[niche] ?? NICHE_ARCHETYPES['servicos']

    const creativeDirRes = await withRetry(() => anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 1024,
      system: `Diretor Criativo sênior. Retorne APENAS JSON com esta estrutura exata:
{"niche_key":"","archetype":"","campaign_emotion":"","target_audience":"","visual_style":"","photography_style":"","lighting":"","composition":"","color_mood":"","forbidden_elements":[],"required_elements":[],"content_safety":"safe_for_all"}`,
      messages: [{ role: 'user', content: `Empresa: ${companyName}\nNicho: ${niche}\nCores: primária=${pc} secundária=${sc}\nFormato: ${contentType} (${W}×${H}px)\nBriefing: ${briefing}\nEstratégia: ${JSON.stringify(strategy)}\nCopy: ${JSON.stringify(copyOutput)}\nPaleta: ${JSON.stringify(palette)}\nTem produto: ${!!productImageUrl}\nAnálise: ${JSON.stringify(visionAnalysis)}\n\nArchetype base (adapte ao briefing):\n${JSON.stringify(baseArchetype, null, 2)}` }],
    }))
    const creativeBrief: CreativeBrief = parseJson<CreativeBrief>(
      creativeDirRes.content[0].type === 'text' ? creativeDirRes.content[0].text : '{}',
      {
        niche_key: niche, archetype: baseArchetype.archetype, campaign_emotion: baseArchetype.campaign_emotion,
        target_audience: strategy.target_audience ?? 'público geral', visual_style: baseArchetype.visual_style,
        photography_style: baseArchetype.photography_style, lighting: baseArchetype.lighting,
        composition: 'produto centralizado, espaço para texto', color_mood: baseArchetype.color_mood,
        forbidden_elements: baseArchetype.forbidden, required_elements: baseArchetype.required,
        content_safety: baseArchetype.content_safety,
      }
    )
    await updateJob(supabase, jobId, { creative_brief: creativeBrief })

    // ── Passo 6.5: Creative Decision Engine ──────────────────
    await updateJob(supabase, jobId, { status: 'creative_decision', current_agent: 'Creative Decision Engine', progress_pct: 58 })

    const nicheDefaults = NICHE_DEFAULTS[niche] ?? NICHE_DEFAULTS['servicos'] ?? {}
    const nicheV3Defaults = NICHE_CREATIVE_DEFAULTS_V3[niche] ?? NICHE_CREATIVE_DEFAULTS_V3['servicos']
    const decisionRes = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 640,
      system: `Diretor de Arte Digital. Analise o briefing e retorne APENAS JSON puro com a decisão criativa:
{"layout":"HERO_RIGHT","style":"CINEMATIC","effects":[],"typography":"STACKED","composition":"","asset_strategy":"PRODUCT_HERO","mood":"","depth":"MEDIUM","image_direction":"","eye_flow":"HERO_TO_CTA","emotional_density":"ENERGETIC","camera_type":"CENTER_HERO"}

LAYOUTS disponíveis — escolha o mais impactante para o objetivo:
- HERO_RIGHT: sujeito direita, texto embaixo-esquerda (padrão forte)
- HERO_LEFT: sujeito esquerda, texto embaixo-direita
- CENTER_STACK: texto centralizado, composição simétrica e equilibrada
- POSTER: headline enorme centralizada, visual de máximo impacto
- FOCUS_CENTER: headline no topo, produto/pessoa centralizado, CTA no rodapé
- SPLIT_SCREEN: metade colorida com texto, metade imagem (corporativo/clean)
- DIAGONAL_FLOW: faixa diagonal dinâmica com texto (esporte/ação)
- ASYMMETRIC: bloco de texto offset, tensão visual criativa

STYLES: CINEMATIC | LUXURY | SPORT | TECH | MINIMAL | NEON | CORPORATE | EDITORIAL | STREET
EFFECTS (máx 2): GLOW | GRAIN | LIGHT_LEAK | SMOKE (use com critério)
TYPOGRAPHY: BOLD_IMPACT | ELEGANT | CONDENSED | STACKED | FLOATING

EYE_FLOW — padrão perceptivo de leitura:
- Z_PATTERN: varredura ocidental clássica top-left→top-right→diagonal→bottom-right
- F_PATTERN: dois scans horizontais da esquerda (conteúdo/serviço)
- DIAGONAL_LEFT: energia descendente upper-right→lower-left
- DIAGONAL_RIGHT: energia ascendente lower-left→upper-right (aspiracional)
- CENTER_EXPLOSION: elemento central irradia para fora (impacto)
- HERO_TO_CTA: sujeito→headline→CTA fluxo publicitário clássico
- FACE_TO_HEADLINE: olhar/gesto do personagem conduz ao título (use só com pessoa)

EMOTIONAL_DENSITY — intensidade visual emocional:
- AGGRESSIVE: contraste máximo, tensão visual intensa (academia/offroad)
- ENERGETIC: dinâmico, movimento, vibrante (esporte/promoções)
- PREMIUM: respiro, suavidade, refinamento (luxo/moda premium)
- CLEAN: espaço negativo forte, mínimo ruído (tech/minimalismo)
- CORPORATE: profissional, sóbrio, confiança (serviços/político)
- URBAN: grain pesado, autêntico, street (moda urbana/cultura)
- CINEMATIC: atmosfera fílmica, profundidade, drama (cinema/veículos)
- DRAMATIC: intensidade teatral, vignette máximo (fashion/impacto)
- MINIMAL: ultra clean, sem efeitos, sereno (alimentação/wellbeing)
- SOFT: gentil, acolhedor, leveza (infantil/saúde/beleza)

CAMERA_TYPE — enquadramento cinematográfico:
- HERO_CLOSEUP: 85mm retrato, bokeh, íntimo
- LOW_ANGLE: ângulo baixo dramático, poder e dominância
- WIDE_CINEMATIC: anamórfico épico, escala grandiosa
- DEPTH_COMPRESSION: 200mm telephoto, perspectiva comprimida
- CENTER_HERO: 50mm centrado, direto e confiante
- DYNAMIC_PERSPECTIVE: ultra-wide distortion, energia extrema
- PRODUCT_SPOTLIGHT: macro/100mm, detalhe seletivo do produto
- MAGAZINE_SHOT: editorial 85-120mm, sofisticado

image_direction: instrução em inglês sobre composição e posicionamento do sujeito (30-50 palavras).`,
      messages: [{ role: 'user', content: `Nicho: ${niche}\nEmoção: ${creativeBrief.campaign_emotion}\nEstilo: ${creativeBrief.visual_style}\nObjetivo: ${strategy.objective ?? briefing}\nTem pessoa: ${String(visionAnalysis.has_person)}\nTem produto: ${!!productImageUrl}\nFormato: ${W}×${H}px\nDefault do nicho: ${JSON.stringify(nicheDefaults)}\nDefault v3 do nicho: ${JSON.stringify(nicheV3Defaults)}` }],
    }))
    const creativeDecision: CreativeDecision = parseJson<CreativeDecision>(
      decisionRes.content[0].type === 'text' ? decisionRes.content[0].text : '{}',
      {
        layout: (nicheDefaults.layout ?? 'HERO_RIGHT') as Layout,
        style: (nicheDefaults.style ?? 'CINEMATIC') as VisualStyle,
        effects: nicheDefaults.effects ?? [],
        typography: (nicheDefaults.typography ?? 'STACKED') as TypographyBehavior,
        composition: creativeBrief.composition,
        asset_strategy: 'PRODUCT_HERO',
        mood: creativeBrief.campaign_emotion,
        depth: nicheDefaults.depth ?? 'MEDIUM',
        image_direction: '',
        eye_flow: (nicheV3Defaults?.eye_flow ?? 'HERO_TO_CTA') as EyeFlowPattern,
        emotional_density: (nicheV3Defaults?.emotional_density ?? 'ENERGETIC') as EmotionalToken,
        camera_type: (nicheV3Defaults?.camera_type ?? 'CENTER_HERO') as CameraType,
      }
    )
    // Auto-corrigir combinações incoerentes (LUXURY+BOLD_IMPACT, SPORT+ELEGANT, etc.)
    const correctedDecision = applyDecisionCorrections(creativeDecision)
    await updateJob(supabase, jobId, { creative_decision: correctedDecision })

    // ── Passo 7: Visual Prompt Engineer ──────────────────────
    await updateJob(supabase, jobId, { status: 'prompt_engineering', current_agent: 'Visual Prompt Engineer', progress_pct: 65 })

    // Extrair nome exato do produto do briefing para forçar no prompt
    const productNameMatch = briefing.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z0-9]+){0,4}(?:\s+\d{4})?)\b/g)
    const productMentions = productNameMatch ? productNameMatch.slice(0, 3).join(', ') : ''
    const productDesc = visionAnalysis.product_description
      ? `The EXACT product to feature: ${visionAnalysis.product_description}. Place it PROMINENTLY as the main subject.`
      : productImageUrl
      ? `A product is provided. Place it PROMINENTLY centered as the hero of the image.`
      : productMentions
      ? `The EXACT product to feature is: "${productMentions}". This specific product/brand MUST be visually represented accurately.`
      : ''

    const referenceNote = referenceStyle ? `\nVisual reference style to emulate: ${referenceStyle}` : ''
    const layoutHint = layoutImageHint(correctedDecision.layout)
    const promptEnhancement = buildImagePromptEnhancement(correctedDecision, niche)
    const logoPlacement = companyLogoUrl ? getLogoPlacement(correctedDecision.layout, W, H) : null
    const logoNote = logoPlacement
      ? `\nLogo overlay: a company logo will be placed at the ${logoPlacement.corner} corner. Keep that area visually clean and uncluttered — avoid placing key subject elements or bright highlights there.`
      : ''
    const decisionNote = [
      correctedDecision.image_direction ? `Creative direction: ${correctedDecision.image_direction}` : '',
      promptEnhancement ? `Photographic guidance: ${promptEnhancement}` : '',
    ].filter(Boolean).map(s => `\n${s}`).join('')

    const promptEngineerRes = await withRetry(() => anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 600,
      system: `You are an expert Visual Prompt Engineer for AI image generation (Flux, Imagen 3, DALL-E 3, Ideogram).
Create a single highly detailed commercial advertising photography prompt in English.
CRITICAL: The prompt describes ONLY the scene/image. Do NOT include any text, words, headlines, logos, or typography in the prompt — text will be added as overlay later.
Return ONLY the prompt text. No explanations, no JSON, no markdown.`,
      messages: [{ role: 'user', content: `Create an image prompt for this advertising campaign:

Company: ${companyName}
Briefing (original, in Portuguese): "${briefing}"
${productDesc}
Visual style: ${creativeBrief.visual_style}
Photography style: ${creativeBrief.photography_style}
Lighting: ${creativeBrief.lighting}
Composition: ${creativeBrief.composition}
Color mood: ${creativeBrief.color_mood}
Campaign emotion: ${creativeBrief.campaign_emotion}
Selected layout: ${correctedDecision.layout} — ${layoutHint}
Visual style: ${correctedDecision.style} | Mood: ${correctedDecision.mood}
Required elements: ${creativeBrief.required_elements.join(', ')}
Forbidden elements (must NOT appear): ${creativeBrief.forbidden_elements.join(', ')}
Safety: ${creativeBrief.content_safety === 'safe_for_all' ? 'safe for all ages, no adult content' : 'general adult audience'}
Image dimensions: ${W}×${H}px${referenceNote}${logoNote}${decisionNote}

RULES:
- If a specific product name/brand/model was mentioned in the briefing, use it EXACTLY (e.g. "Fiat Toro 2026 pickup truck" not "a pickup truck")
- Respect the layout composition hint above for subject placement
- Write 80-120 words using photography/cinematography terminology
- End with: "commercial advertising photography, studio quality, sharp focus, no text, no watermarks"` }],
    }))

    const imagePrompt = promptEngineerRes.content[0].type === 'text'
      ? promptEngineerRes.content[0].text.trim()
      : `${creativeBrief.photography_style}, ${creativeBrief.lighting}, ${creativeBrief.color_mood}, commercial advertising photography, no text, no watermarks`

    await updateJob(supabase, jobId, { image_prompt: imagePrompt })

    // ── Passo 8: Image Generation ─────────────────────────────
    await updateJob(supabase, jobId, { status: 'generating_image', current_agent: 'Image Generation IA', progress_pct: 75 })

    // Baixa produto para todos os provedores (não só Fal.ai)
    let productBase64ForGen: string | undefined
    let productMimeForGen: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | undefined
    if (productImageUrl) {
      const imgData = await fetchImageAsBase64(productImageUrl)
      if (imgData) { productBase64ForGen = imgData.data; productMimeForGen = imgData.mediaType }
    }

    const imageResult = await generateImage(imagePrompt, contentType, W, H, productBase64ForGen, productMimeForGen)
    const rawImageUrl = await uploadGeneratedImage(imageResult.base64, imageResult.mimeType, supabase, companyId, jobId)

    await updateJob(supabase, jobId, { generated_image_url: rawImageUrl, image_provider: imageResult.provider })

    // ── Passo 9: Visual Review ────────────────────────────────
    await updateJob(supabase, jobId, { status: 'visual_review', current_agent: 'Crítico Visual', progress_pct: 90 })

    let retryCount = 0
    let currentImageBase64 = imageResult.base64
    let currentImageMime = imageResult.mimeType
    let currentImageUrl = rawImageUrl
    let critique: Record<string, unknown> = {}
    let finalScore = 0

    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const critiqueRes = await withRetry(() => anthropic.messages.create({
          model: 'claude-sonnet-4-6', max_tokens: 512,
          system: `Avaliador de imagens publicitárias geradas por IA. Retorne APENAS JSON:
{"score":0,"passed":false,"issues":[{"rule":"","severity":"high","suggestion":""}],"praise":[]}`,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: currentImageMime, data: currentImageBase64 } },
            { type: 'text', text: `Avalie esta imagem publicitária gerada por IA (escala 0-100):

REGRAS DE REPROVAÇÃO IMEDIATA (score máx 20):
- Conteúdo explicitamente proibido presente: [${creativeBrief.forbidden_elements.filter(e => ['criança','sensual','violência','álcool','nudez'].includes(e)).join(', ') || 'nenhum'}]

CRITÉRIOS DE QUALIDADE (some os pontos):
- Qualidade técnica (0-30): imagem nítida, sem distorções graves, profissional
- Estilo visual correto (0-25): combina com o nicho "${niche}" e estilo "${creativeBrief.visual_style}"?
- Impacto visual (0-25): imagem atrativa que chama atenção?
- Espaço para texto (0-20): há área escura/limpa no rodapé para texto overlay?

IMPORTANTE: NÃO penalize por ausência de logos, badges, textos ou elementos específicos de marca — esses são adicionados na composição. Avalie apenas a cena fotográfica/artística.
${!!productImageUrl ? `O briefing menciona um produto. Penalize APENAS se a imagem mostrar o tipo de produto completamente errado (ex: carro quando deveria ser comida).` : ''}

passed = score >= 65` },
          ]}],
        }))
        const critiqueText = critiqueRes.content[0].type === 'text' ? critiqueRes.content[0].text : '{}'
        critique = parseJson<Record<string, unknown>>(critiqueText, { score: 70, passed: false, issues: [] })
        finalScore = typeof critique.score === 'number' ? critique.score : 70
        await updateJob(supabase, jobId, { critique, visual_score: finalScore, retry_count: retryCount })

        if (critique.passed === true || attempt >= 2) break

        // Regenerar com prompt refinado
        retryCount = attempt + 1
        await updateJob(supabase, jobId, { status: 'regenerating', current_agent: 'Image Generation IA (refinamento)', retry_count: retryCount, progress_pct: 93 })

        const issuesList = (critique.issues as Array<{ rule: string; suggestion: string }> ?? [])
          .map(i => `- ${i.rule}: ${i.suggestion}`).join('\n')

        const refinedRes = await withRetry(() => anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001', max_tokens: 400,
          system: 'You are a Visual Prompt Engineer. Refine the image prompt to fix the issues. Return ONLY the improved prompt, no explanations.',
          messages: [{ role: 'user', content: `Original prompt: "${imagePrompt}"\n\nIssues to fix:\n${issuesList}\n\nImprove the prompt. Keep 80-120 words. End with "commercial advertising photography, no text, no watermarks"` }],
        }))
        const refinedPrompt = refinedRes.content[0].type === 'text' ? refinedRes.content[0].text.trim() : imagePrompt

        const newResult = await generateImage(refinedPrompt, contentType, W, H, productBase64ForGen)
        const newUrl = await uploadGeneratedImage(newResult.base64, newResult.mimeType, supabase, companyId, jobId, `_v${retryCount + 1}`)
        currentImageBase64 = newResult.base64
        currentImageMime = newResult.mimeType
        currentImageUrl = newUrl

        await updateJob(supabase, jobId, {
          generated_image_url: newUrl ?? currentImageUrl,
          image_prompt: refinedPrompt,
          status: 'visual_review',
          current_agent: 'Crítico Visual',
          progress_pct: 90,
        })
      } catch (critiqueErr) {
        console.warn('[studio] Visual Review falhou, aceitando imagem:', critiqueErr)
        critique = { score: 85, passed: true, issues: [], praise: ['Validação visual automática indisponível'] }
        finalScore = 85
        await updateJob(supabase, jobId, { critique, visual_score: finalScore })
        break
      }
    }

    // ── Passo 10: Composição de texto sobre a imagem (sharp) ─────
    let finalPngUrl = currentImageUrl // fallback: imagem sem texto

    if (currentImageBase64) {
      try {
        const detectedFont = (visionAnalysis.typography as { google_font?: string })?.google_font ?? undefined
        const compositeBuffer = await sharpComposite(
          currentImageBase64, copyOutput, palette, W, H, detectedFont, correctedDecision, companyLogoUrl ?? undefined
        )
        if (compositeBuffer) {
          const compositeUrl = await uploadCompositePng(compositeBuffer, supabase, companyId, jobId)
          if (compositeUrl) finalPngUrl = compositeUrl
        }
      } catch (compErr) {
        console.warn('[studio] Composição de texto falhou, usando imagem sem texto:', compErr)
      }
    }

    // ── Finalizar ─────────────────────────────────────────────
    await updateJob(supabase, jobId, {
      status: 'done',
      current_agent: null,
      progress_pct: 100,
      final_png_url: finalPngUrl,
      generated_image_url: currentImageUrl,
      retry_count: retryCount,
      rejected_reason: critique.passed ? null : JSON.stringify(critique.issues),
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[studio] pipeline error:', err)
    await updateJob(supabase, jobId, { status: 'failed', error_message: msg })
  }
}
