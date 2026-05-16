// ── Carousel Strategy Engine ─────────────────────────────────────────
// Gera estratégia narrativa de carrossel para o Zé Premium.
// Cada slide tem um papel estratégico de marketing (HOOK→BENEFIT→CTA).
// Aproveita safe-area-engine, layout-composition-engine e ze-premium-prompt-builder.

import type { SocialFormat } from './social-formats'
import { buildSafeAreaGuidance, buildProductSafeAreaGuidance } from './safe-area-engine'
import { buildZePremiumPrompt, type ZePremiumNiche, type ZePremiumStyle } from './ze-premium-prompt-builder'

// ── Tipos ─────────────────────────────────────────────────────────────

export type SlideRole =
  | 'HOOK'
  | 'DESIRE'
  | 'PROBLEM'
  | 'BENEFIT'
  | 'PROOF'
  | 'DIFFERENTIAL'
  | 'OBJECTION'
  | 'TIP'
  | 'COMPARISON'
  | 'TRANSFORMATION'
  | 'CTA'

export const SLIDE_ROLE_LABELS: Record<SlideRole, string> = {
  HOOK:           'Hook — Gancho',
  DESIRE:         'Desejo',
  PROBLEM:        'Problema',
  BENEFIT:        'Benefício',
  PROOF:          'Prova Social',
  DIFFERENTIAL:   'Diferencial',
  OBJECTION:      'Objeção',
  TIP:            'Dica',
  COMPARISON:     'Comparação',
  TRANSFORMATION: 'Transformação',
  CTA:            'CTA — Ação',
}

export interface CarouselSlide {
  slideNumber: number
  role: SlideRole
  roleLabel: string
  headline: string
  subline: string
  cta?: string
  /** Variante de composição (0–3) para diversificar layout entre slides */
  compositionVariant: 0 | 1 | 2 | 3
}

export interface CarouselStrategyInput {
  totalSlides: number
  niche: ZePremiumNiche
  style: ZePremiumStyle
  userHeadline: string          // headline principal do usuário
  userSubheadline?: string      // subline principal
  userCta?: string              // CTA principal
  objective?: string            // contexto / objetivo da campanha
  productName?: string          // nome do produto (extraído do objective se disponível)
}

export interface CarouselStrategyOutput {
  totalSlides: number
  slides: CarouselSlide[]
  visualContinuityNote: string  // instrução de continuidade visual para todos os slides
}

// ── Sequências de papéis por quantidade de slides ────────────────────

const ROLE_SEQUENCES: Record<number, SlideRole[]> = {
  3:  ['HOOK', 'BENEFIT', 'CTA'],
  4:  ['HOOK', 'DESIRE', 'BENEFIT', 'CTA'],
  5:  ['HOOK', 'PROBLEM', 'BENEFIT', 'PROOF', 'CTA'],
  6:  ['HOOK', 'DESIRE', 'PROBLEM', 'BENEFIT', 'PROOF', 'CTA'],
  7:  ['HOOK', 'DESIRE', 'PROBLEM', 'BENEFIT', 'PROOF', 'DIFFERENTIAL', 'CTA'],
  8:  ['HOOK', 'DESIRE', 'PROBLEM', 'BENEFIT', 'PROOF', 'DIFFERENTIAL', 'OBJECTION', 'CTA'],
  9:  ['HOOK', 'DESIRE', 'PROBLEM', 'BENEFIT', 'PROOF', 'DIFFERENTIAL', 'OBJECTION', 'TIP', 'CTA'],
  10: ['HOOK', 'DESIRE', 'PROBLEM', 'BENEFIT', 'PROOF', 'DIFFERENTIAL', 'OBJECTION', 'TIP', 'COMPARISON', 'CTA'],
}

// Variante de composição sugerida por papel — para diversificar os slides
const ROLE_COMPOSITION_VARIANT: Record<SlideRole, 0 | 1 | 2 | 3> = {
  HOOK:           0, // produto dominante, grande e centralizado
  DESIRE:         1, // produto esquerda, texto à direita
  PROBLEM:        3, // texto proeminente, produto menor
  BENEFIT:        0, // produto grande com headline abaixo
  PROOF:          2, // produto direita, texto à esquerda (números/dados)
  DIFFERENTIAL:   1, // produto esquerda, texto destaque
  OBJECTION:      3, // tipografia em foco, produto secundário
  TIP:            2, // produto direita, dica em destaque
  COMPARISON:     1, // divisão produto vs texto
  TRANSFORMATION: 0, // produto como resultado final
  CTA:            0, // produto hero + CTA centralizado
}

