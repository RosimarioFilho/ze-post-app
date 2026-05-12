'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CONTENT_TYPE_LABELS, CREATIVE_JOB_STATUS_LABELS, type CreativeJob, type CreativeJobStatus } from '@/types'
import {
  Upload, X, CheckCircle2, Loader2, AlertCircle, Download,
  Wand2, Star, ChevronDown, ChevronUp, RefreshCw, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Pipeline steps (em ordem) ─────────────────────────────────
const PIPELINE_STEPS: CreativeJobStatus[] = [
  'bg_removing', 'analyzing', 'palette_extracting',
  'strategizing', 'copywriting', 'art_directing',
  'designing', 'rendering', 'critiquing', 'done',
]

type PageState = 'form' | 'pipeline' | 'review'

interface Company {
  id: string
  name: string
  primary_color: string
  secondary_color: string
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl font-semibold text-sm animate-fade-in-up">
      {msg}
    </div>
  )
}

// ── Art preview (iframe scaled) ───────────────────────────────
function ArtPreview({ html, width, height, className }: { html: string; width: number; height: number; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const cw = containerRef.current.clientWidth
      const ch = containerRef.current.clientHeight
      const sw = cw / width
      const sh = ch / height
      setScale(Math.min(sw, sh, 1))
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [width, height])

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden bg-slate-100 rounded-xl', className)}>
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: '50%',
          left: '50%',
          marginTop: -height * scale / 2,
          marginLeft: -width * scale / 2,
        }}
      >
        <iframe
          srcDoc={html}
          style={{ width, height, border: 'none', display: 'block' }}
          sandbox="allow-same-origin"
          title="arte-preview"
        />
      </div>
    </div>
  )
}

// ── Score badge ───────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? 'bg-green-500' : score >= 6 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-sm font-bold', color)}>
      <Star className="w-3.5 h-3.5" />
      {score.toFixed(1)} / 10
    </div>
  )
}

// ── Detectar transparência (Canvas API, client-side) ──────────
async function detectarTransparencia(file: File): Promise<boolean> {
  if (!file.type.includes('png')) return false
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(bitmap.width, 200)
    canvas.height = Math.min(bitmap.height, 200)
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true
    }
    return false
  } catch {
    return false
  }
}

