'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2, Calendar, ImageIcon, Loader2, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { STATUS_LABELS, CONTENT_TYPE_LABELS } from '@/types'
import { timeAgo } from '@/lib/utils'

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'IG', facebook: 'FB', linkedin: 'LI', youtube: 'YT', tiktok: 'TK',
}

const TYPE_COLORS: Record<string, string> = {
  post_instagram: '#E1306C',
  post_facebook: '#1877F2',
  post_linkedin_imagem: '#0A66C2',
  post_linkedin_texto: '#0A66C2',
  stories: '#fd7d07',
  carrossel: '#8b5cf6',
  youtube: '#FF0000',
  reels: '#000000',
}

const AR_DIMS: Record<string, [number, number]> = {
  post_instagram: [1080, 1080],
  post_facebook: [1080, 566],
  post_linkedin_imagem: [1200, 627],
  post_linkedin_texto: [1080, 1080],
  stories: [1080, 1920],
  carrossel: [1080, 1080],
  youtube: [1280, 720],
  reels: [1080, 1920],
}

interface ContentCardProps {
  content: {
    id: string
    title: string
    content_type: string
    status: string
    platforms: string[]
    body?: string
    media_urls?: string[]
    art_html?: string | null
    art_width?: number | null
    art_height?: number | null
    scheduled_at?: string
    created_at: string
  }
}

function HtmlArtThumbnail({ html, src, dims }: { html?: string; src?: string; dims: [number, number] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.3)
  const [W, H] = dims

  useEffect(() => {
    const update = () => {
      if (containerRef.current) setScale(containerRef.current.offsetWidth / W)
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [W])

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: `${W}/${H}` }}
    >
      <div style={{
        width: W, height: H,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        position: 'absolute', top: 0, left: 0,
        pointerEvents: 'none',
      }}>
        <iframe
          {...(html ? { srcDoc: html } : { src })}
          sandbox="allow-scripts"
          style={{ width: W, height: H, border: 'none', display: 'block' }}
          title="Arte gerada"
        />
      </div>
    </div>
  )
}

export function ContentCard({ content: c }: ContentCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const st = STATUS_LABELS[c.status as keyof typeof STATUS_LABELS]
  const typeColor = TYPE_COLORS[c.content_type] ?? '#6b7280'

  const artHtmlUrl = c.media_urls?.find(u => u.endsWith('.html'))
  const artImageUrl = c.media_urls?.find(u => !u.endsWith('.html'))
  const hasArtHtml = !!c.art_html
  const dims: [number, number] = c.art_width && c.art_height
    ? [c.art_width, c.art_height]
    : (AR_DIMS[c.content_type] ?? [1080, 1080])
  const aspectRatio = `${dims[0]}/${dims[1]}`

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('approvals').delete().eq('content_id', c.id)
    await supabase.from('contents').delete().eq('id', c.id)
    router.refresh()
  }

  async function downloadArt() {
    const htmlText = c.art_html
      ? c.art_html
      : artHtmlUrl
      ? await fetch(artHtmlUrl).then(r => r.text())
      : null
    if (!htmlText) return
    setDownloading(true)
    try {
      const res = await fetch('/api/arte-png', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlText, width: dims[0], height: dims[1] }),
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `criativo-${c.content_type}-${dims[0]}x${dims[1]}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download PNG falhou:', err)
      const blob = new Blob([htmlText], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'criativo.html'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
      {/* Thumbnail */}
      <div
        className="relative w-full flex items-center justify-center overflow-hidden"
        style={{ aspectRatio, backgroundColor: typeColor + '15' }}
      >
        {hasArtHtml ? (
          <HtmlArtThumbnail html={c.art_html!} dims={dims} />
        ) : artHtmlUrl ? (
          <HtmlArtThumbnail src={artHtmlUrl} dims={dims} />
        ) : artImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artImageUrl}
            alt={c.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-8">
            <ImageIcon className="w-10 h-10 opacity-30" style={{ color: typeColor }} />
            <span className="text-xs font-medium opacity-50" style={{ color: typeColor }}>
              {CONTENT_TYPE_LABELS[c.content_type as keyof typeof CONTENT_TYPE_LABELS]}
            </span>
          </div>
        )}

        {/* Status */}
        <div className="absolute top-2 right-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st?.color ?? 'bg-slate-100 text-slate-600'}`}>
            {st?.label}
          </span>
        </div>

        {/* Tipo */}
        <div
          className="absolute top-2 left-2 text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: typeColor }}
        >
          {CONTENT_TYPE_LABELS[c.content_type as keyof typeof CONTENT_TYPE_LABELS]}
        </div>

        {/* Action buttons — aparecem no hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Link href={`/conteudos/${c.id}/editar`}>
            <button className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl text-xs font-bold text-slate-800 hover:bg-slate-100 transition-colors shadow">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          </Link>
          {(hasArtHtml || artHtmlUrl) && (
            <button
              onClick={downloadArt}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-2 bg-ze-blue text-white rounded-xl text-xs font-bold hover:bg-ze-blue/90 transition-colors shadow disabled:opacity-60"
            >
              {downloading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" />
              }
              {downloading ? 'Exportando...' : 'Baixar PNG'}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow ${
              confirmDelete
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-white text-red-500 hover:bg-red-50'
            }`}
          >
            {deleting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />
            }
            {deleting ? 'Deletando...' : confirmDelete ? 'Confirmar?' : 'Deletar'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 mb-2">{c.title}</h3>

        {c.body && (
          <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">{c.body}</p>
        )}

        {c.platforms?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {c.platforms.map((p: string) => (
              <span
                key={p}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
              >
                {PLATFORM_LABELS[p] ?? p}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">{timeAgo(c.created_at)}</span>
          <div className="flex items-center gap-2">
            {c.scheduled_at && (
              <span className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold">
                <Calendar className="w-3 h-3" /> Agendado
              </span>
            )}
            <div className="flex gap-1">
              {(hasArtHtml || artHtmlUrl) && (
                <button
                  onClick={downloadArt}
                  disabled={downloading}
                  title="Baixar arte como PNG"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-ze-blue hover:bg-ze-blue/10 transition-colors disabled:opacity-40"
                >
                  {downloading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />
                  }
                </button>
              )}
              <Link href={`/conteudos/${c.id}/editar`}>
                <button className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-ze-blue hover:bg-ze-blue/10 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                  confirmDelete
                    ? 'bg-red-500 text-white'
                    : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                }`}
              >
                {deleting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          </div>
        </div>

        {confirmDelete && !deleting && (
          <p className="text-[10px] text-red-500 font-semibold mt-1 text-right">
            Clique novamente para confirmar
          </p>
        )}
      </div>
    </div>
  )
}
