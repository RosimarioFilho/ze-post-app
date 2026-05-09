import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContentCard } from '@/components/conteudos/ContentCard'

export default async function ConteudosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
  const { data: contents } = await supabase
    .from('contents')
    .select('id, title, content_type, status, platforms, body, media_urls, art_html, art_width, art_height, scheduled_at, created_at')
    .eq('company_id', profile?.company_id)
    .order('created_at', { ascending: false })

  const stats = {
    total: contents?.length ?? 0,
    publicados: contents?.filter(c => c.status === 'publicado').length ?? 0,
    pendentes: contents?.filter(c => c.status === 'pendente_aprovacao').length ?? 0,
    agendados: contents?.filter(c => c.status === 'agendado').length ?? 0,
  }

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Conteúdos</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gerencie todos os seus posts e criativos.</p>
        </div>
        <Link href="/criar-conteudo">
          <Button><Plus className="w-4 h-4" /> Novo conteúdo</Button>
        </Link>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-4 gap-3 mb-7">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700' },
          { label: 'Publicados', value: stats.publicados, color: 'text-green-600' },
          { label: 'Pendentes', value: stats.pendentes, color: 'text-yellow-600' },
          { label: 'Agendados', value: stats.agendados, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cards grid */}
      {!contents?.length ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-16 flex flex-col items-center gap-4 text-slate-400">
          <FileText className="w-12 h-12 opacity-30" />
          <p className="font-medium">Nenhum conteúdo criado ainda</p>
          <Link href="/criar-conteudo">
            <Button variant="outline" size="sm">Criar primeiro conteúdo</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {contents.map(c => (
            <ContentCard key={c.id} content={c} />
          ))}
        </div>
      )}
    </div>
  )
}
