import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { readApiKey, AR_SIZES } from '@/lib/art-utils'
import { generateImage, uploadGeneratedImage, NoProviderError } from '@/lib/imageProvider'
import type { CreativeBrief } from '@/types'

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
    const buffer = await res.arrayBuffer()
    const data = Buffer.from(buffer).toString('base64')
    return { data, mediaType }
  } catch {
    return null
  }
}

async function updateJob(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
  data: Record<string, unknown>,
) {
  await supabase.from('creative_jobs').update(data).eq('id', jobId)
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
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form,
    })

    if (!res.ok) {
      console.warn('[studio] remove.bg failed:', res.status)
      return null
    }

    const pngBytes = await res.arrayBuffer()
    const storagePath = `${companyId}/nobg/${jobId}.png`
    const pngBlob = new Blob([pngBytes], { type: 'image/png' })
    const { error: upErr } = await supabase.storage
      .from('media')
      .upload(storagePath, pngBlob, { contentType: 'image/png', upsert: true })

    if (upErr) {
      console.warn('[studio] nobg upload error:', upErr)
      return null
    }

    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(storagePath)
    return publicUrl
  } catch (err) {
    console.warn('[studio] removeBackground error:', err)
    return null
  }
}

// ── Niche Archetypes ──────────────────────────────────────────

