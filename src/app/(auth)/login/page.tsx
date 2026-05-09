'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-14px); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.25; transform: translate(-50%, -50%) scale(1); }
          50%       { opacity: 0.40; transform: translate(-50%, -50%) scale(1.12); }
        }
        @keyframes badge-pop {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mascot-float { animation: float 3.6s ease-in-out infinite; }
        .glow-orb     { animation: glow-pulse 3.6s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen flex">

        {/* ── LEFT PANEL ── */}
        <div
          className="hidden lg:flex flex-col w-[500px] relative overflow-hidden text-white flex-shrink-0"
          style={{ background: 'linear-gradient(155deg, #041e47 0%, #073480 50%, #052d64 100%)' }}
        >
          {/* Decorative blobs */}
          <div
            className="absolute -top-24 -right-24 w-80 h-80 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(254,121,2,0.18), transparent 70%)', filter: 'blur(20px)' }}
          />
          <div
            className="absolute top-1/2 -left-20 w-60 h-60 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(77,163,255,0.10), transparent 70%)', filter: 'blur(30px)' }}
          />

          {/* Logo — versão dark (branco) para fundo azul */}
          <div className="relative z-10 p-10 pb-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo-ze-post-dark.svg" alt="Zé Post" className="w-40" />
          </div>

          {/* Headline */}
          <div className="relative z-10 px-10 pt-10">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1.5 mb-5">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-semibold text-white/80">Squad de IA trabalhando por você</span>
            </div>
            <h1 className="text-[52px] font-black leading-[0.92] tracking-tight">
              Eu crio.<br />
              Eu posto.<br />
              <span style={{ color: '#fe7902' }}>Você cresce!</span>
            </h1>
            <p className="text-white/55 text-[15px] leading-relaxed mt-4 max-w-[300px]">
              Plataforma de criação, agendamento e postagem automática com IA nas principais redes sociais.
            </p>
          </div>

          {/* Mascot area — fills remaining space */}
          <div className="flex-1 relative flex items-end justify-center mt-4" style={{ minHeight: 320 }}>
            {/* Orange glow orb behind mascot */}
            <div
              className="glow-orb absolute rounded-full"
              style={{
                width: 340,
                height: 240,
                background: 'radial-gradient(ellipse, rgba(254,121,2,0.35), transparent 70%)',
                bottom: '8%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
            {/* Blue floor shadow */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-52 h-6 rounded-full opacity-50"
              style={{ background: 'rgba(0,0,0,0.35)', filter: 'blur(12px)' }}
            />
            {/* Mascot */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/mascote-ze-post.webp"
              alt="Mascote Zé Post"
              className="mascot-float relative z-10 select-none"
              style={{
                height: 360,
                width: 'auto',
                objectFit: 'contain',
                filter: 'drop-shadow(0 -4px 20px rgba(254,121,2,0.22)) drop-shadow(0 24px 40px rgba(4,30,71,0.6))',
                marginBottom: -10,
              }}
              draggable={false}
            />
          </div>

          {/* Platform tags */}
          <div className="relative z-10 px-10 py-7 flex gap-2 flex-wrap"
               style={{ background: 'linear-gradient(to top, rgba(4,30,71,0.9) 0%, transparent 100%)' }}>
            {['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube'].map((n, i) => (
              <span
                key={n}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-white/15 bg-white/8 text-white/70"
                style={{ animationDelay: `${i * 0.08}s`, backdropFilter: 'blur(4px)' }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 bg-slate-50">
          <div className="w-full max-w-md">

            {/* Mobile logo — visível só em telas pequenas */}
            <div className="lg:hidden flex justify-center mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/logo-ze-post.svg" alt="Zé Post" className="h-9 w-auto" />
            </div>

            {/* Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">

              {/* Logo acima do formulário */}
              <div className="flex justify-center mb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/logo-ze-post.svg" alt="Zé Post" className="h-9 w-auto" />
              </div>

              {/* Título centralizado */}
              <div className="text-center mb-7">
                <h2 className="text-2xl font-black text-slate-900 leading-tight">Entrar na plataforma</h2>
                <p className="text-slate-400 text-sm mt-1">Bem-vindo de volta! 👋</p>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 mt-3.5" />
                  <Input
                    id="email"
                    type="email"
                    label="E-mail"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 mt-3.5" />
                  <Input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    label="Senha"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-9 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 translate-y-1 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
                  Entrar
                </Button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                Não tem conta?{' '}
                <Link href="/register" className="text-ze-blue font-semibold hover:underline">
                  Criar agora
                </Link>
              </p>
            </div>

            {/* Back to landing */}
            <p className="text-center text-xs text-slate-400 mt-5">
              <Link href="/" className="hover:text-ze-blue transition-colors">
                ← Voltar ao site
              </Link>
            </p>
          </div>
        </div>

      </div>
    </>
  )
}
