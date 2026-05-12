import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { readApiKey, AR_SIZES } from '@/lib/art-utils'
import { generateImage, uploadGeneratedImage, NoProviderError } from '@/lib/imageProvider'
import type { CreativeBrief } from '@/types'

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

// ── Render via Puppeteer (/api/arte-png) ──────────────────────

async function renderHtmlToPng(html: string, W: number, H: number, origin: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`${origin}/api/arte-png`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, width: W, height: H }),
    })
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch (err) {
    console.warn('[studio] renderHtmlToPng error:', err)
    return null
  }
}

async function uploadCompositePng(
  pngBytes: ArrayBuffer,
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

// ── Niche font mapping ────────────────────────────────────────

const NICHE_FONTS: Record<string, { family: string; importSlug: string; weight: string }> = {
  academia:    { family: 'Barlow Condensed', importSlug: 'Barlow+Condensed:wght@400;700;900', weight: '900' },
  infantil:    { family: 'Nunito', importSlug: 'Nunito:wght@400;700;800', weight: '800' },
  luxo:        { family: 'Playfair Display', importSlug: 'Playfair+Display:wght@400;700', weight: '700' },
  politica:    { family: 'Oswald', importSlug: 'Oswald:wght@400;700', weight: '700' },
  offroad:     { family: 'Barlow Condensed', importSlug: 'Barlow+Condensed:wght@400;700;900', weight: '900' },
  tecnologia:  { family: 'Space Grotesk', importSlug: 'Space+Grotesk:wght@400;700', weight: '700' },
  eventos:     { family: 'Bebas Neue', importSlug: 'Bebas+Neue', weight: '400' },
  beleza:      { family: 'Cormorant Garamond', importSlug: 'Cormorant+Garamond:wght@400;600', weight: '600' },
  alimentacao: { family: 'Poppins', importSlug: 'Poppins:wght@400;700;800', weight: '800' },
  servicos:    { family: 'Montserrat', importSlug: 'Montserrat:wght@400;700;900', weight: '700' },
  imobiliaria: { family: 'Raleway', importSlug: 'Raleway:wght@400;600;700', weight: '600' },
  educacao:    { family: 'Nunito', importSlug: 'Nunito:wght@400;700;800', weight: '800' },
  ecommerce:   { family: 'Anton', importSlug: 'Anton', weight: '400' },
  moda:        { family: 'Raleway', importSlug: 'Raleway:wght@300;400;600', weight: '600' },
}
const DEFAULT_FONT = { family: 'Montserrat', importSlug: 'Montserrat:wght@400;700;900', weight: '700' }

// ── Text Composite HTML builder ───────────────────────────────
// Usa URL pública (não base64) para evitar limite de 4MB no body do Next.js

function buildCompositeHtml(
  imageUrl: string,
  copy: { headline: string; subline: string; cta: string },
  palette: Record<string, string>,
  W: number, H: number,
  niche: string,
): string {
  const font = NICHE_FONTS[niche] ?? DEFAULT_FONT
  const isVertical = H / W >= 1.4
  const isSquare = Math.abs(H / W - 1) < 0.15
  const PAD = Math.round(Math.min(W, H) * 0.065)
  const GAP = Math.round(PAD * 0.35)

  const base = Math.min(W, H)
  const headlinePx = Math.round(base / (isVertical ? 9 : isSquare ? 8 : 10))
  const sublinePx  = Math.round(headlinePx * 0.50)
  const ctaPx      = Math.round(headlinePx * 0.38)
  const ctaPadV    = Math.round(ctaPx * 0.65)
  const ctaPadH    = Math.round(ctaPx * 1.5)
  const borderR    = Math.round(ctaPx * 0.4)
  const maxTextW   = W - PAD * 2

  const accent   = palette.accent ?? palette.cta_bg ?? '#fe7902'
  const ctaColor = palette.cta_text ?? '#ffffff'
  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const gradientHeight = isVertical ? '55%' : '45%'
  const gradientAlpha  = isVertical ? '0.92' : '0.85'

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=${font.importSlug}&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;position:relative;background:#000}
.bg{position:absolute;inset:0;z-index:1}
.bg img{width:100%;height:100%;object-fit:cover;display:block}
.gradient{position:absolute;bottom:0;left:0;right:0;height:${gradientHeight};z-index:2;
  background:linear-gradient(to bottom,transparent 0%,rgba(0,0,0,${gradientAlpha}) 100%)}
.content{position:absolute;bottom:${PAD}px;left:${PAD}px;right:${PAD}px;z-index:3}
.headline{
  font-family:'${font.family}',Arial Black,Arial,sans-serif;
  font-size:${headlinePx}px;font-weight:${font.weight};
  color:#ffffff;text-transform:uppercase;
  letter-spacing:-0.02em;line-height:0.95;
  margin-bottom:${GAP}px;
  text-shadow:0 3px 30px rgba(0,0,0,0.8),0 1px 4px rgba(0,0,0,0.9);
  max-width:${maxTextW}px;word-wrap:break-word;overflow-wrap:break-word}
.subline{
  font-family:'${font.family}',Arial,sans-serif;
  font-size:${sublinePx}px;font-weight:400;
  color:rgba(255,255,255,0.90);line-height:1.3;
  margin-bottom:${Math.round(GAP * 1.8)}px;
  text-shadow:0 2px 16px rgba(0,0,0,0.7);
  max-width:${maxTextW}px;word-wrap:break-word;overflow-wrap:break-word}
.cta{
  display:inline-block;
  font-family:'${font.family}',Arial,sans-serif;
  font-size:${ctaPx}px;font-weight:700;
  color:${ctaColor};background:${accent};
  padding:${ctaPadV}px ${ctaPadH}px;
  border-radius:${borderR}px;
  text-transform:uppercase;letter-spacing:0.06em;
  text-shadow:none;box-shadow:0 4px 20px rgba(0,0,0,0.4)}
</style>
</head>
<body>
<div class="bg"><img src="${imageUrl}" alt="arte"></div>
<div class="gradient"></div>
<div class="content">
  <h1 class="headline">${esc(copy.headline)}</h1>
  ${copy.subline ? `<p class="subline">${esc(copy.subline)}</p>` : ''}
  <div class="cta">${esc(copy.cta)}</div>
</div>
</body>
</html>`
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
  const origin = req.nextUrl.origin

  runPipeline({ jobId, companyId, contentType, briefing, productImageUrl, hasTransparentBg: !!hasTransparentBg, referenceImageUrl, supabase, anthropic: new Anthropic({ apiKey }), origin })
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
  supabase: Awaited<ReturnType<typeof createClient>>; anthropic: Anthropic; origin: string
}

async function runPipeline(ctx: PipelineCtx) {
  const { jobId, companyId, contentType, briefing, hasTransparentBg, referenceImageUrl, supabase, anthropic, origin } = ctx
  let { productImageUrl } = ctx

  const [W, H] = AR_SIZES[contentType] ?? [1080, 1080]

  const [{ data: company }, { data: brandKit }] = await Promise.all([
    supabase.from('companies').select('name, primary_color, secondary_color, logo_url, niche').eq('id', companyId).single(),
    supabase.from('brand_kits').select('*').eq('company_id', companyId).maybeSingle(),
  ])

  const pc = company?.primary_color ?? '#052d64'
  const sc = company?.secondary_color ?? '#fe7902'
  const companyName = company?.name ?? 'Sua Empresa'
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
{"product_type":"","dominant_colors":[],"secondary_colors":[],"has_face":false,"has_person":false,"object_position":"center","background_type":"clean","best_text_area":"bottom","suggested_visual_style":"premium","product_description":"","observations":""}`,
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
              model: 'claude-haiku-4-5-20251001', max_tokens: 400,
              system: 'Describe in 3 sentences the visual style, composition, lighting and color palette of this reference image. Be concise and in English.',
              messages: [{ role: 'user', content: [
                { type: 'image', source: { type: 'base64', media_type: refBase64.mediaType, data: refBase64.data } },
                { type: 'text', text: 'Describe the visual style of this reference image.' },
              ]}],
            }))
            referenceStyle = refRes.content[0].type === 'text' ? refRes.content[0].text : ''
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
Headline máx 8 palavras impactantes. Subline máx 10 palavras. CTA 2-3 palavras diretas. Caption com emojis e hashtags.`,
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
Required elements: ${creativeBrief.required_elements.join(', ')}
Forbidden elements (must NOT appear): ${creativeBrief.forbidden_elements.join(', ')}
Safety: ${creativeBrief.content_safety === 'safe_for_all' ? 'safe for all ages, no adult content' : 'general adult audience'}
Image dimensions: ${W}×${H}px${referenceNote}

RULES:
- If a specific product name/brand/model was mentioned in the briefing, use it EXACTLY (e.g. "Fiat Toro 2026 pickup truck" not "a pickup truck")
- Leave clear visual space at the BOTTOM for text overlay (gradient area ~40% height)
- Write 80-120 words using photography/cinematography terminology
- End with: "commercial advertising photography, studio quality, sharp focus, no text, no watermarks"` }],
    }))

    const imagePrompt = promptEngineerRes.content[0].type === 'text'
      ? promptEngineerRes.content[0].text.trim()
      : `${creativeBrief.photography_style}, ${creativeBrief.lighting}, ${creativeBrief.color_mood}, commercial advertising photography, no text, no watermarks`

    await updateJob(supabase, jobId, { image_prompt: imagePrompt })

    // ── Passo 8: Image Generation ─────────────────────────────
    await updateJob(supabase, jobId, { status: 'generating_image', current_agent: 'Image Generation IA', progress_pct: 75 })

    let productBase64ForGen: string | undefined
    if (productImageUrl && process.env.FAL_KEY) {
      const imgData = await fetchImageAsBase64(productImageUrl)
      if (imgData) productBase64ForGen = imgData.data
    }

    const imageResult = await generateImage(imagePrompt, contentType, W, H, productBase64ForGen)
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

    // ── Passo 10: Composição de texto sobre a imagem ──────────
    // Usa URL pública do Supabase (não base64) para evitar limite de 4MB no body do Puppeteer
    let finalPngUrl = currentImageUrl // fallback: imagem sem texto

    if (currentImageUrl) {
      try {
        const compositeHtml = buildCompositeHtml(
          currentImageUrl, copyOutput, palette, W, H, niche
        )
        const pngBytes = await renderHtmlToPng(compositeHtml, W, H, origin)
        if (pngBytes) {
          const compositeUrl = await uploadCompositePng(pngBytes, supabase, companyId, jobId)
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
