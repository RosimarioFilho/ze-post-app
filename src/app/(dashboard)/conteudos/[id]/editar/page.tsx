'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { CONTENT_TYPE_LABELS } from '@/types'
import type { ContentType } from '@/types'

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube']
const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn',
  tiktok: 'TikTok', youtube: 'YouTube',
}
const STATUS_OPTIONS = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'pendente_aprovacao', label: 'Aguardando aprovação' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'agendado', label: 'Agendado' },
  { value: 'publicado', label: 'Publicado' },
  { value: 'rejeitado', label: 'Rejeitado' },
]

export default function EditarConteudoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    title: '',
    body: '',
    content_type: 'post_instagram' as ContentType,
    platforms: [] as string[],
    status: 'rascunho',
    scheduled_at: '',
  })

  useEffect(() => { load() }, [id])

  async function load() {
    const { data } = await supabase.from('contents').select('*').eq('id', id).single()
    if (data) {
      setForm({
        title: data.title ?? '',
        body: data.body ?? '',
        content_type: data.content_type,
        platforms: data.platforms ?? [],
        status: data.status,
        scheduled_at: data.scheduled_at
          ? new Date(data.scheduled_at).toISOString().slice(0, 16)
          : '',
      })
    }
    setLoading(false)
  }

  function set(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))
  }

  function togglePlatform(p: string) {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }))
  }

  async function save() {
    setSaving(true)
    await supabase.from('contents').update({
      title: form.title,
      body: form.body,
      content_type: form.content_type,
      platforms: form.platforms,
      status: form.status,
      scheduled_at: form.scheduled_at || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      router.push('/conteudos')
    }, 1000)
  }

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center h-64 text-slate-400">
        Carregando...
      </div>
    )
  }

  return (
    <div className="p-7 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <Link href="/conteudos">
          <button className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Editar Conteúdo</h1>
          <p className="text-slate-500 text-sm mt-0.5">Faça as alterações necessárias.</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <Input id="title" label="Título *" value={form.title} onChange={set('title')} required />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Tipo de conteúdo</label>
              <select
                value={form.content_type}
                onChange={set('content_type')}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10"
              >
                {Object.entries(CONTENT_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select
                value={form.status}
                onChange={set('status')}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Plataformas</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    form.platforms.includes(p)
                      ? 'bg-ze-blue text-white border-ze-blue'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Conteúdo / Legenda</label>
            <textarea
              value={form.body}
              onChange={set('body')}
              rows={7}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10 resize-none transition-colors"
            />
          </div>

          <Input
            id="scheduled_at"
            type="datetime-local"
            label="Agendamento"
            value={form.scheduled_at}
            onChange={set('scheduled_at')}
          />
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end mt-5">
        <Link href="/conteudos">
          <Button variant="ghost">Cancelar</Button>
        </Link>
        <Button onClick={save} loading={saving} disabled={!form.title}>
          <Save className="w-4 h-4" />
          {saved ? 'Salvo!' : 'Salvar alterações'}
        </Button>
      </div>
    </div>
  )
}
