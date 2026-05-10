'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Crown, CheckCircle2, Sparkles, ArrowLeft, ArrowRight, Check, X,
  Zap, ShieldCheck, CreditCard, Loader2, PartyPopper, Building2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { Company, Plan } from '@/types'

// ─── Definição de planos ───────────────────────────────────────────────
type PlanId = Plan | 'business'

interface PlanDef {
  id: PlanId
  name: string
  tagline: string
  price: number          // valor em R$ por mês (0 = grátis, -1 = sob consulta)
  badge?: string
  highlight?: boolean
  features: string[]
  cta: string
}

const PLANS: PlanDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Para conhecer a plataforma',
    price: 0,
    features: [
      '1 usuário',
      '5 conteúdos por mês',
      'Instagram + Facebook',
      'Squad básico (3 agentes)',
      'Suporte por e-mail',
    ],
    cta: 'Plano gratuito',
  },
  {
    id: 'pro',
    name: 'PRO',
    tagline: 'Para quem leva sua marca a sério',
    price: 97,
    badge: 'Mais popular',
    highlight: true,
    features: [
      '3 usuários',
      'Conteúdos ilimitados',
      'Todas as redes sociais',
      'Squad completo (7 agentes)',
      'Agendamento automático',
      'Carrosseis ilimitados',
      'Suporte prioritário',
    ],
    cta: 'Fazer upgrade para PRO',
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'Para times e operações em escala',
    price: 297,
    features: [
      '10 usuários',
      'Tudo do PRO',
      'Múltiplas marcas/empresas',
      'API e integrações personalizadas',
      'Squad customizado',
      'Gerente de sucesso dedicado',
      'SLA premium',
    ],
    cta: 'Falar com vendas',
  },
]

// ─── Tabela comparativa ────────────────────────────────────────────────
type Cell = boolean | string
const COMPARISON: { feature: string; starter: Cell; pro: Cell; business: Cell }[] = [
  { feature: 'Usuários',                  starter: '1',   pro: '3',           business: '10' },
  { feature: 'Conteúdos por mês',         starter: '5',   pro: 'Ilimitado',   business: 'Ilimitado' },
  { feature: 'Instagram + Facebook',      starter: true,  pro: true,          business: true },
  { feature: 'TikTok / LinkedIn / YouTube', starter: false, pro: true,        business: true },
  { feature: 'Squad de IA completo',      starter: false, pro: true,          business: true },
  { feature: 'Agendamento automático',    starter: false, pro: true,          business: true },
  { feature: 'Carrosseis',                starter: false, pro: true,          business: true },
  { feature: 'Aprovações com workflow',   starter: false, pro: true,          business: true },
  { feature: 'Múltiplas marcas',          starter: false, pro: false,         business: true },
  { feature: 'API / Integrações',         starter: false, pro: false,         business: true },
  { feature: 'Gerente dedicado',          starter: false, pro: false,         business: true },
  { feature: 'Suporte',                   starter: 'E-mail', pro: 'Prioritário', business: 'SLA premium' },
]

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