// ── Copy Banks por papel de slide × nicho ────────────────────────────

interface RoleCopyBank {
  headlines: string[]
  sublines: string[]
  swipeSublines?: string[]  // sublines tipo "arraste" para HOOK
}

// Banco por nicho e papel estratégico
// {headline} = substituído pelo headline do usuário
// {product}  = nome do produto (se detectado) ou "produto"

const CAROUSEL_COPY: Record<ZePremiumNiche, Partial<Record<SlideRole, RoleCopyBank>>> = {

  automotivo: {
    HOOK: {
      headlines: [
        'Você ainda não viu assim',
        'Isso vai mudar tudo para você',
        'O que vem a seguir vai impressionar',
        'Prepare-se para o próximo nível',
      ],
      sublines:    ['Arraste e descubra o que mudou', 'Deslize para ver cada detalhe'],
      swipeSublines: ['Arraste →', 'Continue deslizando'],
    },
    DESIRE: {
      headlines: [
        'Imagina chegar com esse',
        'A presença que você sempre quis',
        'Poder e elegância juntos',
        'O carro que chama atenção onde chega',
      ],
      sublines: [
        'Design que impõe respeito desde o primeiro olhar.',
        'Feito para quem não passa despercebido.',
        'Estilo e performance em perfeita harmonia.',
      ],
    },
    PROBLEM: {
      headlines: [
        'Sua picape atual não dá mais conta?',
        'Cansado de pagar muito por pouco?',
        'Conforto e força ao mesmo tempo é exigir demais?',
        'Tecnologia desatualizada te custa caro',
      ],
      sublines: [
        'A solução chegou — e ela é mais completa do que você imagina.',
        'Chega de comprometer conforto por capacidade.',
        'Você merece ter os dois.',
      ],
    },
    BENEFIT: {
      headlines: [
        'Força de picape. Conforto de SUV.',
        'Motor potente, interior que impressiona',
        'Tecnologia que você sente em cada curva',
        'Performance real para o seu dia a dia',
      ],
      sublines: [
        'Faróis LED, central multimídia, câmera 360° e muito mais.',
        'Tração inteligente, suspensão calibrada, acabamento premium.',
        'Potência e economia que se equilibram perfeitamente.',
      ],
    },
    PROOF: {
      headlines: [
        'Mais de 5.000 clientes satisfeitos',
        'A mais vendida da categoria',
        '4,9 estrelas. Aprovado por quem entende.',
        'Líder de vendas pelo terceiro ano consecutivo',
      ],
      sublines: [
        'Os números falam por si — e os clientes também.',
        'Reputação construída um cliente de cada vez.',
        'Escolha dos especialistas, confiança de quem comprou.',
      ],
    },
    DIFFERENTIAL: {
      headlines: [
        'O único com essa tecnologia no Brasil',
        'O detalhe que nenhum concorrente tem',
        'Feito diferente. Para quem pensa diferente.',
        'Inovação que só encontra aqui',
      ],
      sublines: [
        'Não é sobre preço — é sobre o que você recebe.',
        'Cada detalhe foi pensado para superar o padrão.',
        'Compare e veja por que a escolha é fácil.',
      ],
    },
    OBJECTION: {
      headlines: [
        'Preocupado com o financiamento?',
        'Acha que não é para o seu bolso?',
        'Troca: mais simples do que você pensa',
        'Sem burocracia. Sem pegadinhas.',
      ],
      sublines: [
        'Parcelas que cabem no seu orçamento. Condições que fazem sentido.',
        'Avaliamos seu atual com o melhor preço do mercado.',
        'A equipe cuida de tudo para você.',
      ],
    },
    TIP: {
      headlines: [
        'Sabia que você pode financiar em 72x?',
        'Use seu atual como entrada',
        'Manutenção inclusa no primeiro ano',
        'Test drive gratuito e sem compromisso',
      ],
      sublines: [
        'Facilidades que a maioria das concessionárias não oferece.',
        'A melhor avaliação de usado da região.',
        'Agendamento online em menos de 2 minutos.',
      ],
    },
    COMPARISON: {
      headlines: [
        'Mesmo preço. Muito mais carro.',
        'Veja a diferença com os olhos',
        'Na mesma faixa. Em outro nível.',
        'A comparação que você precisava fazer',
      ],
      sublines: [
        'Tecnologia, conforto e garantia que nenhum concorrente entrega.',
        'Coloque lado a lado e escolha com consciência.',
        'Quando você compara, a decisão se toma sozinha.',
      ],
    },
    CTA: {
      headlines: [],  // Preenchido com o headline do usuário
      sublines: [
        'Agende agora e venha conferir pessoalmente.',
        'Vagas limitadas para test drive esta semana.',
        'Fale com nossa equipe e saia com o seu hoje.',
      ],
    },
  },

  restaurante: {
    HOOK: {
      headlines: [
        'Você vai querer reservar depois disso',
        'Isso chegou para mudar seu sábado',
        'Prepare seu apetite',
        'Arraste. Seu estômago vai agradecer.',
      ],
      sublines:    ['Continue deslizando', 'Deslize para ver o cardápio'],
      swipeSublines: ['Arraste →', 'Veja mais →'],
    },
    BENEFIT: {
      headlines: [
        'Sabor que fica na memória',
        'Ingredientes frescos. Tempero de casa.',
        'Cada prato é uma experiência',
        'Cozinha artesanal com alma',
      ],
      sublines: [
        'Produzimos com dedicação, entregamos com orgulho.',
        'Do produto ao prato — qualidade em cada etapa.',
        'Sabor autêntico que você sente logo no primeiro bite.',
      ],
    },
    PROOF: {
      headlines: [
        '+2.000 avaliações 5 estrelas',
        'O favorito do bairro por 10 anos',
        'Indicado pelos maiores guias gastronômicos',
        'Reconhecido pela qualidade e carinho',
      ],
      sublines: [
        'Clientes que voltam toda semana — esse é nosso maior prêmio.',
        'Reputação construída prato a prato.',
        'Os números refletem o que cada cliente sente na mesa.',
      ],
    },
    CTA: {
      headlines: [],
      sublines: ['Reserve sua mesa agora e garanta a melhor experiência.', 'Peça pelo delivery ou venha nos visitar.'],
    },
  },

  moda: {
    HOOK: {
      headlines: [
        'Essa coleção vai surpreender você',
        'Algo novo chegou para o seu estilo',
        'Você não vai resistir',
        'Prepare seu guarda-roupa para isso',
      ],
      sublines: ['Arraste e conheça cada peça', 'Deslize para descobrir'],
      swipeSublines: ['Arraste →', 'Ver coleção →'],
    },
    BENEFIT: {
      headlines: [
        'Qualidade que você veste todo dia',
        'Tecido premium. Caimento perfeito.',
        'Estilo que não pede desculpas',
        'Conforto e elegância no mesmo look',
      ],
      sublines: [
        'Cada peça produzida com materiais selecionados.',
        'Do casual ao elegante — a coleção cobre tudo.',
        'Design exclusivo que você não encontra em outro lugar.',
      ],
    },
    CTA: {
      headlines: [],
      sublines: ['Garanta a sua antes de acabar.', 'Loja online 24h — entrega para todo o Brasil.'],
    },
  },

  tecnologia: {
    HOOK: {
      headlines: [
        'Isso vai mudar a forma como você trabalha',
        'O futuro do seu negócio começa aqui',
        'Uma tecnologia que você ainda não viu',
        'Prepare-se para operar diferente',
      ],
      sublines: ['Arraste e descubra como', 'Deslize para ver na prática'],
      swipeSublines: ['Continue →', 'Veja mais →'],
    },
    BENEFIT: {
      headlines: [
        'Mais velocidade. Menos retrabalho.',
        'Automatize o que trava sua equipe',
        'Resultados em horas, não semanas',
        'Eficiência que transforma receita',
      ],
      sublines: [
        'Integra com as ferramentas que você já usa.',
        'Setup simples, impacto imediato.',
        'Escalável do primeiro ao décimo funcionário.',
      ],
    },
    CTA: {
      headlines: [],
      sublines: ['Solicite uma demonstração gratuita.', 'Comece hoje com 14 dias grátis, sem cartão.'],
    },
  },

  energia_solar: {
    HOOK: {
      headlines: [
        'Sua conta de luz nunca mais será a mesma',
        'O sol está trabalhando para você. Ou ainda não.',
        'Isso pode mudar sua conta de luz a partir deste mês',
        'Descubra quanto você pode economizar',
      ],
      sublines: ['Arraste e calcule sua economia', 'Deslize para descobrir'],
      swipeSublines: ['Arraste →', 'Calcule →'],
    },
    BENEFIT: {
      headlines: [
        'Até 95% de economia na conta',
        'Energia limpa. Conta menor.',
        'Retorno garantido em até 4 anos',
        'Pague pela geração, não pela distribuidora',
      ],
      sublines: [
        'Financiamento facilitado, sem entrada, parcelas que cabem.',
        'Instalação profissional com garantia de 25 anos.',
        'Homologação pela distribuidora totalmente inclusa.',
      ],
    },
    CTA: {
      headlines: [],
      sublines: ['Solicite sua simulação gratuita agora.', 'Orçamento sem compromisso em até 24h.'],
    },
  },

  corporativo: {
    HOOK: {
      headlines: [
        'Sua empresa pode estar deixando dinheiro na mesa',
        'O que os líderes do setor fazem diferente',
        'Resultado real começa com a escolha certa',
        'Você já pensou nisso para o seu negócio?',
      ],
      sublines: ['Arraste e descubra como', 'Deslize e veja na prática'],
      swipeSublines: ['Continue →', 'Saiba mais →'],
    },
    BENEFIT: {
      headlines: [
        'Eficiência que se reflete no resultado',
        'Processos que escalam com o negócio',
        'Equipe especializada, entrega garantida',
        'Da estratégia à execução — tudo com a gente',
      ],
      sublines: [
        'Soluções testadas e aprovadas por mais de 1.200 empresas.',
        'Metodologia exclusiva orientada a resultados mensuráveis.',
        'Presença nacional, atendimento próximo e dedicado.',
      ],
    },
    CTA: {
      headlines: [],
      sublines: ['Solicite um diagnóstico gratuito do seu negócio.', 'Fale com nossa equipe e receba uma proposta em 48h.'],
    },
  },

  ecommerce: {
    HOOK: {
      headlines: [
        'Esse produto vai ser assunto',
        'O que todo mundo está falando sobre',
        'Você pediu. Chegou.',
        'Antes de comprar em outro lugar, veja isso',
      ],
      sublines: ['Arraste e conheça cada detalhe', 'Deslize para ver mais'],
      swipeSublines: ['Arraste →', 'Ver produto →'],
    },
    BENEFIT: {
      headlines: [
        'Qualidade que você vê e sente',
        'Original com garantia total',
        'O custo-benefício que você procurava',
        'Mais pelo mesmo preço',
      ],
      sublines: [
        'Produto original com nota fiscal e garantia do fabricante.',
        'Parcelado em até 12x sem juros no cartão.',
        'Avaliado 5 estrelas por mais de 2.000 compradores.',
      ],
    },
    CTA: {
      headlines: [],
      sublines: ['Garanta o seu agora. Estoque limitado.', 'Frete grátis para todo o Brasil neste pedido.'],
    },
  },

  educacao: {
    HOOK: {
      headlines: [
        'O que os profissionais top sabem que você ainda não',
        'Sua carreira pode estar mais perto do próximo nível',
        'O conhecimento que vai te diferenciar',
        'Você merece estar nesse nível',
      ],
      sublines: ['Arraste e descubra o conteúdo', 'Deslize para conhecer a jornada'],
      swipeSublines: ['Continue →', 'Saiba mais →'],
    },
    BENEFIT: {
      headlines: [
        'Do zero ao especialista validado',
        'Conteúdo prático com projetos reais',
        'Certificado reconhecido pelo mercado',
        'Aprenda no seu ritmo, em qualquer lugar',
      ],
      sublines: [
        'Instrutores especialistas com experiência comprovada no mercado.',
        'Suporte completo durante toda a jornada de aprendizado.',
        'Acesso vitalício ao conteúdo e atualizações incluídas.',
      ],
    },
    CTA: {
      headlines: [],
      sublines: ['Garanta sua vaga com condição especial de lançamento.', 'Inscrição aberta — vagas limitadas por turma.'],
    },
  },
}

