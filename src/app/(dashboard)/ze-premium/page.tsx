'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Sparkles, Download, RefreshCw, X, ImageIcon, Zap, Type, Monitor, ShieldCheck, ChevronLeft, ChevronRight, Layers } from 'lucide-react'
import type { ZePremiumNiche, ZePremiumStyle } from '@/lib/ze-premium-prompt-builder'
import { SOCIAL_FORMATS, type SocialFormatId } from '@/lib/social-formats'
import type { SafeAreaScores } from '@/lib/safe-area-engine'
import type { LayoutCompositionMode } from '@/lib/layout-composition-engine'
import { getTextOverlayPreviewStyles, drawTextOnCanvas, type CopyData } from '@/lib/text-overlay-engine'

// ── Opções ────────────────────────────────────────────────────

const NICHES: { value: ZePremiumNiche; label: string }[] = [
  { value: 'automotivo',    label: '🚗 Automotivo' },
  { value: 'restaurante',   label: '🍽️ Restaurante' },
  { value: 'moda',          label: '👗 Moda' },
  { value: 'tecnologia',    label: '💻 Tecnologia' },
  { value: 'energia_solar', label: '☀️ Energia Solar' },
  { value: 'corporativo',   label: '🏢 Corporativo' },
  { value: 'ecommerce',     label: '🛒 E-commerce' },
  { value: 'educacao',      label: '📚 Educação' },
]

const STYLES: { value: ZePremiumStyle; label: string; desc: string }[] = [
  { value: 'automotive_premium', label: 'Automotive Premium', desc: 'Campanha cinematográfica automotiva' },
  { value: 'premium_dark',       label: 'Premium Dark',       desc: 'Dark elegante de alto impacto' },
  { value: 'black_luxury',       label: 'Black Luxury',       desc: 'Ultra luxo, estilo Porsche / Rolex' },
  { value: 'luxury',             label: 'Luxury',             desc: 'Elegância editorial e atemporal' },
  { value: 'cinematic',          label: 'Cinematic',          desc: 'Drama cinematográfico profissional' },
  { value: 'aggressive_ads',     label: 'Aggressive Ads',     desc: 'Impacto máximo, estilo Nike / Red Bull' },
  { value: 'modern_clean',       label: 'Modern Clean',       desc: 'Limpo, moderno e confiável' },
  { value: 'minimal',            label: 'Minimal',            desc: 'Simplicidade premium Escandinava' },
]

const FORMAT_OPTIONS = Object.values(SOCIAL_FORMATS)

const LOADING_MESSAGES = [
  'Inicializando motor visual multimodal...',
  'Aplicando safe area da plataforma...',
  'Analisando composição do produto...',
  'Integrando headline na arte...',
  'Aplicando estilo tipográfico premium...',
  'Finalizando campanha publicitária...',
]

const CAROUSEL_LOADING_MESSAGES = [
  'Montando estratégia narrativa do carrossel...',
  'Gerando slide Hook — criando o gancho...',
  'Gerando slide de Desejo / Benefício...',
  'Aplicando safe area em cada slide...',
  'Gerando slide de Prova Social...',
  'Finalizando slide de CTA...',
  'Verificando consistência visual entre slides...',
  'Quase pronto — compilando carrossel premium...',
]

// ── Tipos ──────────────────────────────────────────────────────

/** Resultado de um slide individual no carrossel */
interface CarouselSlideResult {
  slideNumber:      number
  role:             string
  roleLabel:        string
  headline:         string
  subline:          string
  cta?:             string
  imageBase64:      string
  mimeType:         string
  safeAreaScores?:  SafeAreaScores
  productSafeScore?: number
}

/** Resultado de geração — imagem única ou carrossel */
interface GenerateResult {
  // Imagem única
  imageBase64?:      string
  mimeType?:         string
  provider?:         string
  prompt?:           string
  // Campos comuns
  formatId?:         SocialFormatId
  formatLabel?:      string
  styleId?:          ZePremiumStyle
  compositionMode?:  LayoutCompositionMode
  formatRiskLevel?:  'low' | 'medium' | 'high'
  safeAreaScores?:   SafeAreaScores
  productSafeScore?: number
  copyVariationId?:  number
  // Copy — renderizado pelo text-overlay-engine
  copyData?:         CopyData
  // Carrossel
  totalSlides?:      number
  slides?:           CarouselSlideResult[]
}