// ── Main Page ─────────────────────────────────────────────────
export default function StudioPage() {
  const supabase = createClient()
  const router = useRouter()

  // State
  const [pageState, setPageState] = useState<PageState>('form')
  const [company, setCompany] = useState<Company | null>(null)
  const [contentType, setContentType] = useState<string>('post_instagram')
  const [briefing, setBriefing] = useState('')
  const [productImage, setProductImage] = useState<File | null>(null)
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)
  const [productPreview, setProductPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasTransparentBg, setHasTransparentBg] = useState(false)

  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<Partial<CreativeJob> | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const [ajusteText, setAjusteText] = useState('')
  const [showAjuste, setShowAjuste] = useState(false)
  const [isAjusting, setIsAjusting] = useState(false)
  const [showIssues, setShowIssues] = useState(false)

  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [isApproving, setIsApproving] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Load company
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('company_id').eq('id', user.id).single().then(({ data }) => {
        if (!data?.company_id) return
        supabase.from('companies').select('id, name, primary_color, secondary_color').eq('id', data.company_id).single().then(({ data: c }) => {
          if (c) setCompany(c)
        })
      })
    })
  }, [])

  // Upload product image to Supabase storage
  const handleImageUpload = async (file: File) => {
    if (!company) return
    setIsUploading(true)
    try {
      const preview = URL.createObjectURL(file)
      setProductPreview(preview)
      setProductImage(file)

      // Detectar transparência antes de enviar
      const transparent = await detectarTransparencia(file)
      setHasTransparentBg(transparent)

      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${company.id}/ref-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
        setProductImageUrl(publicUrl)
      }
    } finally {
      setIsUploading(false)
    }
  }

  // Poll job status
  const pollJob = useCallback(async (id: string) => {
    const res = await fetch(`/api/studio/job-status?id=${id}`)
    if (!res.ok) return
    const data: Partial<CreativeJob> = await res.json()
    setJob(data)

    if (data.status === 'done') {
      setPageState('review')
      if (pollingRef.current) clearInterval(pollingRef.current)
    } else if (data.status === 'failed') {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  // Start generation
  const handleGenerate = async () => {
    if (!company || !briefing.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/studio/gerar-arte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          contentType,
          briefing,
          productImageUrl: productImageUrl ?? undefined,
          hasTransparentBg,
        }),
      })
      const { jobId: id } = await res.json()
      if (!id) throw new Error('Falha ao criar job')
      setJobId(id)
      setPageState('pipeline')
      pollingRef.current = setInterval(() => pollJob(id), 1500)
    } catch (err) {
      console.error(err)
      alert('Erro ao iniciar geração. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current) }, [])

  // Approve art
  const handleApprove = async () => {
    if (!company || !job?.final_html || isApproving) return
    const [W, H] = getSize(contentType)
    setIsApproving(true)
    try {
      const { data: content } = await supabase.from('contents').insert({
        company_id: company.id,
        title: `Studio: ${briefing.slice(0, 50)}`,
        body: job.copy_output?.caption ?? briefing,
        content_type: contentType,
        platforms: [],
        status: 'pendente_aprovacao',
        media_urls: job.final_png_url ? [job.final_png_url] : [],
        art_html: job.final_html,
        art_width: W,
        art_height: H,
      }).select('id').single()

      if (content?.id) {
        await supabase.from('approvals').insert({
          content_id: content.id,
          company_id: company.id,
          status: 'pendente',
        })
        await supabase.from('creative_jobs').update({ content_id: content.id }).eq('id', jobId)
        setToastMsg('Arte aprovada! Já está na biblioteca.')
        setTimeout(() => {
          setToastMsg(null)
          router.push('/conteudos')
        }, 1800)
      }
    } finally {
      setIsApproving(false)
    }
  }

  // Download PNG
  const handleDownload = async () => {
    if (!job?.final_html || isDownloading) return
    const [W, H] = getSize(contentType)
    setIsDownloading(true)
    setDownloadError(null)
    try {
      const res = await fetch('/api/arte-png', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: job.final_html, width: W, height: H }),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Erro desconhecido')
        setDownloadError('Falha ao gerar PNG. Tente novamente.')
        console.error('[studio] download error:', errText)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `arte-studio-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[studio] download error:', err)
      setDownloadError('Falha ao gerar PNG. Tente novamente.')
    } finally {
      setIsDownloading(false)
    }
  }

  // Adjust art
  const handleAjuste = async () => {
    if (!ajusteText.trim() || !job?.final_html) return
    setIsAjusting(true)
    try {
      const res = await fetch('/api/gerar-conteudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: contentType,
          ajuste: ajusteText,
          htmlAnterior: job.final_html,
          copyAnterior: job.copy_output ? `${job.copy_output.headline}\n${job.copy_output.subline}` : '',
          refImagemUrl: productImageUrl,
          companyId: company?.id,
        }),
      })
      const data = await res.json()
      if (data.designerHtml) {
        setJob(prev => prev ? { ...prev, final_html: data.designerHtml } : prev)
        setShowAjuste(false)
        setAjusteText('')
      }
    } finally {
      setIsAjusting(false)
    }
  }

  const [W, H] = getSize(contentType)
  const critique = job?.critique
  const currentStepIndex = job ? PIPELINE_STEPS.indexOf(job.status as CreativeJobStatus) : -1

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {toastMsg && <Toast msg={toastMsg} />}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ze-blue to-ze-orange flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Studio IA</h1>
              <p className="text-sm text-slate-500">Geração de artes premium com 10 agentes especializados</p>
            </div>
          </div>
        </div>

        {/* ── Estado A: Formulário ── */}
        {pageState === 'form' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna esquerda */}
            <div className="space-y-5">
              {/* Upload de imagem */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="font-bold text-slate-800 mb-3">Imagem do produto (opcional)</h2>
                {productPreview ? (
                  <div className="relative">
                    <img src={productPreview} alt="produto" className="w-full h-48 object-contain rounded-xl bg-slate-50 border border-slate-200" />
                    <button
                      onClick={() => { setProductImage(null); setProductImageUrl(null); setProductPreview(null); setHasTransparentBg(false) }}
                      className="absolute top-2 right-2 bg-white rounded-full p-1 shadow border border-slate-200 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                    {isUploading && (
                      <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-ze-blue" />
                      </div>
                    )}
                    {!isUploading && (
                      <div className="mt-2">
                        {hasTransparentBg ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Fundo já transparente — remoção pulada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                            <Sparkles className="w-3 h-3" /> Fundo será removido automaticamente
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-ze-blue hover:bg-ze-blue/5 transition-colors">
                      <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Clique para enviar PNG, JPG ou WEBP</p>
                      <p className="text-xs text-slate-400 mt-1">O background será removido automaticamente</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }}
                    />
                  </label>
                )}
              </div>

              {/* Tipo de conteúdo */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="font-bold text-slate-800 mb-3">Formato</h2>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(CONTENT_TYPE_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setContentType(key)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm font-medium border transition-colors text-left',
                        contentType === key
                          ? 'bg-ze-blue text-white border-ze-blue'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-ze-blue hover:text-ze-blue'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Coluna direita */}
            <div className="space-y-5">
              {/* Briefing */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="font-bold text-slate-800 mb-1">Briefing da arte</h2>
                <p className="text-xs text-slate-400 mb-3">Descreva o produto, oferta, público e objetivo</p>
                <textarea
                  value={briefing}
                  onChange={e => setBriefing(e.target.value)}
                  placeholder="Ex: Promoção de fim de semana da nossa pizza grande por R$49,90. Público: famílias da região. Objetivo: aumentar pedidos no delivery no sábado..."
                  rows={8}
                  className="w-full text-sm text-slate-700 border border-slate-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ze-blue/30 focus:border-ze-blue"
                />
              </div>

              {/* Agents info */}
              <div className="bg-gradient-to-br from-ze-blue/5 to-ze-orange/5 rounded-2xl border border-ze-blue/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-ze-orange" />
                  <p className="text-sm font-bold text-slate-800">10 agentes vão trabalhar na sua arte</p>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
                  {(['Vision Analyzer', 'Background Remover', 'Palette Intelligence', 'Estrategista', 'Copywriter', 'Diretor de Arte', 'Designer HTML/CSS', 'Render Engine', 'Crítico Visual', 'Autocorreção IA'] as const).map(a => (
                    <div key={a} className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-ze-blue/40" />
                      {a}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isSubmitting || !briefing.trim() || !company || isUploading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-ze-blue to-ze-orange text-white font-black text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                {isSubmitting ? 'Iniciando...' : 'Gerar Arte Premium'}
              </button>
            </div>
          </div>
        )}

        {/* ── Estado B: Pipeline ── */}
        {pageState === 'pipeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pipeline steps */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="font-bold text-slate-800 mb-1">Agentes trabalhando...</h2>
              <p className="text-sm text-slate-400 mb-5">Acompanhe em tempo real</p>

              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full mb-6 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-ze-blue to-ze-orange rounded-full transition-all duration-500"
                  style={{ width: `${job?.progress_pct ?? 0}%` }}
                />
              </div>

              <div className="space-y-2">
                {PIPELINE_STEPS.filter(s => s !== 'done').map((step, idx) => {
                  const isDone = currentStepIndex > idx || job?.status === 'done'
                  const isActive = job?.status === step || (step === 'bg_removing' && job?.status === 'pending')
                  const isFailed = job?.status === 'failed' && isActive
                  const info = CREATIVE_JOB_STATUS_LABELS[step]

                  return (
                    <div key={step} className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                      isActive && !isFailed ? 'bg-ze-blue/5 border border-ze-blue/20' : '',
                      isDone ? 'opacity-60' : '',
                    )}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                        {isFailed ? <AlertCircle className="w-5 h-5 text-red-500" /> :
                          isDone ? <CheckCircle2 className="w-5 h-5 text-green-500" /> :
                            isActive ? <Loader2 className="w-5 h-5 animate-spin text-ze-blue" /> :
                              <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium truncate',
                          isActive ? 'text-ze-blue' : isDone ? 'text-slate-500' : 'text-slate-400'
                        )}>
                          {info.emoji} {info.label}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {job?.status === 'failed' && (
                <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-sm text-red-600 font-medium">{job.error_message ?? 'Erro desconhecido'}</p>
                  <button onClick={() => setPageState('form')} className="mt-2 text-xs text-red-500 underline">Tentar novamente</button>
                </div>
              )}
            </div>

            {/* Preview em tempo real */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="font-bold text-slate-800 mb-4">Preview</h2>
              {job?.rendered_png_url || job?.final_png_url ? (
                <div className="aspect-square bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center">
                  <img
                    src={job.final_png_url ?? job.rendered_png_url}
                    alt="arte"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="aspect-square bg-slate-50 rounded-xl flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                  <p className="text-sm text-slate-400">Gerando sua arte...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Estado C: Revisão ── */}
        {pageState === 'review' && job && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Preview da arte */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-slate-800">Arte gerada</h2>
                    {critique && <ScoreBadge score={critique.score as number} />}
                  </div>

                  {job.final_html ? (
                    <div style={{ aspectRatio: `${W}/${H}`, maxHeight: '480px' }}>
                    <ArtPreview html={job.final_html} width={W} height={H} className="w-full h-full" />
                  </div>
                  ) : job.final_png_url ? (
                    <img src={job.final_png_url} alt="arte" className="w-full rounded-xl" />
                  ) : null}

                  {/* Crítica */}
                  {critique && (critique.issues as unknown[])?.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => setShowIssues(v => !v)}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
                      >
                        {showIssues ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {(critique.issues as unknown[]).length} pontos de melhoria detectados
                      </button>
                      {showIssues && (
                        <div className="mt-3 space-y-2">
                          {(critique.issues as Array<{ rule: string; severity: string; suggestion: string }>).map((issue, i) => (
                            <div key={i} className={cn(
                              'flex gap-2 p-2 rounded-lg text-xs',
                              issue.severity === 'high' ? 'bg-red-50 text-red-700' :
                                issue.severity === 'medium' ? 'bg-yellow-50 text-yellow-700' : 'bg-slate-50 text-slate-600'
                            )}>
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                              <span><strong>{issue.rule}:</strong> {issue.suggestion}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Painel lateral */}
              <div className="lg:col-span-2 space-y-4">
                {/* Copy */}
                {job.copy_output && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-bold text-slate-800 mb-3">Copy gerado</h3>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Headline</p>
                        <p className="text-sm font-bold text-slate-800">{job.copy_output.headline}</p>
                      </div>
                      {job.copy_output.subline && (
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Subline</p>
                          <p className="text-sm text-slate-600">{job.copy_output.subline}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">CTA</p>
                        <p className="text-sm font-bold text-ze-orange">{job.copy_output.cta}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Correções */}
                {(job.correction_attempts ?? 0) > 0 && (
                  <div className="bg-blue-50 rounded-xl border border-blue-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-blue-500" />
                      <p className="text-xs text-blue-700 font-medium">
                        {job.correction_attempts} autocorreção{(job.correction_attempts ?? 0) > 1 ? 'ões' : ''} aplicada{(job.correction_attempts ?? 0) > 1 ? 's' : ''} automaticamente
                      </p>
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                  <button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="w-full py-3 rounded-xl bg-green-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-600 transition-colors disabled:opacity-60"
                  >
                    {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {isApproving ? 'Aprovando...' : 'Aprovar Arte'}
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="w-full py-3 rounded-xl bg-ze-blue text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isDownloading ? 'Gerando PNG...' : 'Download PNG'}
                  </button>

                  {downloadError && (
                    <p className="text-xs text-red-500 font-medium text-center">{downloadError}</p>
                  )}

                  <button
                    onClick={() => setShowAjuste(v => !v)}
                    className="w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Ajustar Arte
                  </button>

                  {showAjuste && (
                    <div className="space-y-2">
                      <textarea
                        value={ajusteText}
                        onChange={e => setAjusteText(e.target.value)}
                        placeholder="Ex: Deixe o fundo mais escuro, aumente a headline..."
                        rows={3}
                        className="w-full text-sm border border-slate-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ze-blue/30"
                      />
                      <button
                        onClick={handleAjuste}
                        disabled={isAjusting || !ajusteText.trim()}
                        className="w-full py-2 rounded-xl bg-ze-orange text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isAjusting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        {isAjusting ? 'Ajustando...' : 'Aplicar Ajuste'}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => { setPageState('form'); setJob(null); setJobId(null) }}
                  className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ← Gerar nova arte
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getSize(contentType: string): [number, number] {
  const sizes: Record<string, [number, number]> = {
    post_instagram: [1080, 1080],
    post_facebook: [1080, 566],
    post_linkedin_imagem: [1200, 627],
    post_linkedin_texto: [1080, 1080],
    stories: [1080, 1920],
    carrossel: [1080, 1080],
    youtube: [1280, 720],
    reels: [1080, 1920],
  }
  return sizes[contentType] ?? [1080, 1080]
}
