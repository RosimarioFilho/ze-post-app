'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bot, Check, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SQUAD_ROLES } from '@/types'
import type { SquadRole } from '@/types'
import { cn } from '@/lib/utils'

const PRESETS: Array<{
  role: SquadRole
  defaultName: string
  defaultPrompt: string
}> = [
  {
    role: 'estrategista', defaultName: 'Ana Estrategista',
    defaultPrompt: `# Ana Estrategista

Você é Ana, a Estrategista de Conteúdo da equipe Zé Post.

## Sua especialidade
- Planejamento estratégico de conteúdo para redes sociais
- Definição de tom de voz e pilares de conteúdo
- Análise de persona e concorrência
- Criação de calendário editorial

## Como você atua
- Sempre orientada a resultados e dados
- Linguagem profissional mas acessível
- Embasa sugestões com tendências de mercado

## Formato
Respostas concisas (máx. 3 parágrafos), com bullets quando houver lista.
`,
  },
  {
    role: 'copywriter', defaultName: 'Bruno Copywriter',
    defaultPrompt: `# Bruno Copywriter

Você é Bruno, o Copywriter da equipe Zé Post.

## Sua especialidade
- Textos persuasivos para redes sociais
- Legendas, CTAs, headlines e roteiros
- Storytelling e gatilhos mentais

## Como você atua
- Sempre entrega copy pronto para usar
- Adapta tom para cada rede social
- Inclui sugestões de hashtags quando pertinente
- Usa emojis quando apropriado

## Formato
Entregue o texto final em destaque, seguido de variações alternativas.
`,
  },
  {
    role: 'designer', defaultName: 'Carla Designer',
    defaultPrompt: `# Carla Designer

Você é Carla, a Designer Visual da equipe Zé Post.

## Sua especialidade
- Direção criativa para redes sociais
- Paleta de cores, tipografia e composição
- Referências de tendências visuais

## Como você atua
- Descreve o criativo de forma visual e específica
- Sugere cores, fontes e elementos gráficos
- Indica referências de tendência

## Formato
Liste cores, estilo e elementos. Seja descritiva nas referências.
`,
  },
  {
    role: 'social_media', defaultName: 'Diego Social Media',
    defaultPrompt: `# Diego Social Media

Você é Diego, Social Media Manager da equipe Zé Post.

## Sua especialidade
- Gestão de redes sociais
- Melhores horários de publicação
- Hashtags e engajamento
- Tendências por plataforma

## Como você atua
- Dicas práticas e específicas por rede
- Sempre sugere hashtags relevantes
- Otimiza para cada algoritmo

## Formato
Sugestões em bullets, com horário e plataforma.
`,
  },
  {
    role: 'pesquisador', defaultName: 'Eva Pesquisadora',
    defaultPrompt: `# Eva Pesquisadora

Você é Eva, Pesquisadora da equipe Zé Post.

## Sua especialidade
- Pesquisa de tendências e benchmarking
- Análise de mercado e concorrência
- Monitoramento de palavras-chave

## Como você atua
- Sempre baseada em dados
- Cita fontes quando possível
- Compara cenários

## Formato
Dados primeiro, interpretação depois. Use listas comparativas.
`,
  },
  {
    role: 'postador', defaultName: 'Felipe Postador',
    defaultPrompt: `# Felipe Postador

Você é Felipe, o Postador da equipe Zé Post.

## Sua especialidade
- Agendamento de publicações
- Checklist pré-publicação
- Otimização técnica de posts

## Como você atua
- Organizado e checklist-driven
- Sugere horários ótimos por rede
- Valida formato/dimensões antes de publicar

## Formato
Checklists numerados e horários sugeridos.
`,
  },
]

export default function ConfigurarSquadPage() {
  const router = useRouter()
  const supabase = createClient()
  const [companyId, setCompanyId] = useState<string>('')
  const [existing, setExisting] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      setCompanyId(p?.company_id ?? '')
      const { data: agents } = await supabase
        .from('squad_members').select('role').eq('company_id', p?.company_id)
      const roles = (agents ?? []).map(a => a.role)
      setExisting(roles)
      // Pré-seleciona o que falta
      const missing = PRESETS.filter(p => !roles.includes(p.role)).map(p => p.role)
      setSelected(missing)
    })()
  }, [])

  function toggle(role: string) {
    setSelected(s => s.includes(role) ? s.filter(x => x !== role) : [...s, role])
  }

  async function applyPreset() {
    setSaving(true)
    const toCreate = PRESETS.filter(p => selected.includes(p.role) && !existing.includes(p.role))
    if (toCreate.length) {
      await supabase.from('squad_members').insert(
        toCreate.map(p => ({
          company_id: companyId,
          name: p.defaultName,
          role: p.role,
          prompt: p.defaultPrompt,
          description: SQUAD_ROLES[p.role].description,
          is_active: true,
        }))
      )
    }
    setSaving(false)
    router.push('/squad')
  }

  return (
    <div className="p-7 max-w-4xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/squad">
          <button className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Reconfigurar Squad</h1>
          <p className="text-slate-500 text-sm mt-0.5">Adicione rapidamente os agentes padrão ao seu squad.</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3">
        <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700">
          Selecione os agentes que deseja adicionar. Os que já existem no seu squad estão marcados como <strong>já configurados</strong>. Você pode editar prompts e adicionar skills depois.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {PRESETS.map(preset => {
          const role = SQUAD_ROLES[preset.role]
          const isExisting = existing.includes(preset.role)
          const isSelected = selected.includes(preset.role)
          return (
            <button
              key={preset.role}
              onClick={() => !isExisting && toggle(preset.role)}
              disabled={isExisting}
              className={cn(
                'text-left p-4 rounded-2xl border-2 transition-all relative',
                isExisting
                  ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-70'
                  : isSelected
                  ? 'border-ze-blue bg-ze-blue/5'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: role.color + '20' }}
                >
                  <Bot className="w-6 h-6" style={{ color: role.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900 truncate">{preset.defaultName}</h3>
                    {isSelected && !isExisting && (
                      <Check className="w-4 h-4 text-ze-blue flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: role.color }}>
                    {role.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {role.description}
                  </p>
                  {isExisting && (
                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      ✓ Já configurado
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 justify-end">
        <Link href="/squad">
          <Button variant="ghost">Cancelar</Button>
        </Link>
        <Button
          onClick={applyPreset}
          loading={saving}
          disabled={!selected.filter(r => !existing.includes(r)).length}
        >
          <Bot className="w-4 h-4" />
          Adicionar {selected.filter(r => !existing.includes(r)).length} agente(s)
        </Button>
      </div>
    </div>
  )
}
