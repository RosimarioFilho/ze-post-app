'use client'
import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CONTENT_TYPE_LABELS } from '@/types'
import { timeAgo } from '@/lib/utils'

interface ApprovalItem {
  id: string
  status: string
  comment?: string
  created_at: string
  content: { id: string; title: string; content_type: string; body?: string } | null
}

export default function AprovacoesPage() {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState<Record<string, string>>({})
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    const { data } = await supabase
      .from('approvals')
      .select('*, content:contents(id,title,content_type,body)')
      .eq('company_id', p?.company_id)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  async function decide(approvalId: string, contentId: string, decision: 'aprovado' | 'rejeitado') {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('approvals').update({
      status: decision, reviewed_by: user?.id, comment: comment[approvalId] || null,
    }).eq('id', approvalId)
    await supabase.from('contents').update({
      status: decision === 'aprovado' ? 'aprovado' : 'rejeitado',
    }).eq('id', contentId)
    load()
  }

  return (
    <div className="p-7">
      <div className="mb-7">
        <h1 className="text-2xl font-black text-slate-900">Aprovações</h1>
        <p className="text-slate-500 text-sm mt-0.5">Revise e aprove os conteúdos do seu squad.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">Carregando...</div>
      ) : !items.length ? (
        <Card>
          <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
            <CheckCircle className="w-12 h-12 opacity-30" />
            <p className="font-medium">Nenhuma aprovação pendente</p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map(item => (
            <Card key={item.id}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900">{item.content?.title}</h3>
                      <Badge variant={item.status === 'pendente' ? 'yellow' : item.status === 'aprovado' ? 'green' : 'red'}>
                        {item.status === 'pendente' ? 'Pendente' : item.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400">
                      {CONTENT_TYPE_LABELS[item.content?.content_type as keyof typeof CONTENT_TYPE_LABELS]} · {timeAgo(item.created_at)}
                    </p>
                  </div>
                  {item.status === 'pendente' && <Clock className="w-5 h-5 text-orange-500 flex-shrink-0" />}
                  {item.status === 'aprovado' && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
                  {item.status === 'rejeitado' && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                </div>

                {item.content?.body && (
                  <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed max-h-32 overflow-y-auto">
                    {item.content.body}
                  </div>
                )}

                {item.status === 'pendente' && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      <input
                        placeholder="Adicionar comentário (opcional)..."
                        value={comment[item.id] ?? ''}
                        onChange={e => setComment(c => ({ ...c, [item.id]: e.target.value }))}
                        className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-ze-blue"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => decide(item.id, item.content?.id ?? '', 'rejeitado')}
                      >
                        <XCircle className="w-4 h-4" /> Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-600 text-white"
                        onClick={() => decide(item.id, item.content?.id ?? '', 'aprovado')}
                      >
                        <CheckCircle className="w-4 h-4" /> Aprovar
                      </Button>
                    </div>
                  </>
                )}
                {item.comment && (
                  <p className="text-sm text-slate-500 mt-3 italic">"{item.comment}"</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
