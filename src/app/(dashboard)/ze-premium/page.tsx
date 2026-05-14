'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Sparkles, Download, RefreshCw, X, ImageIcon, Zap } from 'lucide-react'
import type { ZePremiumNiche, ZePremiumStyle } from '@/lib/ze-premium-prompt-builder'

// ── Opções de seleção ──────────────────────────────────────────

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

// ── Loading messages ───────────────────────────────────────────

const LOADING_MESSAGES = [
  'Inicializando motor visual premium...',
  'Analisando referência do produto...',
  'Construindo composição cinematográfica...',
  'Aplicando iluminação premium...',
  'Finalizando arte com IA multimodal...',
]

// ── Tipos ──────────────────────────────────────────────────────

interface GenerateResult {
  imageBase64: string
  mimeType: string
  provider: string
  prompt: string
}

interface UploadedImage {
  base64: string
  mime: string
  preview: string
  name: string
}

// ── Upload helper ──────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Upload Zone ────────────────────────────────────────────────

function UploadZone({
  label,
  hint,
  image,
  onUpload,
  onRemove,
}: {
  label: string
  hint: string
  image: UploadedImage | null
  onUpload: (img: UploadedImage) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const base64 = await fileToBase64(file)
    const preview = URL.createObjectURL(file)
    onUpload({ base64, mime: file.type, preview, name: file.name })
  }, [onUpload])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  if (image) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-white/10 group">
        <img src={image.preview} alt={label} className="w-full h-40 object-cover" />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={onRemove}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/80 rounded-lg text-white text-sm font-medium"
          >
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
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={[
        'flex flex-col items-center justify-center gap-2 h-40 rounded-xl border-2 border-dashed cursor-pointer transition-all',
        dragging
          ? 'border-violet-400 bg-violet-500/10'
          : 'border-white/10 bg-white/3 hover:border-white/25 hover:bg-white/5',
      ].join(' ')}
    >
      <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center">
        <Upload className="w-5 h-5 text-white/40" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white/70">{label}</p>
        <p className="text-xs text-white/30 mt-0.5">{hint}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}

// ── Loading Card ───────────────────────────────────────────────