// Fallback genérico para papéis não cobertos pelo nicho
const GENERIC_ROLE_COPY: Record<SlideRole, RoleCopyBank> = {
  HOOK:           { headlines: ['O que vem a seguir vai surpreender você', 'Prepare-se para o próximo nível', 'Algo especial chegou'], sublines: ['Arraste para descobrir', 'Continue deslizando para ver'] },
  DESIRE:         { headlines: ['O padrão que você merece', 'Isso é o que premium significa', 'A experiência que você imaginava'], sublines: ['Feito para quem exige o melhor.', 'O nível que você sempre buscou.'] },
  PROBLEM:        { headlines: ['Você merecia mais do que isso', 'Chega de se contentar com menos', 'Isso estava atrapalhando seu resultado'], sublines: ['A solução chegou — e é melhor do que você imagina.', 'Sem complicação, direto ao resultado.'] },
  BENEFIT:        { headlines: ['Resultado real. Qualidade comprovada.', 'O que você precisava, finalmente aqui', 'Simples, eficiente e premium'], sublines: ['Cada detalhe pensado para entregar o melhor.', 'Qualidade que você sente desde o primeiro uso.'] },
  PROOF:          { headlines: ['Aprovado por quem entende', '+1.000 clientes satisfeitos', 'Os resultados falam por si'], sublines: ['Reputação construída um cliente de cada vez.', 'Números que comprovam o que prometemos.'] },
  DIFFERENTIAL:   { headlines: ['O que ninguém mais oferece', 'O detalhe que muda tudo', 'Feito diferente, de propósito'], sublines: ['Não é sobre preço — é sobre o que você recebe.', 'Um passo à frente da concorrência.'] },
  OBJECTION:      { headlines: ['Mais simples do que você imagina', 'Sem letras miúdas', 'Temos a resposta para sua dúvida'], sublines: ['Transparência é o nosso diferencial.', 'Tire todas as suas dúvidas com nossa equipe.'] },
  TIP:            { headlines: ['Uma dica de quem entende', 'Sabia disso?', 'Isso vai fazer diferença'], sublines: ['Dica exclusiva para quem está vendo este carrossel.', 'Use a favor do seu resultado.'] },
  COMPARISON:     { headlines: ['Compare e decida com consciência', 'Qualidade superior. Preço justo.', 'Lado a lado — a escolha é clara'], sublines: ['A comparação honesta que você precisava.', 'Quando você compara, a decisão se toma sozinha.'] },
  TRANSFORMATION: { headlines: ['Antes e depois. A diferença é real.', 'O resultado que transforma', 'Isso muda tudo a partir de agora'], sublines: ['Uma decisão que impacta muito mais do que você imagina.', 'Os resultados aparecem desde o início.'] },
  CTA:            { headlines: [], sublines: ['Não perca essa oportunidade.', 'Fale com nossa equipe e dê o próximo passo.'] },
}