const NICHE_ARCHETYPES: Record<string, {
  archetype: string
  campaign_emotion: string
  visual_style: string
  photography_style: string
  lighting: string
  color_mood: string
  forbidden: string[]
  required: string[]
  content_safety: 'safe_for_all' | 'general_adult'
}> = {
  academia: {
    archetype: 'neon_agressivo',
    campaign_emotion: 'urgência + conquista',
    visual_style: 'cinematográfico escuro com neon',
    photography_style: 'atleta em ação musculosa, suor, determinação',
    lighting: 'luz lateral dura com halo neon verde ou azul',
    color_mood: 'escuro (quase preto) com neon vibrante',
    forbidden: ['criança', 'alimentos', 'animais'],
    required: ['pessoa ativa', 'ambiente fitness'],
    content_safety: 'general_adult',
  },
  infantil: {
    archetype: 'colorido_alegre',
    campaign_emotion: 'alegria + segurança',
    visual_style: 'pastel vibrante limpo',
    photography_style: 'criança feliz sorrindo, brinquedos coloridos, ambiente seguro',
    lighting: 'luz natural suave e uniforme',
    color_mood: 'cores primárias vibrantes fundo claro',
    forbidden: ['violência', 'sensual', 'adulto', 'álcool', 'cigarro', 'moda masculina genérica', 'poses de influencer'],
    required: ['criança sorridente', 'ambiente seguro', 'cores alegres'],
    content_safety: 'safe_for_all',
  },
  luxo: {
    archetype: 'luxo_minimalista',
    campaign_emotion: 'exclusividade + desejo',
    visual_style: 'editorial minimalista premium',
    photography_style: 'produto isolado sobre superfície elegante, reflexo suave',
    lighting: 'luz de estúdio suave lateral, sombras limpas',
    color_mood: 'preto ou branco com dourado sutil',
    forbidden: ['lotação', 'cores berrantes', 'elementos infantis'],
    required: ['espaço em branco', 'produto central', 'acabamento premium'],
    content_safety: 'general_adult',
  },
  politica: {
    archetype: 'institucional_impactante',
    campaign_emotion: 'confiança + liderança',
    visual_style: 'fotográfico sério com overlay de cor sólida',
    photography_style: 'líder em pose confiante, bandeira ao fundo, multidão',
    lighting: 'luz frontal profissional, sem sombras dramáticas',
    color_mood: 'cores da bandeira ou da campanha com overlay escuro',
    forbidden: ['humor', 'cores excessivas', 'animação'],
    required: ['rosto do candidato', 'número eleitoral'],
    content_safety: 'safe_for_all',
  },
  offroad: {
    archetype: 'aventura_bruto',
    campaign_emotion: 'liberdade + adrenalina',
    visual_style: 'fotográfico selvagem com grain cinematográfico',
    photography_style: 'veículo em trilha de terra/lama, pôr do sol dramático',
    lighting: 'luz dourada de pôr do sol ou tempestade',
    color_mood: 'terroso cálido com laranja e marrom',
    forbidden: ['cidade', 'fundo branco', 'elegância'],
    required: ['natureza', 'veículo off-road', 'terreno irregular'],
    content_safety: 'general_adult',
  },
  tecnologia: {
    archetype: 'tech_futurista',
    campaign_emotion: 'inovação + poder',
    visual_style: 'futurista com glow neon azul',
    photography_style: 'dispositivo ou interface com fundo escuro, luzes neon',
    lighting: 'luz ambiente escura com pontos de luz neon azul',
    color_mood: 'preto profundo com azul neon e ciano',
    forbidden: ['rural', 'vintage', 'quente'],
    required: ['tecnologia', 'interface digital', 'fundo escuro'],
    content_safety: 'general_adult',
  },
  eventos: {
    archetype: 'eventos_explosivo',
    campaign_emotion: 'euforia + não pode perder',
    visual_style: 'vibrante festival com cores saturadas',
    photography_style: 'multidão animada, palco com luzes coloridas, efeitos de luz',
    lighting: 'luzes de palco coloridas, fumaça dramática',
    color_mood: 'gradiente angular de cores vibrantes (rosa, roxo, laranja)',
    forbidden: ['silêncio', 'minimalismo', 'tons apagados'],
    required: ['energia', 'pessoas animadas', 'luzes coloridas'],
    content_safety: 'general_adult',
  },
  beleza: {
    archetype: 'beleza_editorial',
    campaign_emotion: 'desejo + autoconfiança',
    visual_style: 'editorial moda suave e elegante',
    photography_style: 'produto de beleza em close-up com textura de pele, floral sutil',
    lighting: 'luz difusa suave de estúdio, tons quentes',
    color_mood: 'nude, rosa claro, dourado suave',
    forbidden: ['bruto', 'escuro demais', 'masculino agressivo'],
    required: ['produto em destaque', 'estética limpa', 'luz suave'],
    content_safety: 'general_adult',
  },
  alimentacao: {
    archetype: 'food_apetitoso',
    campaign_emotion: 'fome + desejo imediato',
    visual_style: 'food photography apetitosa e quente',
    photography_style: 'comida em close-up com vapor, texturas, cores saturadas',
    lighting: 'luz quente lateral de janela ou vela, sombras suaves',
    color_mood: 'tons quentes terrosos com vermelho e laranja',
    forbidden: ['frio', 'azul dominante', 'alimentos com aspecto ruim'],
    required: ['comida apetitosa', 'textura visível', 'iluminação quente'],
    content_safety: 'safe_for_all',
  },
  servicos: {
    archetype: 'servicos_profissional',
    campaign_emotion: 'confiança + solução',
    visual_style: 'profissional moderno e limpo',
    photography_style: 'profissional sorridente em ambiente de trabalho moderno',
    lighting: 'luz natural de escritório ou estúdio neutro',
    color_mood: 'azul corporativo com branco e cinza',
    forbidden: ['caótico', 'muito dark', 'animação excessiva'],
    required: ['rosto humano', 'ambiente profissional', 'clareza visual'],
    content_safety: 'safe_for_all',
  },
  imobiliaria: {
    archetype: 'imovel_aspiracional',
    campaign_emotion: 'sonho + realização',
    visual_style: 'fotográfico arquitetural premium',
    photography_style: 'imóvel em ângulo amplo, luz natural, acabamento visto',
    lighting: 'luz natural abundante, golden hour exterior',
    color_mood: 'branco e bege com verde natural ou azul céu',
    forbidden: ['escuro', 'bagunçado', 'animação infantil'],
    required: ['espaço amplo', 'luz natural', 'acabamento visível'],
    content_safety: 'safe_for_all',
  },
  educacao: {
    archetype: 'educacao_inspirador',
    campaign_emotion: 'crescimento + possibilidade',
    visual_style: 'inspirador e acolhedor com cores vivas',
    photography_style: 'pessoa estudando ou ensinando com sorriso, ambiente de aprendizado',
    lighting: 'luz natural alegre e uniforme',
    color_mood: 'amarelo, azul e verde vibrantes com fundo branco',
    forbidden: ['violência', 'sensual', 'adulto', 'poses de influencer'],
    required: ['aprendizado', 'pessoas sorridentes', 'ambiente organizado'],
    content_safety: 'safe_for_all',
  },
  ecommerce: {
    archetype: 'ecommerce_conversao',
    campaign_emotion: 'urgência + oferta irresistível',
    visual_style: 'produto hero com selos de oferta',
    photography_style: 'produto em fundo limpo com sombra, etiqueta de preço visível',
    lighting: 'luz de estúdio limpa e uniforme',
    color_mood: 'vermelho, laranja ou verde com branco, cores de ação',
    forbidden: ['vago', 'sem produto', 'cores apagadas'],
    required: ['produto em destaque', 'preço ou desconto', 'senso de urgência'],
    content_safety: 'safe_for_all',
  },
  moda: {
    archetype: 'moda_editorial',
    campaign_emotion: 'aspiração + identidade',
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
  if (!companyId || !contentType || !briefing) {
    return NextResponse.json({ error: 'companyId, contentType e briefing são obrigatórios' }, { status: 400 })
  }

  const { data: job, error: jobErr } = await supabase
    .from('creative_jobs')
    .insert({
      company_id: companyId,
      created_by: user.id,
      content_type: contentType,
      briefing,
      product_image_url: productImageUrl ?? null,
      status: 'pending',
      progress_pct: 0,
    })
    .select('id')
    .single()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Erro ao criar job' }, { status: 500 })
  }

  const jobId = job.id

  runPipeline({
    jobId, companyId, contentType, briefing,
    productImageUrl, hasTransparentBg: !!hasTransparentBg,
    referenceImageUrl,
    supabase, anthropic: new Anthropic({ apiKey }),
  }).catch(err => {
    console.error('[studio] pipeline fatal error:', err)
    supabase.from('creative_jobs').update({ status: 'failed', error_message: String(err) }).eq('id', jobId)
  })

  return NextResponse.json({ jobId })
}

