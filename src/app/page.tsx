import Link from 'next/link'
import { Manrope, Sora } from 'next/font/google'
import styles from './lp.module.css'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
})

const sora = Sora({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
})

export const metadata = {
  title: 'Zé Post | Seu postador automático de conteúdo.',
  description:
    'Transforme o que você já sabe em posts prontos para atrair clientes, mesmo sem tempo, sem inspiração e sem depender de terceiros.',
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: 'Dashboard Inteligente',
    desc: 'Seu assistente cuida da organização, sugestões de conteúdo e analisa métricas de engajamento para você focar apenas no que importa: crescer.',
    path: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    title: 'Criação Multiformato',
    desc: 'Descreva o que deseja e nossa IA cria tudo. Gere posts, carrosséis, stories e reels nos formatos e tamanhos ideais para suas redes sociais.',
    path: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    title: 'Calendário de Publicações',
    desc: 'Gerencie o agendamento de conteúdos aprovados nas redes sociais de forma fácil, com uma visão completa da sua programação mensal.',
    path: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    title: 'Meu Squad de Agentes',
    desc: 'Visualize e gerencie seus agentes de IA. Tenha à sua disposição Estrategista de Conteúdo, Copywriter, Designer Visual e Social Media.',
    path: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    title: 'Reunião com o Time',
    desc: 'Converse com todo o seu squad ao mesmo tempo. Envie mensagens para refinar campanhas, alinhar ideias e debater a estratégia do perfil.',
    path: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  },
]

const STEPS = [
  { num: '01', title: 'Destrave sua criação', desc: 'Você elimina bloqueios e começa com clareza.' },
  { num: '02', title: 'Ideia sem esforço', desc: 'Extrai temas do que você já vive e atende.' },
  { num: '03', title: 'Estrutura automática', desc: 'Usa modelos prontos para publicar com consistência.' },
  { num: '04', title: 'Execução com IA', desc: 'Gera, revisa e agenda conteúdo em minutos.' },
]

const BONUSES = [
  { title: 'Checklist "Post em 15 Min"', desc: 'Saia do zero e publique seu primeiro conteúdo hoje mesmo, sem travar e sem pensar demais.' },
  { title: 'Validação de Conteúdo', desc: 'Saiba exatamente se seus posts estão funcionando, mesmo com pouco engajamento.' },
  { title: 'Kit de Implementação', desc: 'Um sistema simples e pronto para transformar o que você já sabe em conteúdo consistente.' },
  { title: 'Rotina Leve (15 min/dia)', desc: 'Descubra como manter constância mesmo sem tempo, usando uma rotina que cabe no seu dia.' },
  { title: 'Onboarding Prioritário', desc: 'Comece mais rápido com acesso antecipado e orientação inicial para não travar logo no começo.' },
]