// ── detectCarouselSlideCount ──────────────────────────────────────────

const PT_NUMBER_WORDS: Record<string, number> = {
  'três': 3, 'tres': 3, 'quatro': 4, 'cinco': 5,
  'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10,
  'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7,
  'eight': 8, 'nine': 9, 'ten': 10,
}

/**
 * Detecta quantos slides o usuário quer a partir do texto livre.
 * Ex: "crie um carrossel de 5 slides" → 5
 *     "quero 7 páginas"               → 7
 *     "cinco cards"                   → 5
 *     sem menção                      → 3 (padrão)
 */
export function detectCarouselSlideCount(text: string): number {
  if (!text?.trim()) return 3
  const lower = text.toLowerCase()

  // Padrão numérico: "5 slides", "7 páginas", "4 cards", "3 imagens"
  const digitMatch = lower.match(/(\d+)\s*(?:slides?|p[áa]ginas?|cards?|imagens?|fotos?|quadros?|telas?)/)
  if (digitMatch) {
    const n = parseInt(digitMatch[1], 10)
    if (n >= 3 && n <= 10) return n
    if (n > 10) return 10
    if (n > 0 && n < 3) return 3
  }

  // Palavras por extenso seguidas de contexto de slide
  for (const [word, num] of Object.entries(PT_NUMBER_WORDS)) {
    const patterns = [
      `${word} slide`, `${word} pág`, `${word} card`,
      `${word} imagem`, `${word} foto`, `de ${word}`,
    ]
    if (patterns.some(p => lower.includes(p))) return num
  }

  // Palavras por extenso isoladas (menos preciso, só usa se contém "carrossel")
  if (lower.includes('carros') || lower.includes('carousel')) {
    for (const [word, num] of Object.entries(PT_NUMBER_WORDS)) {
      if (lower.includes(word)) return num
    }
  }

  return 3 // padrão
}

