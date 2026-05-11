import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NICHE_OPTIONS } from '@/types'
import fs from 'fs'
import path from 'path'

// ─── Niche-aware guidance ───────────────────────────────────────────────
// Cada nicho ganha (1) label legível, (2) tom de voz, (3) palette/visual,
// (4) referencias e (5) hashtags base. Os agentes usam isso para gerar
// conteudo verdadeiramente adaptado ao segmento do cliente.
interface NicheGuide {
  label: string
  tomVoz: string
  visualHints: string
  referencias: string
  hashtags: string
  copyFocus: string
}

const NICHE_GUIDES: Record<string, NicheGuide> = {
  padaria: {
    label: 'Padaria / Confeitaria',
    tomVoz: 'Acolhedor, afetivo e caseiro. Ressalta frescor, tradição e o cheirinho de pão quente. Use linguagem coloquial brasileira.',
    visualHints: 'Tons quentes (marrom-pão, dourado, vermelho-cereja). Texturas rústicas. Foto cheia de produto com close-up apetitoso. Elementos de farinha, trigo, vapor.',
    referencias: 'Padarias artesanais, confeitarias francesas, bistrôs. Estilo "aconchegante e fresquinho".',
    hashtags: '#padaria #paofresco #confeitaria #cafedamanha #docescaseiros',
    copyFocus: 'Frescor diário, sabor caseiro, momentos em família, café da manhã, lanche da tarde.',
  },
  restaurante: {
    label: 'Restaurante / Lanchonete',
    tomVoz: 'Apetitoso, descontraído e descritivo. Faz "água na boca". Convida para a experiência gastronômica.',
    visualHints: 'Food photography vibrante, fundo escuro ou madeira. Vapor, gotas, ingredientes ao redor. Cores saturadas que valorizem o prato (vermelho, mostarda, verde-erva).',
    referencias: 'iFood, Outback, hamburguerias artesanais, food trucks gourmet.',
    hashtags: '#gastronomia #foodporn #delicia #restaurante #cardapio',
    copyFocus: 'Sabor irresistível, ingredientes selecionados, experiência única, peça já, delivery.',
  },
  provedor_internet: {
    label: 'Provedor de Internet',
    tomVoz: 'Direto, técnico-acessível e confiável. Foco em velocidade, estabilidade e atendimento local. Tom de "vizinho que entende de tecnologia".',
    visualHints: 'Cores frias e tecnológicas (azul, ciano, roxo elétrico). Elementos de wifi, fibra óptica, velocímetro, ícones de streaming. Background limpo e moderno.',
    referencias: 'Vivo Fibra, Claro Net, provedores regionais. Estilo techwave/futurista.',
    hashtags: '#internetfibra #altavelocidade #provedorlocal #wifi #tecnologia',
    copyFocus: 'Velocidade em mega/giga, estabilidade, instalação grátis, sem fidelidade, atendimento 24h.',
  },
  concessionaria: {
    label: 'Concessionária / Veículos',
    tomVoz: 'Aspiracional, premium e confiante. Vende sonho de liberdade, status e desempenho. Tom executivo.',
    visualHints: 'Fundo dramático (asfalto, garagem, pôr-do-sol). Veículo em ângulo 3/4 com iluminação cinematográfica. Cores metálicas, contraste alto, tipografia bold.',
    referencias: 'Jeep, Fiat, Volkswagen, BMW. Comerciais de TV automotivos.',
    hashtags: '#carros #veiculos #concessionaria #novomodelo #condicaoespecial',
    copyFocus: 'Parcelas, taxa zero, test-drive grátis, lançamento, ano novo zero km, retomada do seu seminovo.',
  },
  moda: {
    label: 'Moda / Vestuário',
    tomVoz: 'Estiloso, atual e inspirador. Linguagem de tendência, aspiracional. Fala de identidade pessoal através das peças.',
    visualHints: 'Editorial fashion, fundos limpos ou texturizados. Modelos posando ou flatlays. Paleta neutra (off-white, nude, preto) ou vibrante conforme coleção.',
    referencias: 'Zara, Renner, C&A, lojas de boutique. Estilo Instagram fashion.',
    hashtags: '#moda #lookdodia #tendencia #estilo #colecao',
    copyFocus: 'Nova coleção, look completo, tendência da estação, frete grátis, parcelado, peças exclusivas.',
  },
  beleza: {
    label: 'Beleza / Estética',
    tomVoz: 'Empoderador, gentil e sensorial. Promove autocuidado, confiança e transformação. Linguagem feminina mas inclusiva.',
    visualHints: 'Tons rosa, dourado, lilás, branco. Texturas suaves (mármore, veludo). Antes/depois, close em produtos, gestos delicados. Iluminação suave.',
    referencias: 'Sephora, O Boticário, Quem Disse Berenice, salões premium.',
    hashtags: '#beleza #autocuidado #skincare #esteticafacial #procedimentos',
    copyFocus: 'Procedimento, agende seu horário, resultado real, autoestima, combo promocional, dia da beleza.',
  },
  academia: {
    label: 'Academia / Saúde',
    tomVoz: 'Motivador, energético e direto. Linguagem de superação. Equilibra performance e bem-estar.',
    visualHints: 'Cores vibrantes (laranja, vermelho, preto). Atletas em ação, equipamentos, suor. Tipografia bold/condensada. Composição dinâmica.',
    referencias: 'Smart Fit, Bodytech, CrossFit boxes. Estilo "no pain no gain".',
    hashtags: '#academia #treino #vidasaudavel #fitness #motivacao',
    copyFocus: 'Matrícula grátis, plano anual, primeira aula experimental, transformação, comunidade.',
  },
  imobiliaria: {
    label: 'Imobiliária',
    tomVoz: 'Aspiracional e consultivo. Fala de realização do sonho da casa própria. Gera confiança e segurança.',
    visualHints: 'Fotos arquitetônicas (fachada, sala iluminada, vista). Cores neutras (bege, cinza, verde sálvia). Plantas baixas, ícones de ambientes.',
    referencias: 'Loft, QuintoAndar, imobiliárias de luxo. Estilo arquitetural premium.',
    hashtags: '#imovel #casanova #apartamento #imobiliaria #realizandosonhos',
    copyFocus: 'M², dormitórios, financiamento, entrada facilitada, pronto para morar, FGTS.',
  },
  educacao: {
    label: 'Educação / Cursos',
    tomVoz: 'Inspirador, didático e acessível. Promove transformação pela aprendizagem. Combate impostor syndrome.',
    visualHints: 'Cores vivas (azul-escola, amarelo, verde). Ilustrações flat, ícones de livros/diploma. Foto de alunos sorridentes ou estúdio de gravação.',
    referencias: 'Hotmart, Alura, Hashtag Treinamentos, escolas de idiomas.',
    hashtags: '#cursoonline #educacao #aprenderemcasa #certificado #transformacao',
    copyFocus: 'Certificado reconhecido, aulas práticas, carreira, depoimentos de alunos, último dia de inscrição.',
  },
  petshop: {
    label: 'Pet Shop / Veterinária',
    tomVoz: 'Carinhoso, leve e divertido. Trata pets como família. Combina humor com cuidado responsável.',
    visualHints: 'Cores pastel (azul-bebê, rosa, amarelo). Pets fofos como protagonistas. Patinhas, ossinhos, brinquedos como decoração.',
    referencias: 'Cobasi, Petz, lojas independentes de bairro.',
    hashtags: '#petshop #amopets #cachorro #gato #petsdoinsta',
    copyFocus: 'Banho e tosa, ração premium, brinquedos novos, vacinação, agendamento veterinário.',
  },
  tecnologia: {
    label: 'Tecnologia / Software',
    tomVoz: 'Inovador, técnico-acessível e visionário. Foco em eficiência, automação e ROI.',
    visualHints: 'Paleta tech (azul-elétrico, roxo, neon). Gradientes futuristas, glassmorphism, dashboards, ícones minimalistas. Fundo escuro.',
    referencias: 'Stripe, Linear, Notion, Vercel. Estilo SaaS premium.',
    hashtags: '#tecnologia #software #automacao #saas #inovacao',
    copyFocus: 'Aumento de produtividade, integrações, free trial, demo gratuita, automação, IA.',
  },
  ecommerce: {
    label: 'E-commerce',
    tomVoz: 'Direto ao ponto, urgente e persuasivo. Foca em oferta, prazo e benefício prático.',
    visualHints: 'Produto em destaque com fundo branco/contrastante. Selo de oferta, "frete grátis", percentual em vermelho/amarelo. Composição agressiva e vendedora.',
    referencias: 'Shopee, Mercado Livre, Magalu. Estilo "queima de estoque".',
    hashtags: '#promocao #ofertaimperdivel #fretegratis #ecommerce #compraonline',
    copyFocus: 'Desconto, frete grátis, últimas unidades, parcelado em 12x, cupom, black friday.',
  },
  servicos: {
    label: 'Serviços em geral',
    tomVoz: 'Profissional, confiável e prático. Demonstra expertise e disponibilidade.',
    visualHints: 'Paleta sóbria mas acolhedora. Foto do profissional em ação ou cliente satisfeito. Ícones de check, agenda, telefone.',
    referencias: 'GetNinjas, profissionais autônomos, consultorias.',
    hashtags: '#servicos #profissional #orcamentogratis #qualidade',
    copyFocus: 'Orçamento sem compromisso, atendimento rápido, garantia, anos de experiência, depoimentos.',
  },
}

