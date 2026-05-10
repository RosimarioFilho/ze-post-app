'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Palette, CreditCard, User, Save, Upload, X, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { NICHE_OPTIONS, type Profile, type Company } from '@/types'

export default function ConfiguracoesPage() {
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [company, setCompany] = useState<Partial<Company>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [nicheOther, setNicheOther] = useState('')
  const supabase = createClient()

  const isPredefinedNiche = (n?: string) =>
    !!n && NICHE_OPTIONS.some(o => o.value !== 'outro' && o.value === n)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*, company:companies(*)').eq('id', user.id).single()
    setProfile(p ?? {})
    const c: Partial<Company> = (p as { company?: Company })?.company ?? {}
    setCompany(c)
    // Se o nicho atual não é uma das opções predefinidas, considera como "outro"
    if (c.niche && !isPredefinedNiche(c.niche)) {
      setNicheOther(c.niche)
    }
    setLoading(false)
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function clearLogo() {
    setLogoFile(null)
    setLogoPreview('')
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // Resolve o nicho final
    let nicheFinal: string | null = null
    if (company.niche === 'outro') {
      nicheFinal = nicheOther.trim() || null
    } else if (company.niche) {
      nicheFinal = company.niche
    } else if (nicheOther.trim()) {
      // já estava como livre
      nicheFinal = nicheOther.trim()
    }

    // Upload de nova logo, se houver
    let newLogoUrl: string | undefined
    if (logoFile && company.id) {
      const ext = logoFile.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `logos/${company.id}/logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('media')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type || `image/${ext}` })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
        newLogoUrl = publicUrl
      }
    }

    await Promise.all([
      supabase.from('profiles').update({ full_name: profile.full_name }).eq('id', user.id),
      company.id && supabase.from('companies').update({
        name: company.name,
        razao_social: company.razao_social,
        phone: company.phone,
        niche: nicheFinal,
        primary_color: company.primary_color,
        secondary_color: company.secondary_color,
        ...(newLogoUrl ? { logo_url: newLogoUrl } : {}),
      }).eq('id', company.id),
    ])

    if (newLogoUrl) {
      setCompany(c => ({ ...c, logo_url: newLogoUrl }))
      clearLogo()
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="p-7 text-slate-400">Carregando...</div>

  return (
    <div className="p-7 max-w-2xl">
      <div className="mb-7">
        <h1 className="text-2xl font-black text-slate-900">Configurações</h1>
        <p className="text-slate-500 text-sm mt-0.5">Gerencie sua conta e preferências.</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <User className="w-4 h-4 text-ze-blue" /> Perfil
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              label="Nome completo"
              value={profile.full_name ?? ''}
              onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
            />
            <Input label="E-mail" value={profile.email ?? ''} disabled className="bg-slate-50 text-slate-400" />
          </CardContent>
        </Card>

        {/* Company */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Building2 className="w-4 h-4 text-ze-blue" /> Empresa
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              label="Nome da empresa"
              value={company.name ?? ''}
              onChange={e => setCompany(c => ({ ...c, name: e.target.value }))}
            />
            <Input
              label="Razão social"
              value={company.razao_social ?? ''}
              onChange={e => setCompany(c => ({ ...c, razao_social: e.target.value }))}
            />
            <Input
              label="Telefone / WhatsApp"
              value={company.phone ?? ''}
              onChange={e => setCompany(c => ({ ...c, phone: e.target.value }))}
            />

            {/* Nicho */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Nicho da empresa</label>
              <select
                value={
                  company.niche
                    ? (isPredefinedNiche(company.niche) ? company.niche : 'outro')
                    : ''
                }
                onChange={e => setCompany(c => ({ ...c, niche: e.target.value }))}
                className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-ze-blue/20 focus:border-ze-blue transition"
              >
                <option value="">Selecione o segmento</option>
                {NICHE_OPTIONS.map(n => (
                  <option key={n.value} value={n.value}>{n.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400">
                Os agentes de IA usam essa informação para gerar conteúdos mais assertivos para o seu mercado.
              </p>
            </div>

            {(company.niche === 'outro' || (company.niche && !isPredefinedNiche(company.niche))) && (
              <Input
                label="Qual o seu nicho?"
                placeholder="Ex: Cooperativa de crédito"
                value={nicheOther}
                onChange={e => setNicheOther(e.target.value)}
              />
            )}
          </CardContent>
        </Card>

        {/* Logo */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <ImageIcon className="w-4 h-4 text-ze-blue" /> Logomarca
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoPreview || company.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview || company.logo_url!}
                    alt="Logo da empresa"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="w-7 h-7 text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {logoPreview ? 'Nova logo selecionada' : company.logo_url ? 'Logo atual' : 'Nenhuma logo enviada'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">PNG, JPG ou SVG · até 2 MB</p>
                <div className="flex gap-2 mt-2">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    {company.logo_url || logoPreview ? 'Trocar logo' : 'Enviar logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
                  </label>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={clearLogo}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50"
                    >
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Sua logo será aplicada automaticamente nas artes geradas pelos agentes (Carla, Camila).
            </p>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Palette className="w-4 h-4 text-ze-blue" /> Identidade Visual
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-sm font-medium text-slate-700">Cor primária</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={company.primary_color ?? '#052d64'}
                    onChange={e => setCompany(c => ({ ...c, primary_color: e.target.value }))}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-slate-200"
                  />
                  <span className="text-sm text-slate-600 font-mono">{company.primary_color ?? '#052d64'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-sm font-medium text-slate-700">Cor secundária</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={company.secondary_color ?? '#fe7902'}
                    onChange={e => setCompany(c => ({ ...c, secondary_color: e.target.value }))}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-slate-200"
                  />
                  <span className="text-sm text-slate-600 font-mono">{company.secondary_color ?? '#fe7902'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <CreditCard className="w-4 h-4 text-ze-blue" /> Plano atual
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 capitalize">{company.plan ?? 'Starter'}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {company.plan === 'pro' ? '3 usuários · Todas as redes · Ilimitado' : '1 usuário · Instagram + Facebook · 5 conteúdos/mês'}
                </p>
              </div>
              {company.plan !== 'pro' && (
                <Link href="/assinatura/upgrade">
                  <Button variant="secondary" size="sm">Fazer upgrade PRO</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Button onClick={save} loading={saving} className="self-end">
          <Save className="w-4 h-4" />
          {saved ? 'Salvo!' : 'Salvar alterações'}
        </Button>
      </div>
    </div>
  )
}
