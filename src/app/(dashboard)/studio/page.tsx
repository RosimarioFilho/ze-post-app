'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CONTENT_TYPE_LABELS, CREATIVE_JOB_STATUS_LABELS, type CreativeJob, type CreativeJobStatus } from '@/types'
import {
  Upload, X, CheckCircle2, Loader2, AlertCircle, Download,
  Wand2, Star, ChevronDown, ChevronUp, RefreshCw, Sparkles, ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Pipeline steps (em ordem) ─────────────────────────────────
const PIPELINE_STEPS: CreativeJobStatus[] = [
  'bg_removing', 'analyzing', 'palette_extracting',
  'strategizing', 'copywriting', 'creative_directing',
  'prompt_engineering', 'generating_image', 'visual_review', 'done',
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
    <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl font-semibold text-sm">
      {msg}
    </div>
  )
}

// ── Score badge (escala 0-100) ────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-sm font-bold', color)}>
      <Star className="w-3.5 h-3.5" />
      {score} / 100
    </div>
  )
}

// ── Detectar transparência (Canvas API) ──────────────────────
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

  const [pageState, setPageState] = useState<PageState>('form')
  const [company, setCompany] = useState<Company | null>(null)
  const [contentType, setContentType] = useState<string>('post_instagram')
  const [briefing, setBriefing] = useState('')

  // Product image
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)
  const [productPreview, setProductPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [hasTransparentBg, setHasTransparentBg] = useState(false)

  // Reference image (style)
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null)
  const [referencePreview, setReferencePreview] = useState<string | null>(null)
  const [isUploadingRef, setIsUploadingRef] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<Partial<CreativeJob> | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const [showIssues, setShowIssues] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

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

  const handleImageUpload = async (file: File) => {
    if (!company) return
    setIsUploading(true)
    try {
      setProductPreview(URL.createObjectURL(file))
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

  const handleReferenceUpload = async (file: File) => {
    if (!company) return
    setIsUploadingRef(true)
    try {
      setReferencePreview(URL.createObjectURL(file))
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${company.id}/references/ref-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
        setReferenceImageUrl(publicUrl)
      }
    } finally {
      setIsUploadingRef(false)
    }
  }

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
          referenceImageUrl: referenceImageUrl ?? undefined,
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

  const handleApprove = async () => {
    if (!company || isApproving) return
    const imageUrl = job?.final_png_url ?? job?.generated_image_url
    if (!imageUrl) return
    const [W, H] = getSize(contentType)
    setIsApproving(true)
    try {
      const { data: content } = await supabase.from('contents').insert({
        company_id: company.id,
        title: `Studio: ${briefing.slice(0, 50)}`,
        body: job?.copy_output?.caption ?? briefing,
        content_type: contentType,
        platforms: [],
        status: 'pendente_aprovacao',
        media_urls: [imageUrl],
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

  const handleDownload = () => {
    const imageUrl = job?.final_png_url ?? job?.generated_image_url
    if (!imageUrl) return
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = `arte-studio-${Date.now()}.png`
    a.target = '_blank'
    a.click()
  }

  const currentStepIndex = job ? PIPELINE_STEPS.indexOf(job.status as CreativeJobStatus) : -1
  const critique = job?.critique
  const visualScore = job?.visual_score
  // final_png_url = composite com texto; generated_image_url = imagem crua sem texto
  const imageUrl = job?.final_png_url ?? job?.generated_image_url

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
              <p className="text-sm text-slate-500">Geração de imagens premium com IA — Gemini, Flux, Ideogram, DALL-E</p>
            </div>
          </div>
        </div>

        {/* ── Estado A: Formulário ── */}
        {pageState === 'form' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-5">
              {/* Upload produto */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="font-bold text-slate-800 mb-3">Imagem do produto (opcional)</h2>
                {productPreview ? (
                  <div className="relative">
                    <img src={productPreview} alt="produto" className="w-full h-48 object-contain rounded-xl bg-slate-50 border border-slate-200" />
                    <button
                      onClick={() => { setProductImageUrl(null); setProductPreview(null); setHasTransparentBg(false) }}
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
                            <CheckCircle2 className="w-3 h-3" /> Fundo já transparente
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
                      <p className="text-xs text-slate-400 mt-1">Produto será incluído na imagem gerada</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }} />
                  </label>
                )}
              </div>

              {/* Upload referência de estilo */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="font-bold text-slate-800 mb-1">Referência de estilo (opcional)</h2>
                <p className="text-xs text-slate-400 mb-3">A IA vai extrair o estilo visual desta imagem</p>
                {referencePreview ? (
                  <div className="relative">
                    <img src={referencePreview} alt="referência" className="w-full h-32 object-cover rounded-xl bg-slate-50 border border-slate-200" />
                    <button
                      onClick={() => { setReferenceImageUrl(null); setReferencePreview(null) }}
                      className="absolute top-2 right-2 bg-white rounded-full p-1 shadow border border-slate-200 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                    {isUploadingRef && (
                      <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-ze-blue" />
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center hover:border-ze-blue hover:bg-ze-blue/5 transition-colors">
                      <ImageIcon className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                      <p className="text-xs text-slate-500">Adicionar imagem de referência</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleReferenceUpload(f) }} />
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
                  <p className="text-sm font-bold text-slate-800">Pipeline de 10 agentes especializados</p>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
                  {([
                    'Vision Analyzer', 'Background Remover', 'Palette Intelligence', 'Estrategista',
                    'Copywriter', 'Diretor Criativo IA', 'Prompt Engineer', 'Image Generation IA',
                    'Crítico Visual', 'Refinamento IA',
                  ] as const).map(a => (
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
                {isSubmitting ? 'Iniciando...' : 'Gerar Imagem Premium'}
              </button>
            </div>
          </div>
        )}

        {/* ── Estado B: Pipeline ── */}
        {pageState === 'pipeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="font-bold text-slate-800 mb-1">Agentes trabalhando...</h2>
              <p className="text-sm text-slate-400 mb-5">Acompanhe em tempo real</p>

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
                      <p className={cn(
                        'text-sm font-medium',
                        isActive ? 'text-ze-blue' : isDone ? 'text-slate-500' : 'text-slate-400'
                      )}>
                        {info.emoji} {info.label}
                      </p>
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
              {imageUrl ? (
                <div className="bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center">
                  <img src={imageUrl} alt="arte gerada" className="max-w-full max-h-96 object-contain" onError={e => { const fb = job?.generated_image_url; if (fb && e.currentTarget.src !== fb) e.currentTarget.src = fb }} />
                </div>
              ) : (
                <div className="aspect-square bg-slate-50 rounded-xl flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                  <p className="text-sm text-slate-400">Gerando sua imagem...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Estado C: Revisão ── */}
        {pageState === 'review' && job && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Imagem gerada */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-slate-800">Imagem gerada</h2>
                    <div className="flex items-center gap-2">
                      {visualScore !== undefined && <ScoreBadge score={visualScore} />}
                      {job.image_provider && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                          {job.image_provider}
                        </span>
                      )}
                    </div>
                  </div>

                  {imageUrl ? (
                    <img src={imageUrl} alt="arte gerada" className="w-full rounded-xl shadow-sm" onError={e => { const fb = job?.generated_image_url; if (fb && e.currentTarget.src !== fb) e.currentTarget.src = fb }} />
                  ) : (
                    <div className="aspect-square bg-slate-100 rounded-xl flex items-center justify-center">
                      <p className="text-slate-400 text-sm">Imagem não disponível</p>
                    </div>
                  )}

                  {/* Retry info */}
                  {(job.retry_count ?? 0) > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <RefreshCw className="w-3.5 h-3.5" />
                      {job.retry_count} refinamento{(job.retry_count ?? 0) > 1 ? 's' : ''} automático{(job.retry_count ?? 0) > 1 ? 's' : ''} aplicado{(job.retry_count ?? 0) > 1 ? 's' : ''}
                    </div>
                  )}

                  {/* Crítica */}
                  {critique && (critique.issues as unknown[])?.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => setShowIssues(v => !v)}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
                      >
                        {showIssues ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {(critique.issues as unknown[]).length} pontos detectados
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
                      {job.copy_output.caption && (
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Caption</p>
                          <p className="text-xs text-slate-500 leading-relaxed">{job.copy_output.caption}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Brief criativo */}
                {job.creative_brief && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-bold text-slate-800 mb-3">Brief Criativo</h3>
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex flex-wrap gap-1 mb-2">
                        <span className="bg-ze-blue/10 text-ze-blue font-semibold px-2 py-0.5 rounded-full">
                          {job.creative_brief.archetype}
                        </span>
                        <span className={cn(
                          'font-semibold px-2 py-0.5 rounded-full',
                          job.creative_brief.content_safety === 'safe_for_all'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-orange-50 text-orange-700'
                        )}>
                          {job.creative_brief.content_safety === 'safe_for_all' ? 'safe for all' : 'adult'}
                        </span>
                      </div>
                      <p><span className="font-medium text-slate-700">Emoção:</span> {job.creative_brief.campaign_emotion}</p>
                      <p><span className="font-medium text-slate-700">Estilo:</span> {job.creative_brief.visual_style}</p>
                      <p><span className="font-medium text-slate-700">Foto:</span> {job.creative_brief.photography_style}</p>
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                  <button
                    onClick={handleApprove}
                    disabled={isApproving || !imageUrl}
                    className="w-full py-3 rounded-xl bg-green-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-600 transition-colors disabled:opacity-60"
                  >
                    {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {isApproving ? 'Aprovando...' : 'Aprovar Arte'}
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={!imageUrl}
                    className="w-full py-3 rounded-xl bg-ze-blue text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Imagem
                  </button>

                  <button
                    onClick={() => { setPageState('form'); setJob(null); setJobId(null) }}
                    className="w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Gerar nova arte
                  </button>
                </div>
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
