import { NextRequest, NextResponse } from 'next/server'
import { buildZePremiumPrompt, type ZePremiumNiche, type ZePremiumStyle } from '@/lib/ze-premium-prompt-builder'
import { SOCIAL_FORMATS, type SocialFormatId } from '@/lib/social-formats'
import { computeSafeAreaScores, computeProductSafeScore } from '@/lib/safe-area-engine'
import { getCompositionMode } from '@/lib/layout-composition-engine'
import { generateImage } from '@/lib/imageProvider'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      objective: string
      niche: ZePremiumNiche
      style: ZePremiumStyle
      headline: string
      subheadline?: string
      cta?: string
      formatId?: SocialFormatId
      productImageBase64?: string
      productImageMime?: string
    }

    const {
      objective, niche, style, headline, subheadline, cta,
      formatId, productImageBase64, productImageMime,
    } = body

    if (!headline?.trim()) {
      return NextResponse.json({ error: 'Headline é obrigatória' }, { status: 400 })
    }

    // Formato da mídia — padrão: Instagram Post (1:1)
    const format = (formatId && SOCIAL_FORMATS[formatId])
      ? SOCIAL_FORMATS[formatId]
      : SOCIAL_FORMATS.INSTAGRAM_POST

    const prompt = buildZePremiumPrompt({
      objective: objective ?? '',
      niche: niche ?? 'corporativo',
      style: style ?? 'premium_dark',
      headline,
      subheadline,
      cta,
      hasProductImage: !!productImageBase64,
      format,
    })

    console.log(
      `[ze-premium] Gerando arte — format=${format.id} niche=${niche} style=${style} ` +
      `headline="${headline}" hasProduct=${!!productImageBase64} ` +
      `genSize=${format.genW}x${format.genH}`
    )
    console.log(`[ze-premium] Prompt: ${prompt.slice(0, 300)}...`)

    const result = await generateImage(
      prompt,
      'post_instagram',
      format.genW,
      format.genH,
      productImageBase64,
      productImageMime as 'image/jpeg' | 'image/png' | 'image/webp' | undefined,
    )

    console.log(`[ze-premium] Arte gerada via ${result.provider} (${format.genW}×${format.genH})`)

    // Scores e metadados de composição
    const safeAreaScores    = computeSafeAreaScores(format)
    const productSafeScore  = computeProductSafeScore(format)
    const compositionMode   = getCompositionMode(format)
    const copyVariationId   = Math.round(Date.now() % 1000)

    return NextResponse.json({
      imageBase64: result.base64,
      mimeType: result.mimeType,
      provider: result.provider,
      prompt,
      formatId: format.id,
      formatLabel: format.label,
      safeAreaScores,
      productSafeScore,
      compositionMode,
      copyVariationId,
      formatRiskLevel: safeAreaScores.risk_level,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ze-premium] Erro na geração:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
