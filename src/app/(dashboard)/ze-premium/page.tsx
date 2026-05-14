'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Sparkles, Download, RefreshCw, X, ImageIcon, Zap, Type, Monitor, ShieldCheck } from 'lucide-react'
import type { ZePremiumNiche, ZePremiumStyle } from '@/lib/ze-premium-prompt-builder'
import { SOCIAL_FORMATS, type SocialFormatId } from '@/lib/social-formats'
import type { SafeAreaScores } from '@/lib/safe-area-engine'

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

// ── Tipos ──────────────────────────────────────────────────────

interface GenerateResult {
  imageBase64: string
  mimeType: string
  provider: string
  prompt: string
  formatId?: SocialFormatId
  formatLabel?: string
  safeAreaScores?: SafeAreaScores
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
  const aspectCls = getAspectClass(formatId)
  return (
    <div className="rounded-2xl border border-white/8 bg-white/2 p-6 flex flex-col gap-5">
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
            {LOADING_MESSAGES[msgIndex % LOADING_MESSAGES.length]}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-white/25">
          <span>Compondo arte com safe area aplicada...</span>
          <span className="animate-pulse">IA Multimodal</span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full animate-progress" />
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

// ── Result Card ────────────────────────────────────────────────

function ResultCard({ result, onRegenerate }: { result: GenerateResult; onRegenerate: () => void }) {
  const dataUrl    = `data:${result.mimeType};base64,${result.imageBase64}`
  const formatId   = result.formatId ?? 'INSTAGRAM_POST'
  const aspectCls  = getAspectClass(formatId)

  function handleDownload() {
    const a = document.createElement('a')
    a.href = dataUrl; a.download = `ze-premium-${formatId}-${Date.now()}.png`; a.click()
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
      <div className={`relative ${aspectCls} w-full`}>
        <img src={dataUrl} alt="Arte premium gerada" className="w-full h-full object-cover" />
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          <span className="px-2 py-1 bg-black/60 backdrop-blur rounded-lg text-xs text-white/50 border border-white/10">
            {result.provider}
          </span>
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
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Headline',    score: result.safeAreaScores.headline_safe_score },
              { label: 'CTA',         score: result.safeAreaScores.cta_safe_score },
              { label: 'Logo',        score: result.safeAreaScores.logo_safe_score },
              { label: 'Tipografia',  score: result.safeAreaScores.typography_margin_score },
            ].map(({ label, score }) => (
              <div key={label} className="flex items-center justify-between px-2.5 py-1.5 bg-white/4 rounded-lg">
                <span className="text-white/40">{label}</span>
                <span className={score >= 85 ? 'text-emerald-400' : score >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                  {score}
                </span>
              </div>
            ))}
          </div>
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
            Gera headline, subheadline e CTA diretamente na arte — com safe area oficial de cada plataforma.
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
              {currentFmt.dangerZoneIds.length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300/70">
                    Safe area ativa — {currentFmt.dangerZoneIds.length} zona{currentFmt.dangerZoneIds.length > 1 ? 's' : ''} de perigo da {currentFmt.platform} serão respeitadas automaticamente.
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

            {/* Copy — tipografia integrada na arte */}
            <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-white/70">Copy — tipografia integrada na arte</h2>
              </div>
              <p className="text-xs text-white/30 -mt-1">
                Os textos abaixo serão renderizados diretamente pelo modelo de IA dentro da imagem, respeitando a safe area do formato selecionado.
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
                  placeholder="Ex: Lançamento do Fiorino 2026 para pequenos empresários — foco em economia e robustez"
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
              <Sparkles className={['w-5 h-5', loading ? 'animate-spin' : ''].join(' ')} />
              {loading ? 'Gerando arte com safe area...' : 'Gerar Arte Premium'}
            </button>
          </div>

          {/* ── Resultado ── */}
          <div className="lg:sticky lg:top-6">
            {loading ? (
              <LoadingCard msgIndex={msgIndex} formatId={formatId} />
            ) : result ? (
              <ResultCard result={result} onRegenerate={handleGenerate} />
            ) : (
              <div className={`rounded-2xl border border-white/6 bg-white/2 ${getAspectClass(formatId)} flex flex-col items-center justify-center gap-4 text-center p-8`}>
                <div className="w-16 h-16 rounded-2xl bg-white/4 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white/15" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/25">Sua arte premium</p>
                  <p className="text-xs text-white/12 mt-1">
                    Escolha o formato, preencha headline<br />e clique em Gerar Arte Premium
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
      `}</style>
    </div>
  )
}
