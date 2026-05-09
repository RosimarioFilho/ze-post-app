'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Plus, Plug } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { SocialAccount } from '@/types'

const NETWORKS = [
  { id: 'instagram', name: 'Instagram', color: '#E1306C', icon: '📸', description: 'Posts, Stories, Reels e Carrossel' },
  { id: 'facebook', name: 'Facebook', color: '#1877F2', icon: '📘', description: 'Posts, Stories e Vídeos' },
  { id: 'tiktok', name: 'TikTok', color: '#000000', icon: '🎵', description: 'Vídeos curtos e Lives' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', icon: '💼', description: 'Posts de texto e imagem' },
  { id: 'twitter', name: 'Twitter / X', color: '#000000', icon: '🐦', description: 'Tweets e threads' },
  { id: 'youtube', name: 'YouTube', color: '#FF0000', icon: '▶️', description: 'Vídeos e Shorts' },
] as const

export default function RedesSociaisPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    const { data } = await supabase.from('social_accounts').select('*').eq('company_id', p?.company_id)
    setAccounts(data ?? [])
    setLoading(false)
  }

  async function disconnect(id: string) {
    await supabase.from('social_accounts').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-7">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Redes Sociais</h1>
          <p className="text-slate-500 text-sm mt-0.5">Conecte suas contas para publicação automática.</p>
        </div>
        <Link href="/conexoes/nova">
          <Button>
            <Plus className="w-4 h-4" /> Nova conexão
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {NETWORKS.map(net => {
          const connected = accounts.find(a => a.platform === net.id && a.is_active)
          return (
            <Card key={net.id}>
              <CardContent>
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: net.color + '15' }}
                  >
                    {net.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900">{net.name}</h3>
                      {connected && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{net.description}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  {connected ? (
                    <div className="flex gap-2">
                      <div className="flex-1 px-3 py-2 bg-green-50 rounded-lg text-xs text-green-700 font-medium flex items-center gap-1.5 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{connected.account_name ?? 'Conectado'}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => disconnect(connected.id)}>
                        Desconectar
                      </Button>
                    </div>
                  ) : (
                    <Link href={`/conexoes/nova?platform=${net.id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        <Plug className="w-4 h-4" /> Conectar conta
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
        <strong>Nota:</strong> A integração real com as APIs das redes sociais requer configuração de OAuth e aprovação de cada plataforma. Entre em contato com o suporte para ativar a publicação automática.
      </div>
    </div>
  )
}
