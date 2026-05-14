import Anthropic from '@anthropic-ai/sdk'
import type { CarouselNarrativePlan, CarouselSlidePlan, CarouselSlideResult, SlideRole } from '@/types'
import type { Layout, EmotionalToken } from '@/lib/creative-engine'

// ── Constantes de narrativa ───────────────────────────────────

const SLIDE_ROLE_LABELS_PT: Record<SlideRole, string> = {
  HOOK:    'Gancho',
  CONTEXT: 'Contexto',
  VALUE:   'Valor',
  PROOF:   'Prova',
  CTA:     'CTA',
}

export { SLIDE_ROLE_LABELS_PT }

// Layout por posição do slide — garante variação (sem repetição)
const LAYOUT_SEQUENCE: Layout[] = [
  'HERO_RIGHT',    // slide 1 (HOOK) — máximo impacto, sujeito ocupa lado direito
  'CENTER_STACK',  // slide 2 (CONTEXT) — leitura clara, texto centralizado
  'HERO_LEFT',     // slide 3 (VALUE) — contraste com slide 1
  'SPLIT_SCREEN',  // slide 4 (PROOF) — divide evidência/texto
  'POSTER',        // slide 5 (CTA) — headline gigante, máxima conversão
]

// Progressão de energia ao longo do carrossel
const ENERGY_SEQUENCE: EmotionalToken[] = [
  'AGGRESSIVE',  // slide 1 — energia alta para parar o scroll
  'ENERGETIC',   // slide 2 — manter engajamento
  'PREMIUM',     // slide 3 — entregar valor com refinamento
  'CLEAN',       // slide 4 — credibilidade e clareza
  'DRAMATIC',    // slide 5 — emoção máxima no CTA
]

// ── Planejador narrativo ──────────────────────────────────────

export async function planCarouselNarrative(
  anthropic: Anthropic,
  briefing: string,
  company: { name: string; niche: string; primary_color: string },
  strategy: Record<string, string>,
  copyHints: { headline: string; cta: string },
  slideCount: number,
): Promise<CarouselNarrativePlan> {
  const roles = buildRoleSequence(slideCount)

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system: `Você é um Estrategista de Conteúdo especializado em carrosséis virais para Instagram.
Crie um plano narrativo para um carrossel de ${slideCount} slides. Retorne APENAS JSON puro:
{
  "overallObjective": "objetivo em 1 frase",
  "targetAction": "ação desejada (ex: comentar PALAVRA, salvar, direct)",
  "emotionalArc": "arco emocional em 1 frase",
  "slides": [
    {
      "index": 1,
      "role": "HOOK",
      "objective": "o que este slide deve fazer",
      "headline": "headline impactante (máx 4 palavras)",
      "subline": "complemento (máx 8 palavras)",
      "energyLevel": "HIGH",
      "layoutSuggestion": "HERO_RIGHT"
    }
  ]
}

REGRAS DE NARRATIVA — cada slide tem uma função específica:
- HOOK (slide 1): tensão máxima, curiosidade, "para o dedo" — headline mais forte, sem revelar tudo
- CONTEXT (slide 2): introduz o problema ou benefício central — clareza e relevância
- VALUE (slide 3): entrega dica, insight ou benefício forte — o maior valor do conteúdo
- PROOF (slide 4): autoridade, resultado, evidência, desejo — constrói confiança
- CTA (último): converte — comentário, save, direct, compartilhamento; CTA contextual e humano

PROGRESSÃO DE ENERGIA: alta → engajante → refinada → confiante → emocional/impactante

O CTA do slide final DEVE ser contextual e humano, exemplos:
- "Comente [PALAVRA] para saber mais"
- "Qual dessas dicas você não sabia? Comenta aqui"
- "Salve esse post para consultar depois"
- "Quer uma condição especial? Chama no direct"`,
    messages: [{
      role: 'user',
      content: `Empresa: ${company.name}
Nicho: ${company.niche}
Briefing: ${briefing}
Estratégia: ${JSON.stringify(strategy)}
Headline geral: ${copyHints.headline}
CTA geral: ${copyHints.cta}
Roles dos slides: ${roles.join(', ')}`,
    }],
  })

  const raw = res.content[0].type === 'text' ? res.content[0].text : '{}'
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return buildFallbackPlan(briefing, slideCount, roles)

  try {
    const parsed = JSON.parse(jsonMatch[0]) as CarouselNarrativePlan
    if (!Array.isArray(parsed.slides)) return buildFallbackPlan(briefing, slideCount, roles)

    // Garante que os layouts sugeridos respeitem a sequência curada
    parsed.slides = parsed.slides.map((slide, i) => ({
      ...slide,
      layoutSuggestion: LAYOUT_SEQUENCE[i] ?? LAYOUT_SEQUENCE[LAYOUT_SEQUENCE.length - 1],
      energyLevel: slide.energyLevel ?? mapEnergyLevel(i),
    }))

    // Se o AI retornou menos slides que o solicitado, completa com fallback
    if (parsed.slides.length < slideCount) {
      const fallback = buildFallbackPlan(briefing, slideCount, roles)
      for (let i = parsed.slides.length; i < slideCount; i++) {
        parsed.slides.push(fallback.slides[i])
      }
    }
    // Garante que cada slide tem index e role válidos
    parsed.slides = parsed.slides.map((slide, i) => ({
      ...slide,
      index: slide.index ?? i + 1,
      role: (slide.role ?? roles[i] ?? 'VALUE') as SlideRole,
    }))

    return parsed
  } catch {
    return buildFallbackPlan(briefing, slideCount, roles)
  }
}

