'use client'
import { useState } from 'react'
import { marked } from 'marked'
import { FileText, Eye, Download, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarkdownEditorProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  fileName?: string
}

export function MarkdownEditor({ value, onChange, placeholder, rows = 12, fileName = 'prompt.md' }: MarkdownEditorProps) {
  const [tab, setTab] = useState<'editor' | 'preview'>('editor')

  function exportMd() {
    const blob = new Blob([value], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  function importMd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => onChange(String(ev.target?.result ?? ''))
    reader.readAsText(file)
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab('editor')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              tab === 'editor' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <FileText className="w-3 h-3" /> Editor (.md)
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              tab === 'preview' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Eye className="w-3 h-3" /> Preview
          </button>
        </div>
        <div className="flex gap-1">
          <label className="cursor-pointer flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1">
            <Upload className="w-3 h-3" /> Importar
            <input type="file" accept=".md,.txt" onChange={importMd} className="hidden" />
          </label>
          <button
            type="button"
            onClick={exportMd}
            disabled={!value}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 disabled:opacity-40"
          >
            <Download className="w-3 h-3" /> Exportar
          </button>
        </div>
      </div>

      {tab === 'editor' ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-4 py-3 bg-white text-sm text-slate-900 outline-none font-mono resize-y leading-relaxed"
          style={{ minHeight: `${rows * 1.625}rem` }}
        />
      ) : (
        <div
          className="px-5 py-4 prose prose-sm max-w-none text-slate-800 leading-relaxed overflow-y-auto"
          style={{ minHeight: `${rows * 1.625}rem` }}
          dangerouslySetInnerHTML={{ __html: value ? marked.parse(value, { async: false }) as string : '<p class="text-slate-400 italic">Nada para visualizar ainda...</p>' }}
        />
      )}
    </div>
  )
}
