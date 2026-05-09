'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bot, Plus, Pencil, Trash2, Power, PowerOff, Sparkles, Loader2,
  Settings, Wrench,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SQUAD_ROLES } from '@/types'
import { cn, timeAgo } from '@/lib/utils'

interface AgentWithSkills {
  id: string
  company_id: string
  name: string
  role: string
  icon?: string
  title?: string
  description?: string
  prompt?: string
  flow_order?: number
  is_active: boolean
  last_active?: string
  skills?: Array<{ id: string; name: string; enabled: boolean }>
}

const ROLE_COLORS: Record<string, string> = {
  estrategista: '#3b82f6',
  copywriter: '#8b5cf6',
  designer: '#ec4899',
  social_media: '#10b981',
  pesquisador: '#f59e0b',
  postador: '#06b6d4',
  carrossel: '#f97316',
  revisora: '#22c55e',
}

export default function SquadPage() {
  const router = useRouter()
  const supabase = createClient()
  const [agents, setAgents] = useState<AgentWithSkills[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string>('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    setCompanyId(p?.company_id ?? '')
    const { data } = await supabase
      .from('squad_members')
      .select('*, skills:agent_skills(id, name, enabled)')
      .eq('company_id', p?.company_id)
      .order('flow_order', { ascending: true })
    setAgents(data ?? [])
    setLoading(false)
  }

  async function toggleActive(agent: AgentWithSkills) {
    await supabase.from('squad_members').update({ is_active: !agent.is_active }).eq('id', agent.id)
    setAgents(a => a.map(x => x.id === agent.id ? { ...x, is_active: !x.is_active } : x))
  }

  async function remove(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(null), 3000)
      return
    }
    await supabase.from('agent_skills').delete().eq('agent_id', id)
    await supabase.from('squad_members').delete().eq('id', id)
    setAgents(a => a.filter(x => x.id !== id))
    setConfirmDelete(null)
  }

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Meu Squad de Agentes</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gerencie sua equipe de IA, prompts e skills.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/squad/configurar">
            <Button variant="outline">
              <Settings className="w-4 h-4" /> Reconfigurar Squad
            </Button>
          </Link>
          <Link href="/squad/novo">
            <Button>
              <Plus className="w-4 h-4" /> Adicionar Agente
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Agentes ativos</span>
            <Power className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-1">
            {agents.filter(a => a.is_active).length}
          </p>
          <span className="text-xs text-slate-400">de {agents.length} totais</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Skills configuradas</span>
            <Wrench className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-1">
            {agents.reduce((acc, a) => acc + (a.skills?.length ?? 0), 0)}
          </p>
          <span className="text-xs text-slate-400">no total</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Prompts customizados</span>
            <Sparkles className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-1">
            {agents.filter(a => a.prompt && a.prompt.trim().length > 0).length}
          </p>
          <span className="text-xs text-slate-400">com prompt próprio</span>
        </div>
      </div>

      {/* Lista de agentes */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      ) : !agents.length ? (
        <Card>
          <CardContent>
            <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
              <Bot className="w-12 h-12 opacity-30" />
              <p className="font-medium">Nenhum agente no seu squad</p>
              <Link href="/squad/configurar">
                <Button variant="outline" size="sm">Configurar squad padrão</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map(agent => {
            const roleData = SQUAD_ROLES[agent.role as keyof typeof SQUAD_ROLES]
            const color = ROLE_COLORS[agent.role] ?? '#6b7280'
            const skillsCount = agent.skills?.length ?? 0
            const enabledSkills = agent.skills?.filter(s => s.enabled).length ?? 0
            const isOnline = agent.is_active

            return (
              <Card key={agent.id} className={cn(!agent.is_active && 'opacity-60')}>
                <CardContent>
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: color + '20' }}
                    >
                      {agent.icon
                        ? <span className="text-2xl leading-none">{agent.icon}</span>
                        : <Bot className="w-6 h-6" style={{ color }} />
                      }
                      {/* Status dot */}
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white',
                          isOnline ? 'bg-green-400' : 'bg-slate-300'
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{agent.name}</h3>
                      <p className="text-xs font-semibold mt-0.5" style={{ color }}>
                        {roleData?.label ?? agent.role}
                      </p>
                      <p className={cn(
                        'text-[10px] font-medium mt-0.5',
                        isOnline ? 'text-green-600' : 'text-slate-400'
                      )}>
                        {isOnline ? '● Online' : '○ Desativado'}
                        {agent.last_active && isOnline && ` · ativo ${timeAgo(agent.last_active)}`}
                      </p>
                    </div>
                  </div>

                  {agent.description && (
                    <p className="text-xs text-slate-500 mb-3 leading-relaxed line-clamp-2">
                      {agent.description}
                    </p>
                  )}

                  {/* Skills + prompt indicator */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {agent.prompt && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> Prompt customizado
                      </span>
                    )}
                    {skillsCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                        <Wrench className="w-2.5 h-2.5" /> {enabledSkills}/{skillsCount} skills
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <Link href={`/squad/${agent.id}/editar`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </Button>
                    </Link>
                    <button
                      onClick={() => toggleActive(agent)}
                      title={agent.is_active ? 'Desativar' : 'Ativar'}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500"
                    >
                      {agent.is_active
                        ? <Power className="w-3.5 h-3.5" />
                        : <PowerOff className="w-3.5 h-3.5" />
                      }
                    </button>
                    <button
                      onClick={() => remove(agent.id)}
                      title="Remover"
                      className={cn(
                        'w-9 h-9 flex items-center justify-center rounded-lg border transition-colors',
                        confirmDelete === agent.id
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50'
                      )}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {confirmDelete === agent.id && (
                    <p className="text-[10px] text-red-500 font-semibold mt-1 text-right">
                      Clique novamente para confirmar
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