// ── Sequência de layouts ──────────────────────────────────────

export function getSlideLayoutVariations(slideCount: number): Layout[] {
  const out: Layout[] = []
  for (let i = 0; i < slideCount; i++) {
    out.push(LAYOUT_SEQUENCE[i] ?? LAYOUT_SEQUENCE[i % LAYOUT_SEQUENCE.length])
  }
  return out
}

// ── Progressão de energia ─────────────────────────────────────

export function getEnergyProgression(slideCount: number): EmotionalToken[] {
  const out: EmotionalToken[] = []
  for (let i = 0; i < slideCount; i++) {
    out.push(ENERGY_SEQUENCE[i] ?? ENERGY_SEQUENCE[i % ENERGY_SEQUENCE.length])
  }
  return out
}

// ── Validação de consistência ─────────────────────────────────

export function validateCarouselConsistency(
  slides: CarouselSlideResult[],
  expectedCount: number,
): { valid: boolean; issues: string[] } {
  const issues: string[] = []

  if (slides.length !== expectedCount) {
    issues.push(`Esperados ${expectedCount} slides, encontrados ${slides.length}`)
  }

  const doneSlides = slides.filter(s => s.status === 'done')
  if (doneSlides.length < slides.length) {
    const failed = slides.filter(s => s.status === 'failed').map(s => `Slide ${s.index}`)
    if (failed.length) issues.push(`Slides com erro: ${failed.join(', ')}`)
  }

  const withUrl = slides.filter(s => s.url)
  if (withUrl.length !== slides.length) {
    issues.push(`${slides.length - withUrl.length} slide(s) sem URL de imagem`)
  }

  // Verifica se slide 1 tem role HOOK e último tem CTA
  const first = slides.find(s => s.index === 1)
  const last = slides.find(s => s.index === slides.length)
  if (first && first.role !== 'HOOK') issues.push('Slide 1 não tem role HOOK')
  if (last && last.role !== 'CTA') issues.push(`Slide ${slides.length} não tem role CTA`)

  // Verifica repetição de layouts
  const layouts = slides.map(s => s.layoutUsed).filter(Boolean)
  const layoutSet = new Set(layouts)
  if (layouts.length > 2 && layoutSet.size < Math.ceil(layouts.length / 2)) {
    issues.push('Muitos layouts repetidos — variação visual insuficiente')
  }

  return { valid: issues.length === 0, issues }
}

