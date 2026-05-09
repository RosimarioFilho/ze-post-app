'use client'
import { useState, useEffect, useRef } from 'react'
import { Send, Video, VideoOff, Users, Bot } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { SQUAD_ROLES } from '@/types'
import type { SquadMember } from '@/types'
import { timeAgo } from '@/lib/utils'

interface ChatMsg {
  id: string
  sender_type: 'user' | 'agent'
  user_id?: string
  agent_role?: string
  agent_name?: string
  message: string
  created_at: string
}

const ROLE_COLORS: Record<string, string> = {
  estrategista: '#3b82f6',
  copywriter: '#8b5cf6',
  designer: '#ec4899',
  social_media: '#10b981',
  pesquisador: '#f59e0b',
  postador: '#06b6d4',
}

export default function ReuniaoPage() {
  const [squad, setSquad] = useState<SquadMember[]>([])
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [active, setActive] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [profile, setProfile] = useState<{ full_name?: string; company_id?: string } | null>(null)
  const [recipient, setRecipient] = useState<string>('all')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('full_name, company_id').eq('id', user.id).single()
    setProfile(p)
    if (p?.company_id) {
      const { data: s } = await supabase.from('squad_members').select('*').eq('company_id', p.company_id).eq('is_active', true)
      setSquad(s ?? [])
    }
  }

  async function startMeeting() {
    setActive(true)
    setMessages([{
      id: crypto.randomUUID(),
      sender_type: 'agent',
      agent_role: 'estrategista',
      agent_name: 'Assistente Zé',
      message: `Reunião iniciada! Envie uma mensagem para começar a conversa com seu squad. Todos os agentes ativos participarão da reunião. 🚀`,
      created_at: new Date().toISOString(),
    }])
  }

  async function sendMessage() {
    if (!input.trim() || sending) return
    const userMsg: ChatMsg = {
      id: crypto.randomUUID(),
      sender_type: 'user',
      message: input.trim(),
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    const text = input.trim()
    setInput('')
    setSending(true)

    const agentsToCall = recipient === 'all'
      ? squad
      : squad.filter(s => s.role === recipient)

    try {
      const res = await fetch('/api/reuniao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          agents: agentsToCall,
          sessionId,
          companyId: profile?.company_id,
          history: messages.slice(-8).map(m => ({
            role: m.sender_type === 'user' ? 'user' : 'assistant',
            content: m.message,
          })),
        }),
      })
      const data = await res.json()
      if (data.responses) {
        const agentMsgs: ChatMsg[] = data.responses.map((r: { agent_role: string; agent_name: string; message: string }) => ({
          id: crypto.randomUUID(),
          sender_type: 'agent' as const,
          agent_role: r.agent_role,
          agent_name: r.agent_name,
          message: r.message,
          created_at: new Date().toISOString(),
        }))
        setMessages(prev => [...prev, ...agentMsgs])
      }
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        sender_type: 'agent',
        agent_name: 'Sistema',
        message: 'Erro ao processar resposta. Verifique a chave da API.',
        created_at: new Date().toISOString(),
      }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-7 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-ze-blue/10 rounded-xl flex items-center justify-center">
            <Video className="w-5 h-5 text-ze-blue" />
          </div>
          <div>
            <h1 className="font-black text-slate-900">Reunião com o Squad</h1>
            <p className="text-xs text-slate-400">{active ? `${squad.length} agentes ativos` : 'Inicie uma reunião para conversar com seu squad'}</p>
          </div>
        </div>
        {active && (
          <Button variant="danger" size="sm" onClick={() => { setActive(false); setMessages([]) }}>
            <VideoOff className="w-4 h-4" /> Finalizar Reunião
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            {!active ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-20 h-20 bg-ze-blue/10 rounded-full flex items-center justify-center">
                  <Users className="w-10 h-10 text-ze-blue" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Iniciar Reunião</h3>
                <p className="text-slate-500 text-center max-w-xs">
                  Converse em tempo real com seu squad de IA sobre criação de conteúdo, agendamentos, ideias e muito mais.
                </p>
                <Button onClick={startMeeting} size="lg" disabled={squad.length === 0}>
                  <Video className="w-5 h-5" />
                  {squad.length === 0 ? 'Configure seu squad primeiro' : 'Iniciar Reunião'}
                </Button>
              </div>
            ) : (
              <>
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-3 ${msg.sender_type === 'user' ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                      style={{
                        backgroundColor: msg.sender_type === 'user'
                          ? '#052d64'
                          : ROLE_COLORS[msg.agent_role ?? ''] ?? '#6b7280',
                      }}
                    >
                      {msg.sender_type === 'user'
                        ? (profile?.full_name?.[0] ?? 'V').toUpperCase()
                        : <Bot className="w-4 h-4" />
                      }
                    </div>
                    {/* Bubble */}
                    <div className={`flex flex-col gap-0.5 max-w-[70%] ${msg.sender_type === 'user' ? 'items-end' : ''}`}>
                      {msg.sender_type === 'agent' && (
                        <span className="text-xs font-semibold text-slate-500">
                          {msg.agent_name} · {SQUAD_ROLES[msg.agent_role as keyof typeof SQUAD_ROLES]?.label ?? 'Agente'}
                        </span>
                      )}
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.sender_type === 'user'
                          ? 'bg-ze-blue text-white rounded-tr-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                      }`}>
                        {msg.message}
                      </div>
                      <span className="text-[11px] text-slate-400">{timeAgo(msg.created_at)}</span>
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <div className="flex gap-1 items-center h-4">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          {active && (
            <div className="p-4 border-t border-slate-200 bg-white">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-slate-500">Para:</span>
                <select
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-ze-blue"
                >
                  <option value="all">Todo o time</option>
                  {squad.map(s => (
                    <option key={s.id} value={s.role}>{s.name}</option>
                  ))}
                </select>
              </div>
              <form
                onSubmit={e => { e.preventDefault(); sendMessage() }}
                className="flex gap-3"
              >
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Digite sua mensagem para o squad..."
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-ze-blue focus:ring-2 focus:ring-ze-blue/10 transition-colors"
                  disabled={sending}
                />
                <Button type="submit" disabled={!input.trim() || sending} loading={sending}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          )}
        </div>

        {/* Participants sidebar */}
        {active && (
          <div className="w-72 border-l border-slate-200 bg-white p-4">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" /> Participantes
              <span className="ml-auto text-xs text-slate-400">{squad.length + 1} ativos</span>
            </h3>
            {/* Você */}
            <div className="flex items-center gap-3 p-2 rounded-xl bg-ze-blue/5 border border-ze-blue/20 mb-2">
              <div className="w-9 h-9 rounded-full bg-ze-blue flex items-center justify-center">
                <span className="text-white text-sm font-bold">{(profile?.full_name?.[0] ?? 'V').toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">Você</p>
                <p className="text-xs text-slate-400">Organizador</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-green-400" />
            </div>
            {/* Agents */}
            {squad.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors mb-1">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: ROLE_COLORS[s.role] + '20' }}
                >
                  <Bot className="w-4 h-4" style={{ color: ROLE_COLORS[s.role] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{s.name}</p>
                  <p className="text-xs text-slate-400">{SQUAD_ROLES[s.role]?.label}</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-green-400" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
