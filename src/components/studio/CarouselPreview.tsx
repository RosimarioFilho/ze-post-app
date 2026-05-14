'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Download, CheckCircle2, Star, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CarouselSlideResult, SlideRole } from '@/types'

const ROLE_LABELS: Record<SlideRole, string> = {
  HOOK: 'Gancho', CONTEXT: 'Contexto', VALUE: 'Valor', PROOF: 'Prova', CTA: 'CTA',
}

const ROLE_COLORS: Record<SlideRole, string> = {
  HOOK:    'bg-red-100 text-red-700',
  CONTEXT: 'bg-blue-100 text-blue-700',
  VALUE:   'bg-emerald-100 text-emerald-700',
  PROOF:   'bg-purple-100 text-purple-700',
  CTA:     'bg-orange-100 text-orange-700',
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-xs font-bold', color)}>
      <Star className="w-3 h-3" />
      {score}/100
    </span>
  )
}

interface CarouselPreviewProps {
  slides: CarouselSlideResult[]
  overallScore?: number
  isApproving?: boolean
  onApprove?: () => void
  onDownloadAll?: () => void
  onNewArt?: () => void
  onRegenerateSlide?: (slideIndex: number) => void
  regeneratingSlides?: number[]
}

export function CarouselPreview({
  slides,
  overallScore,
  isApproving = false,
  onApprove,
  onDownloadAll,
  onNewArt,
  onRegenerateSlide,
  regeneratingSlides = [],
}: CarouselPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const doneSlides = slides.filter(s => s.status === 'done' && s.url)
  const failedSlides = slides.filter(s => s.status === 'failed')
  const hasFailures = failedSlides.length > 0

  if (doneSlides.length === 0 && !hasFailures) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Aguardando slides...</p>
      </div>
    )
  }

  const activeSlide = doneSlides[activeIndex] ?? doneSlides[0]
  const total = doneSlides.length

  const prev = () => setActiveIndex(i => Math.max(0, i - 1))
  const next = () => setActiveIndex(i => Math.min(total - 1, i + 1))

  const handleDownloadAll = () => {
    if (onDownloadAll) { onDownloadAll(); return }
    doneSlides.forEach((slide, idx) => {
      const a = document.createElement('a')
      a.href = slide.url
      a.download = `carrossel-slide-${idx + 1}.png`
      a.target = '_blank'
      setTimeout(() => a.click(), idx * 300)
    })
  }

  return (
    <div className="space-y-4">
      {/* Aviso de slides com falha */}
      {hasFailures && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              {failedSlides.length} slide{failedSlides.length > 1 ? 's' : ''} não gerado{failedSlides.length > 1 ? 's' : ''}
            </p>
          </div>
          <p className="text-xs text-amber-700 mb-3">
            Clique em "Regenerar" no slide desejado para tentar novamente sem refazer o carrossel inteiro.
          </p>
          <div className="flex flex-wrap gap-2">
            {failedSlides.map(slide => (
              <button
                key={slide.index}
                onClick={() => onRegenerateSlide?.(slide.index)}
                disabled={regeneratingSlides.includes(slide.index)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors"
              >
                {regeneratingSlides.includes(slide.index)
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                Regenerar Slide {slide.index} — {ROLE_LABELS[slide.role]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Slide principal */}
      {activeSlide && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800">Carrossel gerado</h2>
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', ROLE_COLORS[activeSlide.role])}>
                {ROLE_LABELS[activeSlide.role]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {activeSlide.score > 0 && <ScoreBadge score={activeSlide.score} />}
              {overallScore !== undefined && (
                <span className="text-xs bg-ze-blue/10 text-ze-blue font-bold px-2.5 py-1 rounded-full">
                  Geral: {overallScore}/100
                </span>
              )}
            </div>
          </div>

          <div className="relative mx-auto" style={{ maxWidth: '360px' }}>
            <div className="relative w-full" style={{ paddingBottom: '125%' }}>
              <img
                src={activeSlide.url}
                alt={`Slide ${activeSlide.index} — ${ROLE_LABELS[activeSlide.role]}`}
                className="absolute inset-0 w-full h-full object-cover rounded-xl shadow-sm"
              />
            </div>

            <button onClick={prev} disabled={activeIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={next} disabled={activeIndex === total - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center disabled:opacity-30 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-3 mt-4">
            <span className="text-xs text-slate-500 font-medium">Slide {activeIndex + 1} de {total}</span>
            <div className="flex gap-1.5">
              {doneSlides.map((_, idx) => (
                <button key={idx} onClick={() => setActiveIndex(idx)}
                  className={cn('rounded-full transition-all',
                    idx === activeIndex ? 'w-4 h-2 bg-ze-blue' : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'
                  )} />
              ))}
            </div>
          </div>

          {activeSlide.copyOutput && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl space-y-1">
              {activeSlide.copyOutput.headline && (
                <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{activeSlide.copyOutput.headline}</p>
              )}
              {activeSlide.copyOutput.subline && (
                <p className="text-xs text-slate-600">{activeSlide.copyOutput.subline}</p>
              )}
              {activeSlide.copyOutput.cta && (
                <p className="text-xs font-bold text-ze-orange">{activeSlide.copyOutput.cta}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Thumbnails — todos os slides incluindo falhos */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Todos os slides</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {slides.map((slide) => {
            const doneIdx = doneSlides.findIndex(d => d.index === slide.index)
            const isDone = slide.status === 'done' && !!slide.url
            const isFailed = slide.status === 'failed'
            const isGenerating = slide.status === 'generating' || regeneratingSlides.includes(slide.index)
            const isActive = isDone && doneIdx === activeIndex

            return (
              <div key={slide.index} className="flex-shrink-0 flex flex-col items-center gap-1">
                <button
                  onClick={() => isDone ? setActiveIndex(doneIdx) : undefined}
                  className={cn(
                    'relative rounded-lg overflow-hidden border-2 transition-all',
                    isDone && isActive ? 'border-ze-blue shadow-md scale-105' : '',
                    isDone && !isActive ? 'border-transparent hover:border-slate-300' : '',
                    isFailed ? 'border-red-300' : '',
                    !isDone && !isFailed ? 'border-dashed border-slate-200' : '',
                  )}
                  style={{ width: '56px', height: '70px' }}
                >
                  {isDone ? (
                    <>
                      <img src={slide.url} alt={`Slide ${slide.index}`} className="w-full h-full object-cover" />
                      <span className={cn('absolute bottom-0 left-0 right-0 text-center text-[9px] font-bold py-0.5',
                        ROLE_COLORS[slide.role]
                      )}>
                        {ROLE_LABELS[slide.role]}
                      </span>
                    </>
                  ) : isFailed ? (
                    <div className="w-full h-full bg-red-50 flex flex-col items-center justify-center gap-1">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-[8px] text-red-500 font-semibold text-center px-0.5">{ROLE_LABELS[slide.role]}</span>
                    </div>
                  ) : isGenerating ? (
                    <div className="w-full h-full bg-ze-orange/10 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-ze-orange" />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-slate-100 animate-pulse" />
                  )}
                </button>

                {/* Botão regenerar individual por slide */}
                {isFailed && onRegenerateSlide && (
                  <button
                    onClick={() => onRegenerateSlide(slide.index)}
                    disabled={regeneratingSlides.includes(slide.index)}
                    title={`Regenerar Slide ${slide.index}`}
                    className="w-8 h-5 flex items-center justify-center rounded bg-red-100 hover:bg-red-200 text-red-600 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Ações */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        {onApprove && (
          <button onClick={onApprove} disabled={isApproving}
            className="w-full py-3 rounded-xl bg-green-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-600 transition-colors disabled:opacity-60">
            {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isApproving ? 'Aprovando...' : `Aprovar Carrossel (${doneSlides.length} slides)`}
          </button>
        )}

        <button onClick={handleDownloadAll}
          className="w-full py-3 rounded-xl bg-ze-blue text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
          <Download className="w-4 h-4" />
          Baixar Todos os Slides
        </button>

        {onNewArt && (
          <button onClick={onNewArt}
            className="w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
            Gerar novo carrossel
          </button>
        )}
      </div>
    </div>
  )
}
