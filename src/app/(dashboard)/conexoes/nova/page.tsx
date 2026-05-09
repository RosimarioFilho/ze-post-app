'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
  ExternalLink, Plug,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Platform = 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok' | 'youtube'

const NETWORKS: Array<{
  id: Platform
  name: string
  icon: string
  color: string
  needsAppId: boolean
  steps: { title: string; desc: string; link?: string }[]
}> = [
  {
    id: 'instagram', name: 'Instagram', icon: '📸', color: '#E1306C',
    needsAppId: true,
    steps: [
      { title: '1. Crie um app no Meta for Developers', desc: 'Acesse o painel do Meta e crie um aplicativo do tipo Business.', link: 'https://developers.facebook.com/apps' },
      { title: '2. Vincule a conta Instagram Business', desc: 'No app, adicione o produto "Instagram Graph API" e vincule sua conta Instagram Business à página do Facebook.' },
      { title: '3. Gere o Access Token de longa duração', desc: 'Em "Tools > Graph API Explorer", gere um token com permissões instagram_basic, instagram_content_publish.' },
      { title: '4. Copie App ID e Access Token', desc: 'Cole os dados nos campos abaixo.' },
    ],
  },
  {
    id: 'facebook', name: 'Facebook', icon: '📘', color: '#1877F2',
    needsAppId: true,
    steps: [
      { title: '1. Acesse Meta for Developers', desc: 'Crie um app no painel.', link: 'https://developers.facebook.com/apps' },
      { title: '2. Adicione "Pages API"', desc: 'No painel do app, adicione o produto Pages API e configure as permissões.' },
      { title: '3. Gere o Page Access Token', desc: 'Em "Graph API Explorer" selecione sua página e gere um token com permissões pages_manage_posts, pages_read_engagement.' },
      { title: '4. Cole as credenciais abaixo', desc: 'App ID, App Secret e o Access Token gerado.' },
    ],
  },
  {
    id: 'linkedin', name: 'LinkedIn', icon: '💼', color: '#0A66C2',
    needsAppId: true,
    steps: [
      { title: '1. Crie um app no LinkedIn Developers', desc: 'Acesse o portal de desenvolvedores e crie um aplicativo.', link: 'https://www.linkedin.com/developers/apps' },
      { title: '2. Solicite os escopos', desc: 'Solicite acesso aos escopos w_member_social e r_liteprofile (Marketing Developer Platform).' },
      { title: '3. Gere o Access Token via OAuth 2.0', desc: 'Use o fluxo Authorization Code Flow para obter o token.' },
      { title: '4. Cole Client ID, Client Secret e Token', desc: 'Cole as credenciais nos campos abaixo.' },
    ],
  },
  {
    id: 'twitter', name: 'Twitter / X', icon: '🐦', color: '#000000',
    needsAppId: false,
    steps: [
      { title: '1. Acesse o Developer Portal do X', desc: 'Crie um projeto e um app dentro dele.', link: 'https://developer.twitter.com/en/portal/dashboard' },
      { title: '2. Habilite OAuth 2.0', desc: 'Nas configurações do app, habilite OAuth 2.0 e permissões de leitura/escrita.' },
      { title: '3. Gere o Bearer Token', desc: 'Em "Keys and tokens", copie o Bearer Token do app.' },
      { title: '4. Cole o Bearer Token abaixo', desc: 'Use o Bearer Token como Access Token.' },
    ],
  },
  {
    id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#000000',
    needsAppId: true,
    steps: [
      { title: '1. Crie um app no TikTok for Developers', desc: 'Acesse o portal e crie um aplicativo.', link: 'https://developers.tiktok.com/' },
      { title: '2. Solicite o Content Posting API', desc: 'Habilite a API de publicação de conteúdo (requer aprovação do TikTok).' },
      { title: '3. Configure OAuth 2.0', desc: 'Adicione URLs de redirecionamento e gere tokens.' },
      { title: '4. Cole Client Key, Secret e Token', desc: 'Cole os dados nos campos abaixo.' },
    ],
  },
  {
    id: 'youtube', name: 'YouTube', icon: '▶️', color: '#FF0000',
    needsAppId: true,
    steps: [
      { title: '1. Acesse Google Cloud Console', desc: 'Crie um projeto e habilite "YouTube Data API v3".', link: 'https://console.cloud.google.com/' },
      { title: '2. Crie credenciais OAuth 2.0', desc: 'Em "Credentials", crie um Client ID OAuth do tipo Aplicação Web.' },
      { title: '3. Gere o Access Token', desc: 'Use o OAuth 2.0 Playground com escopo youtube.upload e youtube.readonly.', link: 'https://developers.google.com/oauthplayground/' },
      { title: '4. Cole as credenciais', desc: 'Cole Client ID, Client Secret e o Token gerado.' },
    ],
  },
]

type TestResult = { ok: boolean; account?: string; error?: string } | null

