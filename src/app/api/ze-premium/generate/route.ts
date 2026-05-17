import { NextRequest, NextResponse } from 'next/server'
import { SOCIAL_FORMATS, type SocialFormatId } from '@/lib/social-formats'
import { generateImage, generateImage916 } from '@/lib/imageProvider'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      objective: string
      formatId?: SocialFormatId
      productImageBase64?: string
      productImageMime?: string
    }

    const { objective, formatId, productImageBase64, productImageMime } = body

    if (!objective?.trim()) {
      return NextResponse.json({ error: 'Descreva o que você quer criar.' }, { status: 400 })
    }

    // ── Buscar logo da empresa ────────────────────────────────────────
    let logoBase64:  string | undefined
    let companyName: string | undefined

    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles').select('company_id').eq('id', user.id).single()
        if (profile?.company_id) {
          const { data: company } = await supabase
            .from('companies').select('name, logo_url').eq('id', profile.company_id).single()
          companyName = company?.name ?? undefined
          if (company?.logo_url) {
            const logoRes = await fetch(company.logo_url)
            if (logoRes.ok) {
              logoBase64 = Buffer.from(await logoRes.arrayBuffer()).toString('base64')
              console.log(`[ze-premium] Logo: ${companyName}`)
            }
          }
        }
      }
    } catch { console.warn('[ze-premium] Logo fetch falhou') }

    const format = (formatId && SOCIAL_FORMATS[formatId])
      ? SOCIAL_FORMATS[formatId]
      : SOCIAL_FORMATS.INSTAGRAM_POST

    const mimeArg = productImageMime as 'image/jpeg' | 'image/png' | 'image/webp' | undefined

    const promptParts = [objective.trim()]
    if (logoBase64) {
      promptParts.push(
        'Place the company logo (provided as reference image) at the bottom of the creative, ' +
        'elegantly positioned, proportional in size.'
      )
    }
    const prompt = promptParts.join('. ')

    const isVertical = format.aspectRatio === '9:16'
    const isCarousel = format.id === 'INSTAGRAM_CAROUSEL'

    // ── CARROSSEL: 3 slides gerados em paralelo ───────────────────────
    if (isCarousel) {
      console.log('[ze-premium] Carrossel — gerando 3 slides em paralelo')
      const slideHints = [
        'Slide 1 of 3 — impactful opening visual, strong hook to capture immediate attention',
        'Slide 2 of 3 — product or benefit detail, key differentiators and supporting visuals',
        'Slide 3 of 3 — strong call to action, closing with clear next step for the audience',
      ]
      const slides = await Promise.all(
        slideHints.map((hint, i) => {
          const sp = `${prompt}. ${hint}`
          return generateImage(sp, 'carrossel', format.genW, format.genH, productImageBase64, mimeArg, logoBase64)
            .then(r => ({ index: i, imageBase64: r.base64, mimeType: r.mimeType, provider: r.provider }))
        })
      )
      return NextResponse.json({
        isCarousel: true,
        slides,
        formatId:    format.id,
        formatLabel: format.label,
        hasLogo:     !!logoBase64,
        companyName: companyName ?? null,
      })
    }

    // ── IMAGEM ÚNICA ─────────────────────────────────────────────────
    console.log(`[ze-premium] Single — format=${format.id} vertical=${isVertical}`)
    const result = isVertical
      ? await generateImage916(prompt, productImageBase64, mimeArg, logoBase64)
      : await generateImage(prompt, 'post_instagram', format.genW, format.genH, productImageBase64, mimeArg, logoBase64)

    console.log(`[ze-premium] Arte gerada via ${result.provider}`)

    return NextResponse.json({
      isCarousel:  false,
      imageBase64: result.base64,
      mimeType:    result.mimeType,
      provider:    result.provider,
      formatId:    format.id,
      formatLabel: format.label,
      hasLogo:     !!logoBase64,
      companyName: companyName ?? null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ze-premium] Erro:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
