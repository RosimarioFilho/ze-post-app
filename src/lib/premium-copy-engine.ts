// ── Premium Copy Engine ────────────────────────────────────────────────
// Gera variações dinâmicas de headline, subheadline e CTA para o Zé Premium.
// Cada chamada retorna uma combinação diferente, evitando repetição estrutural.
// Baseado em nicho, estilo visual, formato e tom da campanha.

import type { SocialFormatId } from './social-formats'

export type CopyTone =
  | 'luxury'
  | 'aggressive'
  | 'cinematic'
  | 'clean'
  | 'corporate'
  | 'popular'

export interface PremiumCopyInput {
  niche: string
  productName?: string
  visualStyle: string
  formatId: SocialFormatId
  objective?: string
  tone?: CopyTone
}

export interface PremiumCopyOutput {
  headline: string
  highlightPhrase: string
  subline: string
  cta: string
  colorIntent: 'accent' | 'contrast' | 'light' | 'dark' | 'brand'
  variationId: number
}

// ── Copy Banks por Nicho ───────────────────────────────────────────────
// Cada nicho tem 6 ângulos: desejo / autoridade / benefício / exclusividade / urgência / transformação
// Cada ângulo tem 3 variações → total 18 headlines por nicho

interface NicheCopyBank {
  headlines: string[][]   // [ângulo][variação]
  sublines: string[]
  ctas: string[]
  highlights: string[]
}

