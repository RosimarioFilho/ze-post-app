import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { html, width = 1080, height = 1080 } = await req.json()
    if (!html) return NextResponse.json({ error: 'HTML obrigatório' }, { status: 400 })

    const puppeteer = (await import('puppeteer')).default

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    })

    const page = await browser.newPage()
    await page.setViewport({ width, height, deviceScaleFactor: 1 })

    // networkidle2: aguarda imagem do Supabase carregar antes de tirar screenshot
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 1500))

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      omitBackground: false,
    })

    await browser.close()

    return new NextResponse(screenshot as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="criativo-${width}x${height}.png"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('arte-png error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