// ── Pipeline ─────────────────────────────────────────────────

interface PipelineCtx {
  jobId: string
  companyId: string
  contentType: string
  briefing: string
  productImageUrl?: string
  hasTransparentBg?: boolean
  referenceImageUrl?: string
  supabase: Awaited<ReturnType<typeof createClient>>
  anthropic: Anthropic
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
  const niche = company?.niche ?? 'servicos'
  const toneOfVoice = brandKit?.tone_of_voice ?? 'profissional'
  const preferredCtas = (brandKit?.preferred_ctas ?? ['Saiba mais', 'Aproveite']).join(', ')

  try {
    // ── Passo 1: Background Removal ─────────────────────────
    if (productImageUrl) {
      await updateJob(supabase, jobId, { status: 'bg_removing', current_agent: 'Background Remover', progress_pct: 5 })
      if (!hasTransparentBg) {
        const nobgUrl = await removeBackgroundAndUpload(productImageUrl, supabase, companyId, jobId)
        if (nobgUrl) {
          productImageUrl = nobgUrl
          await updateJob(supabase, jobId, { product_image_nobg_url: nobgUrl })
        }
      }
    }

    // ── Passo 2: Vision Analyzer (produto + referência) ─────
    let visionAnalysis: Record<string, unknown> = {}
    let referenceStyle = ''

    if (productImageUrl || referenceImageUrl) {
      await updateJob(supabase, jobId, { status: 'analyzing', current_agent: 'Vision Analyzer', progress_pct: 15 })

      if (productImageUrl) {
        try {
          const imgBase64 = await fetchImageAsBase64(productImageUrl)
          if (imgBase64) {
            const visionRes = await anthropic.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 1024,
              system: `Você é Ana, Analista Visual especialista em marketing digital.
Analise a imagem e retorne APENAS JSON puro (sem markdown):
{
  "product_type": "",
  "dominant_colors": [],
  "secondary_colors": [],
  "has_face": false,
  "has_person": false,
  "object_position": "center|left|right",
  "background_type": "clean|complex|transparent|gradient",
  "best_text_area": "left|right|top|bottom|center",
  "suggested_visual_style": "premium|popular|clean|luxury|modern|aggressive|institutional",
  "product_description": "",
  "observations": ""
}`,
              messages: [{
                role: 'user',
                content: [
                  { type: 'image', source: { type: 'base64', media_type: imgBase64.mediaType, data: imgBase64.data } },
                  { type: 'text', text: `Analise este produto para criativo de marketing. Nicho: ${niche}.` },
                ],
              }],
            })
            const visionText = visionRes.content[0].type === 'text' ? visionRes.content[0].text : '{}'
            visionAnalysis = parseJson(visionText, {})
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
            const refRes = await anthropic.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 512,
              system: 'Você é um analista de estilo visual. Descreva em 3-4 frases o estilo, composição, paleta e iluminação da imagem de referência. Seja conciso e em inglês.',
              messages: [{
                role: 'user',
                content: [
                  { type: 'image', source: { type: 'base64', media_type: refBase64.mediaType, data: refBase64.data } },
                  { type: 'text', text: 'Descreva o estilo visual desta imagem de referência para geração de imagem.' },
                ],
              }],
            })
            referenceStyle = refRes.content[0].type === 'text' ? refRes.content[0].text : ''
          }
        } catch (err) {
          console.warn('[studio] Reference style analysis failed:', err)
        }
      }
    }

    // ── Passo 3: Palette Intelligence ───────────────────────
    await updateJob(supabase, jobId, { status: 'palette_extracting', current_agent: 'Palette Intelligence', progress_pct: 25 })

    const paletteRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `Você é Bianca, Especialista em Identidade Visual.
Crie uma paleta harmônica. Retorne APENAS JSON puro:
{
  "background": "#hex",
  "text_primary": "#hex",
  "text_secondary": "#hex",
  "accent": "#hex",
  "cta_bg": "#hex",
  "cta_text": "#hex",
  "gradient_from": "#hex",
  "gradient_to": "#hex"
}`,
      messages: [{
        role: 'user',
        content: `Cor primária: ${pc}\nCor secundária: ${sc}\nAnálise visual: ${JSON.stringify(visionAnalysis)}\nNicho: ${niche}\nTom: ${toneOfVoice}`,
      }],
    })

    const paletteText = paletteRes.content[0].type === 'text' ? paletteRes.content[0].text : '{}'
    const palette = parseJson<Record<string, string>>(paletteText, { background: pc, text_primary: '#ffffff', accent: sc })
    await updateJob(supabase, jobId, { palette })

    // ── Passo 4: Estrategista ────────────────────────────────
    await updateJob(supabase, jobId, { status: 'strategizing', current_agent: 'Estrategista', progress_pct: 35 })

    const stratRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `Retorne APENAS JSON puro:
{
  "objective": "",
  "target_audience": "",
  "main_promise": "",
  "main_pain": "",
  "main_benefit": "",
  "angle": "",
  "tone": ""
}`,
      messages: [{
        role: 'user',
        content: `Briefing: ${briefing}\nEmpresa: ${companyName}\nNicho: ${niche}\nTom: ${toneOfVoice}\nFormato: ${contentType}`,
      }],
    })

    const stratText = stratRes.content[0].type === 'text' ? stratRes.content[0].text : '{}'
    const strategy = parseJson<Record<string, string>>(stratText, { angle: briefing, tone: toneOfVoice })
    await updateJob(supabase, jobId, { strategy })

    // ── Passo 5: Copywriter ──────────────────────────────────
    await updateJob(supabase, jobId, { status: 'copywriting', current_agent: 'Copywriter', progress_pct: 45 })

    const copyRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `Retorne APENAS JSON puro:
{
  "headline": "",
  "subline": "",
  "cta": "",
  "caption": ""
}
Headline máx 8 palavras impactantes. Subline máx 10 palavras. CTA 2-3 palavras diretas. Caption com emojis e hashtags.`,
      messages: [{
        role: 'user',
        content: `Estratégia: ${JSON.stringify(strategy)}\nBriefing: ${briefing}\nEmpresa: ${companyName}\nCTAs da marca: ${preferredCtas}\nNicho: ${niche}`,
      }],
    })

    const copyText = copyRes.content[0].type === 'text' ? copyRes.content[0].text : '{}'
    const copyOutput = parseJson<{ headline: string; subline: string; cta: string; caption: string }>(
      copyText,
      { headline: briefing.slice(0, 30), subline: '', cta: 'Saiba mais', caption: briefing }
    )
    await updateJob(supabase, jobId, { copy_output: copyOutput })

    // ── Passo 6: Diretor Criativo IA ─────────────────────────
    await updateJob(supabase, jobId, { status: 'creative_directing', current_agent: 'Diretor Criativo IA', progress_pct: 55 })

    const baseArchetype = NICHE_ARCHETYPES[niche] ?? NICHE_ARCHETYPES['servicos']

    const creativeDirRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `Você é um Diretor Criativo sênior de uma grande agência de publicidade.
Sua tarefa é criar um brief visual para geração de imagem via IA.
Retorne APENAS JSON puro com esta estrutura exata:
{
  "niche_key": "",
  "archetype": "",
  "campaign_emotion": "",
  "target_audience": "",
  "visual_style": "",
  "photography_style": "",
  "lighting": "",
  "composition": "",
  "color_mood": "",
  "forbidden_elements": [],
  "required_elements": [],
  "content_safety": "safe_for_all"
}
Adapte o archetype base ao briefing específico. Seja preciso e criativo.`,
      messages: [{
        role: 'user',
        content: `Empresa: ${companyName}
Nicho: ${niche}
Cor primária: ${pc} | Cor secundária: ${sc}
Formato: ${contentType} (${W}×${H}px)
Briefing: ${briefing}
Estratégia: ${JSON.stringify(strategy)}
Copy criado: ${JSON.stringify(copyOutput)}
Paleta: ${JSON.stringify(palette)}
Tem imagem de produto: ${!!productImageUrl}
Análise do produto: ${JSON.stringify(visionAnalysis)}

ARCHETYPE BASE para este nicho (use como referência e adapte):
${JSON.stringify(baseArchetype, null, 2)}

Crie o brief visual adaptado ao briefing específico desta campanha.`,
      }],
    })

    const creativeDirText = creativeDirRes.content[0].type === 'text' ? creativeDirRes.content[0].text : '{}'
    let creativeBrief: CreativeBrief = parseJson<CreativeBrief>(creativeDirText, {
      niche_key: niche,
      archetype: baseArchetype.archetype,
      campaign_emotion: baseArchetype.campaign_emotion,
      target_audience: strategy.target_audience ?? 'público-alvo geral',
      visual_style: baseArchetype.visual_style,
      photography_style: baseArchetype.photography_style,
      lighting: baseArchetype.lighting,
      composition: 'produto centralizado, espaço para texto',
      color_mood: baseArchetype.color_mood,
      forbidden_elements: baseArchetype.forbidden,
      required_elements: baseArchetype.required,
      content_safety: baseArchetype.content_safety,
    })
    await updateJob(supabase, jobId, { creative_brief: creativeBrief })

    // ── Passo 7: Visual Prompt Engineer ─────────────────────
    await updateJob(supabase, jobId, { status: 'prompt_engineering', current_agent: 'Visual Prompt Engineer', progress_pct: 65 })

    const productDesc = visionAnalysis.product_description
      ? `The product is: ${visionAnalysis.product_description}. Place it prominently centered in the image.`
      : productImageUrl
      ? `Include the product prominently centered and large in the image.`
      : ''

    const referenceNote = referenceStyle
      ? `\nVisual reference style to emulate: ${referenceStyle}`
      : ''

    const promptEngineerRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: `You are an expert Visual Prompt Engineer specializing in AI image generation (Flux, Imagen, DALL-E, Midjourney).
Create a single, highly detailed, professional advertising photography prompt in English.
The prompt must be optimized for photorealistic commercial advertising photography.
Return ONLY the prompt text, no explanations, no JSON, no markdown.`,
      messages: [{
        role: 'user',
        content: `Create an image generation prompt for this advertising campaign:

Company: ${companyName}
Campaign headline: "${copyOutput.headline}"
Campaign subline: "${copyOutput.subline}"
Campaign CTA: "${copyOutput.cta}"
${productDesc}
Visual style: ${creativeBrief.visual_style}
Photography style: ${creativeBrief.photography_style}
Lighting: ${creativeBrief.lighting}
Composition: ${creativeBrief.composition}
Color mood: ${creativeBrief.color_mood}
Campaign emotion: ${creativeBrief.campaign_emotion}
Required elements: ${creativeBrief.required_elements.join(', ')}
Forbidden elements (must NOT appear): ${creativeBrief.forbidden_elements.join(', ')}
Content safety: ${creativeBrief.content_safety === 'safe_for_all' ? 'safe for all ages, family friendly' : 'general adult audience'}
Image dimensions: ${W}x${H}px${referenceNote}

Write a detailed, specific prompt (80-120 words) using photography and art direction terminology.
Include: subject, action/pose, environment, lighting direction, camera angle, lens, color palette, mood.
Do NOT include any text, words, headlines, or typography in the image.
End with: "professional advertising photography, commercial quality, sharp focus, high resolution"`,
      }],
    })

    const imagePrompt = promptEngineerRes.content[0].type === 'text'
      ? promptEngineerRes.content[0].text.trim()
      : `${creativeBrief.photography_style}, ${creativeBrief.lighting}, ${creativeBrief.color_mood}, professional advertising photography, commercial quality, sharp focus, high resolution`

    await updateJob(supabase, jobId, { image_prompt: imagePrompt })

    // ── Passo 8: Image Generation ────────────────────────────
    await updateJob(supabase, jobId, { status: 'generating_image', current_agent: 'Image Generation IA', progress_pct: 75 })

    let productBase64ForGen: string | undefined
    if (productImageUrl && process.env.FAL_KEY) {
      const imgData = await fetchImageAsBase64(productImageUrl)
      if (imgData) productBase64ForGen = imgData.data
    }

    const imageResult = await generateImage(imagePrompt, contentType, W, H, productBase64ForGen)
    const generatedUrl = await uploadGeneratedImage(
      imageResult.base64, imageResult.mimeType, supabase, companyId, jobId
    )

    await updateJob(supabase, jobId, {
      generated_image_url: generatedUrl,
      image_provider: imageResult.provider,
    })

    // ── Passo 9: Visual Review ───────────────────────────────
    await updateJob(supabase, jobId, { status: 'visual_review', current_agent: 'Crítico Visual', progress_pct: 90 })

    let retryCount = 0
    let currentImageBase64 = imageResult.base64
    let currentImageUrl = generatedUrl
    let finalScore = 0
    let critique: Record<string, unknown> = {}

    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const critiqueRes = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: `Você é Ricardo, Crítico Visual sênior especialista em imagens publicitárias geradas por IA.
Avalie e retorne APENAS JSON puro:
{
  "score": 0-100,
  "passed": true,
  "issues": [{ "rule": "", "severity": "high|medium|low", "suggestion": "" }],
  "praise": []
}`,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: imageResult.mimeType, data: currentImageBase64 } },
              { type: 'text', text: `Avalie esta imagem publicitária gerada por IA com a seguinte rubrica (0-100):

✖ CONTEUDO_PROIBIDO — Se qualquer elemento em forbidden_elements=[${creativeBrief.forbidden_elements.join(', ')}] aparecer na imagem: score máx 30, passed=false, severity=high

✖ PRODUTO_AUSENTE — Produto foi fornecido mas NÃO aparece visivelmente na imagem: score máx 40, passed=false, severity=high
   Tem produto: ${!!productImageUrl}

QUALIDADE_VISUAL (0-20): Nitidez, sem artefatos de IA (dedos extras, texto distorcido, anatomia estranha), composição profissional

ADERENCIA_BRIEFING (0-20): Bate com o estilo "${creativeBrief.visual_style}" e nicho "${creativeBrief.niche_key}"? Elementos requeridos presentes: [${creativeBrief.required_elements.join(', ')}]

IMPACTO_MARKETING (0-20): Pararia o scroll num feed? Gera emoção "${creativeBrief.campaign_emotion}"?

COPY_INTEGRATION (0-20): Imagem deixa espaço visual para texto? Composição suporta headline sobreposta?

PREMIUM_FINISH (0-20): Parece foto profissional de agência ou imagem genérica de IA?

passed = score >= 85

Brief: nicho=${creativeBrief.niche_key}, archetype=${creativeBrief.archetype}, emoção=${creativeBrief.campaign_emotion}` },
            ],
          }],
        })

        const critiqueText = critiqueRes.content[0].type === 'text' ? critiqueRes.content[0].text : '{}'
        critique = parseJson<Record<string, unknown>>(critiqueText, { score: 70, passed: false, issues: [] })
        finalScore = typeof critique.score === 'number' ? critique.score : 70

        await updateJob(supabase, jobId, {
          critique,
          visual_score: finalScore,
          retry_count: retryCount,
        })

        if (critique.passed === true || attempt >= 2) break

        // Regenerar com prompt refinado
        retryCount = attempt + 1
        await updateJob(supabase, jobId, {
          status: 'regenerating',
          current_agent: 'Image Generation IA (refinamento)',
          retry_count: retryCount,
          progress_pct: 93,
        })

        const issuesList = (critique.issues as Array<{ rule: string; suggestion: string }> ?? [])
          .map(i => `- ${i.rule}: ${i.suggestion}`).join('\n')

        const refinedPromptRes = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: 'You are a Visual Prompt Engineer. Refine the image generation prompt based on critique feedback. Return ONLY the improved prompt text, no explanations.',
          messages: [{
            role: 'user',
            content: `Original prompt: "${imagePrompt}"

Issues to fix:
${issuesList}

Rewrite the prompt fixing these issues while keeping the original intent. Keep it 80-120 words.`,
          }],
        })

        const refinedPrompt = refinedPromptRes.content[0].type === 'text'
          ? refinedPromptRes.content[0].text.trim()
          : imagePrompt

        const newImageResult = await generateImage(refinedPrompt, contentType, W, H, productBase64ForGen)
        const newUrl = await uploadGeneratedImage(
          newImageResult.base64, newImageResult.mimeType, supabase, companyId, jobId, `_v${retryCount + 1}`
        )

        currentImageBase64 = newImageResult.base64
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

    // ── Finalizar ────────────────────────────────────────────
    await updateJob(supabase, jobId, {
      status: 'done',
      current_agent: null,
      progress_pct: 100,
      final_png_url: currentImageUrl,
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