// ── buildCarouselStrategy ─────────────────────────────────────────────

function pickCopy(bank: RoleCopyBank | undefined, fallback: RoleCopyBank, seed: number) {
  const hPool = (bank?.headlines?.length ? bank.headlines : fallback.headlines)
  const sPool = (bank?.sublines?.length  ? bank.sublines  : fallback.sublines)
  return {
    headline: hPool[seed % hPool.length] ?? fallback.headlines[0],
    subline:  sPool[(seed + 1) % sPool.length] ?? fallback.sublines[0],
  }
}

/**
 * Gera a estratégia narrativa completa do carrossel.
 * O copy de cada slide é gerado a partir do nicho, papel e input do usuário.
 */
export function buildCarouselStrategy(input: CarouselStrategyInput): CarouselStrategyOutput {
  const total  = Math.max(3, Math.min(10, input.totalSlides))
  const roles  = ROLE_SEQUENCES[total] ?? ROLE_SEQUENCES[3]
  const niche  = input.niche
  const nicheCopy = CAROUSEL_COPY[niche] ?? {}

  // Seed baseado em timestamp para variedade entre chamadas
  const seed = Date.now() % 997

  const slides: CarouselSlide[] = roles.map((role, idx) => {
    const slideNumber = idx + 1
    const fallback    = GENERIC_ROLE_COPY[role]

    let headline: string
    let subline: string
    let cta: string | undefined

    if (role === 'CTA') {
      // Slide de fechamento: usa o headline principal do usuário
      headline = input.userHeadline
      subline  = input.userSubheadline
        ?? nicheCopy.CTA?.sublines?.[(seed) % (nicheCopy.CTA?.sublines?.length || 1)]
        ?? GENERIC_ROLE_COPY.CTA.sublines[0]
      cta = input.userCta
    } else if (role === 'HOOK') {
      // Slide de gancho: nunca usa o headline do usuário — cria curiosidade
      const bank  = nicheCopy.HOOK ?? GENERIC_ROLE_COPY.HOOK
      const hPool = bank.headlines
      const sPool = bank.swipeSublines ?? bank.sublines
      headline = hPool[(seed + idx) % hPool.length]
      subline  = sPool[(seed + idx + 1) % sPool.length]
    } else if (role === 'BENEFIT' && input.userSubheadline) {
      // Benefício principal: usa o subheadline do usuário se disponível
      const bank = nicheCopy.BENEFIT ?? GENERIC_ROLE_COPY.BENEFIT
      headline   = bank.headlines[(seed + idx) % bank.headlines.length]
      subline    = input.userSubheadline
    } else {
      // Demais papéis: gera do banco de copy do nicho
      const bank   = nicheCopy[role] ?? undefined
      const copied = pickCopy(bank, fallback, seed + idx)
      headline     = copied.headline
      subline      = copied.subline
    }

    return {
      slideNumber,
      role,
      roleLabel:          SLIDE_ROLE_LABELS[role],
      headline,
      subline,
      cta,
      compositionVariant: ROLE_COMPOSITION_VARIANT[role],
    }
  })

  // Nota de continuidade visual — injetada em cada prompt
  const visualContinuityNote =
    `Maintain identical visual identity across all ${total} carousel slides: ` +
    `same color palette, same background atmosphere, same lighting style, same typography family, ` +
    `same overall brand aesthetic — only the copy and minor composition vary between slides`

  return { totalSlides: total, slides, visualContinuityNote }
}

