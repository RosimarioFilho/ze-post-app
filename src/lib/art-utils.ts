import fs from 'fs'
import path from 'path'

export function readApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  // Fallback: read directly from .env.local (bypasses Turbopack env injection issues)
  for (const dir of [process.cwd(), path.join(process.cwd(), '..'), path.join(process.cwd(), '..', '..', '..', '..')]) {
    try {
      const content = fs.readFileSync(path.join(dir, '.env.local'), 'utf-8')
      const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m)
      if (match?.[1]?.trim()) return match[1].trim()
    } catch {}
  }
  return ''
}

export const AR_SIZES: Record<string, [number, number]> = {
  post_instagram: [1080, 1080],
  post_facebook: [1080, 566],
  post_linkedin_imagem: [1200, 627],
  post_linkedin_texto: [1080, 1080],
  stories: [1080, 1920],
  carrossel: [1080, 1080],
  youtube: [1280, 720],
  reels: [1080, 1920],
}

export function extractHtml(text: string): string {
  const fenced = text.match(/```html\n?([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const full = text.match(/<(!DOCTYPE html|html)[\s\S]*<\/html>/i)
  if (full) return full[0].trim()
  const div = text.match(/<(div|section|article|main)[^>]*>[\s\S]*<\/\1>/i)
  if (div) return div[0].trim()
  return text.trim()
}

// Rede de segurança NUCLEAR: substitui TODAS as URLs de stock photos em QUALQUER
// contexto do HTML (src="", background-image: url(), url() em CSS inline)
// pela URL do produto do cliente. Se nenhuma URL de stock for encontrada, injeta
// a imagem centralizada. Opera em qualquer formato que a IA possa usar.
export function enforceProductImage(html: string, productUrl: string): string {
  if (!html || !productUrl) return html
  if (html.includes(productUrl)) return html

  const STOCK_RE = /https?:\/\/(?:images\.unsplash\.com|cdn\.unsplash\.com|[^\s"')>]*unsplash\.com|[^\s"')>]*pexels\.com|[^\s"')>]*pixabay\.com|[^\s"')>]*shutterstock\.com|[^\s"')>]*istockphoto\.com)[^\s"')>]*/gi

  let modified = html.replace(STOCK_RE, productUrl)

  if (!modified.includes(productUrl)) {
    const inject = `<img src="${productUrl}" alt="produto" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);height:65%;max-width:88%;object-fit:contain;filter:drop-shadow(0 40px 80px rgba(0,0,0,0.5));z-index:4">`
    modified = modified.includes('</body>')
      ? modified.replace('</body>', `${inject}\n</body>`)
      : modified + inject
  }
  return modified
}

export interface LayoutGuideParams {
  W: number
  H: number
  tipo: string
  headlinePx: number
  sublinePx: number
  priceBigPx: number
  ctaPx: number
  PAD: number
  GAP: number
  productHeightPx: number
  isVertical: boolean
  isSquare: boolean
}

export function buildLayoutDimensions(tipo: string, W: number, H: number) {
  const isVertical   = H / W >= 1.4
  const isSquare     = Math.abs(H / W - 1) < 0.1
  const isHorizontal = W / H >= 1.5

  const base = Math.min(W, H)
  const headlinePx  = Math.round(base / (isVertical ? 8.5 : isHorizontal ? 9.5 : 8))
  const sublinePx   = Math.round(base / 22)
  const priceBigPx  = Math.round(base / 7)
  const ctaPx       = Math.round(base / 26)
  const logoPx      = Math.round(base / 50)
  const PAD         = Math.round(base * 0.06)
  const GAP         = Math.round(base * 0.025)

  // Produto ocupa 65-75% do canvas — REGRA INVIOLÁVEL
  const productHeightPx = isVertical
    ? Math.round(H * 0.65)   // Stories: produto gigante, ocupa 65% da altura
    : isSquare
    ? Math.round(H * 0.72)   // Quadrado: produto centralizado, 72% da altura
    : Math.round(H * 0.88)   // Horizontal: produto lateral, quase full height

  return { isVertical, isSquare, isHorizontal, base, headlinePx, sublinePx, priceBigPx, ctaPx, logoPx, PAD, GAP, productHeightPx }
}