function getNicheGuide(niche?: string | null): NicheGuide | null {
  if (!niche) return null
  // Match direto pelo value
  if (NICHE_GUIDES[niche]) return NICHE_GUIDES[niche]
  // Match pelo label exato (caso onboarding antigo tenha salvo o label)
  const byLabel = NICHE_OPTIONS.find(o => o.label === niche)
  if (byLabel && NICHE_GUIDES[byLabel.value]) return NICHE_GUIDES[byLabel.value]
  // Nicho livre ("Outro" — texto digitado) — retorna guide genérico com o texto
  return {
    label: niche,
    tomVoz: `Adapte o tom de voz ao segmento "${niche}". Pesquise o vocabulário típico, dores e desejos desse mercado.`,
    visualHints: `Use referencias visuais condizentes com "${niche}".`,
    referencias: `Marcas e canais de referencia em "${niche}".`,
    hashtags: `Hashtags do nicho "${niche}".`,
    copyFocus: `Foque nas dores e desejos especificos de quem atua/consome em "${niche}".`,
  }
}

function readApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  // Fallback: read directly from .env.local (bypasses Turbopack env injection issues)
  for (const dir of [process.cwd(), path.join(process.cwd(), '..'), path.join(process.cwd(), '..', '..', '..', '..')]) {
    try {
      const content = fs.readFileSync(path.join(dir, '.env.local'), 'utf-8')
      const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m)
      if (match?.[1]?.trim()) return match[1].trim()
    } catch {}
  }
  return ''
}

