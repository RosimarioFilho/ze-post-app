import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings, Plus, Users, Clock, FileText, Calendar, Crown, Sparkles, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, timeAgo } from '@/lib/utils'
import { STATUS_LABELS, CONTENT_TYPE_LABELS } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, company:companies(*)')
    .eq('id', user.id)
    .single()

  const companyId = profile?.company_id
  const firstName = (profile?.full_name ?? 'Usuário').split(' ')[0]
  const isFree = profile?.company?.plan !== 'pro'

  const [squadRes, pendingRes, publishedRes, scheduledRes, recentRes] = await Promise.all([
    supabase.from('squad_members').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
    supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pendente'),
    supabase.from('contents').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'publicado'),
    supabase.from('contents').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'agendado'),
    supabase.from('contents').select('id, title, content_type, status, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
  ])

  const stats = [
    { label: 'Squad ativo', value: squadRes.count ?? 0, sub: 'membros', icon: Users, color: 'text-blue-500' },
    { label: 'Solicitações pendentes', value: pendingRes.count ?? 0, sub: 'aguardando aprovação', icon: Clock, color: 'text-orange-500', alert: true },
    { label: 'Conteúdos publicados', value: publishedRes.count ?? 0, sub: 'este mês', icon: FileText, color: 'text-green-500' },
    { label: 'Agendados', value: scheduledRes.count ?? 0, sub: 'próximos conteúdos', icon: Calendar, color: 'text-purple-500' },
  ]

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Olá, {firstName} 👋</h1>
          <p className="text-slate-500 text-sm mt-0.5">Tudo pronto para você criar e publicar.</p>
        </div>
        <div className="flex gap-3">
          {isFree && (
            <Link href="/upgrade">
              <Button
                size="sm"
                className="bg-gradient-to-r from-ze-orange to-orange-500 hover:from-orange-500 hover:to-ze-orange text-white shadow-md hover:shadow-lg transition-all"
              >
                <Crown className="w-4 h-4" /> Assinar PRO
              </Button>
            </Link>
          )}
          <Link href="/configuracoes">
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4" /> Configurações
            </Button>
          </Link>
          <Link href="/criar-conteudo">
            <Button size="sm">
              <Plus className="w-4 h-4" /> Novo conteúdo
            </Button>
          </Link>
        </div>
      </div>

      {/* Upgrade banner — só Free */}
      {isFree && (
        <div className="mb-7 rounded-2xl p-6 relative overflow-hidden border border-orange-200"
             style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 60%, #fed7aa 100%)' }}>
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ze-orange to-orange-500 flex items-center justify-center shadow-lg flex-shrink-0">
              <Crown className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-ze-orange text-white px-2 py-0.5 rounded-full">
                  Plano Free
                </span>
                <span className="text-xs font-semibold text-orange-700">Você está usando o plano gratuito</span>
              </div>
              <h3 className="font-black text-slate-900 text-lg leading-tight">
                Desbloqueie todo o poder do Zé Post com o plano <span className="text-ze-orange">PRO</span>
              </h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Conteúdos ilimitados
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Todas as redes sociais
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Squad completo + agendamento
                </span>
              </div>
            </div>
            <Link href="/upgrade" className="flex-shrink-0">
              <Button className="bg-gradient-to-r from-ze-orange to-orange-500 hover:from-orange-500 hover:to-ze-orange text-white shadow-md">
                <Sparkles className="w-4 h-4" /> Assinar agora
              </Button>
            </Link>
          </div>
          <Crown className="absolute -right-4 -top-4 w-32 h-32 text-ze-orange opacity-5 rotate-12 pointer-events-none" />
        </div>
      )}

      {/* Banner Zé */}
      <div className="rounded-2xl bg-ze-blue p-7 mb-7 flex items-center justify-between overflow-hidden relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs bg-white/20 text-white px-3 py-1 rounded-full font-medium">✨ Assistente Zé</span>
          </div>
          <h2 className="text-white font-black text-2xl leading-tight mb-2">
            Tudo pronto para você<br />
            criar, agendar e <span className="text-ze-orange">crescer!</span>
          </h2>
          <p className="text-white/70 text-sm mb-5 max-w-md">
            Eu cuido da organização, sugestões e performance para você focar no que importa.
          </p>
          <div className="flex gap-3">
            <Link href="/reuniao">
              <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white">
                ✨ Ver sugestões da IA
              </Button>
            </Link>
            <Link href="/criar-conteudo">
              <Button variant="secondary" size="sm">
                <Plus className="w-4 h-4" /> Criar novo conteúdo
              </Button>
            </Link>
          </div>
        </div>
        <div className="absolute right-6 top-0 bottom-0 flex items-center opacity-20 text-white text-[120px] font-black select-none pointer-events-none">
          Z
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{s.label}</span>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <span className="text-3xl font-black text-slate-900">{s.value}</span>
              <span className={`text-xs font-medium ${s.alert && s.value > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                {s.sub}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent content */}
      <Card>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Atividade recente</h3>
          <Link href="/conteudos" className="text-xs text-ze-blue font-semibold hover:underline">
            Ver tudo
          </Link>
        </div>
        <CardContent className="p-0">
          {!recentRes.data?.length ? (
            <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
              <FileText className="w-10 h-10 opacity-30" />
              <p className="text-sm">Nenhum conteúdo criado ainda.</p>
              <Link href="/criar-conteudo">
                <Button size="sm" variant="outline">Criar primeiro conteúdo</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentRes.data.map((c: { id: string; title: string; content_type: string; status: string; created_at: string }) => {
                const st = STATUS_LABELS[c.status as keyof typeof STATUS_LABELS]
                return (
                  <div key={c.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {CONTENT_TYPE_LABELS[c.content_type as keyof typeof CONTENT_TYPE_LABELS]} · {timeAgo(c.created_at)}
                      </p>
                    </div>
                    <Badge className={st?.color}>{st?.label}</Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
