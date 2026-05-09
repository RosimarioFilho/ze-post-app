'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Bot } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { MarkdownEditor } from '@/components/squad/MarkdownEditor'
import { SQUAD_ROLES } from '@/types'

const PROMPT_TEMPLATE = `# Identidade
Você é {{NOME}}, especialista em {{FUNCAO}} da equipe Zé Post.

# Sua missão
Descreva aqui o objetivo principal do agente.

# Como você atua
- Tom de voz:
- Estilo de resposta:
- O que evitar:

# Diretrizes específicas
1. Sempre faça X
2. Nunca faça Y
3. Quando solicitado Z, responda com W

# Formato de resposta
Descreva como o agente deve formatar suas respostas.
`

export default function NovoAgentePage() {
  const router = useRouter()
  const supabase = createClient()
  const [companyId, setCompanyId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    role: 'estrategista',
    description: '',
    prompt: PROMPT_TEMPLATE,
  })

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      setCompanyId(p?.company_id ?? '')
    })()
  }, [])

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const finalPrompt = form.prompt
      .replace(/\{\{NOME\}\}/g, form.name)
      .replace(/\{\{FUNCAO\}\}/g, SQUAD_ROLES[form.role as keyof typeof SQUAD_ROLES]?.label ?? form.role)

    await supabase.from('squad_members').insert({
      company_id: companyId,
      name: form.name,
      role: form.role,
      description: form.description || null,
      prompt: finalPrompt,
      is_active: true,
    })
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
          <h1 className="text-2xl font-black text-slate-900">Adicionar Agente</h1>
          <p className="text-slate-500 text-sm mt-0.5">Crie um novo agente de IA para o seu squad.</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="name"
                label="Nome do agente *"
                placeholder="Ex: Pedro Especialista"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Função / Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10"
                >
                  {Object.entries(SQUAD_ROLES).map(([v, r]) => (
                    <option key={v} value={v}>{r.label}</option>
                  ))}
                  <option value="custom">Customizada</option>
                </select>
              </div>
            </div>

            {form.role === 'custom' && (
              <Input
                id="role"
                label="Nome da função customizada *"
                placeholder="Ex: especialista_seo"
                value={form.role === 'custom' ? '' : form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value || 'custom' }))}
              />
            )}

            <Input
              id="description"
              label="Descrição curta"
              placeholder="Ex: Especialista em SEO local e otimização de buscas"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-ze-blue" />
            <h3 className="font-bold text-slate-900">Prompt do agente</h3>
          </div>
          <p className="text-sm text-slate-500">
            Defina como o agente deve se comportar. Use markdown para estruturar. Variáveis <code className="bg-slate-100 px-1 rounded text-xs">{'{{NOME}}'}</code> e <code className="bg-slate-100 px-1 rounded text-xs">{'{{FUNCAO}}'}</code> serão substituídas automaticamente.
          </p>
          <MarkdownEditor
            value={form.prompt}
            onChange={v => setForm(f => ({ ...f, prompt: v }))}
            placeholder="Defina aqui o comportamento do agente em markdown..."
            rows={16}
            fileName={`${form.name || 'agente'}-prompt.md`}
          />
        </div>

        <div className="flex gap-3 justify-end">
          <Link href="/squad">
            <Button variant="ghost">Cancelar</Button>
          </Link>
          <Button onClick={save} loading={saving} disabled={!form.name.trim()}>
            <Save className="w-4 h-4" /> Criar agente
          </Button>
        </div>
      </div>
    </div>
  )
}
