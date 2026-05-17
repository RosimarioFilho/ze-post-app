'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, Sparkles, Download, X, ImageIcon,
  ChevronLeft, ChevronRight, CheckCircle2, RotateCcw,
  ThumbsDown, Calendar, Send, Loader2, Wand2,
} from 'lucide-react'
import { SOCIAL_FORMATS, type SocialFormatId } from '@/lib/social-formats'
import { createClient } from '@/lib/supabase/client'

// ── Paleta Ze Post ───────────────────────────────────────────────
const C = {
  navy:   '#052D64',   // fundo header / botão primário
  blue:   '#0A3D8E',   // acentos secundários
  orange: '#FE7902',   // CTAs, destaques
  light:  '#F2F2F2',   // fundo da página
  white:  '#FFFFFF',   // fundo dos cards
  border: '#E2EAF4',   // bordas delicadas
  muted:  '#6B84A3',   // texto secundário
  text:   '#1A3558',   // texto principal dos cards
} as const

// ── Tipos ────────────────────────────────────────────────────────

interface SlideResult {
  index:       number
  imageBase64: string
  mimeType:    string
  provider:    string
}

interface GenerateResult {
  isCarousel:   boolean
  imageBase64?: string
  mimeType?:    string
  provider?:    string
  slides?:      SlideResult[]
  formatId?:    SocialFormatId
  formatLabel?: string
  hasLogo?:     boolean
  companyName?: string | null
}

interface UploadedImage {
  base64:  string
  mime:    string
  preview: string
  name:    string
}

// ── Helpers ──────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getAspectClass(formatId: SocialFormatId): string {
  const f = SOCIAL_FORMATS[formatId]
  if (!f) return 'aspect-square'
  if (f.genW === f.genH) return 'aspect-square'
  if (f.genH > f.genW)   return 'aspect-[9/16]'
  return 'aspect-video'
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

const FORMAT_OPTIONS = Object.values(SOCIAL_FORMATS)

const LOADING_MESSAGES = [
  'Zé Post está criando sua arte...',
  'Compondo arte com identidade visual...',
  'Adicionando logomarca e elementos...',
  'Finalizando criativo premium...',
]
const CAROUSEL_LOADING = [
  'Gerando 3 slides em paralelo...',
  'Criando abertura impactante...',
  'Desenvolvendo conteúdo dos slides...',
  'Montando chamada para ação...',
]

// ── Card wrapper ─────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background:   C.white,
  border:       `1px solid ${C.border}`,
  borderRadius: 16,
  padding:      20,
}

// ── Input style ──────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width:        '100%',
  background:   '#F8FAFD',
  border:       `1px solid ${C.border}`,
  borderRadius: 10,
  padding:      '10px 14px',
  fontSize:     14,
  color:        C.navy,
  outline:      'none',
}

// ── Upload Zone ──────────────────────────────────────────────────

function UploadZone({ label, hint, image, onUpload, onRemove }: {
  label: string; hint: string
  image: UploadedImage | null
  onUpload: (img: UploadedImage) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const base64  = await fileToBase64(file)
    const preview = URL.createObjectURL(file)
    onUpload({ base64, mime: file.type, preview, name: file.name })
  }, [onUpload])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }, [handleFile])

  if (image) {
    return (
      <div className="relative rounded-xl overflow-hidden group"
        style={{ border: `1px solid ${C.border}` }}>
        <img src={image.preview} alt={label} className="w-full h-32 object-cover" />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button onClick={onRemove}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium"
            style={{ background: 'rgba(220,38,38,0.85)' }}>
            <X className="w-3.5 h-3.5" /> Remover
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5"
          style={{ background: 'rgba(5,45,100,0.80)' }}>
          <p className="text-xs truncate text-white/70">{image.name}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className="flex flex-col items-center justify-center gap-2 h-32 rounded-xl border-2 border-dashed cursor-pointer transition-all"
      style={{
        borderColor: dragging ? C.orange : C.border,
        background:  dragging ? `${C.orange}08` : '#F8FAFD',
      }}
    >
      <Upload className="w-5 h-5" style={{ color: dragging ? C.orange : C.muted }} />
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: C.text }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: C.muted }}>{hint}</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}

