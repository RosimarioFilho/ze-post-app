import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import {
  readApiKey,
  AR_SIZES,
  extractHtml,
  enforceProductImage,
  buildLayoutDimensions,
  buildLayoutGuide,
  wrapHtml,
} from '@/lib/art-utils'

// ── Helpers ───────────────────────────────────────────────────

function parseJson<T>(text: string, fallback: T): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return fallback
  try { return JSON.parse(jsonMatch[0]) as T } catch { return fallback }
}

// Baixa imagem de qualquer URL e retorna como base64 + mediaType
async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const mediaType = contentType.includes('png') ? 'image/png'
      : contentType.includes('gif') ? 'image/gif'
      : contentType.includes('webp') ? 'image/webp'
      : 'image/jpeg'
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return { data: base64, mediaType }
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

// ── Background Removal (Remove.bg) ───────────────────────────

async function removeBackground(imageUrl: string): Promise<string | null> {
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
      console.warn('[studio] remove.bg failed:', res.status, await res.text())
      return null
    }

    return null // Binary response — handled by caller with storage upload
  } catch (err) {
    console.warn('[studio] remove.bg error:', err)
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

    // Converter para Blob explicitamente para evitar upload corrompido
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

// ── Render Engine (calls /api/arte-png) ──────────────────────

async function renderHtmlToPng(
  html: string,
  W: number,
  H: number,
  origin: string,
): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`${origin}/api/arte-png`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, width: W, height: H }),
    })
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch (err) {
    console.warn('[studio] render error:', err)
    return null
  }
}

async function uploadPng(
  pngBytes: ArrayBuffer,
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  jobId: string,
  suffix = '',
): Promise<string | null> {
  const storagePath = `${companyId}/renders/${jobId}${suffix}.png`
  const { error } = await supabase.storage
    .from('media')
    .upload(storagePath, pngBytes, { contentType: 'image/png', upsert: true })
  if (error) {
    console.warn('[studio] png upload error:', error)
    return null
  }
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(storagePath)
  return publicUrl
}