export default function NovaConexaoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [platform, setPlatform] = useState<Platform | null>(null)
  const [form, setForm] = useState({
    accessToken: '',
    appId: '',
    appSecret: '',
    displayName: '',
  })
  const [showSecrets, setShowSecrets] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult>(null)
  const [saving, setSaving] = useState(false)

  function set(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))
  }

  const network = NETWORKS.find(n => n.id === platform)

  async function testConnection() {
    if (!platform || !form.accessToken) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/conexoes/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          accessToken: form.accessToken,
          appId: form.appId,
        }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, error: 'Erro de rede ao validar' })
    } finally {
      setTesting(false)
    }
  }

  async function connect() {
    if (!platform || !form.accessToken || !form.displayName) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()

    await supabase.from('social_accounts').insert({
      company_id: p?.company_id,
      platform,
      account_name: testResult?.account ?? form.displayName,
      display_name: form.displayName,
      access_token: form.accessToken,
      app_id: form.appId || null,
      app_secret: form.appSecret || null,
      is_active: true,
    })

    setSaving(false)
    router.push('/redes-sociais')
  }

  // Etapa 1: seleção de rede
  if (!platform) {
    return (
      <div className="p-7 max-w-3xl">
        <div className="flex items-center gap-3 mb-7">
          <Link href="/redes-sociais">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Conectar Rede Social</h1>
            <p className="text-slate-500 text-sm mt-0.5">Selecione a rede que deseja conectar.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {NETWORKS.map(n => (
            <button
              key={n.id}
              onClick={() => setPlatform(n.id)}
              className="bg-white border-2 border-slate-200 rounded-2xl p-5 flex flex-col items-center gap-2 hover:border-ze-blue hover:shadow-md transition-all"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                style={{ backgroundColor: n.color + '15' }}
              >
                {n.icon}
              </div>
              <span className="font-bold text-slate-900 text-sm">{n.name}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Etapa 2: formulário de credenciais
  return (
    <div className="p-7 max-w-5xl">
      <div className="flex items-center gap-3 mb-7">
        <button
          onClick={() => { setPlatform(null); setTestResult(null); setForm({ accessToken: '', appId: '', appSecret: '', displayName: '' }) }}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: network!.color + '15' }}
          >
            {network!.icon}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Conectar {network!.name}</h1>
            <p className="text-slate-500 text-sm mt-0.5">Forneça as credenciais para integrar.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Formulário */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardContent className="flex flex-col gap-5">
              <Input
                id="displayName"
                label="Nome de exibição da conexão *"
                placeholder={`Ex: ${network!.name} Corporativo`}
                value={form.displayName}
                onChange={set('displayName')}
              />

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Access Token *</label>
                  <button
                    type="button"
                    onClick={() => setShowSecrets(v => !v)}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    {showSecrets ? <><EyeOff className="w-3 h-3" /> Ocultar</> : <><Eye className="w-3 h-3" /> Mostrar</>}
                  </button>
                </div>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  value={form.accessToken}
                  onChange={set('accessToken')}
                  placeholder="Cole o token gerado na plataforma"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10 font-mono"
                />
              </div>

              {network!.needsAppId && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      App ID / Client ID <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={form.appId}
                      onChange={set('appId')}
                      placeholder="ID do aplicativo criado"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      App Secret / Client Secret <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={form.appSecret}
                      onChange={set('appSecret')}
                      placeholder="Chave secreta do aplicativo"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10 font-mono"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Status da conexão */}
          {testResult && (
            <div className={cn(
              'p-4 rounded-xl border-2 flex items-start gap-3',
              testResult.ok
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            )}>
              {testResult.ok
                ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                : <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              }
              <div className="flex-1">
                <p className={cn(
                  'font-bold text-sm',
                  testResult.ok ? 'text-green-700' : 'text-red-700'
                )}>
                  {testResult.ok ? 'Conexão validada com sucesso!' : 'Falha na validação'}
                </p>
                <p className={cn(
                  'text-xs mt-0.5',
                  testResult.ok ? 'text-green-600' : 'text-red-600'
                )}>
                  {testResult.ok
                    ? `Conta detectada: ${testResult.account}`
                    : testResult.error}
                </p>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={testConnection}
              loading={testing}
              disabled={!form.accessToken}
            >
              {!testing && <Plug className="w-4 h-4" />}
              Testar conexão
            </Button>
            <Button
              onClick={connect}
              loading={saving}
              disabled={!form.accessToken || !form.displayName}
              size="lg"
            >
              <CheckCircle2 className="w-4 h-4" />
              Conectar
            </Button>
          </div>
        </div>

        {/* Instruções */}
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ze-blue bg-ze-blue/10 px-2 py-1 rounded-full">
                COMO OBTER
              </span>
            </div>
            <h3 className="font-bold text-slate-900">Passo a passo {network!.name}</h3>
            <div className="flex flex-col gap-3">
              {network!.steps.map((s, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-ze-blue/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-ze-blue">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{s.title.replace(/^\d+\.\s*/, '')}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                    {s.link && (
                      <a
                        href={s.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-ze-blue font-semibold mt-1 hover:underline"
                      >
                        Abrir <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
              <p className="text-xs text-amber-700">
                <strong>Dica:</strong> Mantenha as credenciais em segurança. Elas são armazenadas criptografadas e usadas apenas para publicar em seu nome.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