// ── Loading Card ──────────────────────────────────────────────────

function LoadingCard({ msgIndex, formatId }: { msgIndex: number; formatId: SocialFormatId }) {
  const isCarousel = formatId === 'INSTAGRAM_CAROUSEL'
  const messages   = isCarousel ? CAROUSEL_LOADING : LOADING_MESSAGES
  const aspectCls  = getAspectClass(formatId)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}`, background: C.white }}>
      {/* Imagem dark enquanto gera */}
      <div className={`relative w-full ${isCarousel ? 'aspect-square' : aspectCls} flex flex-col items-center justify-center gap-4`}
        style={{ background: C.navy }}>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 animate-shimmer"
            style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)` }} />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: `${C.orange}20` }}>
              <Wand2 className="w-8 h-8 animate-pulse" style={{ color: C.orange }} />
            </div>
            <div className="absolute inset-0 rounded-2xl animate-ping"
              style={{ border: `2px solid ${C.orange}50` }} />
          </div>
          <p className="text-sm text-center px-6 text-white/60">
            {messages[msgIndex % messages.length]}
          </p>
        </div>
      </div>
      {/* Progress bar */}
      <div className="px-4 py-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span style={{ color: C.muted }}>
            {isCarousel ? 'Gerando 3 slides com Zé Post' : 'Gerando arte com Zé Post'}
          </span>
          <span className="animate-pulse font-semibold" style={{ color: C.orange }}>IA</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
          <div className="h-full rounded-full animate-progress"
            style={{ background: `linear-gradient(90deg, ${C.orange}, #FF9A3C)` }} />
        </div>
      </div>
    </div>
  )
}

// ── Slide Viewer ──────────────────────────────────────────────────

