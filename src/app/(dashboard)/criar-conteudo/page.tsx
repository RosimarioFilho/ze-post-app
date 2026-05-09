'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Sparkles, Upload, X, ImageIcon, Loader2, Send,
  CheckCircle2, Palette, PenLine, Eye, Wrench, FileText, ArrowRight,
  RefreshCw, ThumbsUp, Download,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { CONTENT_TYPE_LABELS, SQUAD_ROLES } from '@/types'
import type { ContentType, SquadRole, SquadMember } from '@/types'
import { cn } from '@/lib/utils'

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube']
const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn',
  tiktok: 'TikTok', youtube: 'YouTube',
}

// Dimensões oficiais 2025 (source: Buffer/Hootsuite)
const ASPECT_RATIOS: Record<string, { ratio: string; label: string; w: number; h: number }> = {
  post_instagram:       { ratio: '1/1',     label: '1:1 — Feed Instagram',        w: 1080, h: 1080 },
  post_facebook:        { ratio: '1.91/1',  label: '1.91:1 — Feed Facebook',      w: 1080, h: 566  },
  post_linkedin_imagem: { ratio: '1.91/1',  label: '1.91:1 — LinkedIn Imagem',    w: 1200, h: 627  },
  post_linkedin_texto:  { ratio: '1/1',     label: '1:1 — LinkedIn Texto',        w: 1080, h: 1080 },
  stories:              { ratio: '9/16',    label: '9:16 — Stories (1080×1920)',   w: 1080, h: 1920 },
  carrossel:            { ratio: '1/1',     label: '1:1 — Carrossel',             w: 1080, h: 1080 },
  youtube:              { ratio: '16/9',    label: '16:9 — YouTube Thumbnail',    w: 1280, h: 720  },
  reels:                { ratio: '9/16',    label: '9:16 — Reels/TikTok (1080×1920)', w: 1080, h: 1920 },
}

// Largura ideal do card de preview por tipo (balanceia altura visível na tela)
const CARD_PREVIEW_WIDTH: Partial<Record<string, number>> = {
  post_instagram:       380,
  post_facebook:        480,
  post_linkedin_imagem: 480,
  post_linkedin_texto:  380,
  stories:              260,  // estreito para 9:16 ficar visível sem scroll
  carrossel:            380,
  youtube:              480,
  reels:                260,
}

const PROGRESS_STEPS = [
  { label: 'Analisando briefing...', icon: FileText },
  { label: 'Estrategista definindo abordagem...', icon: Sparkles },
  { label: 'Copywriter criando o texto...', icon: PenLine },
  { label: 'Designer gerando o criativo...', icon: Palette },
  { label: 'Revisando e salvando...', icon: Wrench },
]

type Mode = 'ia' | 'upload'

interface GerationResult {
  copyFinal: string
  designerHtml: string
  results: Record<string, string>
  contentId?: string
  artUrl?: string
}

// ─── Confetti ───────────────────────────────────────────────────────────────
function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const COLORS = ['#fe7902', '#052d64', '#8b5cf6', '#fd7d07', '#3b82f6', '#a855f7', '#f97316']
    type Particle = { x: number; y: number; vx: number; vy: number; color: string; w: number; h: number; rot: number; rotV: number; alpha: number }

    const particles: Particle[] = Array.from({ length: 180 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height * 0.5 - 20,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: Math.random() * 12 + 5,
      h: Math.random() * 6 + 3,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.15,
      alpha: 1,
    }))

    let frame: number
    let t = 0

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t++
      particles.forEach(p => {
        p.x += p.vx + Math.sin(t * 0.02 + p.y * 0.01) * 0.5
        p.y += p.vy
        p.rot += p.rotV
        if (t > 120) p.alpha -= 0.008
        if (p.y > canvas.height + 20) {
          p.y = -20
          p.x = Math.random() * canvas.width
          p.alpha = 1
          t = Math.min(t, 119)
        }
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.alpha)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      })
      frame = requestAnimationFrame(draw)
    }

    draw()
    const stop = setTimeout(() => cancelAnimationFrame(frame), 5000)
    return () => { cancelAnimationFrame(frame); clearTimeout(stop) }
  }, [active])

  if (!active) return null
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[100]"
    />
  )
}