const PLANS = [
  {
    name: 'Free',
    price: 'R$ 0,00',
    features: ['10 conteúdos/mês', '1 squad', '2 usuários', 'Suporte por e-mail'],
    cta: 'Começar grátis',
    highlight: false,
    badge: null,
  },
  {
    name: 'Starter',
    price: 'R$ 97,00',
    features: [
      '50 conteúdos/mês',
      '3 squads',
      '5 usuários',
      'Suporte prioritário',
      'Agendamento de publicações',
      'Múltiplas redes sociais',
    ],
    cta: 'Assinar Starter',
    highlight: true,
    badge: 'Mais popular',
  },
  {
    name: 'Pro',
    price: 'R$ 297,00',
    features: [
      '200 conteúdos/mês',
      '10 squads',
      '20 usuários',
      'Suporte dedicado',
      'Agendamento avançado',
      'Todas as redes sociais',
      'Relatórios e analytics',
      'API de integração',
    ],
    cta: 'Assinar Pro',
    highlight: false,
    badge: null,
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className={`${manrope.variable} ${sora.variable} ${styles.root}`}>

      {/* ── HEADER ── */}
      <header className={styles.topbar}>
        <div className={`${styles.container} ${styles.nav}`}>
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo-ze-post.svg" alt="Logo Zé Post" className={styles.brand} />
          </Link>
          <nav className={styles.menu}>
            <a href="#recursos">Recursos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#planos">Planos</a>
            <a href="#garantia">Garantia</a>
          </nav>
          <div className={styles.menuActions}>
            <Link className={`${styles.btn} ${styles.btnLink}`} href="/login">Entrar</Link>
            <a className={`${styles.btn} ${styles.btnSolid}`} href="#planos">Começar grátis</a>
          </div>
        </div>
      </header>

      <main>

        {/* ── HERO ── */}
        <section className={styles.hero} id="hero">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Crie posts com IA sem esforço.</p>
              <h1>Seu <span>postador</span> automático de conteúdo.</h1>
              <p className={styles.subtitle}>
                A Zé Post transforma o que você já sabe em publicações com IA, organiza sua agenda
                e te ajuda a publicar com consistência.
              </p>
              <div className={styles.heroActions}>
                <a className={`${styles.btn} ${styles.btnSolid}`} href="#planos">Começar grátis</a>
                <a className={`${styles.btn} ${styles.btnGhost}`} href="#como-funciona">Ver como funciona</a>
              </div>
              <ul className={styles.heroBadges}>
                <li>✓ 7 dias grátis</li>
                <li>✓ Não precisa de cartão</li>
                <li>✓ Cancelamento fácil</li>
              </ul>
            </div>

            <div className={styles.heroVisual}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.mascot}
                src="/landing/mascote-ze-post.webp"
                alt="Mascote Zé Post"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={`${styles.heroWidget} ${styles.widget1}`} src="/landing/widget-1.webp" alt="Sugestão da IA" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={`${styles.heroWidget} ${styles.widget2}`} src="/landing/widget-2.webp" alt="Desempenho" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={`${styles.heroWidget} ${styles.widget3}`} src="/landing/widget-3.webp" alt="Engajamento" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={`${styles.heroWidget} ${styles.widget4}`} src="/landing/widget-4.webp" alt="Novo conteúdo" />
            </div>
          </div>
        </section>

        {/* ── PAIN POINT ── */}
        <section>
          <div className={`${styles.container} ${styles.painGrid}`}>
            <div className={styles.painCopy}>
              <h2>Você sabe trabalhar...<br /><span>mas não sabe se mostrar?</span></h2>
              <p>
                É frustrante ver profissionais menos experientes crescendo só porque sabem se posicionar,
                enquanto seu conhecimento fica invisível para o mercado.
              </p>
            </div>
            <div className={styles.painCards}>
              {[
                { bold: 'Abre o Instagram', rest: ' e fecha sem postar nada, travada porque a inspiração não vem.' },
                { bold: 'Já tentou terceirizar', rest: ' e acabou com posts frios que não passam a sua essência.' },
                { bold: 'Trabalha muito', rest: ' e não tem tempo para aprender as regras do marketing digital.' },
              ].map((item, i) => (
                <article key={i} className={styles.painCard}>
                  <svg className={styles.painIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p><strong>{item.bold}</strong>{item.rest}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="recursos">
          <div className={styles.container}>
            <h2>Tudo o que você precisa em um <span>só lugar</span></h2>
            <p className={styles.sectionIntro}>
              Uma plataforma completa com funcionalidades baseadas em inteligência artificial
              para dominar suas redes sociais.
            </p>
            <div className={styles.featuresGrid}>
              {FEATURES.map((f, i) => (
                <article key={i} className={`${styles.card} ${styles.featureCard}`}>
                  <div className={styles.featureIcon}>
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={f.path} />
                    </svg>
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className={styles.method} id="como-funciona">
          <div className={styles.container}>
            <h2>Crie. <span>Poste.</span> Cresça.</h2>
            <div className={styles.cardsFour}>
              {STEPS.map(s => (
                <article key={s.num} className={`${styles.card} ${styles.accent}`}>
                  <span className={styles.accentNum}>{s.num}</span>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── BONUSES ── */}
        <section className={styles.bonuses} id="bonus">
          <div className={styles.container}>
            <div className={styles.bonusHeader}>
              <h2>Você não vai começar do zero.<br /><span>Leve 5 bônus para acelerar.</span></h2>
              <p>Preparados especialmente para eliminar qualquer desculpa de falta de tempo ou ideias.</p>
            </div>
            <div className={styles.bonusGrid}>
              {BONUSES.map((b, i) => (
                <article key={i} className={styles.bonusCard}>
                  <div className={styles.bonusTag}>Bônus {i + 1}</div>
                  <h3>{b.title}</h3>
                  <p>{b.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section className={styles.pricing} id="planos">
          <div className={styles.container}>
            <h2>Escolha o plano ideal para o seu momento</h2>
            <div className={styles.pricingGrid}>
              {PLANS.map((plan, i) => (
                <article key={i} className={`${styles.planCard} ${plan.highlight ? styles.planHighlight : ''}`}>
                  {plan.badge && <p className={styles.planBadge}>{plan.badge}</p>}
                  <h3>{plan.name}</h3>
                  <p className={styles.value}>
                    {plan.price}<span className={styles.valueSub}>/mês</span>
                  </p>
                  <ul className={styles.planFeatures}>
                    {plan.features.map((f, j) => <li key={j}>{f}</li>)}
                  </ul>
                  <Link className={styles.planBtn} href="/login">{plan.cta}</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── GUARANTEE ── */}
        <section id="garantia">
          <div className={styles.container}>
            <div className={styles.guaranteeBox}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.garantiaMascote}
                src="/landing/mascote-ze-post-garantia.webp"
                alt="Mascote Zé Post aprovando a garantia"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.garantiaSelo}
                src="/landing/garantia-7dias.webp"
                alt="Selo de garantia 7 dias"
              />
              <div className={styles.guaranteeCopy}>
                <h2>Teste 7 dias sem risco</h2>
                <p>
                  Se você não conseguir gerar seu primeiro conteúdo em até 24 horas, a gente te ajuda.
                  Se ainda assim não fizer sentido, devolvemos 100% do valor.
                </p>
              </div>
              <Link className={`${styles.btn} ${styles.btnSolid}`} href="/login">
                Quero entrar agora
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <p>© 2026 Zé Post. Todos os direitos reservados.</p>
        </div>
      </footer>

    </div>
  )
}