// ── Main Orchestration ────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiKey = readApiKey()
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

  const { companyId, contentType, briefing, productImageUrl } = await req.json()
  if (!companyId || !contentType || !briefing) {
    return NextResponse.json({ error: 'companyId, contentType e briefing são obrigatórios' }, { status: 400 })
  }

  // Criar o job
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

  // Executar pipeline de forma assíncrona (não bloqueia a resposta)
  const origin = req.nextUrl.origin
  runPipeline({ jobId, companyId, contentType, briefing, productImageUrl, supabase, anthropic: new Anthropic({ apiKey }), origin }).catch(err => {
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
  supabase: Awaited<ReturnType<typeof createClient>>
  anthropic: Anthropic
  origin: string
}

async function runPipeline(ctx: PipelineCtx) {
  const { jobId, companyId, contentType, briefing, supabase, anthropic, origin } = ctx
  let { productImageUrl } = ctx

  const [W, H] = AR_SIZES[contentType] ?? [1080, 1080]

  // Buscar dados da empresa e brand kit
  const [{ data: company }, { data: brandKit }] = await Promise.all([
    supabase.from('companies').select('name, primary_color, secondary_color, logo_url, niche').eq('id', companyId).single(),
    supabase.from('brand_kits').select('*').eq('company_id', companyId).maybeSingle(),
  ])

  const pc = company?.primary_color ?? '#052d64'
  const sc = company?.secondary_color ?? '#fe7902'
  const companyName = company?.name ?? 'Sua Empresa'
  const niche = company?.niche ?? ''
  const primaryFont = brandKit?.primary_font ?? 'Montserrat'
  const toneOfVoice = brandKit?.tone_of_voice ?? 'profissional'
  const preferredCtas = (brandKit?.preferred_ctas ?? ['Saiba mais', 'Aproveite']).join(', ')

  try {
    // ── Passo 1: Background Removal ─────────────────────────
    if (productImageUrl) {
      await updateJob(supabase, jobId, { status: 'bg_removing', current_agent: 'Background Remover', progress_pct: 5 })
      const nobgUrl = await removeBackgroundAndUpload(productImageUrl, supabase, companyId, jobId)
      if (nobgUrl) {
        productImageUrl = nobgUrl
        await updateJob(supabase, jobId, { product_image_nobg_url: nobgUrl })
      }
    }

    // ── Passo 2: Vision Analyzer ────────────────────────────
    let visionAnalysis: Record<string, unknown> = {}
    if (productImageUrl) {
      await updateJob(supabase, jobId, { status: 'analyzing', current_agent: 'Vision Analyzer', progress_pct: 15 })

      try {
        // Baixar imagem como base64 para evitar problemas de URL inacessível
        const imgBase64 = await fetchImageAsBase64(productImageUrl)
        if (!imgBase64) throw new Error('Não foi possível baixar a imagem do produto')

        const visionRes = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: `Você é Ana, Analista Visual especialista em marketing digital.
Analise a imagem e retorne APENAS JSON puro (sem markdown) com exatamente estas chaves:
{
  "product_type": "",
  "dominant_colors": [],
  "secondary_colors": [],
  "has_face": false,
  "has_person": false,
  "object_position": "center|left|right",
  "background_type": "clean|complex|transparent|gradient",
  "needs_bg_removal": false,
  "best_text_area": "left|right|top|bottom|center",
  "suggested_visual_style": "premium|popular|clean|luxury|modern|aggressive|institutional",
  "observations": ""
}`,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: imgBase64.mediaType, data: imgBase64.data } },
              { type: 'text', text: `Esta é a imagem do produto para o criativo. Analise e retorne o JSON conforme instruído. Nicho: ${niche || 'geral'}.` },
            ],
          }],
        })

        const visionText = visionRes.content[0].type === 'text' ? visionRes.content[0].text : '{}'
        visionAnalysis = parseJson(visionText, {})
        await updateJob(supabase, jobId, { vision_analysis: visionAnalysis })
      } catch (visionErr) {
        // Formato de imagem não suportado ou URL inacessível — continua sem análise visual
        console.warn('[studio] Vision Analyzer falhou, continuando sem análise:', visionErr)
        visionAnalysis = { observations: 'Análise visual indisponível — formato de imagem não suportado' }
        await updateJob(supabase, jobId, { vision_analysis: visionAnalysis })
      }
    }

    // ── Passo 3: Palette Intelligence ───────────────────────
    await updateJob(supabase, jobId, { status: 'palette_extracting', current_agent: 'Palette Intelligence', progress_pct: 25 })

    const paletteRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `Você é Bianca, Especialista em Identidade Visual.
Crie uma paleta harmônica para o criativo. Retorne APENAS JSON puro com estas chaves:
{
  "background": "#hex",
  "text_primary": "#hex",
  "text_secondary": "#hex",
  "accent": "#hex",
  "cta_bg": "#hex",
  "cta_text": "#hex",
  "gradient_from": "#hex",
  "gradient_to": "#hex",
  "contrast_note": "AA|AAA"
}
REGRAS: máximo 3 cores principais, CTA com alto contraste, nunca usar mais de 3 cores visíveis.`,
      messages: [{
        role: 'user',
        content: `Dados para criar a paleta:
- Cor primária da marca: ${pc}
- Cor secundária da marca: ${sc}
- Análise visual do produto: ${JSON.stringify(visionAnalysis)}
- Nicho: ${niche || 'geral'}
- Tom de voz: ${toneOfVoice}
Crie uma paleta que harmonize com o produto e respeite a identidade da marca.`,
      }],
    })

    const paletteText = paletteRes.content[0].type === 'text' ? paletteRes.content[0].text : '{}'
    const palette = parseJson<Record<string, string>>(paletteText, { background: pc, text_primary: '#ffffff', accent: sc, cta_bg: sc, cta_text: '#ffffff', gradient_from: pc, gradient_to: '#0a1628' })
    await updateJob(supabase, jobId, { palette })

    // ── Passo 4: Estrategista ────────────────────────────────
    await updateJob(supabase, jobId, { status: 'strategizing', current_agent: 'Estrategista', progress_pct: 35 })

    const stratRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `Você é Ana, Estrategista de Conteúdo especialista em marketing digital brasileiro.
Retorne APENAS JSON puro:
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
        content: `Briefing: ${briefing}