const COPY_BANKS: Record<string, NicheCopyBank> = {

  automotivo: {
    headlines: [
      // desejo
      ['A picape que impõe presença', 'O SUV que virou referência', 'O carro que define o padrão'],
      // autoridade
      ['Força que chama respeito', 'Potência que não pede licença', 'Performance além do esperado'],
      // benefício
      ['Conforto de SUV. Tração de picape.', 'Tecnologia que você sente na pista', 'Eficiência em cada quilômetro'],
      // exclusividade
      ['Edição limitada. Presença ilimitada.', 'Exclusivo para quem exige o melhor.', 'Para quem não se contenta com menos'],
      // urgência
      ['Lançamento. Reserve o seu.', 'Últimas unidades disponíveis.', 'Oferta por tempo limitado.'],
      // transformação
      ['Do asfalto à estrada, sem comprometer', 'Cidade ou trilha — ele domina os dois', 'Nasceu para ser diferente'],
    ],
    sublines: [
      'Design robusto, tecnologia e presença.',
      'Motor potente, interior premium e conectado.',
      'Faróis LED, central multimídia e câmera 360°.',
      'Pronto para cidade, estrada e trabalho pesado.',
      'Segurança, conforto e estilo em um único modelo.',
      'A evolução que o mercado esperava.',
    ],
    ctas: [
      'Agende seu Test Drive',
      'Conheça agora',
      'Fale com a concessionária',
      'Reserve a sua',
      'Ver condições especiais',
      'Solicite uma proposta',
    ],
    highlights: [
      'Novo modelo',
      'Lançamento 2026',
      'Exclusivo',
      'Oferta especial',
      'Edição limitada',
      'Test Drive grátis',
    ],
  },

  restaurante: {
    headlines: [
      ['Sabor que fica na memória', 'A experiência começa no primeiro bite', 'Onde cada prato conta uma história'],
      ['Tradição que se sente no paladar', 'Gastronomia de verdade', 'Ingredientes de origem, sabor autêntico'],
      ['Feito na hora, entregue com cuidado', 'Da nossa cozinha para sua mesa', 'Freshness em cada detalhe'],
      ['Exclusivo. Reservas abertas.', 'Menu especial do chef', 'Uma experiência inesquecível'],
      ['Hoje tem promoção especial', 'Happy hour até 20h', 'Combo especial fim de semana'],
      ['Comemore aqui', 'Momentos que ficam', 'A mesa mais especial da cidade'],
    ],
    sublines: [
      'Ingredientes frescos, sabor incomparável.',
      'Cozinha artesanal com tempero de casa.',
      'Cardápio premium, preço acessível.',
      'Ambiente exclusivo, atendimento impecável.',
      'Aberto todos os dias, das 11h às 23h.',
      'Delivery disponível nos principais apps.',
    ],
    ctas: [
      'Faça sua reserva',
      'Peça agora no delivery',
      'Ver cardápio completo',
      'Ligue e reserve',
      'Venha nos visitar',
      'Reservar mesa agora',
    ],
    highlights: [
      'Chef premiado',
      'Ingredientes frescos',
      'Novo cardápio',
      'Promoção especial',
      'Ambiente renovado',
      'Delivery express',
    ],
  },

  moda: {
    headlines: [
      ['Estilo que fala por você', 'Vista o que você é', 'Moda que expressa atitude'],
      ['Coleção que impõe tendência', 'Peças que definem estilo', 'O que estava faltando no seu guarda-roupa'],
      ['Conforto e estilo unidos', 'Qualidade que você veste todo dia', 'Material premium, caimento perfeito'],
      ['Edição limitada disponível', 'Exclusivo para quem entende de moda', 'Peças que você não encontra em outro lugar'],
      ['Últimas peças da coleção', 'Aproveite antes de acabar', 'Garanta a sua agora'],
      ['Renove seu estilo hoje', 'Uma nova fase começa aqui', 'Transforme seu guarda-roupa'],
    ],
    sublines: [
      'Coleção premium com design exclusivo.',
      'Peças selecionadas para quem tem personalidade.',
      'Tecidos nobres, acabamento impecável.',
      'Moda com atitude e sofisticação.',
      'Do casual ao elegante, para todos os momentos.',
      'Parcelado em até 10x sem juros.',
    ],
    ctas: [
      'Compre agora',
      'Ver coleção completa',
      'Aproveite a oferta',
      'Loja online 24h',
      'Peça pelo WhatsApp',
      'Garantir minha peça',
    ],
    highlights: [
      'Nova coleção',
      'Lançamento exclusivo',
      'Edição limitada',
      'Frete grátis',
      'Desconto especial',
      'Novidade da semana',
    ],
  },

  tecnologia: {
    headlines: [
      ['Tecnologia que transforma negócios', 'O futuro chegou para ficar', 'Inovação que você pode aplicar agora'],
      ['Performance que impressiona', 'Poder que você controla', 'Eficiência sem precedentes'],
      ['Mais velocidade. Menos esforço.', 'Resultados melhores, de verdade', 'Automatize. Escale. Cresça.'],
      ['Solução exclusiva para sua empresa', 'Tecnologia sob medida', 'Feito para quem exige o melhor'],
      ['Demonstração gratuita hoje', 'Teste sem compromisso', 'Implantação em 24 horas'],
      ['Digitalize seu negócio agora', 'Pare de perder tempo com processos manuais', 'A mudança que você precisava'],
    ],
    sublines: [
      'Plataforma inteligente para empresas modernas.',
      'Integração simples, resultados imediatos.',
      'Suporte técnico especializado 24/7.',
      'Segurança, performance e inovação juntos.',
      'Mais de 500 empresas já transformaram seus resultados.',
      'Setup rápido, retorno imediato.',
    ],
    ctas: [
      'Fale com um especialista',
      'Solicite uma demo',
      'Teste grátis por 14 dias',
      'Ver planos e preços',
      'Comece agora',
      'Agendar demonstração',
    ],
    highlights: [
      'Novo recurso',
      'Lançamento beta',
      'Integração gratuita',
      'Certificado ISO',
      'Plano gratuito',
      'API disponível',
    ],
  },

  energia_solar: {
    headlines: [
      ['Energia limpa. Conta menor.', 'O sol trabalha para você', 'Independência energética real'],
      ['Economize até 95% na conta de luz', 'Gere sua própria energia renovável', 'Energia solar sem custo inicial'],
      ['Retorno garantido em até 4 anos', 'Investimento que se paga todo mês', 'Economia real, todo mês'],
      ['Projeto exclusivo para sua propriedade', 'Sistema dimensionado sob medida', 'Instalação técnica com garantia total'],
      ['Simulação gratuita hoje mesmo', 'Orçamento sem compromisso em 24h', 'Instale no próximo mês'],
      ['Livre das tarifas da distribuidora', 'Nunca mais pague caro na conta', 'Energia que você controla'],
    ],
    sublines: [
      'Instalação profissional com garantia de 25 anos.',
      'Financiamento facilitado, sem entrada.',
      'Economia real desde o primeiro mês.',
      'Homologação pela distribuidora inclusa no projeto.',
      'Painéis certificados, inversores de última geração.',
      'Da visita técnica à instalação, tudo incluso.',
    ],
    ctas: [
      'Faça sua simulação gratuita',
      'Orçamento sem compromisso',
      'Fale com um consultor',
      'Economize agora',
      'Solicitar visita técnica',
      'Calcular minha economia',
    ],
    highlights: [
      'Economia real',
      'Sem entrada',
      'Garantia 25 anos',
      'Instalação rápida',
      'Financiamento fácil',
      'Projeto grátis',
    ],
  },

  corporativo: {
    headlines: [
      ['Soluções que geram resultados reais', 'Parceiros do seu crescimento', 'Sua empresa em outro patamar'],
      ['Expertise que faz a diferença', 'Décadas de excelência no mercado', 'Referência consolidada no setor'],
      ['Eficiência operacional que você mede', 'Processos otimizados para escalar', 'Resultados mensuráveis e concretos'],
      ['Atendimento personalizado e dedicado', 'Proposta desenvolvida sob medida', 'Parceria estratégica de longo prazo'],
      ['Diagnóstico gratuito hoje', 'Proposta em até 48 horas', 'Implantação sem burocracia'],
      ['Transforme sua empresa com estratégia', 'O próximo nível começa agora', 'Hora de crescer com quem entende'],
    ],
    sublines: [
      'Soluções personalizadas para empresas de todos os portes.',
      'Equipe especializada com resultados comprovados.',
      'Consultoria estratégica de alto impacto.',
      'Presença nacional, atendimento próximo e eficiente.',
      'Mais de 1.200 empresas atendidas com sucesso.',
      'Metodologia exclusiva orientada a resultados.',
    ],
    ctas: [
      'Fale com nossa equipe',
      'Solicite uma proposta',
      'Agendar uma reunião',
      'Saiba mais sobre nós',
      'Conheça nossas soluções',
      'Diagnóstico gratuito',
    ],
    highlights: [
      'Líder do setor',
      '+10 anos de mercado',
      'Certificado',
      'Destaque nacional',
      'Award 2024',
      'Top parceiro',
    ],
  },

  ecommerce: {
    headlines: [
      ['Qualidade que você vê e sente', 'Produto original com garantia total', 'Exatamente o que você precisava'],
      ['Melhor preço. Melhor produto.', 'Custo-benefício imbatível no mercado', 'Qualidade premium, preço justo'],
      ['Entrega em 24h para todo o Brasil', 'Compre agora, receba amanhã', 'Frete grátis nas compras acima de R$199'],
      ['Só aqui. Só hoje.', 'Oferta exclusiva para você', 'Esse produto esgota rápido'],
      ['Últimas unidades em estoque', 'Promoção relâmpago — aproveite', 'Somente até meia-noite'],
      ['Mude sua rotina com este produto', 'A solução definitiva que faltava', 'Experimente e surpreenda-se'],
    ],
    sublines: [
      'Produto original com nota fiscal e garantia.',
      'Parcelado em até 12x sem juros no cartão.',
      'Devolução grátis em até 30 dias.',
      'Avaliado com 5 estrelas por mais de 2.000 clientes.',
      'Estoque limitado — peça o seu agora.',
      'Embalagem segura, entrega expressa.',
    ],
    ctas: [
      'Compre agora',
      'Aproveitar a oferta',
      'Adicionar ao carrinho',
      'Ver o produto completo',
      'Parcelar em 12x',
      'Garantir o meu',
    ],
    highlights: [
      'Frete grátis',
      'Promoção relâmpago',
      'Mais vendido',
      'Novidade exclusiva',
      '5 estrelas',
      'Parcelado',
    ],
  },

  educacao: {
    headlines: [
      ['Conhecimento que transforma carreiras', 'Aprenda com quem realmente sabe', 'Educação que abre portas reais'],
      ['Certificação reconhecida pelo mercado', 'Do zero ao especialista validado', 'Qualificação que faz diferença'],
      ['Aprenda no seu ritmo, onde estiver', 'Flexibilidade com qualidade real', 'Conteúdo prático e aplicável hoje'],
      ['Vagas limitadas — turma exclusiva', 'Acesso premium disponível agora', 'Grupo seleto de profissionais'],
      ['Inscrições abertas — garanta sua vaga', 'Matricule-se hoje com desconto', 'Últimas vagas desta turma'],
      ['Dê um passo à frente na carreira', 'Invista em você — resultados reais', 'Sua carreira começa aqui'],
    ],
    sublines: [
      'Certificado reconhecido pelas principais empresas do setor.',
      'Instrutores especialistas com experiência no mercado.',
      'Conteúdo 100% prático com projetos reais.',
      'Suporte completo durante toda a jornada.',
      'Acesso vitalício ao material e atualizações.',
      'Comunidade exclusiva de alunos e ex-alunos.',
    ],
    ctas: [
      'Garantir minha vaga',
      'Inscrever-se agora',
      'Ver conteúdo do curso',
      'Falar com consultor',
      'Começar hoje',
      'Baixar ementa grátis',
    ],
    highlights: [
      'Certificado incluso',
      'Nova turma',
      'Vagas limitadas',
      'Destaque do mercado',
      'Bolsa disponível',
      'Acesso vitalício',
    ],
  },
}

