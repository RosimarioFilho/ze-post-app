'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Bot, Plus, Pencil, Trash2,
  Power, PowerOff, X, Wrench,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { MarkdownEditor } from '@/components/squad/MarkdownEditor'
import { SQUAD_ROLES } from '@/types'
import { cn } from '@/lib/utils'

interface Skill {
  id: string
  agent_id: string
  name: string
  description?: string
  prompt: string
  enabled: boolean
}

const SKILL_TEMPLATE = `# {{SKILL}}

## Quando usar
Descreva quando esta skill deve ser ativada.

## Como executar
Descreva o passo a passo de como o agente executa esta skill.

## Exemplos
- Exemplo de input/output
`

export default function EditarAgentePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', role: '', description: '', prompt: '', is_active: true,
  })
  const [skills, setSkills] = useState<Skill[]>([])
  const [skillModal, setSkillModal] = useState<Partial<Skill> | null>(null)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: agent } = await supabase
      .from('squad_members').select('*').eq('id', id).single()
    if (agent) {
      setForm({
        name: agent.name,
        role: agent.role,
        description: agent.description ?? '',
        prompt: agent.prompt ?? '',
        is_active: agent.is_active,
      })
    }
    const { data: sk } = await supabase
      .from('agent_skills').select('*').eq('agent_id', id).order('created_at')
    setSkills(sk ?? [])
    setLoading(false)
  }

  async function saveAgent() {
    setSaving(true)
    await supabase.from('squad_members').update({
      name: form.name,
      role: form.role,
      description: form.description || null,
      prompt: form.prompt || null,
      is_active: form.is_active,
    }).eq('id', id)
    setSaving(false)
    router.push('/squad')
  }

  function openNewSkill() {
    setSkillModal({
      name: '',
      description: '',
      prompt: SKILL_TEMPLATE,
      enabled: true,
    })
  }

  function editSkill(s: Skill) {
    setSkillModal(s)
  }

  async function saveSkill() {
    if (!skillModal?.name) return
    const finalPrompt = (skillModal.prompt ?? '').replace(/\{\{SKILL\}\}/g, skillModal.name)
    if (skillModal.id) {
      await supabase.from('agent_skills').update({
        name: skillModal.name,
        description: skillModal.description || null,
        prompt: finalPrompt,
        enabled: skillModal.enabled ?? true,
      }).eq('id', skillModal.id)
    } else {
      await supabase.from('agent_skills').insert({
        agent_id: id,
        name: skillModal.name,
        description: skillModal.description || null,
        prompt: finalPrompt,
        enabled: skillModal.enabled ?? true,
      })
    }
    setSkillModal(null)
    load()
  }

  async function deleteSkill(skillId: string) {
    await supabase.from('agent_skills').delete().eq('id', skillId)
    setSkills(s => s.filter(x => x.id !== skillId))
  }

  async function toggleSkill(skill: Skill) {
    await supabase.from('agent_skills').update({ enabled: !skill.enabled }).eq('id', skill.id)
    setSkills(s => s.map(x => x.id === skill.id ? { ...x, enabled: !x.enabled } : x))
  }

  if (loading) return <div className="p-7 text-slate-400">Carregando...</div>

  return (
    <div className="p-7 max-w-5xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/squad">
          <button className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-slate-900">Editar Agente</h1>
          <p className="text-slate-500 text-sm mt-0.5">{form.name}</p>
        </div>
        <button
          onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-all',
            form.is_active
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-slate-50 border-slate-200 text-slate-500'
          )}
        >
          {form.is_active ? <><Power className="w-4 h-4" /> Online</> : <><PowerOff className="w-4 h-4" /> Desativado</>}
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {/* Dados básicos */}
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="name"
                label="Nome do agente *"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Função</label>
                <select
                  value={Object.keys(SQUAD_ROLES).includes(form.role) ? form.role : 'custom'}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value === 'custom' ? f.role : e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10"
                >
                  {Object.entries(SQUAD_ROLES).map(([v, r]) => (
                    <option key={v} value={v}>{r.label}</option>
                  ))}
                  <option value="custom">Customizada ({form.role})</option>
                </select>
              </div>
            </div>
            <Input
              id="description"
              label="Descrição"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </CardContent>
        </Card>

        {/* Prompt principal */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-ze-blue" />
            <h3 className="font-bold text-slate-900">Prompt principal (.md)</h3>
          </div>
          <p className="text-sm text-slate-500">
            Define o comportamento base do agente. Em runtime, as skills habilitadas são adicionadas ao final.
          </p>
          <MarkdownEditor
            value={form.prompt}
            onChange={v => setForm(f => ({ ...f, prompt: v }))}
            rows={14}
            fileName={`${form.name}-prompt.md`}
          />
        </div>

        {/* Skills */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-purple-500" />
              <h3 className="font-bold text-slate-900">Skills ({skills.length})</h3>
            </div>
            <Button size="sm" onClick={openNewSkill}>
              <Plus className="w-3.5 h-3.5" /> Nova skill
            </Button>
          </div>
          <p className="text-sm text-slate-500">
            Cada skill é um arquivo markdown que adiciona uma capacidade específica ao agente. Você pode habilitar/desabilitar individualmente.
          </p>

          {!skills.length ? (
            <Card>
              <CardContent>
                <div className="py-8 flex flex-col items-center gap-2 text-slate-400">
                  <Wrench className="w-10 h-10 opacity-30" />
                  <p className="text-sm">Nenhuma skill configurada</p>
                  <Button size="sm" variant="outline" onClick={openNewSkill}>
                    <Plus className="w-3.5 h-3.5" /> Adicionar primeira skill
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {skills.map(s => (
                <Card key={s.id} className={cn(!s.enabled && 'opacity-60')}>
                  <CardContent>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{s.name}</h4>
                        {s.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{s.description}</p>
                        )}
                      </div>
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap',
                        s.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      )}>
                        {s.enabled ? '● Ativa' : '○ Inativa'}
                      </span>
                    </div>
                    <div className="flex gap-1.5 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => editSkill(s)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                      <button
                        onClick={() => toggleSkill(s)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        {s.enabled
                          ? <><PowerOff className="w-3 h-3" /> Desativar</>
                          : <><Power className="w-3 h-3" /> Ativar</>
                        }
                      </button>
                      <button
                        onClick={() => deleteSkill(s.id)}
                        className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <Link href="/squad">
            <Button variant="ghost">Cancelar</Button>
          </Link>
          <Button onClick={saveAgent} loading={saving} disabled={!form.name.trim()}>
            <Save className="w-4 h-4" /> Salvar alterações
          </Button>
        </div>
      </div>

      {/* Modal de skill */}
      {skillModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4 backdrop-blur-sm"
          onClick={() => setSkillModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-900">
                {skillModal.id ? 'Editar Skill' : 'Nova Skill'}
              </h3>
              <button onClick={() => setSkillModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
              <Input
                id="skill_name"
                label="Nome da skill *"
                placeholder="Ex: Análise de concorrentes"
                value={skillModal.name ?? ''}
                onChange={e => setSkillModal(s => s && { ...s, name: e.target.value })}
              />
              <Input
                id="skill_desc"
                label="Descrição (1 linha)"
                placeholder="Ex: Analisa estratégia de conteúdo dos concorrentes"
                value={skillModal.description ?? ''}
                onChange={e => setSkillModal(s => s && { ...s, description: e.target.value })}
              />
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Conteúdo da skill (.md) — variável <code className="bg-slate-100 px-1 rounded text-xs">{'{{SKILL}}'}</code> é substituída pelo nome
                </label>
                <MarkdownEditor
                  value={skillModal.prompt ?? ''}
                  onChange={v => setSkillModal(s => s && { ...s, prompt: v })}
                  rows={10}
                  fileName={`${skillModal.name || 'skill'}.md`}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skillModal.enabled ?? true}
                  onChange={e => setSkillModal(s => s && { ...s, enabled: e.target.checked })}
                  className="w-4 h-4 rounded text-ze-blue"
                />
                <span className="text-sm text-slate-700">Skill habilitada</span>
              </label>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setSkillModal(null)}>Cancelar</Button>
              <Button onClick={saveSkill} disabled={!skillModal.name?.trim()}>
                <Save className="w-4 h-4" /> Salvar skill
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
