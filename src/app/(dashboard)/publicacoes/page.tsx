'use client'
import { useEffect, useState } from 'react'
import {
  Send, CalendarDays, Clock, BarChart3, X, ChevronLeft, ChevronRight,
  CheckCircle2, ImageIcon, Layers, List,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CONTENT_TYPE_LABELS, STATUS_LABELS } from '@/types'
import { cn, formatDateTime } from '@/lib/utils'

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube']
const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn',
  tiktok: 'TikTok', youtube: 'YouTube',
}
const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C', facebook: '#1877F2', linkedin: '#0A66C2',
  tiktok: '#000000', youtube: '#FF0000',
}

interface Content {
  id: string
  title: string
  body?: string
  content_type: string
  platforms: string[]
  status: string
  scheduled_at?: string
  published_at?: string
  media_urls?: string[]
  art_html?: string | null
  art_width?: number | null
  art_height?: number | null
  created_at: string
}

type Tab = 'aprovados' | 'agendados' | 'publicados' | 'calendario'

export default function PublicacoesPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('aprovados')
  const [contents, setContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string>('')

  // Modal de agendamento
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleTarget, setScheduleTarget] = useState<Content | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleNetworks, setScheduleNetworks] = useState<string[]>([])
  const [scheduling, setScheduling] = useState(false)

  // Publicação imediata
  const [publishingId, setPublishingId] = useState<string | null>(null)

  // Calendário
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    setCompanyId(p?.company_id ?? '')
    const { data } = await supabase
      .from('contents')
      .select('*')
      .eq('company_id', p?.company_id)
      .in('status', ['aprovado', 'agendado', 'publicado'])
      .order('created_at', { ascending: false })
    setContents(data ?? [])
    setLoading(false)
  }

  function openSchedule(c: Content) {
    setScheduleTarget(c)
    setScheduleNetworks(c.platforms ?? [])
    const next = new Date()
    next.setHours(next.getHours() + 1, 0, 0, 0)
    setScheduleDate(next.toISOString().slice(0, 16))
    setScheduleOpen(true)
  }

  function closeSchedule() {
    setScheduleOpen(false)
    setScheduleTarget(null)
    setScheduleDate('')
    setScheduleNetworks([])
  }

  function toggleScheduleNet(p: string) {
    setScheduleNetworks(n => n.includes(p) ? n.filter(x => x !== p) : [...n, p])
  }

  async function confirmSchedule() {
    if (!scheduleTarget || !scheduleDate || !scheduleNetworks.length) return
    setScheduling(true)
    await supabase.from('contents').update({
      status: 'agendado',
      scheduled_at: new Date(scheduleDate).toISOString(),
      platforms: scheduleNetworks,
    }).eq('id', scheduleTarget.id)
    setScheduling(false)
    closeSchedule()
    load()
  }

  async function publishNow(c: Content) {
    setPublishingId(c.id)
    // Simula a chamada do agente Postador (em produção: API real do Instagram/Facebook/etc.)
    await new Promise(r => setTimeout(r, 1200))
    await supabase.from('contents').update({
      status: 'publicado',
      published_at: new Date().toISOString(),
    }).eq('id', c.id)
    setPublishingId(null)
    load()
  }

  // Filtragem por aba
  const filtered = contents.filter(c => {
    if (tab === 'aprovados') return c.status === 'aprovado'
    if (tab === 'agendados') return c.status === 'agendado'
    if (tab === 'publicados') return c.status === 'publicado'
    return true
  })

  const stats = {
    aprovados: contents.filter(c => c.status === 'aprovado').length,
    agendados: contents.filter(c => c.status === 'agendado').length,
    publicados: contents.filter(c => c.status === 'publicado').length,
  }

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Publicações e Agendamentos</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gerencie a publicação de conteúdo aprovado nas redes sociais.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          onClick={() => setTab('aprovados')}
          className={cn(
            'bg-white rounded-xl border p-4 text-left transition-all',
            tab === 'aprovados' ? 'border-ze-blue ring-2 ring-ze-blue/10' : 'border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Aprovados</span>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-1">{stats.aprovados}</p>
          <span className="text-xs text-slate-400">prontos para publicar</span>
        </button>
        <button
          onClick={() => setTab('agendados')}
          className={cn(
            'bg-white rounded-xl border p-4 text-left transition-all',
            tab === 'agendados' ? 'border-ze-blue ring-2 ring-ze-blue/10' : 'border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Agendados</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-1">{stats.agendados}</p>
          <span className="text-xs text-slate-400">aguardando publicação</span>
        </button>
        <button
          onClick={() => setTab('publicados')}
          className={cn(
            'bg-white rounded-xl border p-4 text-left transition-all',
            tab === 'publicados' ? 'border-ze-blue ring-2 ring-ze-blue/10' : 'border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Publicados</span>
            <Send className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-1">{stats.publicados}</p>
          <span className="text-xs text-slate-400">veja o desempenho</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-5">
        {[
          { id: 'aprovados' as Tab, label: 'Aprovados', icon: List },
          { id: 'agendados' as Tab, label: 'Agendados', icon: Clock },
          { id: 'publicados' as Tab, label: 'Publicados', icon: Send },
          { id: 'calendario' as Tab, label: 'Calendário', icon: CalendarDays },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'border-ze-blue text-ze-blue'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Carregando...</div>
      ) : tab === 'calendario' ? (
        <CalendarView
          month={calMonth}
          contents={contents.filter(c => c.scheduled_at || c.published_at)}
          onPrev={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          onNext={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
        />
      ) : !filtered.length ? (
        <Card>
          <CardContent>
            <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
              <Layers className="w-12 h-12 opacity-30" />
              <p className="font-medium">Nenhum conteúdo nesta categoria</p>
              <Link href="/conteudos">
                <Button variant="outline" size="sm">Ver todos os conteúdos</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(c => (
            <PublicationItem
              key={c.id}
              content={c}
              onPublishNow={() => publishNow(c)}
              onSchedule={() => openSchedule(c)}
              isPublishing={publishingId === c.id}
            />
          ))}
        </div>
      )}

      {/* Modal de agendamento */}
      {scheduleOpen && scheduleTarget && (
        <ScheduleModal
          content={scheduleTarget}
          date={scheduleDate}
          networks={scheduleNetworks}
          onClose={closeSchedule}
          onChangeDate={setScheduleDate}
          onToggleNetwork={toggleScheduleNet}
          onConfirm={confirmSchedule}
          loading={scheduling}
        />
      )}
    </div>
  )
}

// ─── Miniatura da arte (iframe escalado) ─────────────────
function ArtThumb({ content: c }: { content: Content }) {
  const W = c.art_width ?? 1080
  const H = c.art_height ?? 1080
  // Largura fixa de 72px, altura proporcional ao formato (stories fica mais alto, horizontal mais baixo)
  const thumbW = 72
  const thumbH = Math.round(thumbW * H / W)
  const scale = thumbW / W

  if (c.art_html) {
    return (
      <div
        className="flex-shrink-0 rounded-xl overflow-hidden border border-slate-100 shadow-sm"
        style={{ width: thumbW, height: thumbH, position: 'relative' }}
      >
        <div style={{
          width: W, height: H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute', top: 0, left: 0,
          pointerEvents: 'none',
        }}>
          <iframe
            srcDoc={c.art_html}
            sandbox="allow-scripts"
            style={{ width: W, height: H, border: 'none', display: 'block' }}
            title="Arte"
          />
        </div>
      </div>
    )
  }

  const firstMedia = c.media_urls?.find(u => !u.endsWith('.html'))
  return (
    <div
      className="flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-100"
      style={{ width: thumbW, height: Math.max(thumbH, 64) }}
    >
      {firstMedia
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={firstMedia} alt={c.title} className="w-full h-full object-cover" />
        : <ImageIcon className="w-6 h-6 text-slate-300" />
      }
    </div>
  )
}

// ─── Item de publicação ──────────────────
function PublicationItem({
  content: c, onPublishNow, onSchedule, isPublishing,
}: {
  content: Content
  onPublishNow: () => void
  onSchedule: () => void
  isPublishing: boolean
}) {
  const st = STATUS_LABELS[c.status as keyof typeof STATUS_LABELS]
  return (
    <Card>
      <CardContent>
        <div className="flex gap-4 items-start">
          {/* Miniatura da arte */}
          <ArtThumb content={c} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{c.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {CONTENT_TYPE_LABELS[c.content_type as keyof typeof CONTENT_TYPE_LABELS]}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${st?.color}`}>
                {st?.label}
              </span>
            </div>

            {/* Plataformas */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {c.platforms?.map(p => (
                <span
                  key={p}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: PLATFORM_COLORS[p] }}
                >
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
            </div>

            {/* Datas */}
            {c.scheduled_at && c.status === 'agendado' && (
              <p className="text-xs text-blue-600 font-semibold mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Agendado para {formatDateTime(c.scheduled_at)}
              </p>
            )}
            {c.published_at && (
              <p className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Publicado em {formatDateTime(c.published_at)}
              </p>
            )}
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-2 self-center min-w-[150px]">
            {c.status === 'aprovado' && (
              <>
                <Button size="sm" onClick={onPublishNow} loading={isPublishing}>
                  <Send className="w-3.5 h-3.5" /> Publicar agora
                </Button>
                <Button size="sm" variant="outline" onClick={onSchedule}>
                  <CalendarDays className="w-3.5 h-3.5" /> Agendar
                </Button>
              </>
            )}
            {c.status === 'agendado' && (
              <>
                <Button size="sm" onClick={onPublishNow} loading={isPublishing}>
                  <Send className="w-3.5 h-3.5" /> Publicar agora
                </Button>
                <Button size="sm" variant="outline" onClick={onSchedule}>
                  Reagendar
                </Button>
              </>
            )}
            {c.status === 'publicado' && (
              <Link href={`/conteudos/${c.id}/editar`}>
                <Button size="sm" variant="outline" className="w-full">
                  <BarChart3 className="w-3.5 h-3.5" /> Ver resultados
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Modal de agendamento ──────────────────
function ScheduleModal({
  content, date, networks, onClose, onChangeDate, onToggleNetwork, onConfirm, loading,
}: {
  content: Content
  date: string
  networks: string[]
  onClose: () => void
  onChangeDate: (d: string) => void
  onToggleNetwork: (p: string) => void
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-900">Agendar publicação</h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{content.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Data e hora *</label>
            <input
              type="datetime-local"
              value={date}
              onChange={e => onChangeDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Redes sociais *</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onToggleNetwork(p)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                    networks.includes(p)
                      ? 'text-white border-transparent'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  )}
                  style={networks.includes(p) ? { backgroundColor: PLATFORM_COLORS[p] } : {}}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={onConfirm}
            loading={loading}
            disabled={!date || !networks.length}
          >
            <CalendarDays className="w-4 h-4" /> Confirmar agendamento
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Calendário ──────────────────
function CalendarView({
  month, contents, onPrev, onNext,
}: {
  month: Date
  contents: Content[]
  onPrev: () => void
  onNext: () => void
}) {
  const monthName = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const startWeekday = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  // Gera células do mês (incluindo padding antes do dia 1)
  const cells: Array<{ day: number; date: Date } | null> = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: new Date(month.getFullYear(), month.getMonth(), d) })
  }

  const today = new Date()

  function postsOnDay(date: Date) {
    return contents.filter(c => {
      const ref = c.published_at ?? c.scheduled_at
      if (!ref) return false
      const d = new Date(ref)
      return (
        d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate()
      )
    })
  }

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-900 text-lg capitalize">{monthName}</h3>
          <div className="flex gap-1">
            <button
              onClick={onPrev}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onNext}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="text-xs font-bold text-slate-400 text-center py-2">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} className="aspect-square" />
            const posts = postsOnDay(cell.date)
            const isToday =
              cell.date.getFullYear() === today.getFullYear() &&
              cell.date.getMonth() === today.getMonth() &&
              cell.date.getDate() === today.getDate()
            return (
              <div
                key={i}
                className={cn(
                  'aspect-square rounded-lg border p-1.5 flex flex-col gap-1 overflow-hidden',
                  isToday ? 'border-ze-blue bg-ze-blue/5' : 'border-slate-100',
                  posts.length > 0 && 'border-slate-200'
                )}
              >
                <span className={cn(
                  'text-xs font-semibold',
                  isToday ? 'text-ze-blue' : 'text-slate-700'
                )}>
                  {cell.day}
                </span>
                <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                  {posts.slice(0, 2).map(p => {
                    const isPub = p.status === 'publicado'
                    return (
                      <div
                        key={p.id}
                        title={p.title}
                        className={cn(
                          'text-[9px] font-semibold px-1.5 py-0.5 rounded truncate',
                          isPub
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-blue-100 text-blue-700'
                        )}
                      >
                        {p.title}
                      </div>
                    )
                  })}
                  {posts.length > 2 && (
                    <span className="text-[9px] text-slate-400 font-semibold">+{posts.length - 2}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
            <span className="text-xs text-slate-500">Agendado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
            <span className="text-xs text-slate-500">Publicado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-ze-blue/10 border border-ze-blue" />
            <span className="text-xs text-slate-500">Hoje</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