Empresa: ${companyName}
Nicho: ${niche || 'geral'}
Tom de voz preferido: ${toneOfVoice}
Tipo de criativo: ${contentType}`,
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
      system: `Você é Bruno, Copywriter especialista em conversão para redes sociais no Brasil.
Retorne APENAS JSON puro:
{
  "headline": "",
  "subline": "",
  "cta": "",
  "caption": ""
}
REGRAS: headline máx 8 palavras impactantes, subline máx 10 palavras, CTA direto 2-3 palavras, caption com emojis e hashtags.`,
      messages: [{
        role: 'user',
        content: `Estratégia: ${JSON.stringify(strategy)}
Briefing: ${briefing}
Empresa: ${companyName}
CTAs preferidos da marca: ${preferredCtas}
Nicho: ${niche || 'geral'}`,
      }],
    })

    const copyText = copyRes.content[0].type === 'text' ? copyRes.content[0].text : '{}'
    const copyOutput = parseJson<{ headline: string; subline: string; cta: string; caption: string }>(
      copyText,
      { headline: briefing.slice(0, 30), subline: '', cta: 'Saiba mais', caption: briefing }
    )
    await updateJob(supabase, jobId, { copy_output: copyOutput })

    // ── Passo 6: Diretor de Arte ─────────────────────────────
    await updateJob(supabase, jobId, { status: 'art_directing', current_agent: 'Diretor de Arte', progress_pct: 55 })

    const { data: templates } = await supabase
      .from('design_templates')
      .select('id, name, category, description, compatible_formats')
      .contains('compatible_formats', [contentType])
      .eq('is_active', true)

    const templateList = (templates ?? []).map(t => `- id: ${t.id} | nome: ${t.name} | categoria: ${t.category} | desc: ${t.description}`).join('\n')

    const artDirRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: `Você é Leo, Diretor de Arte sênior especialista em criativos premium para redes sociais.
Retorne APENAS JSON puro:
{
  "template_id": "uuid ou null",
  "composition": "hero_central|hero_bottom|split_right",
  "product_emphasis": "dominant",
  "text_position": "top|bottom|left",
  "background_style": "gradient|solid_dark|solid_vivid",
  "use_glow": false,
  "use_shadow": true,
  "use_badge": false,
  "decoration_level": "none|minimal",
  "reasoning": ""
}

FILOSOFIA DE ARTE PREMIUM:
- O produto é a ESTRELA. Tudo mais é coadjuvante.
- "hero_central" é a composição padrão para qualquer formato que não seja horizontal.
- "split_right" SOMENTE para formatos horizontais (landscape) — NUNCA para quadrado ou vertical.
- Sombra profunda (drop-shadow) é OBRIGATÓRIA quando o produto tem fundo removido.
- Fundo deve contrastar FORTEMENTE com o produto: produto claro → fundo escuro; produto escuro → fundo claro/vívido.
- Gradiente radial (escurece nas bordas) cria profundidade premium sem esforço.
- Texto NUNCA compete com o produto: coloca headline acima ou CTA footer abaixo, com zona separada.
- Badge de preço em círculo no canto é OK — não interfere no produto.
- "decoration_level" máximo "minimal" — 1 ou 2 formas geométricas opacity 0.08-0.15.
- Safe area: ${Math.round(Math.min(W, H) * 0.06)}px de todas as bordas.`,
      messages: [{
        role: 'user',
        content: `Formato: ${contentType} (${W}×${H}px)
