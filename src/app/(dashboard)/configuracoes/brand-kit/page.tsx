'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Save, Plus, X, Palette, Type, MessageSquare, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface BrandKitForm {
  primary_font: string
  secondary_font: string
  accent_color: string
  tone_of_voice: string
  preferred_styles: string[]
  rejected_styles: string[]
  preferred_ctas: string[]
}

const TONE_OPTIONS = [
  { value: 'profissional', label: 'Profissional', desc: 'Formal, confiável, técnico' },
  { value: 'descontraido', label: 'Descontraído', desc: 'Informal, próximo, divertido' },
  { value: 'urgente', label: 'Urgente', desc: 'Impacto, escassez, ação imediata' },
  { value: 'luxuoso', label: 'Luxuoso', desc: 'Premium, exclusivo, sofisticado' },
]

const STYLE_OPTIONS = [
  'bold', 'minimal', 'colorido', 'elegante', 'moderno', 'clássico',
  'vibrante', 'clean', 'fotográfico', 'ilustrado', 'tipográfico', 'geométrico',
]

const FONT_OPTIONS = [
  'Montserrat', 'Open Sans', 'Roboto', 'Poppins', 'Inter',
  'Playfair Display', 'Lato', 'Raleway', 'Nunito', 'Oswald',
]

export default function BrandKitPage() {
  const supabase = createClient()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newCta, setNewCta] = useState('')

  const [form, setForm] = useState<BrandKitForm>({
    primary_font: 'Montserrat',
    secondary_font: 'Open Sans',
    accent_color: '#fe7902',
    tone_of_voice: 'profissional',
    preferred_styles: [],
    rejected_styles: [],
    preferred_ctas: ['Saiba mais', 'Aproveite', 'Compre agora'],
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('company_id').eq('id', user.id).single().then(({ data }) => {
        if (!data?.company_id) return
        setCompanyId(data.company_id)

        supabase.from('brand_kits').select('*').eq('company_id', data.company_id).maybeSingle().then(({ data: kit }) => {
          if (kit) {
            setForm({
              primary_font: kit.primary_font ?? 'Montserrat',
              secondary_font: kit.secondary_font ?? 'Open Sans',
              accent_color: kit.accent_color ?? '#fe7902',
              tone_of_voice: kit.tone_of_voice ?? 'profissional',
              preferred_styles: kit.preferred_styles ?? [],
              rejected_styles: kit.rejected_styles ?? [],
              preferred_ctas: kit.preferred_ctas ?? ['Saiba mais', 'Aproveite', 'Compre agora'],
            })
          }
        })
      })
    })
  }, [])

  const handleSave = async () => {
    if (!companyId) return
    setIsSaving(true)
    try {
      await supabase.from('brand_kits').upsert({
        company_id: companyId,
        ...form,
      }, { onConflict: 'company_id' })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleStyle = (style: string, type: 'preferred_styles' | 'rejected_styles') => {
    const opposite = type === 'preferred_styles' ? 'rejected_styles' : 'preferred_styles'
    setForm(prev => ({
      ...prev,
      [type]: prev[type].includes(style) ? prev[type].filter(s => s !== style) : [...prev[type], style],
      [opposite]: prev[opposite].filter(s => s !== style),
    }))
  }

  const addCta = () => {
    if (!newCta.trim()) return
    setForm(prev => ({ ...prev, preferred_ctas: [...prev.preferred_ctas, newCta.trim()] }))
    setNewCta('')
  }

  const removeCta = (cta: string) => {
    setForm(prev => ({ ...prev, preferred_ctas: prev.preferred_ctas.filter(c => c !== cta) }))
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/configuracoes" className="text-sm text-slate-400 hover:text-slate-600 mb-2 block">← Configurações</Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ze-blue to-ze-orange flex items-center justify-center">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Brand Kit</h1>
              <p className="text-sm text-slate-500">Identidade de marca usada pelos agentes do Studio IA</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* Tipografia */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Type className="w-4 h-4 text-ze-blue" />
              <h2 className="font-bold text-slate-800">Tipografia</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Fonte principal</label>
                <select
                  value={form.primary_font}
                  onChange={e => setForm(prev => ({ ...prev, primary_font: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ze-blue/30"
                >
                  {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <p className="mt-1 text-sm text-slate-600" style={{ fontFamily: form.primary_font }}>
                  Preview — {form.primary_font}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Fonte secundária</label>
                <select
                  value={form.secondary_font}
                  onChange={e => setForm(prev => ({ ...prev, secondary_font: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ze-blue/30"
                >
                  {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <p className="mt-1 text-sm text-slate-600" style={{ fontFamily: form.secondary_font }}>
                  Preview — {form.secondary_font}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Cor de acento</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.accent_color}
                  onChange={e => setForm(prev => ({ ...prev, accent_color: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={form.accent_color}
                  onChange={e => setForm(prev => ({ ...prev, accent_color: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-ze-blue/30 font-mono"
                />
                <p className="text-xs text-slate-400">Usada em CTAs e destaques</p>
              </div>
            </div>
          </div>

          {/* Tom de voz */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-ze-blue" />
              <h2 className="font-bold text-slate-800">Tom de voz</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {TONE_OPTIONS.map(tone => (
                <button
                  key={tone.value}
                  onClick={() => setForm(prev => ({ ...prev, tone_of_voice: tone.value }))}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all',
                    form.tone_of_voice === tone.value
                      ? 'border-ze-blue bg-ze-blue/5'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <p className={cn('font-bold text-sm', form.tone_of_voice === tone.value ? 'text-ze-blue' : 'text-slate-700')}>
                    {tone.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{tone.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Estilos */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="w-4 h-4 text-ze-blue" />
              <h2 className="font-bold text-slate-800">Estilos visuais</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">Clique para marcar como preferido (verde) ou rejeitado (vermelho)</p>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map(style => {
                const isPreferred = form.preferred_styles.includes(style)
                const isRejected = form.rejected_styles.includes(style)
                return (
                  <div key={style} className="flex gap-1">
                    <button
                      onClick={() => toggleStyle(style, 'preferred_styles')}
                      className={cn(
                        'px-3 py-1.5 rounded-l-lg text-xs font-medium border transition-all',
                        isPreferred ? 'bg-green-500 text-white border-green-500' : 'bg-white text-slate-600 border-slate-200 hover:border-green-300'
                      )}
                    >
                      ✓ {style}
                    </button>
                    <button
                      onClick={() => toggleStyle(style, 'rejected_styles')}
                      className={cn(
                        'px-2 py-1.5 rounded-r-lg text-xs font-medium border transition-all',
                        isRejected ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-400 border-slate-200 hover:border-red-300'
                      )}
                    >
                      ✗
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* CTAs preferidos */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-1">CTAs preferidos</h2>
            <p className="text-xs text-slate-400 mb-4">O Copywriter usará estes CTAs preferencialmente</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {form.preferred_ctas.map(cta => (
                <div key={cta} className="flex items-center gap-1 bg-ze-blue/10 text-ze-blue px-3 py-1 rounded-full text-sm font-medium">
                  {cta}
                  <button onClick={() => removeCta(cta)} className="hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCta}
                onChange={e => setNewCta(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCta()}
                placeholder="Novo CTA (ex: Quero desconto)"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ze-blue/30"
              />
              <button onClick={addCta} className="px-3 py-2 bg-ze-blue text-white rounded-lg hover:opacity-90">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Salvar */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-ze-blue to-ze-orange text-white font-black flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> :
              saved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            {isSaving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Brand Kit'}
          </button>
        </div>
      </div>
    </div>
  )
}