export function buildLayoutGuide(tipo: string, W: number, H: number): string {
  const d = buildLayoutDimensions(tipo, W, H)

  // Zona segura Stories/Reels (evita corte nas plataformas)
  const storiesSafeTop    = Math.round(H * 0.13)  // ~250px em 1920px
  const storiesSafeBottom = Math.round(H * 0.18)  // ~340px em 1920px

  if (d.isVertical) {
    return `═══ FORMATO STORIES/REELS ${W}×${H}px ═══

PRINCÍPIO: O PRODUTO É A ESTRELA. Ele deve ocupar 60-70% da tela. O olho do espectador bate no produto em ≤ 2 segundos.

ESTRUTURA OBRIGATÓRIA (position:absolute em todo elemento):

① FUNDO (z-index:0):
   width:${W}px; height:${H}px;
   background: gradiente ou cor sólida que CONTRASTE com o produto.
   NUNCA fundo branco com produto branco. NUNCA fundo preto com produto preto.

② PRODUTO — HERÓI ABSOLUTO (z-index:3):
   position:absolute;
   left:50%; top:48%; transform:translate(-50%,-50%);
   height:${d.productHeightPx}px;  ← MÍNIMO INVIOLÁVEL — nunca menor que isso
   max-width:90%; object-fit:contain;
   filter: drop-shadow(0 ${Math.round(d.productHeightPx*0.08)}px ${Math.round(d.productHeightPx*0.16)}px rgba(0,0,0,0.55))
           drop-shadow(0 ${Math.round(d.productHeightPx*0.02)}px ${Math.round(d.productHeightPx*0.04)}px rgba(0,0,0,0.3));
   O produto DEVE ser o maior elemento visual. Se o produto "flutua" sobre o fundo, adicione sombra profunda.

③ ZONA SUPERIOR — segura (top:0; height:${storiesSafeTop}px; z-index:5):
   Logo da empresa (canto esq) + tag/badge opcional (canto dir).
   Tipografia headline compacta se necessário.

④ ZONA INFERIOR — CTA (bottom:0; height:${storiesSafeBottom}px; z-index:5):
   Fundo sólido ou translúcido (rgba, backdrop-filter:blur).
   Headline: ${d.headlinePx}px weight:900 line-height:0.9 — ACIMA do preço.
   Preço/oferta: ${d.priceBigPx}px weight:900 — cor destaque (amarelo, laranja, branco).
   Subline: ${d.sublinePx}px weight:400.
   Botão CTA: border-radius:${Math.round(d.ctaPx*0.6)}px; padding:${Math.round(d.ctaPx*0.4)}px ${Math.round(d.ctaPx*1.2)}px; font-size:${d.ctaPx}px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em.

REGRA 60-30-10: 60% cor dominante (fundo), 30% cor secundária (headline/CTA), 10% cor de acento (preço/badge).
PROIBIDO: texto sobre o produto | produto menor que ${d.productHeightPx}px | layout split esq/dir.`
  }

  if (d.isSquare) {
    const badgeSize = Math.round(W * 0.22)
    return `═══ FORMATO QUADRADO ${W}×${H}px ═══

PRINCÍPIO: HERO CENTRALIZADO. O produto ocupa o centro e comanda 65-75% do espaço visual.
NUNCA use layout split esquerda/direita — isso fragmenta o impacto visual.

ESTRUTURA OBRIGATÓRIA:

① FUNDO (z-index:0, position:absolute, inset:0):
   Gradiente radial OU diagonal que escurece nas bordas — cria "vignette" natural.
   Exemplo: background:radial-gradient(ellipse at center, #1a2a4a 0%, #050f1e 100%);
   O contraste fundo×produto é OBRIGATÓRIO.

② PRODUTO — HERÓI CENTRAL (z-index:3):
   position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
   height:${d.productHeightPx}px;  ← MÍNIMO INVIOLÁVEL
   max-width:80%; object-fit:contain;
   filter: drop-shadow(0 ${Math.round(d.productHeightPx*0.07)}px ${Math.round(d.productHeightPx*0.14)}px rgba(0,0,0,0.6))
           drop-shadow(0 ${Math.round(d.productHeightPx*0.02)}px ${Math.round(d.productHeightPx*0.04)}px rgba(0,0,0,0.35));

③ HEADLINE (z-index:5) — ACIMA ou ABAIXO do produto, NUNCA sobre ele:
   position:absolute; text-align:center; width:${Math.round(W*0.9)}px; left:${Math.round(W*0.05)}px;
   Se acima: top:${d.PAD}px.  Se abaixo: posicione APÓS o fim do produto.
   font-size:${d.headlinePx}px; font-weight:900; line-height:0.92; text-transform:uppercase.

④ RODAPÉ CTA (z-index:5):
   position:absolute; bottom:0; width:${W}px; height:${Math.round(H*0.2)}px;
   background sólido ou gradiente (não transparente).
   Subline ${d.sublinePx}px + Botão CTA ${d.ctaPx}px uppercase centralizados.

⑤ BADGE DE PREÇO (opcional, z-index:6):
   position:absolute; top:${d.PAD}px; right:${d.PAD}px;
   width:${badgeSize}px; height:${badgeSize}px; border-radius:50% OU ${Math.round(badgeSize*0.2)}px;
   background cor acento; font-size:${Math.round(d.priceBigPx*0.7)}px; font-weight:900.

REGRA DOURADA: Se o produto não for o primeiro elemento que o olho percebe, o layout está ERRADO.
PROIBIDO: layout split | produto menor que ${d.productHeightPx}px | headline sobre o produto.`
  }

  // Horizontal
  const textZoneW = Math.round(W * 0.42)
  return `═══ FORMATO HORIZONTAL ${W}×${H}px ═══

PRINCÍPIO: PRODUTO GIGANTE À DIREITA. O produto deve ocupar ≥55% da largura e quase 100% da altura.
O texto fica na faixa esquerda (${textZoneW}px) e não compete com o produto.

ESTRUTURA OBRIGATÓRIA:

① FUNDO (z-index:0, position:absolute, inset:0):
   Gradiente horizontal: cor forte à esquerda (zona de texto) → mais suave à direita (zona produto).
   Exemplo: background:linear-gradient(90deg, #0a1628 0%, #0a1628 40%, #0d1f38 100%);

② PRODUTO — HERÓI À DIREITA (z-index:3):
   position:absolute; right:0; top:50%; transform:translateY(-50%);
   height:${d.productHeightPx}px;  ← MÍNIMO INVIOLÁVEL (quase full height)
   width:${Math.round(W*0.6)}px; object-fit:contain; object-position:center;
   filter: drop-shadow(-${Math.round(W*0.04)}px 0 ${Math.round(W*0.06)}px rgba(0,0,0,0.5))
           drop-shadow(0 ${Math.round(H*0.06)}px ${Math.round(H*0.12)}px rgba(0,0,0,0.4));

③ ZONA DE TEXTO — ESQUERDA (z-index:5):
   position:absolute; left:${d.PAD}px; top:50%; transform:translateY(-50%);
   width:${textZoneW}px; display:flex; flex-direction:column; gap:${d.GAP*2}px;
   • Logo: height:${d.logoPx * 3}px; object-fit:contain; margin-bottom:${d.GAP}px.
   • Headline: font-size:${d.headlinePx}px; font-weight:900; line-height:0.9; text-transform:uppercase.
   • Subline: font-size:${d.sublinePx}px; font-weight:400; opacity:0.85.
   • Preço: font-size:${d.priceBigPx}px; font-weight:900; color: cor acento.
   • Botão CTA: align-self:flex-start; font-size:${d.ctaPx}px; font-weight:700; uppercase;
     padding:${Math.round(d.ctaPx*0.55)}px ${Math.round(d.ctaPx*1.5)}px; border-radius:${Math.round(d.ctaPx*0.5)}px.

PROIBIDO: produto menor que ${d.productHeightPx}px altura | texto invadindo a zona do produto.`
}

export function wrapHtml(html: string, W: number, H: number): string {
  const isFullDoc = html.trimStart().toLowerCase().startsWith('<!doctype') || html.trimStart().toLowerCase().startsWith('<html')
  return isFullDoc
    ? html
    : `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden}</style></head><body>${html}</body></html>`
}
