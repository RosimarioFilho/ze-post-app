'use client'
import { useEffect, useState } from 'react'
import { Building2, Palette, CreditCard, User, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Profile, Company } from '@/types'

export default function ConfiguracoesPage() {
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [company, setCompany] = useState<Partial<Company>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*, company:companies(*)').eq('id', user.id).single()
    setProfile(p ?? {})
    setCompany((p as { company?: Company })?.company ?? {})
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await Promise.all([
      supabase.from('profiles').update({ full_name: profile.full_name }).eq('id', user.id),
      company.id && supabase.from('companies').update({
        name: company.name,
        razao_social: company.razao_social,
        phone: company.phone,
        primary_color: company.primary_color,
        secondary_color: company.secondary_color,
      }).eq('id', company.id),
    ])
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
                <Button variant="secondary" size="sm">Fazer upgrade PRO</Button>
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