// ── Instruções de variação de composição por variant ─────────────────

const COMPOSITION_VARIANT_GUIDANCE: Record<0 | 1 | 2 | 3, string> = {
  0: 'Centered hero composition — product large and commanding, centrally positioned, headline below the product',
  1: 'Split left composition — product on the left side filling 50% of frame, clean text panel on the right',
  2: 'Split right composition — product on the right side, prominent text panel on the left',
  3: 'Type-forward composition — typography as the visual hero, product as supporting background element',
}

// Instruções de role para o modelo entender o papel narrativo do slide
const ROLE_PROMPT_INSTRUCTIONS: Record<SlideRole, string> = {
  HOOK:           'This is the HOOK slide — it must create maximum curiosity and desire to swipe to the next slide. Make the visual dramatic and intriguing. Do NOT reveal the full product message yet.',
  DESIRE:         'This is the DESIRE slide — evoke aspiration, emotional connection and the lifestyle the product enables. Make the viewer want what is shown.',
  PROBLEM:        'This is the PROBLEM slide — acknowledge the pain point or limitation the viewer feels. The visual should feel slightly tense, then the copy resolves it.',
  BENEFIT:        'This is the BENEFIT slide — showcase the key value clearly. Product should look its best. Copy delivers the most important advantage.',
  PROOF:          'This is the PROOF slide — establish credibility and trust. Numbers, achievements or recognition should feel prominent and real.',
  DIFFERENTIAL:   'This is the DIFFERENTIAL slide — highlight what makes this unique versus alternatives. Bold visual claim.',
  OBJECTION:      'This is the OBJECTION slide — address the most common concern or barrier. Copy should reassure and simplify.',
  TIP:            'This is the TIP slide — deliver a genuinely useful piece of information related to the product or niche. Feel informative and generous.',
  COMPARISON:     'This is the COMPARISON slide — present a side-by-side or before/after concept. Clarity is key.',
  TRANSFORMATION: 'This is the TRANSFORMATION slide — show the change or result the product enables. Emotional and aspirational.',
  CTA:            'This is the CLOSING CTA slide — the strongest visual of the carousel. Product at its most premium. Copy drives action. CTA must be clearly visible.',
}

