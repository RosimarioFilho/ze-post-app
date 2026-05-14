import { NextRequest, NextResponse } from 'next/server'
import { buildZePremiumPrompt, type ZePremiumNiche, type ZePremiumStyle } from '@/lib/ze-premium-prompt-builder'
import { generateImage } from '@/lib/imageProvider'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      objective: string
      niche: ZePremiumNiche
      style: ZePremiumStyle
      cta?: string
      productImageBase64?: string
      productImageMime?: string
    }

    const { objective, niche, style, cta, productImageBase64, productImageMime } = body

    if (!objective?.trim()) {
      return NextResponse.json({ error: 'Objetivo da arte é obrigatório' }, { status: 400 })
    }

    const prompt = buildZePremiumPrompt({
      objective,
      niche: niche ?? 'corporativo',
      style: style ?? 'premium_dark',
      cta,
      hasProductImage: !!productImageBase64,
      hasLogo: false,
    })

    console.log(`[ze-premium] Gerando arte — niche=${niche} style=${style} hasProduct=${!!productImageBase64}`)
    console.log(`[ze-premium] Prompt: ${prompt.slice(0, 200)}...`)

    const result = await generateImage(
      prompt,
      'post_instagram',   // square 1:1
      1024, 1024,
      productImageBase64,
      productImageMime as 'image/jpeg' | 'image/png' | 'image/webp' | undefined,
    )

    console.log(`[ze-premium] Arte gerada via ${result.provider}`)

    return NextResponse.json({
      imageBase64: result.base64,
      mimeType: result.mimeType,
      provider: result.provider,
      prompt,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ze-premium] Erro na geração:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