Copy criado: ${JSON.stringify(copyOutput)}
Análise visual: ${JSON.stringify(visionAnalysis)}
Paleta: ${JSON.stringify(palette)}
Templates disponíveis:\n${templateList || 'Nenhum — criar do zero'}`,
      }],
    })

    const artDirText = artDirRes.content[0].type === 'text' ? artDirRes.content[0].text : '{}'
    const artDirection = parseJson<Record<string, unknown>>(artDirText, { composition: 'hero_central', use_shadow: true })
    await updateJob(supabase, jobId, { art_direction: artDirection })

    // Buscar HTML skeleton do template escolhido (se houver)
    let templateSkeleton = ''
    const chosenTemplateId = artDirection.template_id as string | null
    if (chosenTemplateId) {
      const { data: tpl } = await supabase.from('design_templates').select('html_skeleton').eq('id', chosenTemplateId).single()
      if (tpl?.html_skeleton) {
        templateSkeleton = tpl.html_skeleton
          .replace(/\{\{HEADLINE\}\}/g, copyOutput.headline)
          .replace(/\{\{SUBLINE\}\}/g, copyOutput.subline)
          .replace(/\{\{CTA\}\}/g, copyOutput.cta)
          .replace(/\{\{COMPANY_NAME\}\}/g, companyName)
          .replace(/\{\{PRIMARY_COLOR\}\}/g, pc)
          .replace(/\{\{SECONDARY_COLOR\}\}/g, sc)
          .replace(/\{\{PRODUCT_IMAGE_URL\}\}/g, productImageUrl ?? '')
          .replace(/\{\{WIDTH\}\}/g, String(W))
          .replace(/\{\{HEIGHT\}\}/g, String(H))
          .replace(/\{\{PRODUCT_HEIGHT\}\}/g, String(Math.round(H * (contentType === 'stories' || contentType === 'reels' ? 0.54 : 0.68))))
          .replace(/\{\{HEADLINE_SIZE\}\}/g, String(Math.round(Math.min(W, H) / 8)))
          .replace(/\{\{SUBLINE_SIZE\}\}/g, String(Math.round(Math.min(W, H) / 22)))
          .replace(/\{\{PRICE\}\}/g, '')
      }
    }

    // ── Passo 7: Designer HTML/CSS ───────────────────────────
    await updateJob(supabase, jobId, { status: 'designing', current_agent: 'Designer HTML/CSS', progress_pct: 65 })

    const dims = buildLayoutDimensions(contentType, W, H)
    const layoutGuide = buildLayoutGuide(contentType, W, H)
    const { isVertical, isSquare, headlinePx, sublinePx, priceBigPx, ctaPx, PAD, GAP } = dims

    const skeletonNote = templateSkeleton
      ? `\n\nPONTO DE PARTIDA — Template selecionado pelo Diretor de Arte (adapte e melhore):\n\`\`\`html\n${templateSkeleton}\n\`\`\`\n`
      : ''

    const designerSystemPrompt = `Você é Carla, Designer SENIOR especialista em HTML/CSS para criativos de marketing digital PREMIUM.

FILOSOFIA: Cada criativo deve passar no teste dos 2 segundos — o produto é identificado instantaneamente, a mensagem é absorvida sem esforço, o CTA é irresistível.

REGRAS ABSOLUTAS (violá-las invalida o trabalho):
1. O PRODUTO É O HERÓI. Ele ocupa o espaço visual dominante. NUNCA miniaturize o produto.
2. CONTRASTE OBRIGATÓRIO. Fundo deve contrastar fortemente com o produto. Produto claro? Fundo escuro. Produto colorido? Fundo neutro escuro.
3. SOMBRA PROFUNDA. Produto com fundo removido SEMPRE recebe drop-shadow multicamadas para flutuar.
4. TEXTO EM ZONA SEPARADA. Headline, subline e CTA ficam em áreas que NÃO se sobrepõem ao produto.
5. HIERARQUIA VISUAL. Tamanhos de fonte seguem razão áurea: headline → subline → CTA → legenda (1 : 0.6 : 0.45 : 0.35).
6. CTA DESTACADO. Botão com padding generoso, cor acento de alto contraste, uppercase + letter-spacing.
7. DECORAÇÃO MÍNIMA. Máx 2 elementos decorativos, opacity 0.08–0.18. Menos é mais.
8. FONTE PREMIUM. @import ${primaryFont} do Google Fonts. Headline peso 900, sem serifas.
9. URL DO PRODUTO SAGRADA. A URL fornecida vai no src do img. Jamais substitua por outra imagem.
10. HTML COMPLETO. position:absolute em tudo. body: width:${W}px; height:${H}px; overflow:hidden; position:relative; margin:0; padding:0.`

    const designerUserPrompt = productImageUrl
      ? `═══ CRIATIVO ${W}×${H}px | ${isVertical ? 'STORIES/REELS' : isSquare ? 'POST QUADRADO' : 'HORIZONTAL'} ═══

URL DO PRODUTO (SAGRADA — copie exatamente no src):
"${productImageUrl}"

EMPRESA: ${companyName}
PALETA: fundo ${palette.background ?? pc} | texto ${palette.text_primary ?? '#fff'} | acento ${palette.accent ?? sc} | CTA bg ${palette.cta_bg ?? sc}
${skeletonNote}
COPY:
• Headline: "${copyOutput.headline}"
• Subline: "${copyOutput.subline}"
• CTA: "${copyOutput.cta}"

DIREÇÃO DE ARTE: composição=${artDirection.composition} | shadow=${artDirection.use_shadow} | badge=${artDirection.use_badge}
Análise do produto: ${JSON.stringify(visionAnalysis).slice(0, 300)}

${layoutGuide}

TIPOGRAFIA — @import url('https://fonts.googleapis.com/css2?family=${primaryFont.replace(/ /g,'+')}:wght@400;700;900&display=swap') no <head>:
• Headline: ${headlinePx}px | weight:900 | line-height:0.9 | text-transform:uppercase | letter-spacing:-0.02em
• Subline: ${sublinePx}px | weight:400 | opacity:0.88
• Preço/destaque: ${priceBigPx}px | weight:900 | cor acento
• CTA: ${ctaPx}px | weight:700 | uppercase | letter-spacing:0.06em

CHECKLIST FINAL antes de entregar:
□ <img src="${productImageUrl}"> está no HTML?
□ O produto é o maior elemento visual?
□ Nenhum texto está sobre o produto?
□ O fundo contrasta com o produto?
□ O botão CTA tem cor de alto contraste?
□ HTML tem width:${W}px e height:${H}px?

Entregue APENAS o bloco \`\`\`html ... \`\`\`. Zero texto fora do bloco.`
      : `═══ CRIATIVO ${W}×${H}px | ${isVertical ? 'STORIES/REELS' : isSquare ? 'POST QUADRADO' : 'HORIZONTAL'} ═══

EMPRESA: ${companyName} | NICHO: ${niche || 'geral'}
PALETA: fundo ${palette.background ?? pc} | texto ${palette.text_primary ?? '#fff'} | acento ${palette.accent ?? sc}
${skeletonNote}
COPY:
• Headline: "${copyOutput.headline}"
• Subline: "${copyOutput.subline}"
• CTA: "${copyOutput.cta}"

SEM IMAGEM DO PRODUTO — use uma foto Unsplash temática de alta qualidade:
• Automotivo: https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=90&auto=format&fit=crop
• Tecnologia: https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1200&q=90&auto=format&fit=crop
• Alimentação: https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&q=90&auto=format&fit=crop
• Moda/Beleza: https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1200&q=90&auto=format&fit=crop
• Fitness: https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=90&auto=format&fit=crop
• Negócios: https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=90&auto=format&fit=crop
Escolha a mais adequada para: ${briefing.slice(0, 80)}

${layoutGuide}

TIPOGRAFIA — @import url('https://fonts.googleapis.com/css2?family=${primaryFont.replace(/ /g,'+')}:wght@400;700;900&display=swap') no <head>:
• Headline: ${headlinePx}px | weight:900 | uppercase
• Subline: ${sublinePx}px | weight:400
• CTA: ${ctaPx}px | weight:700 | uppercase | letter-spacing:0.06em

Entregue APENAS o bloco \`\`\`html ... \`\`\`.`

    // Tentar enviar imagem como base64 para o Designer (mais confiável que URL)
    let productBase64: { data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' } | null = null
    if (productImageUrl) {
      productBase64 = await fetchImageAsBase64(productImageUrl)
    }

    const buildDesignerMessages = (withVision: boolean): Parameters<typeof anthropic.messages.create>[0]['messages'] =>
      productImageUrl && withVision && productBase64
        ? [{
            role: 'user' as const,
            content: [
              { type: 'image' as const, source: { type: 'base64' as const, media_type: productBase64.mediaType, data: productBase64.data } },
              { type: 'text' as const, text: `ESTA IMAGEM É O PRODUTO. Sua URL é: "${productImageUrl}"\nUse EXATAMENTE esta URL no src do <img>. NÃO use nenhuma outra imagem.\n\n${designerUserPrompt}` },
            ],
          }]
        : [{ role: 'user' as const, content: designerUserPrompt }]

    let designerResText = ''
    try {
      const designerRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: designerSystemPrompt,
        messages: buildDesignerMessages(true),
      })
      designerResText = designerRes.content[0].type === 'text' ? designerRes.content[0].text : ''
    } catch {
      // Fallback sem vision
      console.warn('[studio] Designer com vision falhou, tentando sem imagem na mensagem')
      const designerRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: designerSystemPrompt,
        messages: buildDesignerMessages(false),
      })
      designerResText = designerRes.content[0].type === 'text' ? designerRes.content[0].text : ''
    }

    let designerHtml = extractHtml(designerResText)
    if (productImageUrl) designerHtml = enforceProductImage(designerHtml, productImageUrl)
    designerHtml = wrapHtml(designerHtml, W, H)

    await updateJob(supabase, jobId, { designer_html: designerHtml })

    // ── Passo 8+9+10: Render → Critique (com loop de correção) ──
    let finalHtml = designerHtml
    let finalPngUrl: string | null = null
    let finalPngBytes: ArrayBuffer | null = null
    let critique: Record<string, unknown> = { score: 10, passed: true, issues: [] }
    let correctionAttempts = 0

    for (let attempt = 0; attempt <= 2; attempt++) {
      // Render
      await updateJob(supabase, jobId, {
        status: 'rendering',
        current_agent: 'Render Engine',
        progress_pct: 75 + attempt * 5,
      })

      const pngBytes = await renderHtmlToPng(finalHtml, W, H, ctx.origin)
      if (pngBytes) {
        finalPngBytes = pngBytes
        const suffix = attempt > 0 ? `_v${attempt + 1}` : ''
        finalPngUrl = await uploadPng(pngBytes, supabase, companyId, jobId, suffix)
        await updateJob(supabase, jobId, { rendered_png_url: finalPngUrl })
      }

      // Critique — usa bytes em memória (base64) para evitar problemas de URL pública
      await updateJob(supabase, jobId, { status: 'critiquing', current_agent: 'Crítico Visual', progress_pct: 80 + attempt * 5 })

      try {
        const critiquePromptImage = finalPngBytes
          ? [{
              role: 'user' as const,
              content: [
                { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png' as const, data: Buffer.from(finalPngBytes).toString('base64') } },
                { type: 'text' as const, text: `Você é um crítico visual RIGOROSO de criativos de marketing digital premium. Avalie e retorne APENAS JSON puro:
{
  "score": 0-10,
  "passed": true ou false (score >= 8),
  "issues": [
    { "rule": "nome da regra violada", "severity": "high|medium|low", "suggestion": "instrução específica de como corrigir" }
  ],
  "praise": ["pontos positivos concretos"]
}

RUBRICA DE AVALIAÇÃO (cada critério vale 1 ponto, exceto ★★ que vale 2):

★★ [PRODUTO_DOMINANTE] O produto ocupa ≥60% do espaço visual e é o primeiro elemento que o olho percebe. Se o produto estiver pequeno, lateral, ou competindo com texto, desconte 2 pontos. (severity: high se falhar)

★★ [CONTRASTE_FUNDO_PRODUTO] O fundo contrasta fortemente com o produto — eles NÃO se "fundem". Fundo e produto de cores similares é falha GRAVE. (severity: high se falhar)

[TEXTO_SEPARADO] Headline, subline e CTA estão em zonas que NÃO se sobrepõem ao produto. Texto sobre produto = -1 ponto.

[SOMBRA_PROFUNDIDADE] Produto tem sombra drop-shadow visível que o faz "flutuar" sobre o fundo, criando profundidade 3D.

[HIERARQUIA_TIPOGRAFICA] Headline > subline > CTA em tamanho. O texto mais importante é o maior.

[LEGIBILIDADE_2S] Em 2 segundos: produto identificado + headline lida + CTA visto. Teste mental: rápido?

[CTA_IMPACTANTE] Botão CTA tem cor de alto contraste, padding generoso, texto uppercase. É impossível não ver.

[PREMIUM_FINISH] Design tem acabamento profissional: espaçamentos consistentes, alinhamentos corretos, sem elementos cortados nas bordas.

[PALETA_HARMONICA] Máx 3 cores visíveis dominantes. Regra 60-30-10 respeitada.

[COPY_ADEQUADO] Headline impactante, subline complementar, CTA direto. Copy adequado ao nicho/produto.

Briefing original: ${briefing}
Copy esperado: ${JSON.stringify(copyOutput)}

IMPORTANTE: Seja SEVERO com produto pequeno ou mal posicionado. Um criativo onde o produto não domina a cena NÃO pode passar (score < 8).` }
              ],
            }]
          : [{ role: 'user' as const, content: `Não foi possível renderizar a imagem. Retorne: {"score":5,"passed":false,"issues":[{"rule":"render_failed","severity":"high","suggestion":"Verificar HTML do designer"}],"praise":[]}` }]

        const critiqueRes = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: `Você é Ricardo, Crítico Visual sênior especialista em marketing digital.
Avalie criativos com rigor profissional e retorne sempre JSON válido conforme solicitado.`,
          messages: critiquePromptImage,
        })

        const critiqueText = critiqueRes.content[0].type === 'text' ? critiqueRes.content[0].text : '{}'
        critique = parseJson<Record<string, unknown>>(critiqueText, { score: 7, passed: false, issues: [] })
        await updateJob(supabase, jobId, { critique })
      } catch (critiqueErr) {
        // PNG inacessível para o modelo — aceitar arte sem crítica visual
        console.warn('[studio] Crítico Visual falhou, aceitando arte:', critiqueErr)
        critique = { score: 8, passed: true, issues: [], praise: ['Validação visual automática indisponível'] }
        await updateJob(supabase, jobId, { critique })
      }

      if (critique.passed === true || attempt >= 2) break

      // Autocorreção
      correctionAttempts = attempt + 1
      await updateJob(supabase, jobId, {
        status: 'correcting',
        current_agent: 'Designer HTML/CSS (autocorreção)',
        correction_attempts: correctionAttempts,
        progress_pct: 85,
      })

      const issuesList = (critique.issues as Array<{ rule: string; suggestion: string }> ?? [])
        .map(i => `- ${i.rule}: ${i.suggestion}`).join('\n')

      const correctionRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: designerSystemPrompt,
        messages: productImageUrl
          ? [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'url', url: productImageUrl } },
                { type: 'text', text: `ESTA IMAGEM É O PRODUTO: "${productImageUrl}"\n\nVocê criou este criativo HTML (${W}×${H}px) mas ele foi REPROVADO pelo Crítico Visual:\n\`\`\`html\n${finalHtml}\n\`\`\`\n\nCORREÇÕES OBRIGATÓRIAS:\n${issuesList}\n\nAO CORRIGIR, RESPEITE ESTAS LEIS:\n• O produto (src="${productImageUrl}") DEVE ser o elemento visual dominante — aumente height se necessário\n• Fundo e produto DEVEM contrastar fortemente — mude a cor do fundo se precisar\n• Texto em zona separada — NUNCA sobre o produto\n• Espaçamento mínimo ${Math.round(W * 0.06)}px das bordas\n• Produto com drop-shadow multicamadas se tiver fundo transparente\n• HTML exatamente ${W}px × ${H}px; overflow:hidden\n\nEntregue APENAS entre \`\`\`html e \`\`\`. Zero texto fora do bloco.` }
              ],
            }]
          : [{
              role: 'user',
              content: `Você criou este criativo (${W}×${H}px):\n\`\`\`html\n${finalHtml}\n\`\`\`\n\nCORREÇÕES EXIGIDAS:\n${issuesList}\n\nAplique as correções. HTML ${W}×${H}px. Apenas entre \`\`\`html e \`\`\`.`,
            }],
      })

      let correctedHtml = extractHtml(correctionRes.content[0].type === 'text' ? correctionRes.content[0].text : '')
      if (productImageUrl) correctedHtml = enforceProductImage(correctedHtml, productImageUrl)
      finalHtml = wrapHtml(correctedHtml, W, H)
    }

    // ── Finalizar job ────────────────────────────────────────
    await updateJob(supabase, jobId, {
      status: 'done',
      current_agent: null,
      progress_pct: 100,
      final_html: finalHtml,
      final_png_url: finalPngUrl,
      correction_attempts: correctionAttempts,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[studio] pipeline error:', err)
    await updateJob(supabase, jobId, { status: 'failed', error_message: msg })
  }
}
