// Supabase Edge Function: agente-executar
// Roda no runtime Deno do Supabase Edge Functions.
//
// Como deployar:
//   1. Instale o Supabase CLI: npm install -g supabase
//   2. Faça login: supabase login
//   3. Vincule o projeto: supabase link --project-ref zfnqcbroanttquprjwbo
//   4. Configure a secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   5. Deploy: supabase functions deploy agente-executar
//
// Endpoint após deploy:
//   POST https://zfnqcbroanttquprjwbo.supabase.co/functions/v1/agente-executar
//   Headers: Authorization: Bearer <user_jwt>
//   Body: { agentId, message, history? }

// @ts-expect-error — Deno globals (não disponíveis no TS do Next)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
// @ts-expect-error — Deno import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-expect-error — Deno import
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.30.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// @ts-expect-error — Deno globals
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // @ts-expect-error — Deno.env
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-expect-error — Deno.env
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    // @ts-expect-error — Deno.env
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { agentId, message, history } = await req.json()
    if (!agentId || !message) {
      return new Response(JSON.stringify({ error: 'agentId e message obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: agent } = await supabase
      .from('squad_members')
      .select('*, skills:agent_skills(*)')
      .eq('id', agentId)
      .single()

    if (!agent || !agent.is_active) {
      return new Response(JSON.stringify({ error: 'Agente não disponível' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const enabledSkills = (agent.skills ?? []).filter((s: { enabled: boolean }) => s.enabled)
    const skillsBlock = enabledSkills.length
      ? `\n\n## Skills disponíveis\n${enabledSkills
          .map((s: { name: string; description?: string; prompt: string }) =>
            `### ${s.name}${s.description ? ` — ${s.description}` : ''}\n${s.prompt}`
          ).join('\n\n')}`
      : ''
    const systemPrompt = `${agent.prompt ?? `Você é ${agent.name}, ${agent.role}.`}${skillsBlock}`

    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const historyMessages = (history ?? []).slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }))

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [...historyMessages, { role: 'user', content: message }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    await supabase.from('squad_members').update({ last_active: new Date().toISOString() }).eq('id', agentId)

    return new Response(JSON.stringify({
      message: text,
      agent: { id: agent.id, name: agent.name, role: agent.role },
      skillsUsed: enabledSkills.map((s: { name: string }) => s.name),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno', details: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