export default function UpgradeAssinaturaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState<Partial<Company>>({})
  const [step, setStep] = useState<'select' | 'summary' | 'success'>('select')
  const [selected, setSelected] = useState<PlanDef | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: p } = await supabase
      .from('profiles')
      .select('*, company:companies(*)')
      .eq('id', user.id)
      .single()
    const c: Partial<Company> = (p as { company?: Company })?.company ?? {}
    setCompany(c)
    setLoading(false)
  }

  const currentPlanId: PlanId = (company.plan ?? 'starter') as PlanId
  const currentPlan = PLANS.find(p => p.id === currentPlanId) ?? PLANS[0]

  // Planos superiores ao atual
  const upgradeOptions = PLANS.filter(p => {
    if (currentPlanId === 'starter') return p.id !== 'starter'
    if (currentPlanId === 'pro')     return p.id === 'business'
    return false
  })

  function selectPlan(plan: PlanDef) {
    setSelected(plan)
    setStep('summary')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function confirmUpgrade() {
    if (!selected || !company.id) return
    setConfirming(true)

    if (selected.id === 'business') {
      // Plano Business — encaminhar para vendas (mailto)
      window.location.href =
        `mailto:vendas@zepost.com?subject=Interesse no plano Business&body=Quero saber mais sobre o plano Business para a empresa ${encodeURIComponent(company.name ?? '')}.`
      setConfirming(false)
      return
    }

    // Upgrade direto para PRO (sem gateway integrado ainda — ativa imediatamente)
    const { error } = await supabase
      .from('companies')
      .update({ plan: selected.id as Plan })
      .eq('id', company.id)

    setConfirming(false)
    if (!error) {
      setStep('success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      alert('Não foi possível concluir o upgrade. Tente novamente.')
      console.error(error)
    }
  }

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
      </div>
    )
  }

  // ───────────────────────── Tela: SUCESSO ─────────────────────────────
  if (step === 'success' && selected) {
    return (
      <div className="p-7 max-w-2xl mx-auto">
        <div className="rounded-3xl p-10 text-center text-white relative overflow-hidden"
             style={{ background: 'linear-gradient(155deg, #041e47 0%, #073480 50%, #052d64 100%)' }}>
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full"
               style={{ background: 'radial-gradient(circle, rgba(254,121,2,0.4), transparent 70%)', filter: 'blur(20px)' }} />
          <div className="relative z-10">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-ze-orange to-orange-500 flex items-center justify-center shadow-2xl mb-6">
              <PartyPopper className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black mb-2">Bem-vindo ao plano {selected.name}!</h1>
            <p className="text-white/70 mb-8">
              Sua conta foi atualizada e todos os recursos já estão liberados.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/dashboard">
                <Button className="bg-gradient-to-r from-ze-orange to-orange-500 hover:from-orange-500 hover:to-ze-orange text-white border-none">
                  <Sparkles className="w-4 h-4" /> Ir para o dashboard
                </Button>
              </Link>
              <Link href="/configuracoes">
                <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
                  Ver configurações
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ───────────────────────── Tela: RESUMO ──────────────────────────────
  if (step === 'summary' && selected) {
    return (
      <div className="p-7 max-w-3xl mx-auto">
        <button
          onClick={() => setStep('select')}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-ze-blue mb-5 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para os planos
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 mb-2">Resumo do upgrade</h1>
          <p className="text-slate-500 text-sm">Confira os detalhes antes de confirmar a alteração do seu plano.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* De → Para */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            <div className="p-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Plano atual</p>
              <h3 className="font-black text-xl text-slate-900">{currentPlan.name}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{currentPlan.tagline}</p>
              <p className="mt-3 text-2xl font-black text-slate-700">
                {currentPlan.price === 0 ? 'Grátis' : `${formatBRL(currentPlan.price)}/mês`}
              </p>
            </div>
            <div className="p-6 bg-gradient-to-br from-ze-blue/5 to-ze-orange/5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ze-orange mb-2 flex items-center gap-1">
                <Crown className="w-3 h-3" /> Novo plano
              </p>
              <h3 className="font-black text-xl text-slate-900 flex items-center gap-2">
                {selected.name}
                {selected.badge && (
                  <span className="text-[10px] font-bold bg-ze-orange text-white px-2 py-0.5 rounded-full">
                    {selected.badge}
                  </span>
                )}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">{selected.tagline}</p>
              <p className="mt-3 text-2xl font-black text-ze-blue">
                {selected.price === -1 ? 'Sob consulta' : selected.price === 0 ? 'Grátis' : `${formatBRL(selected.price)}/mês`}
              </p>
            </div>
          </div>

          {/* O que muda */}
          <div className="border-t border-slate-200 p-6">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-ze-orange" /> O que você ganha com o {selected.name}
            </h4>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {selected.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Total */}
          {selected.price > 0 && (
            <div className="border-t border-slate-200 p-6 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Cobrança mensal recorrente</p>
                  <p className="text-xs text-slate-400 mt-0.5">Cancele quando quiser. Sem fidelidade.</p>
                </div>
                <p className="text-2xl font-black text-slate-900">{formatBRL(selected.price)}<span className="text-sm font-normal text-slate-400">/mês</span></p>
              </div>
            </div>
          )}

          {/* Garantias */}
          <div className="border-t border-slate-200 p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span><b>7 dias de garantia.</b> Não gostou? Devolvemos 100%.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <CreditCard className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span><b>Pagamento seguro.</b> Cartão, Pix ou boleto.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <Zap className="w-4 h-4 text-ze-orange flex-shrink-0 mt-0.5" />
              <span><b>Ativação imediata.</b> Use os recursos na hora.</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setStep('select')}>
            Voltar
          </Button>
          <Button
            size="lg"
            onClick={confirmUpgrade}
            loading={confirming}
            className="bg-gradient-to-r from-ze-orange to-orange-500 hover:from-orange-500 hover:to-ze-orange text-white border-none shadow-md"
          >
            {selected.id === 'business' ? <>Falar com vendas <ArrowRight className="w-4 h-4" /></> : <><CheckCircle2 className="w-4 h-4" /> Confirmar upgrade</>}
          </Button>
        </div>
      </div>
    )
  }

  // ───────────────────────── Tela: SELEÇÃO ─────────────────────────────
  return (
    <div className="p-7 max-w-6xl mx-auto">
      {/* Voltar */}
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-ze-blue mb-5 transition">
        <ArrowLeft className="w-4 h-4" /> Voltar ao dashboard
      </Link>

      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-ze-orange/10 border border-ze-orange/20 rounded-full px-3 py-1.5 mb-4">
          <Crown className="w-4 h-4 text-ze-orange" />
          <span className="text-xs font-bold text-ze-orange uppercase tracking-wider">Upgrade de plano</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 leading-tight mb-3">
          Escolha o plano ideal para o seu negócio
        </h1>
        <p className="text-slate-500 max-w-xl mx-auto">
          Compare os planos, veja tudo o que cada um oferece e faça upgrade em poucos cliques.
        </p>
      </div>

      {/* 1️⃣ Plano Atual */}
      <section className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Seu plano atual</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
            {currentPlanId === 'starter'
              ? <Sparkles className="w-6 h-6 text-slate-500" />
              : currentPlanId === 'pro'
                ? <Crown className="w-6 h-6 text-ze-orange" />
                : <Building2 className="w-6 h-6 text-ze-blue" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-lg text-slate-900">{currentPlan.name}</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Ativo
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{currentPlan.tagline}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-black text-slate-900">
              {currentPlan.price === 0 ? 'Grátis' : formatBRL(currentPlan.price)}
            </p>
            {currentPlan.price > 0 && <p className="text-xs text-slate-400">por mês</p>}
          </div>
        </div>
      </section>

      {/* 2️⃣ Cartões de planos disponíveis */}
      {upgradeOptions.length > 0 ? (
        <section className="mb-12">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Planos disponíveis</h2>
          <div className={`grid gap-5 ${upgradeOptions.length === 1 ? 'md:max-w-md mx-auto' : 'md:grid-cols-2'}`}>
            {upgradeOptions.map(plan => (
              <PlanCard key={plan.id} plan={plan} onSelect={() => selectPlan(plan)} />
            ))}
          </div>
        </section>
      ) : (
        <section className="mb-12 rounded-2xl border-2 border-dashed border-green-200 bg-green-50/50 p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-green-100 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="font-black text-xl text-slate-900 mb-1">Você está no plano máximo!</h3>
          <p className="text-sm text-slate-500">Aproveite todos os recursos premium do Zé Post.</p>
        </section>
      )}

      {/* 3️⃣ Comparativo de funcionalidades */}
      <section className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Comparativo completo</h2>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-700">Recurso</th>
                  <th className={`text-center px-5 py-3.5 font-bold ${currentPlanId === 'starter' ? 'text-ze-blue' : 'text-slate-700'}`}>
                    Starter {currentPlanId === 'starter' && <span className="text-[10px] font-bold ml-1 bg-ze-blue/10 text-ze-blue px-1.5 py-0.5 rounded-full">ATUAL</span>}
                  </th>
                  <th className={`text-center px-5 py-3.5 font-bold ${currentPlanId === 'pro' ? 'text-ze-blue' : 'text-ze-orange'}`}>
                    PRO {currentPlanId === 'pro' && <span className="text-[10px] font-bold ml-1 bg-ze-blue/10 text-ze-blue px-1.5 py-0.5 rounded-full">ATUAL</span>}
                  </th>
                  <th className={`text-center px-5 py-3.5 font-bold ${currentPlanId === 'business' ? 'text-ze-blue' : 'text-slate-700'}`}>
                    Business {currentPlanId === 'business' && <span className="text-[10px] font-bold ml-1 bg-ze-blue/10 text-ze-blue px-1.5 py-0.5 rounded-full">ATUAL</span>}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    <td className="px-5 py-3 text-slate-700 font-medium">{row.feature}</td>
                    <td className="text-center px-5 py-3"><Cell value={row.starter} /></td>
                    <td className="text-center px-5 py-3"><Cell value={row.pro} highlight /></td>
                    <td className="text-center px-5 py-3"><Cell value={row.business} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td className="px-5 py-4 font-bold text-slate-900">Preço</td>
                  <td className="text-center px-5 py-4 font-black text-slate-900">Grátis</td>
                  <td className="text-center px-5 py-4 font-black text-ze-orange">R$ 97/mês</td>
                  <td className="text-center px-5 py-4 font-black text-slate-900">R$ 297/mês</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* Garantia */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-4">
        <ShieldCheck className="w-7 h-7 text-green-500 flex-shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-bold text-slate-900">7 dias de garantia incondicional</p>
          <p className="text-slate-500 text-xs mt-0.5">Se não gostar, devolvemos 100% do valor. Sem perguntas.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Subcomponentes ────────────────────────────────────────────────────
function Cell({ value, highlight = false }: { value: Cell; highlight?: boolean }) {
  if (typeof value === 'boolean') {
    return value
      ? <Check className={`w-4 h-4 mx-auto ${highlight ? 'text-ze-orange' : 'text-green-500'}`} />
      : <X className="w-4 h-4 mx-auto text-slate-300" />
  }
  return <span className={`text-sm font-semibold ${highlight ? 'text-ze-orange' : 'text-slate-700'}`}>{value}</span>
}

function PlanCard({ plan, onSelect }: { plan: PlanDef; onSelect: () => void }) {
  const isHighlight = plan.highlight
  return (
    <div
      className={`rounded-2xl p-7 relative overflow-hidden transition-all ${
        isHighlight
          ? 'text-white shadow-2xl scale-[1.02]'
          : 'border border-slate-200 bg-white shadow-sm hover:shadow-md'
      }`}
      style={isHighlight ? { background: 'linear-gradient(155deg, #041e47 0%, #073480 50%, #052d64 100%)' } : undefined}
    >
      {isHighlight && (
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(254,121,2,0.35), transparent 70%)', filter: 'blur(20px)' }}
        />
      )}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1">
          <h3 className={`font-black text-xl flex items-center gap-2 ${isHighlight ? 'text-white' : 'text-slate-900'}`}>
            {plan.id === 'pro' && <Crown className={`w-5 h-5 ${isHighlight ? 'text-ze-orange' : 'text-ze-orange'}`} />}
            {plan.id === 'business' && <Building2 className="w-5 h-5 text-ze-blue" />}
            {plan.name}
          </h3>
          {plan.badge && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-ze-orange text-white px-2 py-1 rounded-full">
              {plan.badge}
            </span>
          )}
        </div>
        <p className={`text-sm mb-5 ${isHighlight ? 'text-white/60' : 'text-slate-400'}`}>{plan.tagline}</p>
        <div className="mb-6">
          {plan.price === 0 ? (
            <span className={`text-4xl font-black ${isHighlight ? 'text-white' : 'text-slate-900'}`}>Grátis</span>
          ) : plan.price === -1 ? (
            <span className={`text-4xl font-black ${isHighlight ? 'text-white' : 'text-slate-900'}`}>Sob consulta</span>
          ) : (
            <>
              <span className={`text-4xl font-black ${isHighlight ? 'text-white' : 'text-slate-900'}`}>{formatBRL(plan.price)}</span>
              <span className={`text-sm ${isHighlight ? 'text-white/60' : 'text-slate-400'}`}> /mês</span>
            </>
          )}
        </div>
        <ul className="flex flex-col gap-2.5 mb-6">
          {plan.features.map(f => (
            <li key={f} className={`flex items-start gap-2 text-sm ${isHighlight ? 'text-white' : 'text-slate-600'}`}>
              <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isHighlight ? 'text-ze-orange' : 'text-green-500'}`} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Button
          size="lg"
          onClick={onSelect}
          className={`w-full ${
            isHighlight
              ? 'bg-gradient-to-r from-ze-orange to-orange-500 hover:from-orange-500 hover:to-ze-orange text-white border-none shadow-lg'
              : ''
          }`}
        >
          {plan.cta} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
