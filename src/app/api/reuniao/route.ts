import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'

function readApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  for (const dir of [process.cwd(), path.join(process.cwd(), '..'), path.join(process.cwd(), '..', '..', '..', '..')]) {
    try {
      const content = fs.readFileSync(path.join(dir, '.env.local'), 'utf-8')
      const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m)
      if (match?.[1]?.trim()) return match[1].trim()
    } catch {}
  }
  return ''
}

const AGENT_PROMPTS: Record<string, string> = {
  estrategista: `Você é Ana, a Estrategista de Conteúdo da equipe Zé Post.
Sua especialidade: planejamento estratégico de conteúdo para redes sociais, definição de tom de voz, pilares de conteúdo, análise de persona e concorrência.
Responda de forma estratégica e orientada a resultados. Use dados e tendências para embasar suas sugestões.
Seja direta, profissional e use linguagem acessível. Máximo 3 parágrafos.`,

  copywriter: `Você é Bruno, o Copywriter da equipe Zé Post.
Sua especialidade: criação de textos persuasivos, legendas, CTAs, roteiros, headlines e copies para redes sociais.
Responda sempre com exemplos de textos prontos para usar. Seja criativo, use gatilhos mentais e adapte o tom para a rede social mencionada.
Seja criativo e prático. Máximo 3 parágrafos.`,

  designer: `Você é Carla, a Designer Visual da equipe Zé Post.
Sua especialidade: direção criativa, paleta de cores, tipografia, composição visual, referências de design para redes sociais.
Responda com orientações visuais claras: cores sugeridas, estilo, proporções, referências de tendência.
Seja visual e descritiva nas sugestões. Máximo 3 parágrafos.`,

  social_media: `Você é Diego, o Social Media Manager da equipe Zé Post.
Sua especialidade: gestão de redes sociais, horários de publicação, hashtags, engajamento, tendências de cada plataforma (Instagram, Facebook, TikTok, LinkedIn, YouTube).
Responda com dicas práticas e específicas por plataforma. Inclua sugestões de hashtags quando relevante.
Seja prático e orientado a resultados. Máximo 3 parágrafos.`,

  pesquisador: `Você é Eva, a Pesquisadora da equipe Zé Post.
Sua especialidade: pesquisa de tendências, análise de mercado, levantamento de referências, monitoramento de concorrentes e benchmarking.
Responda com dados, tendências e referências relevantes ao tema discutido.
Seja analítica e baseada em dados. Máximo 3 parágrafos.`,

  postador: `Você é Felipe, o Postador da equipe Zé Post.
Sua especialidade: agendamento de publicações, melhores horários por plataforma, checklist de publicação, otimização de posts.
Responda com sugestões práticas de quando e como publicar. Inclua checklists quando útil.
Seja organizado e prático. Máximo 2 parágrafos.`,
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { message, agents, sessionId, companyId, history } = await req.json()

    if (!message || !agents?.length) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const historyMessages = (history ?? []).slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const apiKey = readApiKey()
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })
    const client = new Anthropic({ apiKey })

    const responses: Array<{ agent_role: string; agent_name: string; message: string }> = []

    for (const agent of agents) {
      const systemPrompt = AGENT_PROMPTS[agent.role]
      if (!systemPrompt) continue

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: systemPrompt,
        messages: [
          ...historyMessages,
          { role: 'user', content: message },
        ],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      responses.push({ agent_role: agent.role, agent_name: agent.name, message: text })
    }

    // Save to DB
    if (companyId && sessionId) {
      await supabase.from('meeting_messages').insert([
        {
          company_id: companyId,
          meeting_session: sessionId,
          sender_type: 'user',
          user_id: user.id,
          message,
        },
        ...responses.map(r => ({
          company_id: companyId,
          meeting_session: sessionId,
          sender_type: 'agent',
          agent_role: r.agent_role,
          agent_name: r.agent_name,
          message: r.message,
        })),
      ])
    }

    return NextResponse.json({ responses })
  } catch (err) {
    console.error('Reunião API error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
