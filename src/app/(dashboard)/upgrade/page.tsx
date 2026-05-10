'use client'
import Link from 'next/link'
import { Crown, CheckCircle2, Sparkles, ArrowLeft, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

const FREE_FEATURES = [
  '1 usuário',
  '5 conteúdos por mês',
  'Instagram + Facebook',
  'Squad básico (3 agentes)',
]

const PRO_FEATURES = [
  '3 usuários',
  'Conteúdos ilimitados',
  'Todas as redes sociais (Instagram, Facebook, TikTok, LinkedIn, YouTube)',
  'Squad completo (7 agentes)',
  'Agendamento automático',
  'Carrosseis ilimitados',
  'Aprovações com workflow',
  'Suporte prioritário',
]

export default function UpgradePage() {
  return (
    <div className="p-7 max-w-5xl mx-auto">
      {/* Voltar */}
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-ze-blue mb-5 transition">
        <ArrowLeft className="w-4 h-4" /> Voltar ao dashboard
      </Link>

      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-ze-orange/10 border border-ze-orange/20 rounded-full px-3 py-1.5 mb-4">
          <Crown className="w-4 h-4 text-ze-orange" />
          <span className="text-xs font-bold text-ze-orange uppercase tracking-wider">Upgrade para PRO</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 leading-tight mb-3">
          Liberte todo o potencial do <span className="text-ze-orange">Zé Post</span>
        </h1>
        <p className="text-slate-500 max-w-xl mx-auto">
          Conteúdos ilimitados, todas as redes sociais e seu squad completo de IA trabalhando 24h por você.
        </p>
      </div>

      {/* Comparação */}
      <div className="grid md:grid-cols-2 gap-5 mb-8">
        {/* Free */}
        <div className="rounded-2xl border border-slate-200 bg-white p-7">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-black text-xl text-slate-900">Starter</h2>
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Atual</span>
          </div>
          <p className="text-slate-400 text-sm mb-5">Para conhecer a plataforma</p>
          <div className="mb-6">
            <span className="text-4xl font-black text-slate-900">Grátis</span>
          </div>
          <ul className="flex flex-col gap-3">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* PRO */}
        <div className="rounded-2xl p-7 relative overflow-hidden text-white shadow-2xl"
             style={{ background: 'linear-gradient(155deg, #041e47 0%, #073480 50%, #052d64 100%)' }}>
          <div
            className="absolute -top-12 -right-12 w-48 h-48 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(254,121,2,0.35), transparent 70%)', filter: 'blur(20px)' }}
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-black text-xl flex items-center gap-2">
                <Crown className="w-5 h-5 text-ze-orange" /> PRO
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-ze-orange text-white px-2 py-1 rounded-full">
                Recomendado
              </span>
            </div>
            <p className="text-white/60 text-sm mb-5">Para quem leva sua marca a sério</p>
            <div className="mb-6">
              <span className="text-4xl font-black">R$ 97</span>
              <span className="text-white/60 text-sm"> /mês</span>
            </div>
            <ul className="flex flex-col gap-3 mb-6">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-ze-orange mt-0.5 flex-shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-ze-orange to-orange-500 hover:from-orange-500 hover:to-ze-orange text-white shadow-lg border-none"
            >
              <Sparkles className="w-4 h-4" /> Assinar PRO agora
            </Button>
            <p className="text-center text-[11px] text-white/40 mt-3">
              Cancele quando quiser. Sem fidelidade.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-ze-blue/10 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-ze-blue" />
        </div>
        <div className="flex-1 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Precisa de algo personalizado?</p>
          <p className="text-xs text-slate-400">Para times maiores ou planos enterprise, fale com nosso time.</p>
        </div>
        <Button variant="outline" size="sm">Falar com vendas</Button>
      </div>
    </div>
  )
}
