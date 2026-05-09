import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { agentId, message, history } = await req.json()
    if (!agentId || !message) {
      return NextResponse.json({ error: 'agentId e message são obrigatórios' }, { status: 400 })
    }

    // Buscar agente + skills habilitadas
    const { data: agent } = await supabase
      .from('squad_members')
      .select('*, skills:agent_skills(*)')
      .eq('id', agentId)
      .single()

    if (!agent) return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 })
    if (!agent.is_active) return NextResponse.json({ error: 'Agente desativado' }, { status: 400 })

    // Montar system prompt = prompt base + skills habilitadas
    const enabledSkills = (agent.skills ?? []).filter((s: { enabled: boolean }) => s.enabled)
    const skillsBlock = enabledSkills.length
      ? `\n\n## Skills disponíveis\n${enabledSkills
          .map((s: { name: string; description?: string; prompt: string }) =>
            `### ${s.name}${s.description ? ` — ${s.description}` : ''}\n${s.prompt}`
          ).join('\n\n')}`
      : ''

    const systemPrompt = `${agent.prompt ?? `Você é ${agent.name}, ${agent.role} da equipe Zé Post. ${agent.description ?? ''}`}${skillsBlock}`

    const historyMessages = (history ?? []).slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [...historyMessages, { role: 'user', content: message }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Atualizar last_active
    await supabase.from('squad_members').update({ last_active: new Date().toISOString() }).eq('id', agentId)

    return NextResponse.json({
      message: text,
      agent: { id: agent.id, name: agent.name, role: agent.role },
      skillsUsed: enabledSkills.map((s: { name: string }) => s.name),
    })
  } catch (err) {
    console.error('Erro ao executar agente:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
