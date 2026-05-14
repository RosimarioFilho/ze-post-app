'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Plus, FileText, CheckCircle, Calendar,
  Users, Video, Share2, Settings, LogOut, ChevronDown, ChevronUp, Send, Wand2, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import type { Profile } from '@/types'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/criar-conteudo', label: 'Criar conteúdo', icon: Plus },
  { href: '/studio', label: 'Studio IA', icon: Wand2 },
  { href: '/ze-premium', label: 'Zé Premium ✦', icon: Sparkles },
  { href: '/conteudos', label: 'Conteúdos', icon: FileText },
  { href: '/aprovacoes', label: 'Aprovações', icon: CheckCircle },
  { href: '/publicacoes', label: 'Publicações', icon: Send },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/squad', label: 'Meu Squad', icon: Users },
  { href: '/reuniao', label: 'Reunião', icon: Video },
  { href: '/redes-sociais', label: 'Redes sociais', icon: Share2 },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

interface SidebarProps {
  profile: Profile | null
  pendingCount?: number
}

export function Sidebar({ profile, pendingCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [userOpen, setUserOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const companyName = profile?.company?.name ?? 'Minha empresa'
  const userName = profile?.full_name ?? profile?.email ?? 'Usuário'

  return (
    <aside className="w-[230px] min-h-screen bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-ze-blue rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-sm">Z</span>
          </div>
          <span className="font-black text-lg">
            <span className="text-ze-blue">Zé </span>
            <span className="text-ze-orange">Post</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const isApproval = href === '/aprovacoes'
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-ze-blue/10 text-ze-blue font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {isApproval && pendingCount > 0 && (
                <span className="bg-ze-orange text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Plan */}
      <div className="mx-3 mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-600 capitalize">
            Plano {profile?.company?.plan ?? 'Starter'}
          </span>
          <Link href="/configuracoes" className="text-xs text-ze-blue font-semibold hover:underline">
            Upgrade
          </Link>
        </div>
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full w-2/5 bg-ze-blue rounded-full" />
        </div>
      </div>

      {/* User */}
      <div className="border-t border-slate-100">
        <button
          onClick={() => setUserOpen(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-ze-blue flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {(profile?.full_name ?? 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-semibold text-slate-800 truncate">{userName}</p>
            <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
          </div>
          {userOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </button>
        {userOpen && (
          <div className="px-3 pb-3">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
