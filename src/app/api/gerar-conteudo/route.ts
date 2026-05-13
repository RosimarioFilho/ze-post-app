import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { readApiKey, AR_SIZES, extractHtml, enforceProductImage, buildLayoutDimensions, buildLayoutGuide } from '@/lib/art-utils'

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

      const { isVertical, isSquare, isHorizontal, headlinePx, sublinePx, priceBigPx, ctaPx, logoPx, PAD, GAP, productHeightPx } = buildLayoutDimensions(tipo, W, H)
      const layoutGuide = buildLayoutGuide(tipo, W, H)

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