const AR_SIZES: Record<string, [number, number]> = {
  post_instagram: [1080, 1080],
  post_facebook: [1080, 566],
  post_linkedin_imagem: [1200, 627],
  post_linkedin_texto: [1080, 1080],
  stories: [1080, 1920],
  carrossel: [1080, 1080],
  youtube: [1280, 720],
  reels: [1080, 1920],
}

const FALLBACK_PROMPTS: Record<string, string> = {
  estrategista: `Você é Ana, Estrategista de Conteúdo. Analise o briefing e defina em até 3 linhas: tom de voz ideal, abordagem estratégica e gancho principal de atenção. Seja concisa e direta.`,
  copywriter: `Você é Bruno, Copywriter especialista em redes sociais. Com base no briefing, entregue EXATAMENTE neste formato:

VISUAL:
Headline: [2-4 palavras impactantes]
Subline: [máx 8 palavras]
Oferta: [preço ou benefício principal em 1 linha]
CTA: [2-3 palavras]

LEGENDA:
[copy completo para publicação com emojis, hashtags e CTA]`,
  designer: `Você é Carla, Designer SENIOR especialista em HTML/CSS para criativos de marketing digital premium. Cria layouts com produto centralizado e em destaque absoluto, tipografia bold e limpa (Montserrat), background harmonioso com a paleta do produto. Quando o cliente fornece URL de imagem do produto, usa EXATAMENTE essa URL no atributo src — jamais busca alternativa externa.`,
  pesquisador: `Você é Eva, Pesquisadora de Mercado. Analise o briefing e traga insights, tendências e ângulos relevantes para o conteúdo. Seja analítica.`,
  revisora: `Você é Rita, Revisora de Qualidade. Revise o conteúdo gerado, verifique clareza, tom, gramática e adequação à marca. Aponte melhorias concisas.`,
  carrossel: `Você é Camila, Especialista em Carrossel. Crie um roteiro de carrossel com slides (título, texto, imagem sugerida) para engajamento máximo.`,
  postador: `Você é Felipe, Postador Digital. Sugira os melhores horários de publicação, legendas finais e checklist de publicação.`,
}