// ── Score geral do carrossel ──────────────────────────────────

export function scoreCarousel(
  plan: CarouselNarrativePlan,
  slides: CarouselSlideResult[],
): { overallScore: number; issues: string[] } {
  const issues: string[] = []

  const doneSlides = slides.filter(s => s.status === 'done' && s.score > 0)
  if (doneSlides.length === 0) return { overallScore: 0, issues: ['Nenhum slide gerado com sucesso'] }

  // Média ponderada: slide 1 (HOOK) e último (CTA) têm peso maior
  let weightedSum = 0
  let totalWeight = 0
  for (const slide of doneSlides) {
    const weight = slide.index === 1 || slide.role === 'CTA' ? 1.5 : 1
    weightedSum += slide.score * weight
    totalWeight += weight
  }
  let score = Math.round(weightedSum / totalWeight)

  // Penalidades
  const failedCount = slides.filter(s => s.status === 'failed').length
  if (failedCount > 0) {
    score = Math.max(0, score - failedCount * 8)
    issues.push(`${failedCount} slide(s) com falha`)
  }

  const lowScoreSlides = doneSlides.filter(s => s.score < 65)
  if (lowScoreSlides.length > 0) {
    score = Math.max(0, score - lowScoreSlides.length * 3)
    issues.push(`${lowScoreSlides.length} slide(s) com score abaixo de 65`)
  }

  if (!plan.targetAction) issues.push('Ação-alvo do CTA não definida')

  return { overallScore: Math.min(100, score), issues }
}

// ── Helpers internos ──────────────────────────────────────────

function buildRoleSequence(count: number): SlideRole[] {
  if (count <= 3) return ['HOOK', 'VALUE', 'CTA']
  if (count === 4) return ['HOOK', 'CONTEXT', 'VALUE', 'CTA']
  if (count === 5) return ['HOOK', 'CONTEXT', 'VALUE', 'PROOF', 'CTA']
  // 6-10: preenche com VALUE/PROOF extras entre PROOF e CTA
  const middle: SlideRole[] = ['CONTEXT', 'VALUE', 'PROOF']
  const fillers: SlideRole[] = ['VALUE', 'PROOF', 'VALUE', 'PROOF', 'VALUE']
  const seq: SlideRole[] = ['HOOK', ...middle, ...fillers.slice(0, count - 5), 'CTA']
  return seq.slice(0, count)
}

function mapEnergyLevel(index: number): CarouselSlidePlan['energyLevel'] {
  const map: CarouselSlidePlan['energyLevel'][] = ['HIGH', 'MEDIUM_HIGH', 'MEDIUM', 'DEEP', 'EMOTIONAL']
  return map[index] ?? 'MEDIUM'
}

function buildFallbackPlan(
  briefing: string,
  slideCount: number,
  roles: SlideRole[],
): CarouselNarrativePlan {
  const slides: CarouselSlidePlan[] = roles.map((role, i) => ({
    index: i + 1,
    role,
    objective: SLIDE_ROLE_LABELS_PT[role],
    headline: i === 0 ? briefing.slice(0, 20) : SLIDE_ROLE_LABELS_PT[role],
    subline: briefing.slice(0, 40),
    ...(role === 'CTA' ? { cta: 'Saiba mais' } : {}),
    energyLevel: mapEnergyLevel(i),
    layoutSuggestion: LAYOUT_SEQUENCE[i] ?? 'CENTER_STACK',
  }))

  return {
    overallObjective: briefing.slice(0, 80),
    targetAction: 'Salve esse post',
    emotionalArc: 'curiosidade → valor → conversão',
    slides,
  }
}
