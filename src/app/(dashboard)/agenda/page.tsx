import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Calendar, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CONTENT_TYPE_LABELS } from '@/types'
import { formatDateTime } from '@/lib/utils'

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
  const { data: scheduled } = await supabase
    .from('contents')
    .select('*')
    .eq('company_id', profile?.company_id)
    .in('status', ['agendado', 'aprovado'])
    .order('scheduled_at', { ascending: true })

  return (
    <div className="p-7">
      <div className="mb-7">
        <h1 className="text-2xl font-black text-slate-900">Agenda</h1>
        <p className="text-slate-500 text-sm mt-0.5">Visualize os conteúdos agendados e aprovados.</p>
      </div>

      {!scheduled?.length ? (
        <Card>
          <CardContent>
            <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
              <Calendar className="w-12 h-12 opacity-30" />
              <p className="font-medium">Nenhum conteúdo agendado</p>
              <p className="text-sm text-center max-w-xs">
                Aprove conteúdos e defina datas de publicação para eles aparecerem aqui.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {scheduled.map((c: { id: string; title: string; content_type: string; status: string; scheduled_at?: string; platforms: string[] }) => (
            <Card key={c.id}>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-ze-blue/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-6 h-6 text-ze-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{c.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {CONTENT_TYPE_LABELS[c.content_type as keyof typeof CONTENT_TYPE_LABELS]}
                      {c.platforms?.length > 0 && ` · ${c.platforms.join(', ')}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge variant={c.status === 'agendado' ? 'blue' : 'green'}>
                      {c.status === 'agendado' ? 'Agendado' : 'Aprovado'}
                    </Badge>
                    {c.scheduled_at && (
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-400 justify-end">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(c.scheduled_at)}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