// ── buildCarouselSlidePrompt ──────────────────────────────────────────

/**
 * Constrói o prompt completo para um slide individual do carrossel.
 * Reutiliza buildZePremiumPrompt com copy específica do slide +
 * instruções de papel estratégico e continuidade visual.
 */
export function buildCarouselSlidePrompt(
  slide: CarouselSlide,
  strategy: CarouselStrategyOutput,
  format: SocialFormat,
  niche: ZePremiumNiche,
  style: ZePremiumStyle,
  objective: string,
  hasProductImage: boolean,
): string {
  // ── Bloco de contexto do carrossel (prefixo antes do prompt base)
  const carouselContext = [
    `CAROUSEL SLIDE ${slide.slideNumber} OF ${strategy.totalSlides} — ` +
    `strategic role: ${slide.role} (${slide.roleLabel})`,

    ROLE_PROMPT_INSTRUCTIONS[slide.role],

    `Composition variant for this slide: ${COMPOSITION_VARIANT_GUIDANCE[slide.compositionVariant]}`,

    strategy.visualContinuityNote,
  ].join(',\n')

  // ── Prompt base — reutiliza todo o sistema de safe area e estilo
  // Nota: headline/subheadline/cta foram removidos do prompt do modelo;
  // são renderizados via text-overlay-engine no frontend.
  const basePrompt = buildZePremiumPrompt({
    objective,
    niche,
    style,
    hasProductImage,
    format,
  })

  return `${carouselContext},\n${basePrompt}`
}