// ─── Designer Art Card ───────────────────────────────────────────────────────
function ArtCard({ html, arInfo, artUrl }: {
  html: string
  arInfo: { ratio: string; label: string; w: number; h: number }
  artUrl?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.35)
  const [downloading, setDownloading] = useState(false)
  const { w: srcW, h: srcH } = arInfo

  useEffect(() => {
    const update = () => {
      if (containerRef.current) setScale(containerRef.current.offsetWidth / srcW)
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [srcW])

  const wrappedHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${srcW}px;height:${srcH}px;overflow:hidden}</style></head><body>${html}</body></html>`

  async function downloadPng() {
    setDownloading(true)
    try {
      const res = await fetch('/api/arte-png', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: wrappedHtml, width: srcW, height: srcH }),
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `criativo-${srcW}x${srcH}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download PNG falhou:', err)
      // Fallback: baixa o HTML armazenado
      if (artUrl) {
        const a = document.createElement('a')
        a.href = artUrl
        a.download = 'criativo.html'
        a.target = '_blank'
        a.click()
      }
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-2xl"
        style={{ aspectRatio: `${srcW}/${srcH}` }}
      >
        <div style={{
          width: srcW, height: srcH,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute', top: 0, left: 0,
        }}>
          <iframe
            srcDoc={wrappedHtml}
            sandbox="allow-scripts"
            style={{ width: srcW, height: srcH, border: 'none', display: 'block' }}
            title="Criativo gerado pela Carla"
          />
        </div>
      </div>
      <button
        onClick={downloadPng}
        disabled={downloading}
        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-ze-blue hover:text-ze-blue hover:bg-ze-blue/5 transition-all disabled:opacity-50"
      >
        {downloading
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exportando PNG...</>
          : <><Download className="w-3.5 h-3.5" /> Baixar arte (PNG)</>
        }
      </button>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function CriarConteudoPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('ia')
  const [squad, setSquad] = useState<SquadMember[]>([])
  const [companyId, setCompanyId] = useState<string>('')

  const [ia, setIa] = useState({
    tipo: 'post_instagram' as ContentType,
    squadSelecionado: [] as SquadRole[],
    descricao: '',
    quantidade: 1,
    redes: ['instagram'] as string[],
    observacoes: '',
  })
  const [gerando, setGerando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const [resultado, setResultado] = useState<GerationResult | null>(null)
  const [erroIA, setErroIA] = useState('')
  const [confetti, setConfetti] = useState(false)
  const [activeTab, setActiveTab] = useState<'art' | 'copy' | 'all'>('art')

  // Refazer / Aprovar
  const [showAjuste, setShowAjuste] = useState(false)
  const [ajusteTexto, setAjusteTexto] = useState('')
  const [refazendo, setRefazendo] = useState(false)
  const [aprovando, setAprovando] = useState(false)

  // Imagem de referência do produto
  const refImagemRef = useRef<HTMLInputElement>(null)
  const [refImagemFile, setRefImagemFile] = useState<File | null>(null)
  const [refImagemPreview, setRefImagemPreview] = useState<string>('')

  const [upload, setUpload] = useState({
    tipo: 'post_instagram' as ContentType,
    redes: ['instagram'] as string[],
    titulo: '',
    scheduledAt: '',
  })
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string>('')
  const [salvando, setSalvando] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    setCompanyId(p?.company_id ?? '')
    const { data: s } = await supabase.from('squad_members').select('*').eq('company_id', p?.company_id).eq('is_active', true).order('flow_order', { ascending: true })
    setSquad(s ?? [])
  }

  function togglePlatform(p: string, targetMode: Mode) {
    if (targetMode === 'ia') setIa(f => ({ ...f, redes: f.redes.includes(p) ? f.redes.filter(x => x !== p) : [...f.redes, p] }))
    else setUpload(f => ({ ...f, redes: f.redes.includes(p) ? f.redes.filter(x => x !== p) : [...f.redes, p] }))
  }

  function toggleSquad(role: SquadRole) {
    setIa(f => ({
      ...f,
      squadSelecionado: f.squadSelecionado.includes(role)
        ? f.squadSelecionado.filter(r => r !== role)
        : [...f.squadSelecionado, role],
    }))
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
  }

  function removeMedia() {
    setMediaFile(null)
    setMediaPreview('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleRefImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setRefImagemFile(file)
    setRefImagemPreview(URL.createObjectURL(file))
  }

  function removeRefImagem() {
    setRefImagemFile(null)
    setRefImagemPreview('')
    if (refImagemRef.current) refImagemRef.current.value = ''
  }

  const gerarComIA = useCallback(async () => {
    if (!ia.descricao.trim()) return
    setGerando(true)
    setProgresso(0)
    setStepIdx(0)
    setResultado(null)
    setErroIA('')

    let step = 0
    const interval = setInterval(() => {
      step++
      if (step < PROGRESS_STEPS.length) {
        setStepIdx(step)
        setProgresso(Math.round((step / PROGRESS_STEPS.length) * 88))
      }
    }, 2200)

    try {
      // Upload imagem de referência se houver
      let refImagemUrl = ''
      if (refImagemFile) {
        setStepIdx(0)
        const ext = (refImagemFile.name.split('.').pop() ?? 'png').toLowerCase()
        const filePath = `${companyId}/ref-${Date.now()}.${ext}`
        const { data: uploaded, error: upErr } = await supabase.storage
          .from('media').upload(filePath, refImagemFile, {
            upsert: true,
            contentType: refImagemFile.type || `image/${ext}`,
          })
        if (upErr || !uploaded) {
          clearInterval(interval)
          setGerando(false)
          setProgresso(0)
          setErroIA(`Falha ao enviar imagem do produto: ${upErr?.message ?? 'erro desconhecido'}. Tente novamente.`)
          return
        }
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath)
        // Verifica se a URL está acessível antes de prosseguir
        try {
          const head = await fetch(publicUrl, { method: 'HEAD' })
          if (!head.ok) throw new Error(`HTTP ${head.status}`)
        } catch (e) {
          clearInterval(interval)
          setGerando(false)
          setProgresso(0)
          setErroIA(`A imagem foi enviada mas não está pública (${e instanceof Error ? e.message : ''}). Verifique as policies do bucket "media".`)
          return
        }
        refImagemUrl = publicUrl
        console.log('[criar-conteudo] refImagemUrl uploaded:', refImagemUrl)
      }

      const res = await fetch('/api/gerar-conteudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: ia.tipo,
          descricao: ia.descricao,
          quantidade: ia.quantidade,
          redes: ia.redes,
          observacoes: ia.observacoes,
          squad: ia.squadSelecionado.length ? ia.squadSelecionado : ['estrategista', 'copywriter', 'designer'],
          companyId,
          refImagemUrl: refImagemUrl || undefined,
        }),
      })
      clearInterval(interval)
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao gerar conteúdo')
      setProgresso(100)
      setStepIdx(PROGRESS_STEPS.length - 1)
      setTimeout(() => {
        setGerando(false)
        setResultado(data)
        setActiveTab(data.designerHtml ? 'art' : 'copy')
        setConfetti(true)
        setTimeout(() => setConfetti(false), 5200)
      }, 600)
    } catch (err) {
      clearInterval(interval)
      setGerando(false)
      setProgresso(0)
      setErroIA(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }, [ia, companyId])

  const aprovarArte = useCallback(async () => {
    if (!resultado?.contentId) {
      router.push('/conteudos')
      return
    }
    setAprovando(true)
    try {
      await supabase
        .from('contents')
        .update({ status: 'aprovado' })
        .eq('id', resultado.contentId)
      await supabase
        .from('approvals')
        .update({ status: 'aprovado', resolved_at: new Date().toISOString() })
        .eq('content_id', resultado.contentId)
    } catch (err) {
      console.error('Erro ao aprovar:', err)
    } finally {
      router.push('/conteudos')
    }
  }, [resultado, router, supabase])

  const refazerArte = useCallback(async () => {
    if (!ajusteTexto.trim() || !resultado) return
    setRefazendo(true)
    setErroIA('')
    try {
      const res = await fetch('/api/gerar-conteudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: ia.tipo,
          descricao: ia.descricao,
          redes: ia.redes,
          quantidade: 1,
          observacoes: ia.observacoes,
          squad: ['designer'],
          companyId,
          ajuste: ajusteTexto,
          htmlAnterior: resultado.designerHtml,
          copyAnterior: resultado.copyFinal,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setResultado(prev => prev ? { ...prev, designerHtml: data.designerHtml } : prev)
      setShowAjuste(false)
      setAjusteTexto('')
      setConfetti(true)
      setTimeout(() => setConfetti(false), 4000)
    } catch (err) {
      setErroIA(err instanceof Error ? err.message : 'Erro ao refazer')
    } finally {
      setRefazendo(false)
    }
  }, [ajusteTexto, resultado, ia, companyId])

  async function salvarUpload() {
    if (!upload.titulo.trim()) return
    setSalvando(true)
    setUploadError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let mediaUrl = ''
    if (mediaFile) {
      const ext = mediaFile.name.split('.').pop()
      const path = `${companyId}/${Date.now()}.${ext}`
      const { data: uploaded, error: uploadErr } = await supabase.storage
        .from('media').upload(path, mediaFile, { upsert: true })
      if (uploadErr) { setUploadError(`Erro no upload: ${uploadErr.message}`); setSalvando(false); return }
      if (uploaded) {
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
        mediaUrl = publicUrl
      }
    }

    const { data: content } = await supabase.from('contents').insert({
      company_id: companyId,
      created_by: user.id,
      title: upload.titulo,
      content_type: upload.tipo,
      platforms: upload.redes,
      status: upload.scheduledAt ? 'agendado' : 'aprovado',
      media_urls: mediaUrl ? [mediaUrl] : [],
      scheduled_at: upload.scheduledAt || null,
    }).select().single()

    if (content) {
      await supabase.from('approvals').insert({
        content_id: content.id,
        company_id: companyId,
        requested_by: user.id,
        status: 'pendente',
      })
    }
    setSalvando(false)
    router.push('/conteudos')
  }

  const arInfo = ASPECT_RATIOS[mode === 'ia' ? ia.tipo : upload.tipo]
  const StepIcon = PROGRESS_STEPS[stepIdx]?.icon ?? Sparkles

  return (
    <div className="p-8 max-w-5xl">
      <Confetti active={confetti} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <Link href="/conteudos">
          <button className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Criar Conteúdo</h1>
          <p className="text-slate-500 text-sm mt-0.5">Escolha como deseja criar seu conteúdo.</p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-3 mb-7">
        {(['ia', 'upload'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 p-4 rounded-2xl border-2 font-semibold text-sm transition-all',
              mode === m
                ? m === 'ia' ? 'border-ze-blue bg-ze-blue/5 text-ze-blue' : 'border-ze-orange bg-ze-orange/5 text-ze-orange'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            )}
          >
            {m === 'ia' ? <Sparkles className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
            <div className="text-left">
              <p className="font-bold">{m === 'ia' ? 'Criar com IA' : 'Já tenho o criativo'}</p>
              <p className="text-xs font-normal opacity-70">
                {m === 'ia' ? 'O squad gera o conteúdo para você' : 'Faça upload e agende a publicação'}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* ─── MODO IA ─── */}
      {mode === 'ia' && !resultado && (
        <div className="flex flex-col gap-5">
          <Card>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Tipo de conteúdo *</label>
                  <select
                    value={ia.tipo}
                    onChange={e => setIa(f => ({ ...f, tipo: e.target.value as ContentType }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10"
                  >
                    {Object.entries(CONTENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <Input id="qtd" type="number" label="Quantidade" min={1} max={10} value={ia.quantidade}
                  onChange={e => setIa(f => ({ ...f, quantidade: Number(e.target.value) }))} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Redes sociais *</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(p => (
                    <button key={p} type="button" onClick={() => togglePlatform(p, 'ia' as Mode)}
                      className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                        ia.redes.includes(p) ? 'bg-ze-blue text-white border-ze-blue' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      )}>
                      {PLATFORM_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Squad responsável <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {squad.map(s => {
                    const roleData = SQUAD_ROLES[s.role as keyof typeof SQUAD_ROLES]
                    return (
                      <button key={s.id} type="button" onClick={() => toggleSquad(s.role)}
                        className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-1.5',
                          ia.squadSelecionado.includes(s.role) ? 'border-transparent text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        )}
                        style={ia.squadSelecionado.includes(s.role) ? { backgroundColor: roleData?.color } : {}}>
                        {s.icon ?? ''} {s.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Descrição do conteúdo *</label>
                <textarea value={ia.descricao}
                  onChange={e => setIa(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descreva o que você quer comunicar. Ex: Post sobre promoção de 30% off, tom descontraído, público jovem adulto..."
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Observações extras</label>
                <textarea value={ia.observacoes}
                  onChange={e => setIa(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Ex: Não usar gírias, mencionar validade da promoção..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10 resize-none"
                />
              </div>

              {/* Imagem de referência do produto */}
              <div className="flex flex-col gap-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Imagem do produto <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <p className="text-xs text-slate-400 mt-0.5">
                    PNG com fundo transparente recomendado — a Designer usará como destaque na arte
                  </p>
                </div>
                <input
                  ref={refImagemRef}
                  type="file"
                  accept="image/*"
                  onChange={handleRefImagem}
                  className="hidden"
                />
                {!refImagemFile ? (
                  <button
                    type="button"
                    onClick={() => refImagemRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex items-center gap-4 hover:border-ze-orange hover:bg-ze-orange/5 transition-all text-slate-400 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-ze-orange/10 flex items-center justify-center flex-shrink-0 transition-colors">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-600">Adicionar imagem do produto</p>
                      <p className="text-xs mt-0.5">PNG, JPG, WEBP — ideal PNG com fundo transparente</p>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border-2 border-green-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={refImagemPreview} alt="Ref" className="w-16 h-16 rounded-lg object-contain bg-white border border-green-200 shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-green-800 truncate flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Imagem anexada
                      </p>
                      <p className="text-xs text-green-700 mt-0.5 truncate">{refImagemFile.name}</p>
                      <p className="text-[11px] text-green-600 mt-0.5">A Designer vai usar EXATAMENTE esta imagem do produto</p>
                    </div>
                    <button onClick={removeRefImagem} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          {gerando && (
            <Card>
              <CardContent>
                <div className="flex items-center gap-3 mb-3">
                  {progresso < 100
                    ? <StepIcon className="w-5 h-5 text-ze-blue animate-pulse" />
                    : <CheckCircle2 className="w-5 h-5 text-green-500" />
                  }
                  <span className="text-sm font-semibold text-slate-700">
                    {PROGRESS_STEPS[stepIdx]?.label}
                  </span>
                  <span className="ml-auto text-sm font-bold text-ze-blue">{progresso}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-ze-blue to-ze-orange rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progresso}%` }} />
                </div>
                <div className="flex gap-1.5 mt-3 overflow-hidden">
                  {PROGRESS_STEPS.map((s, i) => (
                    <div key={i} className={cn('flex-1 h-1 rounded-full transition-all duration-500',
                      i <= stepIdx ? 'bg-ze-blue' : 'bg-slate-100')} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {erroIA && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <strong>Erro ao gerar conteúdo:</strong> {erroIA}
            </div>
          )}

          {!gerando && (
            <div className="flex gap-3 justify-end">
              <Link href="/conteudos"><Button variant="ghost">Cancelar</Button></Link>
              <Button onClick={gerarComIA} disabled={!ia.descricao.trim() || !ia.redes.length} size="lg">
                <Send className="w-4 h-4" /> Enviar para o Squad
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── RESULTADO IA ─── */}
      {mode === 'ia' && resultado && (
        <div className="flex flex-col gap-8">
          {/* Success banner */}
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl">
            <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-green-800">Conteúdo gerado pelo squad! 🎉</p>
              <p className="text-sm text-green-600">Confira o criativo e o copy abaixo. O conteúdo já foi salvo para aprovação.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setResultado(null); setErroIA('') }}>
                Criar outro
              </Button>
              <Link href="/conteudos">
                <Button size="sm">
                  Ver conteúdos <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Tabs */}
          {resultado.designerHtml && (
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
              {[
                { key: 'art', label: '🎨 Criativo', show: !!resultado.designerHtml },
                { key: 'copy', label: '✍️ Copy', show: true },
                { key: 'all', label: '📋 Todos os agentes', show: true },
              ].filter(t => t.show).map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
                  className={cn('px-4 py-1.5 rounded-lg text-sm font-semibold transition-all',
                    activeTab === t.key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  )}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Art tab */}
          {(activeTab === 'art' || !resultado.designerHtml) && resultado.designerHtml && (() => {
            const cardArInfo = arInfo ?? { ratio: '1/1', label: '1:1', w: 1080, h: 1080 }
            const cardWidth = CARD_PREVIEW_WIDTH[ia.tipo] ?? 380
            return (
            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0" style={{ width: cardWidth }}>
                <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" /> Criativo — {cardArInfo.label}
                </p>
                <ArtCard html={resultado.designerHtml} arInfo={cardArInfo} artUrl={resultado.artUrl} />

                {/* Aprovar (destaque) + Refazer */}
                <div className="mt-5 flex flex-col gap-2.5">
                  <button
                    onClick={aprovarArte}
                    disabled={aprovando}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-60"
                  >
                    {aprovando
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Aprovando...</>
                      : <><ThumbsUp className="w-4 h-4" /> Aprovar arte</>
                    }
                  </button>
                  <button
                    onClick={() => { setShowAjuste(!showAjuste); setAjusteTexto('') }}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all',
                      showAjuste
                        ? 'border-ze-orange text-ze-orange bg-ze-orange/5'
                        : 'border-slate-200 text-slate-600 hover:border-ze-orange hover:text-ze-orange hover:bg-ze-orange/5'
                    )}
                  >
                    <RefreshCw className="w-4 h-4" /> Refazer arte
                  </button>
                </div>

                {showAjuste && (
                  <div className="mt-3 flex flex-col gap-2.5 p-4 bg-orange-50 border border-orange-100 rounded-xl">
                    <p className="text-xs font-semibold text-orange-700">Descreva os ajustes para a Designer:</p>
                    <textarea
                      value={ajusteTexto}
                      onChange={e => setAjusteTexto(e.target.value)}
                      placeholder="Ex: mude a cor do fundo para vermelho, deixe o preço maior, troque a foto por algo mais festivo..."
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg border border-orange-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-orange focus:ring-2 focus:ring-ze-orange/10 resize-none"
                    />
                    <Button
                      size="sm"
                      onClick={refazerArte}
                      loading={refazendo}
                      disabled={!ajusteTexto.trim()}
                      className="w-full"
                    >
                      {refazendo ? 'Refazendo...' : <><Send className="w-3.5 h-3.5" /> Enviar ajuste ao squad</>}
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Copy do Bruno Copywriter
                </p>
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                  {resultado.copyFinal}
                </div>
              </div>
            </div>
            )
          })()}

          {/* Copy tab */}
          {activeTab === 'copy' && (
            <Card>
              <CardContent>
                <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
                  <PenLine className="w-3.5 h-3.5" /> Copy gerado pelo squad
                </p>
                <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {resultado.copyFinal}
                </div>
              </CardContent>
            </Card>
          )}

          {/* All agents tab */}
          {activeTab === 'all' && (
            <div className="flex flex-col gap-4">
              {Object.entries(resultado.results).map(([role, text]) => {
                if (!text) return null
                const roleData = SQUAD_ROLES[role as keyof typeof SQUAD_ROLES]
                const isDesigner = role === 'designer'
                return (
                  <Card key={role}>
                    <CardContent>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                          style={{ backgroundColor: (roleData?.color ?? '#6b7280') + '20' }}>
                          {role === 'estrategista' ? '🧠' : role === 'copywriter' ? '✍️' : role === 'designer' ? '🎨' : role === 'pesquisador' ? '🔍' : role === 'revisora' ? '✅' : '🤖'}
                        </div>
                        <p className="text-sm font-bold" style={{ color: roleData?.color ?? '#6b7280' }}>
                          {roleData?.label ?? role}
                        </p>
                      </div>
                      {isDesigner ? (
                        <div className="text-xs text-slate-500 italic">
                          (HTML/CSS gerado — veja na aba Criativo)
                        </div>
                      ) : (
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-6">
                          {text}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── MODO UPLOAD ─── */}
      {mode === 'upload' && (
        <div className="grid grid-cols-[1fr_320px] gap-6">
          <div className="flex flex-col gap-5">
            <Card>
              <CardContent className="flex flex-col gap-5">
                <Input id="titulo" label="Título do conteúdo *" placeholder="Ex: Promo 30% off — Feed Instagram"
                  value={upload.titulo} onChange={e => setUpload(f => ({ ...f, titulo: e.target.value }))} />

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">Tipo de conteúdo *</label>
                    <select value={upload.tipo} onChange={e => setUpload(f => ({ ...f, tipo: e.target.value as ContentType }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10">
                      {Object.entries(CONTENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <Input id="scheduledAt" type="datetime-local" label="Agendar publicação"
                    value={upload.scheduledAt} onChange={e => setUpload(f => ({ ...f, scheduledAt: e.target.value }))} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Redes sociais *</label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(p => (
                      <button key={p} type="button" onClick={() => togglePlatform(p, 'upload' as Mode)}
                        className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                          upload.redes.includes(p) ? 'bg-ze-orange text-white border-ze-orange' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        )}>
                        {PLATFORM_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Arquivo do criativo</label>
                  <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile} className="hidden" />
                  {!mediaFile ? (
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-ze-orange hover:bg-ze-orange/5 transition-all text-slate-400">
                      <Upload className="w-8 h-8" />
                      <div className="text-center">
                        <p className="font-semibold text-sm text-slate-600">Clique para fazer upload</p>
                        <p className="text-xs mt-0.5">PNG, JPG, GIF, MP4 até 50MB</p>
                      </div>
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <ImageIcon className="w-5 h-5 text-ze-orange" />
                      <span className="text-sm text-slate-700 flex-1 truncate">{mediaFile.name}</span>
                      <button onClick={removeMedia} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {uploadError}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <Link href="/conteudos"><Button variant="ghost">Cancelar</Button></Link>
              <Button variant="secondary" onClick={salvarUpload} loading={salvando}
                disabled={!upload.titulo.trim()} size="lg">
                <Send className="w-4 h-4" />
                {upload.scheduledAt ? 'Agendar publicação' : 'Enviar para aprovação'}
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-700">Preview do criativo</p>
              <p className="text-xs text-slate-400">{arInfo?.label}</p>
            </div>
            <div className="relative w-full bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center"
              style={{ aspectRatio: arInfo?.ratio ?? '1/1' }}>
              {mediaPreview ? (
                mediaFile?.type.startsWith('video')
                  ? <video src={mediaPreview} controls className="w-full h-full object-cover" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-300">
                  <ImageIcon className="w-10 h-10" />
                  <p className="text-xs font-medium">Sem mídia</p>
                </div>
              )}
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                {arInfo?.label?.split('—')[0]?.trim()}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-600 mb-1.5">Tamanhos recomendados</p>
              {upload.tipo === 'stories' || upload.tipo === 'reels'
                ? <p className="text-xs text-slate-500">1080 × 1920 px (9:16)</p>
                : upload.tipo === 'post_instagram' || upload.tipo === 'carrossel'
                  ? <p className="text-xs text-slate-500">1080 × 1080 px (1:1)</p>
                  : upload.tipo === 'youtube' || upload.tipo === 'post_facebook'
                    ? <p className="text-xs text-slate-500">1280 × 720 px (16:9)</p>
                    : <p className="text-xs text-slate-500">1200 × 628 px (1.91:1)</p>
              }
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