function LoadingCard({ msgIndex }: { msgIndex: number }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-6 flex flex-col gap-5">
      {/* Shimmer de imagem */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-white/5">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent animate-shimmer" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-violet-400 animate-pulse" />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-violet-400/30 animate-ping" />
          </div>
          <p className="text-sm text-white/50 text-center px-4 transition-all">
            {LOADING_MESSAGES[msgIndex % LOADING_MESSAGES.length]}
          </p>
        </div>
      </div>

      {/* Barra de progresso fake */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-white/30">
          <span>Gerando arte premium...</span>
          <span className="animate-pulse">IA Multimodal</span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full animate-progress" />
        </div>
      </div>
    </div>
  )
}

// ── Result Card ────────────────────────────────────────────────

function ResultCard({
  result,
  onRegenerate,
}: {
  result: GenerateResult
  onRegenerate: () => void
}) {
  const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`

  function handleDownload() {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `ze-premium-${Date.now()}.png`
    a.click()
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
      {/* Imagem */}
      <div className="relative aspect-square w-full">
        <img src={dataUrl} alt="Arte premium gerada" className="w-full h-full object-cover" />
        <div className="absolute top-3 right-3">
          <span className="px-2 py-1 bg-black/60 backdrop-blur rounded-lg text-xs text-white/60 border border-white/10">
            {result.provider}
          </span>
        </div>
      </div>

      {/* Ações */}
      <div className="p-4 flex flex-col gap-3">
        <button
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Download className="w-4 h-4" />
          Baixar Arte
        </button>

        <button
          onClick={onRegenerate}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/70 text-sm font-medium hover:bg-white/8 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Gerar Variação
        </button>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────

export default function ZePremiumPage() {
  const [productImage, setProductImage] = useState<UploadedImage | null>(null)
  const [niche, setNiche] = useState<ZePremiumNiche>('automotivo')
  const [style, setStyle] = useState<ZePremiumStyle>('automotive_premium')
  const [objective, setObjective] = useState('')
  const [cta, setCta] = useState('')

  const [loading, setLoading] = useState(false)
  const [msgIndex, setMsgIndex] = useState(0)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function handleGenerate() {
    if (!objective.trim()) {
      setError('Descreva o objetivo da arte antes de gerar.')
      return
    }

    setLoading(true)
    setResult(null)
    setError(null)
    setMsgIndex(0)

    msgIntervalRef.current = setInterval(() => {
      setMsgIndex(i => i + 1)
    }, 3000)

    try {
      const res = await fetch('/api/ze-premium/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective,
          niche,
          style,
          cta: cta.trim() || undefined,
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
      if (msgIntervalRef.current) clearInterval(msgIntervalRef.current)
    }
  }

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Fundo com glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-fuchsia-600/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-semibold mb-5">
            <Zap className="w-3.5 h-3.5" />
            Multimodal AI — Experimental
          </div>
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-white">Zé </span>
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Premium</span>
          </h1>
          <p className="mt-2 text-white/40 text-sm max-w-md mx-auto">
            Geração visual multimodal — o modelo de IA cria a composição completa a partir do seu produto.
          </p>
        </div>

        {/* Layout: form + resultado */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

          {/* Formulário */}
          <div className="space-y-5">

            {/* Upload */}
            <div className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-white/80">Imagens de referência</h2>
              </div>
              <UploadZone
                label="Upload do Produto"
                hint="PNG, JPG ou WebP — O produto será o herói da arte"
                image={productImage}
                onUpload={setProductImage}
                onRemove={() => setProductImage(null)}
              />
            </div>

            {/* Nicho + Estilo */}
            <div className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white/80">Identidade da arte</h2>

              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2 block">Nicho</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {NICHES.map(n => (
                    <button
                      key={n.value}
                      onClick={() => setNiche(n.value)}
                      className={[
                        'px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all',
                        niche === n.value
                          ? 'bg-violet-500/20 border border-violet-400/50 text-violet-200'
                          : 'bg-white/4 border border-white/8 text-white/50 hover:border-white/20 hover:text-white/70',
                      ].join(' ')}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2 block">Estilo Visual</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STYLES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      className={[
                        'px-4 py-3 rounded-xl text-left transition-all border',
                        style === s.value
                          ? 'bg-violet-500/20 border-violet-400/50'
                          : 'bg-white/4 border-white/8 hover:border-white/20',
                      ].join(' ')}
                    >
                      <p className={['text-sm font-semibold', style === s.value ? 'text-violet-200' : 'text-white/70'].join(' ')}>
                        {s.label}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Objetivo + CTA */}
            <div className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white/80">Copy & objetivo</h2>

              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2 block">
                  Objetivo da Arte <span className="text-violet-400">*</span>
                </label>
                <textarea
                  value={objective}
                  onChange={e => setObjective(e.target.value)}
                  placeholder="Ex: Campanha de lançamento do Fiorino 2026 — ressaltar potência e economia para pequenos empresários"
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-violet-400/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2 block">
                  CTA / Texto Principal <span className="text-white/20">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={cta}
                  onChange={e => setCta(e.target.value)}
                  placeholder="Ex: FALE CONOSCO — (69) 99900-0000"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-400/50 transition-colors"
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
              disabled={loading || !objective.trim()}
              className={[
                'w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all',
                loading || !objective.trim()
                  ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 shadow-[0_0_40px_rgba(139,92,246,0.3)] hover:shadow-[0_0_60px_rgba(139,92,246,0.4)]',
              ].join(' ')}
            >
              <Sparkles className={['w-5 h-5', loading ? 'animate-spin' : ''].join(' ')} />
              {loading ? 'Gerando arte premium...' : 'Gerar Arte Premium'}
            </button>

          </div>

          {/* Resultado */}
          <div className="lg:sticky lg:top-6">
            {loading ? (
              <LoadingCard msgIndex={msgIndex} />
            ) : result ? (
              <ResultCard result={result} onRegenerate={handleGenerate} />
            ) : (
              <div className="rounded-2xl border border-white/6 bg-white/2 aspect-square flex flex-col items-center justify-center gap-4 text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white/20" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/30">Sua arte premium</p>
                  <p className="text-xs text-white/15 mt-1">
                    Preencha o formulário e clique em<br />Gerar Arte Premium
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
          0% { width: 0% }
          20% { width: 25% }
          50% { width: 55% }
          80% { width: 80% }
          100% { width: 92% }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .animate-progress {
          animation: progress 90s ease-out forwards;
        }
        .bg-white\/3 { background-color: rgba(255,255,255,0.03) }
        .bg-white\/2 { background-color: rgba(255,255,255,0.02) }
        .bg-white\/4 { background-color: rgba(255,255,255,0.04) }
        .bg-white\/5 { background-color: rgba(255,255,255,0.05) }
        .bg-white\/8 { background-color: rgba(255,255,255,0.08) }
        .hover\\:bg-white\\/8:hover { background-color: rgba(255,255,255,0.08) }
      `}</style>
    </div>
  )
}