function replaceVars(prompt: string, vars: Record<string, string>): string {
  return prompt
    .replace(/\{\{company_name\}\}/g, vars.company_name)
    .replace(/\{\{primary_color\}\}/g, vars.primary_color)
    .replace(/\{\{secondary_color\}\}/g, vars.secondary_color)
    .replace(/\{\{logo_url\}\}/g, vars.logo_url)
}

function extractHtml(text: string): string {
  const fenced = text.match(/```html\n?([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const full = text.match(/<(!DOCTYPE html|html)[\s\S]*<\/html>/i)
  if (full) return full[0].trim()
  const div = text.match(/<(div|section|article|main)[^>]*>[\s\S]*<\/\1>/i)
  if (div) return div[0].trim()
  return text.trim()
}

// Rede de segurança NUCLEAR: substitui TODAS as URLs de stock photos em QUALQUER
// contexto do HTML (src="", background-image: url(), url() em CSS inline)
// pela URL do produto do cliente. Se nenhuma URL de stock for encontrada, injeta
// a imagem centralizada. Opera em qualquer formato que a IA possa usar.
function enforceProductImage(html: string, productUrl: string): string {
  if (!html || !productUrl) return html
  if (html.includes(productUrl)) return html

  // Regex que captura qualquer URL de stock photo em qualquer contexto
  // Cobre: unsplash.com, pexels.com, pixabay.com, shutterstock.com, istockphoto.com
  const STOCK_RE = /https?:\/\/(?:images\.unsplash\.com|cdn\.unsplash\.com|[^\s"')>]*unsplash\.com|[^\s"')>]*pexels\.com|[^\s"')>]*pixabay\.com|[^\s"')>]*shutterstock\.com|[^\s"')>]*istockphoto\.com)[^\s"')>]*/gi

  let modified = html.replace(STOCK_RE, productUrl)

  console.log('[enforceProductImage] stockUrlsReplaced:', modified !== html, '| productUrlPresent:', modified.includes(productUrl))

  // Se após substituir ainda não tem a URL (IA usou outro formato/estratégia), injeta
  // height:65% do body = tamanho grande garantido independente do formato
  if (!modified.includes(productUrl)) {
    const inject = `<img src="${productUrl}" alt="produto" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);height:65%;max-width:88%;object-fit:contain;filter:drop-shadow(0 40px 80px rgba(0,0,0,0.5));z-index:4">`
    modified = modified.includes('</body>')
      ? modified.replace('</body>', `${inject}\n</body>`)
      : modified + inject
  }
  return modified
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = readApiKey()
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada — verifique .env.local' }, { status: 500 })
    const anthropic = new Anthropic({ apiKey })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { tipo, descricao, quantidade, redes, observacoes, squad, companyId, ajuste, htmlAnterior, copyAnterior, refImagemUrl } = await req.json()
    console.log('[gerar-conteudo] req:', { tipo, hasRefImage: !!refImagemUrl, refImagemUrl, ajuste: !!ajuste })

    // ── Modo Refazer: só regera a arte com o ajuste solicitado ──────────────
    if (ajuste && htmlAnterior) {
      const [W, H] = AR_SIZES[tipo] ?? [1080, 1080]
      const refNote = refImagemUrl ? `\n\nImagem do produto do cliente (use se relevante ao ajuste): ${refImagemUrl}` : ''
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: FALLBACK_PROMPTS.designer,
        messages: [{
          role: 'user',
          content: `Você criou este criativo HTML (${W}×${H}px):\n\`\`\`html\n${htmlAnterior}\n\`\`\`\n\nCopy original usado:\n${copyAnterior ?? ''}${refNote}\n\nO cliente solicitou os seguintes AJUSTES:\n"${ajuste}"\n\nRegras invioláveis ao refazer:\n- NUNCA coloque texto ou elementos sobre a imagem do produto\n- Mantenha espaçamento mínimo de ${Math.round(W * 0.06)}px das bordas\n- O produto deve continuar em destaque absoluto, sem sobreposição\n- Background deve contrastar com o produto\n\nAplique APENAS os ajustes solicitados, mantendo a qualidade premium. HTML exatamente ${W}px × ${H}px. Entregue SOMENTE entre \`\`\`html e \`\`\`.`,
        }],
      })
      let newHtml = extractHtml(response.content[0].type === 'text' ? response.content[0].text : '')
      if (refImagemUrl) newHtml = enforceProductImage(newHtml, refImagemUrl)
      return NextResponse.json({ designerHtml: newHtml, copyFinal: copyAnterior ?? '', results: { designer: response.content[0].type === 'text' ? response.content[0].text : '' }, isAjuste: true })
    }

    const { data: company } = await supabase
      .from('companies')
      .select('name, primary_color, secondary_color, logo_url')
      .eq('id', companyId)
      .single()

    const vars = {
      company_name: company?.name ?? 'Sua Empresa',
      primary_color: (company?.primary_color ?? '#052d64').replace('#', ''),
      secondary_color: (company?.secondary_color ?? '#fe7902').replace('#', ''),
      logo_url: company?.logo_url ?? '',
    }
    const pc = `#${vars.primary_color}`
    const sc = `#${vars.secondary_color}`

    const { data: members } = await supabase
      .from('squad_members')
      .select('role, name, prompt')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('flow_order', { ascending: true })

    const memberMap = Object.fromEntries((members ?? []).map(m => [m.role, m]))

    const briefing = [
      `Tipo de conteúdo: ${tipo}`,
      `Redes sociais: ${(redes ?? []).join(', ')}`,
      `Descrição: ${descricao}`,
      `Quantidade: ${quantidade}`,
      `Observações: ${observacoes || 'Nenhuma'}`,
      `Empresa: ${vars.company_name}`,
      `Cor primária: ${pc}`,
      `Cor secundária: ${sc}`,
    ].join('\n')

    const rolesToRun: string[] = squad?.length
      ? squad
      : ['estrategista', 'copywriter', 'designer']

    const results: Record<string, string> = {}
    let sharedContext = `Briefing:\n${briefing}`

    for (const role of rolesToRun) {
      const member = memberMap[role]
      const rawPrompt = member?.prompt || FALLBACK_PROMPTS[role]
      if (!rawPrompt) continue

      const systemPrompt = replaceVars(rawPrompt, { ...vars, primary_color: pc, secondary_color: sc })

      const isDesigner = role === 'designer'

      const [W, H] = AR_SIZES[tipo] ?? [1080, 1080]

      const copy = results.copywriter ?? descricao

      const visualCopy = (() => {
        const visualMatch = copy.match(/VISUAL:([\s\S]*?)(?=LEGENDA:|$)/i)
        return visualMatch ? visualMatch[1].trim() : copy.slice(0, 200)
      })()

      // ━━━ FORMAT TYPE ━━━
      const isVertical   = H / W >= 1.4   // stories, reels (9:16)
      const isSquare     = Math.abs(H / W - 1) < 0.1  // posts quadrados (1:1)
      const isHorizontal = W / H >= 1.5   // youtube, facebook (16:9, 1.91:1)

      // Tamanhos proporcionais — usa o lado MENOR como base para legibilidade
      const base = Math.min(W, H)
      const headlinePx  = Math.round(base / (isVertical ? 8.5 : isHorizontal ? 9.5 : 8))
      const sublinePx   = Math.round(base / 22)
      const priceBigPx  = Math.round(base / 7)        // preço grande estilo refs
      const ctaPx       = Math.round(base / 26)
      const logoPx      = Math.round(base / 50)
      const PAD         = Math.round(base * 0.06)
      const GAP         = Math.round(base * 0.025)

      // ━━━ LAYOUT ESPECÍFICO POR FORMATO — valores em pixels EXATOS ━━━
      // REGRA CARDINAL: produto sempre com height em PIXELS ABSOLUTOS (não %)
      // para evitar que a IA reduza o tamanho aplicando % relativo ao elemento pai.
      const productHeightPx = isVertical
        ? Math.round(H * 0.54)   // stories: ~1037px de 1920 — produto domina
        : isSquare
        ? Math.round(H * 0.68)   // square: ~734px de 1080 — produto grande
        : Math.round(H * 0.86)   // horizontal: ~619px de 720 — produto quase full height

      const layoutGuide = isVertical
        ? `FORMATO STORIES/REELS (${W}×${H}px):
LAYOUT EM 3 ZONAS — tudo position:absolute no body:
- TOPO (top:0; height:${Math.round(H*0.20)}px): logo empresa + headline
- PRODUTO — DOMINANTE E CENTRALIZADO (z-index:3):
  position:absolute; left:50%; top:48%; transform:translate(-50%,-50%);
  height:${productHeightPx}px; ← USE ESTE VALOR EXATO EM PIXELS
  max-width:92%; object-fit:contain;
  filter:drop-shadow(0 40px 80px rgba(0,0,0,0.45));
  O produto deve ser o elemento VISUALMENTE DOMINANTE — NUNCA reduzir abaixo de ${productHeightPx}px
- BASE (bottom:0; height:${Math.round(H*0.24)}px; z-index:5): subline + oferta + CTA footer
  • Preço destaque: font-size:${priceBigPx}px weight 900
  • Footer CTA: background cor sólida, height:${Math.round(H * 0.07)}px`
        : isSquare
        ? `FORMATO QUADRADO (${W}×${H}px):
LAYOUT A — Hero centralizado (para produtos PNG/fundo limpo):
  PRODUTO: position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  height:${productHeightPx}px; ← USE ESTE VALOR EXATO EM PIXELS
  max-width:82%; object-fit:contain;
  filter:drop-shadow(0 30px 70px rgba(0,0,0,0.4));
  Logo: top-left | Tag: top-right
  Headline: acima OU abaixo do produto (NUNCA sobre ele)
  Badge preço + footer CTA na zona inferior (bottom:0 to ${Math.round(H*0.22)}px)
LAYOUT B — Split (produto dir | texto esq):
  PRODUTO: position:absolute; right:${Math.round(W*0.02)}px; top:50%; transform:translateY(-50%);
  height:${productHeightPx}px; width:${Math.round(W*0.52)}px; object-fit:contain;
  Texto zona esquerda: left:${PAD}px; width:${Math.round(W*0.44)}px`
        : `FORMATO HORIZONTAL (${W}×${H}px):
LAYOUT SPLIT texto-esq | produto-dir:
PRODUTO: position:absolute; right:${Math.round(W*0.01)}px; top:50%; transform:translateY(-50%);
  height:${productHeightPx}px; ← USE ESTE VALOR EXATO EM PIXELS
  max-width:54%; object-fit:contain;
  filter:drop-shadow(0 25px 60px rgba(0,0,0,0.4));
Texto zona esquerda (width:${Math.round(W*0.44)}px; left:${PAD}px):
  logo topo, headline ${headlinePx}px, subline, preço ${priceBigPx}px, footer CTA`

      // ━━━ PROMPT DA DESIGNER (curto e direto) ━━━
      const designerTextPrompt = refImagemUrl
        ? `URL DO PRODUTO DO CLIENTE (OBRIGATÓRIO — não substitua por nenhuma outra imagem):
${refImagemUrl}

→ Esta URL DEVE estar no atributo src do <img> do produto no HTML final.
→ Analise as cores da imagem acima para criar background harmonioso.
→ PROIBIDO usar Unsplash, Pexels, Pixabay ou qualquer outra URL de imagem.

CRIATIVO HTML ${W}×${H}px | ${isVertical ? 'STORIES/REELS' : isSquare ? 'POST QUADRADO' : 'HORIZONTAL'}
EMPRESA: ${vars.company_name} | ACENTO: ${pc} / ${sc}
COPY (máx 15 palavras visíveis): ${visualCopy}

${layoutGuide}

TIPOGRAFIA (Montserrat — @import Google Fonts obrigatório):
- Headline: ${headlinePx}px weight 900, line-height 0.92
- Preço/oferta: ${priceBigPx}px weight 900
- CTA: ${ctaPx}px weight 700, uppercase, letter-spacing 0.05em
- Proibido text-shadow 3D (máx 1-2px sutil)

REGRAS:
1. Produto centralizado e GRANDE (55-70%) — NUNCA canto inferior direito
2. Texto em zona separada — NUNCA sobre o produto
3. Background contrasta com o produto (cor sólida ou gradiente 2 tons)
4. Padding ${PAD}px das bordas | gap ${GAP * 2}px entre elementos
5. Decoração mínima: máx 2 elementos sutis (opacity 0.1-0.25)

HTML completo: width:${W}px; height:${H}px; overflow:hidden; font-family Montserrat.
ENTREGUE APENAS entre \`\`\`html e \`\`\`. Nenhum texto fora do bloco.
LEMBRETE: <img src="${refImagemUrl}" ...> — obrigatório.`
        : `CRIATIVO HTML ${W}×${H}px | ${isVertical ? 'STORIES/REELS' : isSquare ? 'POST QUADRADO' : 'HORIZONTAL'}
EMPRESA: ${vars.company_name} | CORES: ${pc} / ${sc}
PRODUTO/SERVIÇO: ${descricao.slice(0, 120)}
COPY (máx 15 palavras visíveis): ${visualCopy}

IMAGEM DO PRODUTO (cliente não enviou — escolha 1 photo-id Unsplash adequado):
- Carro/moto: photo-1494976388531-d1058494cdd8 | photo-1503376780353-7e6692767b70
- Comida: photo-1565299624946-b28f40a0ae38 | photo-1529042410759-befb1204b468
- Tech: photo-1496181133206-80ce9b88a853 | photo-1518770660439-4636190af475
- Moda: photo-1558769132-cb1aea458c5e | photo-1483985988355-763728e1935b
- Fitness: photo-1517836357463-d25dfeac3438 | photo-1534438327276-14e5300c3a48
- Beleza: photo-1522335789203-aabd1fc54bc9 | photo-1596462502278-27bfdc403348
- Pets: photo-1450778869180-41d0601e046e | photo-1587300003388-59208cc962cb
Use: <img alt="produto" src="https://images.unsplash.com/[PHOTO_ID]?w=1200&q=90&auto=format&fit=crop" style="[posição conforme layout]">

${layoutGuide}

TIPOGRAFIA (Montserrat — @import Google Fonts obrigatório):
- Headline: ${headlinePx}px weight 900, line-height 0.92
- Preço/oferta: ${priceBigPx}px weight 900
- CTA: ${ctaPx}px weight 700, uppercase, letter-spacing 0.05em
- Proibido text-shadow 3D

REGRAS:
1. Produto centralizado e GRANDE (55-70%) — NUNCA canto inferior direito
2. Texto em zona separada — NUNCA sobre o produto
3. Background contrasta com produto (sólido saturado ou gradiente 2 tons)
4. Referências: Jeep Compass, Fiat Pulse, Internet 300mega
5. Padding ${PAD}px das bordas | gap ${GAP * 2}px | decoração máx 2 elementos (opacity 0.1-0.25)

HTML completo: width:${W}px; height:${H}px; overflow:hidden; font-family Montserrat.
ENTREGUE APENAS entre \`\`\`html e \`\`\`. Nenhum texto fora do bloco.`

      // Se há imagem de referência, usar vision para leitura de paleta de cores
      const designerMessages: Parameters<typeof anthropic.messages.create>[0]['messages'] =
        isDesigner && refImagemUrl
          ? [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'url', url: refImagemUrl },
                },
                {
                  type: 'text',
                  text: `ESTA IMAGEM É O PRODUTO. Sua URL é: "${refImagemUrl}"\nUse EXATAMENTE esta URL no src do img. NÃO use nenhuma outra imagem.\n\n${designerTextPrompt}`,
                },
              ],
            }]
          : [{ role: 'user', content: designerTextPrompt }]

      const maxTokens = isDesigner ? 4096 : 700
      const model = isDesigner ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'

      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: isDesigner ? designerMessages : [{ role: 'user', content: sharedContext }],
      })

      const output = response.content[0].type === 'text' ? response.content[0].text : ''
      results[role] = output
      sharedContext += `\n\n[${role.toUpperCase()}]: ${output.slice(0, 400)}`
    }

    const copyFinal = results.copywriter ?? Object.values(results).find(r => r.length > 30) ?? descricao
    let designerHtml = results.designer ? extractHtml(results.designer) : ''
    if (designerHtml && refImagemUrl) {
      const before = designerHtml.includes(refImagemUrl)
      designerHtml = enforceProductImage(designerHtml, refImagemUrl)
      const after = designerHtml.includes(refImagemUrl)
      console.log('[gerar-conteudo] enforceProductImage:', { aiUsedRefUrl: before, finalHasRefUrl: after })
    }

    const [W2, H2] = AR_SIZES[tipo] ?? [1080, 1080]

    // Documento HTML completo que será armazenado/renderizado
    // Se a IA já retornou um documento completo (!DOCTYPE html), usa direto — evita double-wrap
    const isFullDoc = designerHtml.trimStart().toLowerCase().startsWith('<!doctype') || designerHtml.trimStart().toLowerCase().startsWith('<html')
    const fullHtml = designerHtml
      ? isFullDoc
        ? designerHtml
        : `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${W2}px;height:${H2}px;overflow:hidden}</style></head><body>${designerHtml}</body></html>`
      : ''

    const { data: content, error: contentError } = await supabase
      .from('contents')
      .insert({
        company_id: companyId,
        created_by: user.id,
        title: `${tipo} — ${descricao.slice(0, 50)}`,
        body: copyFinal,
        content_type: tipo,
        platforms: redes ?? [],
        status: 'pendente_aprovacao',
        media_urls: [],
        art_html: fullHtml || null,
        art_width: W2,
        art_height: H2,
      })
      .select()
      .single()

    if (contentError) console.error('[gerar-conteudo] Content insert error:', contentError)

    // Tenta também salvar como arquivo no storage (como conveniência para download)
    let artUrl = ''
    if (fullHtml && content?.id) {
      const storagePath = `${companyId}/artes/${content.id}.html`
      const htmlBlob = new Blob([fullHtml], { type: 'text/html; charset=utf-8' })
      const { data: uploaded, error: upErr } = await supabase.storage
        .from('media')
        .upload(storagePath, htmlBlob, { contentType: 'text/html; charset=utf-8', upsert: true })
      if (upErr) console.error('[gerar-conteudo] Storage upload art error:', upErr)
      if (uploaded) {
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(storagePath)
        artUrl = publicUrl
        const { error: updErr } = await supabase.from('contents').update({ media_urls: [artUrl] }).eq('id', content.id)
        if (updErr) console.error('[gerar-conteudo] Update media_urls error:', updErr)
      }
    }

    if (content) {
      await supabase.from('approvals').insert({
        content_id: content.id,
        company_id: companyId,
        requested_by: user.id,
        status: 'pendente',
      })
    }

    return NextResponse.json({ results, copyFinal, designerHtml, contentId: content?.id, artUrl, artWidth: W2, artHeight: H2 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Erro na geração:', err)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? msg : 'Erro interno ao gerar conteúdo' },
      { status: 500 }
    )
  }
}