function SlideViewer({ slides, currentSlide, onSlideChange }: {
  slides: SlideResult[]
  currentSlide: number
  onSlideChange: (i: number) => void
}) {
  const slide = slides[currentSlide]
  if (!slide) return null
  const dataUrl = `data:${slide.mimeType};base64,${slide.imageBase64}`

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}`, background: C.white }}>
      <div className="relative aspect-square w-full">
        <img src={dataUrl} alt={`Slide ${currentSlide + 1}`} className="w-full h-full object-cover" />

        {/* Provider */}
        <div className="absolute top-3 right-3">
          <span className="px-2 py-1 rounded-lg text-xs backdrop-blur font-medium"
            style={{ background: 'rgba(5,45,100,0.75)', color: 'rgba(255,255,255,0.75)', border: `1px solid rgba(255,255,255,0.15)` }}>
            {slide.provider}
          </span>
        </div>

        {/* Slide badge */}
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold"
            style={{ background: C.orange, color: C.navy }}>
            Slide {currentSlide + 1} / {slides.length}
          </span>
        </div>

        {/* Arrows */}
        {slides.length > 1 && (
          <>
            <button onClick={() => onSlideChange(Math.max(0, currentSlide - 1))}
              disabled={currentSlide === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur transition-opacity disabled:opacity-25"
              style={{ background: 'rgba(5,45,100,0.80)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <button onClick={() => onSlideChange(Math.min(slides.length - 1, currentSlide + 1))}
              disabled={currentSlide === slides.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur transition-opacity disabled:opacity-25"
              style={{ background: 'rgba(5,45,100,0.80)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {slides.length > 1 && (
        <div className="flex justify-center gap-2 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => onSlideChange(i)}
              className="rounded-full transition-all duration-200"
              style={{
                width:      i === currentSlide ? 20 : 8,
                height:     8,
                background: i === currentSlide ? C.orange : C.border,
              }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Approve Modal ─────────────────────────────────────────────────

function ApproveModal({ onPublish, onSchedule, onClose }: {
  onPublish: () => void
  onSchedule: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,45,100,0.60)', backdropFilter: 'blur(10px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-7 space-y-5 shadow-2xl"
        style={{ background: C.white, border: `1px solid ${C.border}` }}>

        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: `${C.orange}15` }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: C.orange }} />
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-xl font-bold" style={{ color: C.navy }}>Arte Aprovada! 🎉</h3>
          <p className="text-sm mt-1.5" style={{ color: C.muted }}>
            Sua arte foi salva na biblioteca. O que deseja fazer agora?
          </p>
        </div>

        <div className="space-y-2.5">
          <button onClick={onPublish}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-90"
            style={{ background: C.orange, color: C.white }}>
            <Send className="w-4 h-4" /> Publicar Agora
          </button>
          <button onClick={onSchedule}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-90"
            style={{ background: C.navy, color: C.white }}>
            <Calendar className="w-4 h-4" /> Agendar Publicação
          </button>
          <button onClick={onClose}
            className="w-full py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: C.muted }}>
            Continuar criando
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Confetti ──────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#FE7902', '#052D64', '#0A3D8E', '#FFD166', '#FFFFFF', '#FF6B6B', '#4ECDC4']

interface ConfettiPiece {
  id:    number
  x:     number   // % from left
  delay: number   // s
  dur:   number   // s
  color: string
  size:  number   // px
  rot:   number   // initial rotation deg
  shape: 'rect' | 'circle' | 'ribbon'
}

function generatePieces(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id:    i,
    x:     Math.random() * 100,
    delay: Math.random() * 0.8,
    dur:   1.8 + Math.random() * 1.4,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size:  6 + Math.floor(Math.random() * 8),
    rot:   Math.floor(Math.random() * 360),
    shape: (['rect', 'circle', 'ribbon'] as const)[Math.floor(Math.random() * 3)],
  }))
}

function ConfettiOverlay({ onDone }: { onDone: () => void }) {
  const [pieces] = useState<ConfettiPiece[]>(() => generatePieces(90))

  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden" aria-hidden="true">
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position:         'absolute',
            left:             `${p.x}%`,
            top:              '-20px',
            width:            p.shape === 'ribbon' ? p.size * 0.4 : p.size,
            height:           p.shape === 'ribbon' ? p.size * 2.5 : p.size,
            borderRadius:     p.shape === 'circle' ? '50%' : p.shape === 'ribbon' ? 2 : 2,
            background:       p.color,
            transform:        `rotate(${p.rot}deg)`,
            animationName:    'confettiFall',
            animationDuration:       `${p.dur}s`,
            animationDelay:          `${p.delay}s`,
            animationTimingFunction: 'ease-in',
            animationFillMode:       'forwards',
          }}
        />
      ))}
    </div>
  )
}

// ── Label helper ──────────────────────────────────────────────────

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold tracking-wide" style={{ color: C.navy }}>
      {children}
    </h2>
  )
}

// ── Página principal ──────────────────────────────────────────────

export default function ZePremiumPage() {
  const router = useRouter()

  const [productImage,  setProductImage]  = useState<UploadedImage | null>(null)
  const [formatId,      setFormatId]      = useState<SocialFormatId>('INSTAGRAM_POST')
  const [description,   setDescription]   = useState('')

  const [loading,   setLoading]   = useState(false)
  const [msgIndex,  setMsgIndex]  = useState(0)
  const [result,    setResult]    = useState<GenerateResult | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  const [currentSlide, setCurrentSlide] = useState(0)

  const [saving,       setSaving]       = useState(false)
  const [approveModal, setApproveModal] = useState(false)

  const [refazerMode,    setRefazerMode]    = useState(false)
  const [refazerText,    setRefazerText]    = useState('')
  const [refazerLoading, setRefazerLoading] = useState(false)

  const [showConfetti, setShowConfetti] = useState(false)

  const descRef     = useRef<HTMLTextAreaElement>(null)
  const refazerRef  = useRef<HTMLTextAreaElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (refazerMode) refazerRef.current?.focus()
  }, [refazerMode])

  // ── Gerar ────────────────────────────────────────────────────

  async function handleGenerate(overrideObjective?: string, overrideProduct?: string) {
    const obj = overrideObjective ?? description.trim()
    if (!obj) { setError('Descreva o que você quer criar.'); return }

    setLoading(true); setResult(null); setError(null)
    setMsgIndex(0); setCurrentSlide(0); setRefazerMode(false)
    intervalRef.current = setInterval(() => setMsgIndex(i => i + 1), 3500)

    try {
      const res = await fetch('/api/ze-premium/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective:          obj,
          formatId,
          productImageBase64: overrideProduct ?? productImage?.base64,
          productImageMime:   productImage?.mime,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha na geração')
      setResult(data as GenerateResult)
      setShowConfetti(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar. Tente novamente.')
    } finally {
      setLoading(false)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }

  // ── Refazer ──────────────────────────────────────────────────

  async function handleRefazer() {
    if (!refazerText.trim() || !result) return
    const currentBase64 = result.isCarousel
      ? result.slides?.[currentSlide]?.imageBase64
      : result.imageBase64
    if (!currentBase64) return

    setRefazerLoading(true); setError(null)
    try {
      const res = await fetch('/api/ze-premium/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective:          refazerText.trim(),
          formatId,
          productImageBase64: currentBase64,
          productImageMime:   result.isCarousel
            ? (result.slides?.[currentSlide]?.mimeType ?? 'image/png')
            : (result.mimeType ?? 'image/png'),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha ao refazer')
      const newResult = data as GenerateResult

      if (result.isCarousel && result.slides && newResult.imageBase64) {
        const newSlides = [...result.slides]
        newSlides[currentSlide] = {
          index:       currentSlide,
          imageBase64: newResult.imageBase64,
          mimeType:    newResult.mimeType ?? 'image/png',
          provider:    newResult.provider ?? 'gpt-image-2',
        }
        setResult({ ...result, slides: newSlides })
      } else {
        setResult(newResult)
      }
      setRefazerMode(false); setRefazerText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao refazer. Tente novamente.')
    } finally {
      setRefazerLoading(false)
    }
  }

  // ── Aprovar ──────────────────────────────────────────────────

  async function handleAprovar() {
    if (!result) return
    setSaving(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')
      const { data: profile } = await supabase
        .from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) throw new Error('Empresa não encontrada')

      const companyId = profile.company_id
      const timestamp = Date.now()
      const mediaUrls: string[] = []

      const imgs = result.isCarousel
        ? (result.slides ?? []).map(s => ({ base64: s.imageBase64, mimeType: s.mimeType, idx: s.index }))
        : [{ base64: result.imageBase64 ?? '', mimeType: result.mimeType ?? 'image/png', idx: 0 }]

      for (const img of imgs) {
        const ext  = img.mimeType.includes('png') ? 'png' : img.mimeType.includes('webp') ? 'webp' : 'jpg'
        const path = `${companyId}/ze-premium/${timestamp}-${img.idx}.${ext}`
        const blob = base64ToBlob(img.base64, img.mimeType)
        const { error: uploadErr } = await supabase.storage
          .from('media').upload(path, blob, { contentType: img.mimeType, upsert: true })
        if (uploadErr) throw new Error(`Upload: ${uploadErr.message}`)
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
        mediaUrls.push(publicUrl)
      }

      const res = await fetch('/api/ze-premium/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaUrls, description, formatId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')
      setApproveModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aprovar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // ── Reprovar ─────────────────────────────────────────────────

  function handleReprovar() {
    setResult(null); setDescription(''); setProductImage(null)
    setRefazerMode(false); setRefazerText(''); setError(null); setCurrentSlide(0)
    setTimeout(() => descRef.current?.focus(), 100)
  }

  // ── Download ─────────────────────────────────────────────────

  function handleDownload() {
    if (!result) return
    if (result.isCarousel && result.slides) {
      result.slides.forEach((s, i) => {
        const a = document.createElement('a')
        a.href = `data:${s.mimeType};base64,${s.imageBase64}`
        a.download = `ze-premium-slide-${i + 1}-${Date.now()}.png`; a.click()
      })
    } else if (result.imageBase64) {
      const a = document.createElement('a')
      a.href = `data:${result.mimeType ?? 'image/png'};base64,${result.imageBase64}`
      a.download = `ze-premium-${formatId}-${Date.now()}.png`; a.click()
    }
  }

  const canGenerate = !loading && !!description.trim()
  const currentFmt  = SOCIAL_FORMATS[formatId]
  const hasResult   = !!result

  return (
    <div className="min-h-screen" style={{ background: C.light }}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ background: C.navy, borderBottom: `3px solid ${C.orange}` }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/mascote-ze-post.webp"
            alt="Zé Post"
            className="w-14 h-14 object-contain flex-shrink-0"
            style={{ filter: 'drop-shadow(0 2px 10px rgba(254,121,2,0.4))' }}
          />
          <div>
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/logo-ze-post-dark.svg" alt="Zé Post" className="h-5 w-auto" />
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                style={{ background: C.orange, color: C.white }}>
                Premium ✦
              </span>
            </div>
            <p className="text-xs mt-1 font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Artes premium geradas por Zé Post
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

          {/* ── FORMULÁRIO ─────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Formato */}
            <div style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: `${C.orange}15` }}>
                  <span className="text-xs font-bold" style={{ color: C.orange }}>⊞</span>
                </div>
                <CardLabel>Formato da Arte</CardLabel>
                <span className="ml-auto text-xs font-semibold" style={{ color: C.orange }}>
                  {currentFmt.officialW}×{currentFmt.officialH}
                </span>
              </div>
              <select
                value={formatId}
                onChange={e => setFormatId(e.target.value as SocialFormatId)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {FORMAT_OPTIONS.map(f => (
                  <option key={f.id} value={f.id} style={{ background: C.white, color: C.navy }}>
                    {f.label} — {f.aspectRatio}
                  </option>
                ))}
              </select>
              {formatId === 'INSTAGRAM_CAROUSEL' && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: `${C.orange}08`, border: `1px solid ${C.orange}30` }}>
                  <span style={{ color: C.orange, fontSize: 15, lineHeight: 1 }}>⊞</span>
                  <p className="text-xs" style={{ color: C.navy }}>
                    Modo carrossel — serão gerados <strong>3 slides</strong> automaticamente:
                    abertura, desenvolvimento e CTA.
                  </p>
                </div>
              )}
            </div>

            {/* Produto */}
            <div style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: `${C.orange}15` }}>
                  <ImageIcon className="w-3.5 h-3.5" style={{ color: C.orange }} />
                </div>
                <CardLabel>Produto de referência</CardLabel>
                <span className="ml-auto text-xs" style={{ color: C.muted }}>opcional</span>
              </div>
              <UploadZone
                label="Upload do Produto"
                hint="PNG · JPG · WebP — herói visual da arte"
                image={productImage}
                onUpload={setProductImage}
                onRemove={() => setProductImage(null)}
              />
            </div>

            {/* Descrição */}
            <div style={{ ...cardStyle, border: `1.5px solid ${C.orange}50` }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: `${C.orange}15` }}>
                  <Sparkles className="w-3.5 h-3.5" style={{ color: C.orange }} />
                </div>
                <CardLabel>Descreva sua arte</CardLabel>
                <span className="ml-auto text-xs font-bold" style={{ color: C.orange }}>*</span>
              </div>
              <p className="text-xs mb-3" style={{ color: C.muted }}>
                Descreva em poucas palavras. O modelo gera copy, composição, tipografia e logomarca integrados.
              </p>
              <textarea
                ref={descRef}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={
                  formatId === 'INSTAGRAM_CAROUSEL'
                    ? 'Ex: Carrossel para lançamento da Nova Fiat Toro 4x4 — força, tecnologia e aventura'
                    : 'Ex: Criativo para lançamento da Nova Fiat Toro 4x4 no Instagram'
                }
                rows={3}
                style={{ ...inputStyle, resize: 'none' }}
              />
            </div>

            {/* Erro */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Botão Gerar */}
            <button
              onClick={() => handleGenerate()}
              disabled={!canGenerate}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all"
              style={canGenerate ? {
                background: C.navy,
                color:      C.orange,
                boxShadow:  `0 4px 20px rgba(5,45,100,0.25)`,
              } : {
                background: '#E2EAF4',
                color:      C.muted,
                cursor:     'not-allowed',
              }}
            >
              {loading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <Wand2 className="w-5 h-5" />
              }
              {loading
                ? (formatId === 'INSTAGRAM_CAROUSEL' ? 'Gerando 3 slides...' : 'Gerando arte...')
                : (formatId === 'INSTAGRAM_CAROUSEL' ? 'Gerar Carrossel (3 slides)' : 'Gerar Arte Premium')
              }
            </button>
          </div>

          {/* ── RESULTADO ──────────────────────────────────────── */}
          <div className="lg:sticky lg:top-6 space-y-3">
            {loading ? (
              <LoadingCard msgIndex={msgIndex} formatId={formatId} />
            ) : hasResult ? (
              <>
                {/* Arte */}
                {result!.isCarousel && result!.slides ? (
                  <SlideViewer
                    slides={result!.slides}
                    currentSlide={currentSlide}
                    onSlideChange={setCurrentSlide}
                  />
                ) : result!.imageBase64 ? (
                  <div className="rounded-2xl overflow-hidden"
                    style={{ border: `1px solid ${C.border}`, background: C.white }}>
                    <div className={`relative w-full ${getAspectClass(result!.formatId ?? 'INSTAGRAM_POST')}`}>
                      <img
                        src={`data:${result!.mimeType ?? 'image/png'};base64,${result!.imageBase64}`}
                        alt="Arte gerada"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                        {result!.provider && (
                          <span className="px-2 py-1 rounded-lg text-xs backdrop-blur"
                            style={{ background: 'rgba(5,45,100,0.75)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)' }}>
                            {result!.provider}
                          </span>
                        )}
                        {result!.hasLogo && (
                          <span className="px-2 py-1 rounded-lg text-xs font-bold"
                            style={{ background: C.orange, color: C.white }}>
                            Logo incluída
                          </span>
                        )}
                      </div>
                      {result!.formatLabel && (
                        <div className="absolute bottom-3 left-3">
                          <span className="px-2 py-1 rounded-lg text-xs backdrop-blur"
                            style={{ background: 'rgba(5,45,100,0.75)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)' }}>
                            {result!.formatLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Painel Refazer */}
                {refazerMode && (
                  <div style={{ ...cardStyle, border: `1.5px solid ${C.orange}40` }}>
                    <p className="text-sm font-bold flex items-center gap-2 mb-3" style={{ color: C.navy }}>
                      <RotateCcw className="w-4 h-4" style={{ color: C.orange }} />
                      Quais ajustes você quer fazer?
                      {result!.isCarousel && (
                        <span className="text-xs font-normal ml-auto" style={{ color: C.muted }}>
                          Slide {currentSlide + 1}
                        </span>
                      )}
                    </p>
                    <textarea
                      ref={refazerRef}
                      value={refazerText}
                      onChange={e => setRefazerText(e.target.value)}
                      placeholder="Ex: Fundo mais escuro, aumentar o carro, tons azuis..."
                      rows={3}
                      style={{ ...inputStyle, resize: 'none', marginBottom: 10 }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleRefazer}
                        disabled={refazerLoading || !refazerText.trim()}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
                        style={{ background: C.navy, color: C.orange }}>
                        {refazerLoading
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Wand2 className="w-4 h-4" />
                        }
                        {refazerLoading ? 'Gerando...' : 'Gerar com ajustes'}
                      </button>
                      <button
                        onClick={() => { setRefazerMode(false); setRefazerText('') }}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
                        style={{ border: `1px solid ${C.border}`, color: C.muted }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Botões de ação */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={handleAprovar}
                    disabled={saving}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50 shadow-sm"
                    style={{ background: C.orange, color: C.white }}>
                    {saving
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <CheckCircle2 className="w-5 h-5" />
                    }
                    {saving ? 'Salvando...' : 'Aprovar Arte'}
                  </button>

                  <button
                    onClick={() => setRefazerMode(v => !v)}
                    disabled={refazerLoading}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 shadow-sm"
                    style={{
                      background: refazerMode ? C.navy : C.white,
                      border:     `1.5px solid ${refazerMode ? C.navy : C.border}`,
                      color:      refazerMode ? C.white : C.navy,
                    }}>
                    <RotateCcw className="w-5 h-5" style={{ color: refazerMode ? C.white : C.orange }} />
                    Refazer Arte
                  </button>

                  <button
                    onClick={handleReprovar}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 shadow-sm"
                    style={{
                      background: '#FEF2F2',
                      border:     '1.5px solid #FECACA',
                      color:      '#DC2626',
                    }}>
                    <ThumbsDown className="w-5 h-5" />
                    Reprovar Arte
                  </button>
                </div>

                {/* Download */}
                <button onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ background: C.white, border: `1px solid ${C.border}`, color: C.muted }}>
                  <Download className="w-4 h-4" />
                  {result!.isCarousel ? 'Baixar todos os slides' : 'Baixar arte'}
                </button>
              </>
            ) : (
              /* Empty state */
              <div className="rounded-2xl flex flex-col items-center justify-center gap-5 text-center p-10"
                style={{ background: C.white, border: `1px solid ${C.border}`, minHeight: 420 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/landing/mascote-ze-post.webp"
                  alt="Zé Post"
                  className="w-36 h-36 object-contain"
                  style={{ filter: 'drop-shadow(0 4px 20px rgba(254,121,2,0.20))' }}
                />
                <div>
                  <p className="text-base font-bold" style={{ color: C.navy }}>
                    Sua arte premium aparece aqui
                  </p>
                  <p className="text-sm mt-1.5 max-w-[200px] mx-auto" style={{ color: C.muted }}>
                    Descreva o criativo e clique em Gerar
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full"
                  style={{ background: `${C.orange}10`, border: `1px solid ${C.orange}30` }}>
                  <Sparkles className="w-3.5 h-3.5" style={{ color: C.orange }} />
                  <span className="text-xs font-semibold" style={{ color: C.orange }}>
                    Powered by Zé Post Premium
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Confetti */}
      {showConfetti && (
        <ConfettiOverlay onDone={() => setShowConfetti(false)} />
      )}

      {/* Approve Modal */}
      {approveModal && (
        <ApproveModal
          onPublish={() => { setApproveModal(false); router.push('/publicacoes') }}
          onSchedule={() => { setApproveModal(false); router.push('/agenda') }}
          onClose={() => setApproveModal(false)}
        />
      )}

      <style jsx global>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg) scaleX(1);   opacity: 1; }
          60%  { opacity: 1; }
          80%  { transform: translateY(90vh) rotate(720deg) scaleX(0.6); opacity: 0.7; }
          100% { transform: translateY(110vh) rotate(1080deg) scaleX(0.3); opacity: 0; }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%) }
          100% { transform: translateX(200%) }
        }
        @keyframes progress {
          0%   { width: 0% }
          20%  { width: 25% }
          50%  { width: 58% }
          80%  { width: 78% }
          100% { width: 90% }
        }
        .animate-shimmer  { animation: shimmer 2.2s infinite }
        .animate-progress { animation: progress 120s ease-out forwards }

        select option { background: #FFFFFF; color: #052D64; }
        textarea::placeholder, input::placeholder { color: #A0AEBE; }
        textarea:focus, select:focus {
          outline: none;
          border-color: #FE7902 !important;
          box-shadow: 0 0 0 3px rgba(254,121,2,0.10);
        }
      `}</style>
    </div>
  )
}