// ── Mapeamentos de Tom ─────────────────────────────────────────────────

// Ângulo preferido por tom (índice no array headlines[])
const TONE_ANGLE: Record<CopyTone, number> = {
  luxury:      3, // exclusividade
  aggressive:  1, // autoridade
  cinematic:   0, // desejo
  clean:       2, // benefício
  corporate:   4, // urgência
  popular:     4, // urgência
}

const TONE_COLOR_INTENT: Record<CopyTone, PremiumCopyOutput['colorIntent']> = {
  luxury:      'accent',
  aggressive:  'contrast',
  cinematic:   'light',
  clean:       'dark',
  corporate:   'brand',
  popular:     'contrast',
}

// Tom sugerido por estilo visual
const STYLE_DEFAULT_TONE: Record<string, CopyTone> = {
  automotive_premium: 'cinematic',
  premium_dark:       'aggressive',
  black_luxury:       'luxury',
  luxury:             'luxury',
  cinematic:          'cinematic',
  aggressive_ads:     'aggressive',
  modern_clean:       'clean',
  minimal:            'clean',
}

// ── Limite de palavras recomendado por formato ─────────────────────────

export function getHeadlineWordLimit(formatId: SocialFormatId): number {
  const vertical: SocialFormatId[] = [
    'INSTAGRAM_STORIES',
    'INSTAGRAM_REELS_COVER',
    'TIKTOK_COVER',
    'FACEBOOK_STORIES',
    'WHATSAPP_STATUS',
  ]
  return vertical.includes(formatId) ? 7 : 9
}