interface UploadedImage {
  base64: string
  mime: string
  preview: string
  name: string
}

// ── Helpers ────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
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

// ── Upload Zone ────────────────────────────────────────────────

function UploadZone({
  label, hint, image, onUpload, onRemove,
}: {
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
      <div className="relative rounded-xl overflow-hidden border border-white/10 group">
        <img src={image.preview} alt={label} className="w-full h-36 object-cover" />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button onClick={onRemove} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/80 rounded-lg text-white text-sm font-medium">
            <X className="w-3.5 h-3.5" /> Remover
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-3 py-1.5">
          <p className="text-xs text-white/70 truncate">{image.name}</p>
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
      className={[
        'flex flex-col items-center justify-center gap-2 h-36 rounded-xl border-2 border-dashed cursor-pointer transition-all',
        dragging ? 'border-violet-400 bg-violet-500/10' : 'border-white/10 hover:border-white/25 hover:bg-white/5',
      ].join(' ')}
    >
      <Upload className="w-5 h-5 text-white/30" />
      <div className="text-center">
        <p className="text-sm font-medium text-white/60">{label}</p>
        <p className="text-xs text-white/25 mt-0.5">{hint}</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}

// ── Loading Card ───────────────────────────────────────────────

function LoadingCard({ msgIndex, formatId }: { msgIndex: number; formatId: SocialFormatId }) {
  const aspectCls   = getAspectClass(formatId)
  const isCarousel  = formatId === 'INSTAGRAM_CAROUSEL'
  const messages    = isCarousel ? CAROUSEL_LOADING_MESSAGES : LOADING_MESSAGES

  return (
    <div className="rounded-2xl border border-white/8 bg-white/2 p-6 flex flex-col gap-5">
      {isCarousel ? (
        // Loading especial para carrossel — mostra múltiplos quadros
        <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-white/4">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent animate-shimmer" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                <Layers className="w-8 h-8 text-violet-400 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-2xl border-2 border-violet-400/30 animate-ping" />
            </div>
            <p className="text-sm text-white/40 text-center px-4">
              {messages[msgIndex % messages.length]}
            </p>
          </div>
        </div>
      ) : (
        <div className={`relative w-full ${aspectCls} rounded-xl overflow-hidden bg-white/4`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent animate-shimmer" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-violet-400 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-2xl border-2 border-violet-400/30 animate-ping" />
            </div>
            <p className="text-sm text-white/40 text-center px-4">
              {messages[msgIndex % messages.length]}
            </p>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-white/25">
          <span>
            {isCarousel
              ? 'Gerando slides com estratégia narrativa...'
              : 'Compondo arte com safe area aplicada...'}
          </span>
          <span className="animate-pulse">IA Multimodal</span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className={[
            'h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full',
            isCarousel ? 'animate-progress-slow' : 'animate-progress',
          ].join(' ')} />
        </div>
      </div>
    </div>
  )
}

// ── Safe Area Score Badge ──────────────────────────────────────

function SafeScoreBadge({ scores }: { scores: SafeAreaScores }) {
  const color =
    scores.risk_level === 'low'    ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/8' :
    scores.risk_level === 'medium' ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/8' :
                                     'text-red-400 border-red-400/30 bg-red-400/8'
  const label =
    scores.risk_level === 'low'    ? 'Safe Area ✓' :
    scores.risk_level === 'medium' ? 'Safe Area ~' :
                                     'Safe Area !'

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${color}`}>
      <ShieldCheck className="w-3 h-3" />
      {label} {scores.overall}%
    </div>
  )
}

// ── Download com texto composto via Canvas 2D ──────────────────────
// Carrega a imagem base64, desenha o texto em cima com canvas nativo,
// sem depender de html2canvas — funciona na resolução real do modelo.

async function downloadWithTextOverlay(
  imageBase64: string,
  mimeType:    string,
  formatId:    SocialFormatId,
  styleId:     ZePremiumStyle,
  copy:        CopyData,
  filename:    string,
) {
  const img = new Image()
  await new Promise<void>((res, rej) => {
    img.onload  = () => res()
    img.onerror = rej
    img.src = `data:${mimeType};base64,${imageBase64}`
  })

  const canvas = document.createElement('canvas')
  canvas.width  = img.naturalWidth
  canvas.height = img.naturalHeight

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  drawTextOnCanvas(ctx, canvas.width, canvas.height, formatId, styleId, copy)

  const link = document.createElement('a')
  link.download = filename
  link.href     = canvas.toDataURL('image/png')
  link.click()
}

// ── Result Card ────────────────────────────────────────────────

function ResultCard({ result, onRegenerate }: { result: GenerateResult; onRegenerate: () => void }) {
  const dataUrl    = `data:${result.mimeType ?? 'image/png'};base64,${result.imageBase64 ?? ''}`
  const formatId   = result.formatId ?? 'INSTAGRAM_POST'
  const styleId    = result.styleId  ?? 'premium_dark'
  const aspectCls  = getAspectClass(formatId)
  const fmt        = SOCIAL_FORMATS[formatId]
  const isVertical = fmt?.genH > fmt?.genW

  // CSS overlay para preview
  const overlayStyles = result.copyData
    ? getTextOverlayPreviewStyles(formatId, styleId)
    : null
  const copy = result.copyData ?? null

  async function handleDownload() {
    if (!result.imageBase64 || !copy) {
      // Fallback: download da imagem sem texto
      const a = document.createElement('a')
      a.href = dataUrl; a.download = `ze-premium-${formatId}-${Date.now()}.png`; a.click()
      return
    }
    await downloadWithTextOverlay(
      result.imageBase64,
      result.mimeType ?? 'image/png',
      formatId,
      styleId,
      copy,
      `ze-premium-${formatId}-${Date.now()}.png`,
    )
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
      <div className={`relative ${aspectCls} w-full`} style={{ containerType: 'inline-size' }}>
        <img src={dataUrl} alt="Arte premium gerada" className="w-full h-full object-cover" />

        {/* ── Text overlay — posicionado via text-overlay-engine ── */}
        {overlayStyles && copy && (
          <div style={overlayStyles.container}>
            <p style={{ ...overlayStyles.headline, margin: 0 }}>{copy.headline}</p>
            {copy.subheadline && (
              <p style={{ ...overlayStyles.subline, margin: 0 }}>{copy.subheadline}</p>
            )}
            {copy.cta && (
              <span style={overlayStyles.cta}>{copy.cta}</span>
            )}
          </div>
        )}

        {/* Safe area overlay — apenas formatos verticais com danger zones */}
        {isVertical && fmt?.dangerZoneIds?.length > 0 && (
          <>
            {/* Top danger zone */}
            <div className="absolute top-0 left-0 right-0 h-[15%] bg-red-500/10 border-b border-red-400/20 pointer-events-none" />
            {/* Bottom danger zone */}
            <div className="absolute bottom-0 left-0 right-0 h-[18%] bg-red-500/10 border-t border-red-400/20 pointer-events-none" />
            {/* Right action bar (se existir) */}
            {fmt.dangerZoneIds.some(id => id.includes('right') || id.includes('tiktok')) && (
              <div className="absolute top-0 right-0 bottom-0 w-[12%] bg-amber-500/8 border-l border-amber-400/15 pointer-events-none" />
            )}
            {/* Label */}
            <div className="absolute top-[15%] left-2 right-2 flex justify-center pointer-events-none">
              <span className="px-2 py-0.5 bg-black/50 backdrop-blur rounded text-[9px] text-white/30 border border-white/8">
                ↕ Zona segura do produto
              </span>
            </div>
          </>
        )}

        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          {result.provider && (
            <span className="px-2 py-1 bg-black/60 backdrop-blur rounded-lg text-xs text-white/50 border border-white/10">
              {result.provider}
            </span>
          )}
          {result.safeAreaScores && (
            <SafeScoreBadge scores={result.safeAreaScores} />
          )}
        </div>
        {result.formatLabel && (
          <div className="absolute bottom-3 left-3">
            <span className="px-2 py-1 bg-black/60 backdrop-blur rounded-lg text-xs text-white/60 border border-white/10">
              {result.formatLabel}
            </span>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-3">
        {result.safeAreaScores && (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'Headline',    score: result.safeAreaScores.headline_safe_score },
                { label: 'CTA',         score: result.safeAreaScores.cta_safe_score },
                { label: 'Logo',        score: result.safeAreaScores.logo_safe_score },
                { label: 'Tipografia',  score: result.safeAreaScores.typography_margin_score },
                ...(result.productSafeScore !== undefined
                  ? [{ label: 'Produto', score: result.productSafeScore }]
                  : []),
              ].map(({ label, score }) => (
                <div key={label} className="flex items-center justify-between px-2.5 py-1.5 bg-white/4 rounded-lg">
                  <span className="text-white/40">{label}</span>
                  <span className={score >= 85 ? 'text-emerald-400' : score >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                    {score}
                  </span>
                </div>
              ))}
            </div>
            {result.compositionMode && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white/3 rounded-lg text-xs">
                <span className="text-white/25">Composição:</span>
                <span className="text-violet-300/70 font-mono text-[10px]">{result.compositionMode}</span>
              </div>
            )}
          </>
        )}
        <button onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity">
          <Download className="w-4 h-4" /> Baixar Arte
        </button>
        <button onClick={onRegenerate}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/60 text-sm font-medium hover:bg-white/8 transition-colors">
          <RefreshCw className="w-4 h-4" /> Gerar Variação
        </button>
      </div>
    </div>
  )
}

// ── Role badge colors ──────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  HOOK:           'bg-violet-500/20 text-violet-300 border-violet-400/30',
  DESIRE:         'bg-pink-500/20 text-pink-300 border-pink-400/30',
  PROBLEM:        'bg-orange-500/20 text-orange-300 border-orange-400/30',
  BENEFIT:        'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  PROOF:          'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  DIFFERENTIAL:   'bg-blue-500/20 text-blue-300 border-blue-400/30',
  OBJECTION:      'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
  TIP:            'bg-teal-500/20 text-teal-300 border-teal-400/30',
  COMPARISON:     'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
  TRANSFORMATION: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/30',
  CTA:            'bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/30',
}

// ── Carousel Result Card ───────────────────────────────────────

function CarouselResultCard({
  result, onRegenerate,
}: {
  result: GenerateResult
  onRegenerate: () => void
}) {
  const [current, setCurrent] = useState(0)
  const slides      = result.slides ?? []
  const totalSlides = slides.length
  const slide       = slides[current]
  const styleId     = result.styleId ?? 'premium_dark'
  const formatId    = (result.formatId ?? 'INSTAGRAM_CAROUSEL') as SocialFormatId

  if (!slide) return null

  const dataUrl = `data:${slide.mimeType ?? 'image/png'};base64,${slide.imageBase64}`
  const roleCls = ROLE_COLORS[slide.role] ?? 'bg-white/10 text-white/50 border-white/20'

  // CSS overlay para o slide atual
  const overlayStyles = getTextOverlayPreviewStyles(formatId, styleId)
  const slideCopy: CopyData = {
    headline:    slide.headline,
    subheadline: slide.subline ?? null,
    cta:         slide.cta    ?? null,
  }

  async function downloadSlide(s: CarouselSlideResult, idx: number) {
    const copy: CopyData = { headline: s.headline, subheadline: s.subline ?? null, cta: s.cta ?? null }
    await downloadWithTextOverlay(
      s.imageBase64,
      s.mimeType ?? 'image/png',
      formatId,
      styleId,
      copy,
      `ze-premium-carousel-${idx + 1}-${s.role}-${Date.now()}.png`,
    )
  }

  async function downloadAll() {
    for (let i = 0; i < slides.length; i++) {
      await downloadSlide(slides[i], i)
      await new Promise(r => setTimeout(r, 400))
    }
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">

      {/* Cabeçalho do carrossel */}
      <div className="px-4 pt-4 pb-3 border-b border-white/6 flex items-center gap-2">
        <Layers className="w-4 h-4 text-violet-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-white/70">Carrossel Estratégico</span>
        <span className="ml-auto text-xs text-white/30">{totalSlides} slides</span>
        {result.formatLabel && (
          <span className="text-xs px-2 py-0.5 bg-white/6 rounded border border-white/8 text-white/40">
            {result.formatLabel}
          </span>
        )}
      </div>

      {/* Preview do slide atual */}
      <div className="relative aspect-square w-full" style={{ containerType: 'inline-size' }}>
        <img
          src={dataUrl}
          alt={`Slide ${current + 1} — ${slide.roleLabel}`}
          className="w-full h-full object-cover"
        />

        {/* ── Text overlay do slide ── */}
        <div style={overlayStyles.container}>
          <p style={{ ...overlayStyles.headline, margin: 0 }}>{slideCopy.headline}</p>
          {slideCopy.subheadline && (
            <p style={{ ...overlayStyles.subline, margin: 0 }}>{slideCopy.subheadline}</p>
          )}
          {slideCopy.cta && (
            <span style={overlayStyles.cta}>{slideCopy.cta}</span>
          )}
        </div>

        {/* Badge de papel do slide */}
        <div className="absolute top-3 left-3">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${roleCls}`}>
            {slide.roleLabel}
          </span>
        </div>

        {/* Badge de safe area */}
        <div className="absolute top-3 right-3">
          {slide.safeAreaScores && <SafeScoreBadge scores={slide.safeAreaScores} />}
        </div>

        {/* Indicador de slide */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={[
                'rounded-full transition-all duration-200',
                i === current
                  ? 'w-5 h-1.5 bg-white'
                  : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50',
              ].join(' ')}
            />
          ))}
        </div>
      </div>

      {/* Copy do slide atual */}
      <div className="px-4 pt-3 pb-2 space-y-1 border-b border-white/6">
        <p className="text-sm font-semibold text-white/80 leading-snug">{slide.headline}</p>
        <p className="text-xs text-white/40 leading-relaxed">{slide.subline}</p>
        {slide.cta && (
          <p className="text-xs font-semibold text-violet-400 mt-1">→ {slide.cta}</p>
        )}
      </div>

      {/* Navegação */}
      <div className="px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => setCurrent(c => Math.max(0, c - 1))}
          disabled={current === 0}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 text-center text-xs text-white/35 font-medium">
          Slide {current + 1} de {totalSlides}
        </div>

        <button
          onClick={() => setCurrent(c => Math.min(totalSlides - 1, c + 1))}
          disabled={current === totalSlides - 1}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Score do slide atual */}
      {slide.safeAreaScores && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Headline',   score: slide.safeAreaScores.headline_safe_score },
              { label: 'CTA',        score: slide.safeAreaScores.cta_safe_score },
              ...(slide.productSafeScore !== undefined
                ? [{ label: 'Produto', score: slide.productSafeScore }]
                : []),
            ].map(({ label, score }) => (
              <div key={label} className="flex items-center justify-between px-2 py-1 bg-white/4 rounded-lg">
                <span className="text-white/35">{label}</span>
                <span className={score >= 85 ? 'text-emerald-400' : score >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                  {score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botões de download */}
      <div className="px-4 pb-4 space-y-2">
        <button
          onClick={() => void downloadSlide(slide, current)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Download className="w-4 h-4" /> Baixar slide {current + 1}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={downloadAll}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/10 bg-white/5 text-white/55 text-xs font-medium hover:bg-white/10 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Baixar todos
          </button>
          <button
            onClick={onRegenerate}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/10 bg-white/5 text-white/55 text-xs font-medium hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regerar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared input classes ───────────────────────────────────────

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-400/50 transition-colors'

// ── Página principal ───────────────────────────────────────────

export default function ZePremiumPage() {
  const [productImage, setProductImage] = useState<UploadedImage | null>(null)
  const [formatId,     setFormatId]     = useState<SocialFormatId>('INSTAGRAM_POST')
  const [niche,        setNiche]        = useState<ZePremiumNiche>('automotivo')
  const [style,        setStyle]        = useState<ZePremiumStyle>('automotive_premium')

  // Copy fields — renderizados diretamente pelo modelo multimodal
  const [headline,    setHeadline]    = useState('')
  const [subheadline, setSubheadline] = useState('')
  const [cta,         setCta]         = useState('')
  const [objective,   setObjective]   = useState('')

  const [loading,  setLoading]  = useState(false)
  const [msgIndex, setMsgIndex] = useState(0)
  const [result,   setResult]   = useState<GenerateResult | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function handleGenerate() {
    if (!headline.trim()) {
      setError('Escreva a headline da arte antes de gerar.')
      return
    }
    setLoading(true); setResult(null); setError(null); setMsgIndex(0)
    intervalRef.current = setInterval(() => setMsgIndex(i => i + 1), 3200)

    try {
      const res = await fetch('/api/ze-premium/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective:          objective.trim() || headline,
          niche,
          style,
          formatId,
          headline:           headline.trim(),
          subheadline:        subheadline.trim() || undefined,
          cta:                cta.trim() || undefined,
          productImageBase64: productImage?.base64,
          productImageMime:   productImage?.mime,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha na geração')
      setResult(data as GenerateResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não conseguimos gerar sua arte agora. Tente novamente.')
    } finally {
      setLoading(false)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }

  const canGenerate  = !loading && !!headline.trim()
  const currentFmt   = SOCIAL_FORMATS[formatId]

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-fuchsia-600/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-semibold mb-5">
            <Zap className="w-3.5 h-3.5" />
            Multimodal AI — Safe Area System
          </div>
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-white">Zé </span>
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Premium</span>
          </h1>
          <p className="mt-2 text-white/35 text-sm max-w-lg mx-auto">
            Produto gerado pelo modelo, texto renderizado com precisão Canvas — resultado perfeito em qualquer formato.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

          {/* ── Formulário ── */}
          <div className="space-y-4">

            {/* Formato da Arte */}
            <div className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-white/70">Formato da Arte</h2>
                <span className="ml-auto text-xs font-medium text-violet-400/70">
                  {currentFmt.officialW}×{currentFmt.officialH}
                </span>
              </div>
              <select
                value={formatId}
                onChange={e => setFormatId(e.target.value as SocialFormatId)}
                className={inputCls + ' cursor-pointer'}
              >
                {FORMAT_OPTIONS.map(f => (
                  <option key={f.id} value={f.id} style={{ background: '#0f0f1a' }}>
                    {f.label} — {f.aspectRatio}
                  </option>
                ))}
              </select>
              {currentFmt.id === 'INSTAGRAM_CAROUSEL' ? (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-violet-500/8 border border-violet-500/20 rounded-xl">
                  <Layers className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-violet-300/70">
                    Modo carrossel ativo — o sistema vai gerar múltiplos slides com estratégia narrativa (Hook → Benefício → CTA).
                    Para personalizar a quantidade, escreva "carrossel de X slides" no campo Contexto abaixo (3 a 10 slides).
                  </p>
                </div>
              ) : currentFmt.dangerZoneIds.length > 0 ? (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300/70">
                    Safe area ativa — {currentFmt.dangerZoneIds.length} zona{currentFmt.dangerZoneIds.length > 1 ? 's' : ''} de perigo da {currentFmt.platform} protegidas.
                    {currentFmt.aspectRatio === '9:16' && ' Produto, textos e CTA protegidos para Stories/Reels.'}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/6 border border-emerald-500/15 rounded-xl">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <p className="text-xs text-emerald-300/60">
                    Formato sem zonas de perigo — safe area padrão aplicada.
                  </p>
                </div>
              )}
            </div>

            {/* Upload */}
            <div className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-white/70">Produto de referência</h2>
                <span className="ml-auto text-xs text-white/25">opcional</span>
              </div>
              <UploadZone
                label="Upload do Produto"
                hint="PNG · JPG · WebP — o produto será o herói visual"
                image={productImage}
                onUpload={setProductImage}
                onRemove={() => setProductImage(null)}
              />
            </div>

            {/* Nicho + Estilo */}
            <div className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white/70">Identidade visual</h2>

              <div>
                <label className="text-xs text-white/35 uppercase tracking-wider font-semibold mb-2 block">Nicho</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {NICHES.map(n => (
                    <button key={n.value} onClick={() => setNiche(n.value)}
                      className={[
                        'px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all border',
                        niche === n.value
                          ? 'bg-violet-500/20 border-violet-400/50 text-violet-200'
                          : 'bg-white/4 border-white/8 text-white/45 hover:border-white/20 hover:text-white/70',
                      ].join(' ')}
                    >{n.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/35 uppercase tracking-wider font-semibold mb-2 block">Estilo Visual</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STYLES.map(s => (
                    <button key={s.value} onClick={() => setStyle(s.value)}
                      className={[
                        'px-4 py-3 rounded-xl text-left transition-all border',
                        style === s.value ? 'bg-violet-500/20 border-violet-400/50' : 'bg-white/4 border-white/8 hover:border-white/20',
                      ].join(' ')}
                    >
                      <p className={['text-sm font-semibold', style === s.value ? 'text-violet-200' : 'text-white/65'].join(' ')}>{s.label}</p>
                      <p className="text-xs text-white/25 mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Copy — overlay preciso sobre a imagem gerada */}
            <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-white/70">Copy da Arte</h2>
              </div>
              <p className="text-xs text-white/30 -mt-1">
                O texto é renderizado com precisão pixel sobre a imagem — sem distorção, sem corte, exatamente como você digitou. O download já inclui a composição final.
              </p>

              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2 block">
                  Headline <span className="text-violet-400">*</span>
                </label>
                <input type="text" value={headline} onChange={e => setHeadline(e.target.value)}
                  placeholder="Ex: ELEGÂNCIA QUE TRABALHA PARA VOCÊ"
                  className={inputCls}
                />
                <p className="text-xs text-white/20 mt-1.5">Grande, impactante, em maiúsculas recomendado</p>
              </div>

              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2 block">
                  Subheadline <span className="text-white/20">(opcional)</span>
                </label>
                <input type="text" value={subheadline} onChange={e => setSubheadline(e.target.value)}
                  placeholder="Ex: Mais eficiência e economia para o seu dia a dia"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2 block">
                  CTA <span className="text-white/20">(opcional)</span>
                </label>
                <input type="text" value={cta} onChange={e => setCta(e.target.value)}
                  placeholder="Ex: FALE COM NOSSA EQUIPE · (69) 99900-0000"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2 block">
                  Contexto / Objetivo <span className="text-white/20">(opcional)</span>
                </label>
                <textarea value={objective} onChange={e => setObjective(e.target.value)}
                  placeholder={
                    formatId === 'INSTAGRAM_CAROUSEL'
                      ? 'Ex: Carrossel de 5 slides para lançamento da Toro 2026 — foco em força e tecnologia'
                      : 'Ex: Lançamento do Fiorino 2026 para pequenos empresários — foco em economia e robustez'
                  }
                  rows={2}
                  className={inputCls + ' resize-none'}
                />
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Botão */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={[
                'w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all',
                canGenerate
                  ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 shadow-[0_0_40px_rgba(139,92,246,0.25)]'
                  : 'bg-white/5 border border-white/8 text-white/25 cursor-not-allowed',
              ].join(' ')}
            >
              {formatId === 'INSTAGRAM_CAROUSEL'
                ? <Layers className={['w-5 h-5', loading ? 'animate-spin' : ''].join(' ')} />
                : <Sparkles className={['w-5 h-5', loading ? 'animate-spin' : ''].join(' ')} />
              }
              {loading
                ? (formatId === 'INSTAGRAM_CAROUSEL' ? 'Gerando carrossel estratégico...' : 'Gerando arte com safe area...')
                : (formatId === 'INSTAGRAM_CAROUSEL' ? 'Gerar Carrossel Estratégico' : 'Gerar Arte Premium')
              }
            </button>
          </div>

          {/* ── Resultado ── */}
          <div className="lg:sticky lg:top-6">
            {loading ? (
              <LoadingCard msgIndex={msgIndex} formatId={formatId} />
            ) : result?.slides?.length ? (
              <CarouselResultCard result={result} onRegenerate={handleGenerate} />
            ) : result ? (
              <ResultCard result={result} onRegenerate={handleGenerate} />
            ) : (
              <div className={`rounded-2xl border border-white/6 bg-white/2 ${getAspectClass(formatId)} flex flex-col items-center justify-center gap-4 text-center p-8`}>
                <div className="w-16 h-16 rounded-2xl bg-white/4 flex items-center justify-center">
                  {formatId === 'INSTAGRAM_CAROUSEL'
                    ? <Layers className="w-8 h-8 text-white/15" />
                    : <Sparkles className="w-8 h-8 text-white/15" />
                  }
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/25">
                    {formatId === 'INSTAGRAM_CAROUSEL' ? 'Seu carrossel estratégico' : 'Sua arte premium'}
                  </p>
                  <p className="text-xs text-white/12 mt-1">
                    {formatId === 'INSTAGRAM_CAROUSEL'
                      ? <>Preencha headline e objetivo,<br />clique em Gerar Carrossel</>
                      : <>Escolha o formato, preencha headline<br />e clique em Gerar Arte Premium</>
                    }
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) }
          100% { transform: translateX(100%) }
        }
        @keyframes progress {
          0%   { width: 0% }
          15%  { width: 20% }
          40%  { width: 48% }
          70%  { width: 72% }
          90%  { width: 87% }
          100% { width: 92% }
        }
        .animate-shimmer { animation: shimmer 2s infinite }
        .animate-progress { animation: progress 90s ease-out forwards }
        .animate-progress-slow { animation: progress 240s ease-out forwards }
      `}</style>
    </div>
  )
}