// ── Gerador Principal ──────────────────────────────────────────────────

/**
 * Gera uma variação de copy premium para o briefing informado.
 * O variationId garante diversidade entre chamadas sucessivas.
 */
export function generatePremiumCopy(input: PremiumCopyInput): PremiumCopyOutput {
  const bank = COPY_BANKS[input.niche] ?? COPY_BANKS['corporativo']

  // Resolve tom efetivo
  const tone: CopyTone = input.tone ?? STYLE_DEFAULT_TONE[input.visualStyle] ?? 'cinematic'

  // Seed para variedade — baseado em timestamp para evitar repetição
  const seed = Date.now() % 997  // primo para boa distribuição

  // Ângulo base pelo tom + rotação aleatória entre ângulos disponíveis
  const baseAngle    = TONE_ANGLE[tone]
  const angleOffset  = Math.floor(seed / 166) % bank.headlines.length  // rotação entre os 6 ângulos
  const angleToUse   = (baseAngle + angleOffset) % bank.headlines.length

  const headlinePool = bank.headlines[angleToUse]
  const headline     = headlinePool[seed % headlinePool.length]

  const highlight    = bank.highlights[(seed + 3) % bank.highlights.length]
  const subline      = bank.sublines[(seed + 7) % bank.sublines.length]
  const cta          = bank.ctas[(seed + 5) % bank.ctas.length]
  const colorIntent  = TONE_COLOR_INTENT[tone]

  return {
    headline,
    highlightPhrase: highlight,
    subline,
    cta,
    colorIntent,
    variationId: seed,
  }
}
