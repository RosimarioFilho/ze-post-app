import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { html, width = 1080, height = 1080 } = await req.json()
    if (!html) return NextResponse.json({ error: 'HTML obrigatório' }, { status: 400 })

    // Import dinâmico para não quebrar o build em ambientes sem Chromium
    const puppeteer = (await import('puppeteer')).default

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
        '--disable-web-security',
        '--allow-running-insecure-content',
      ],
    })

    const page = await browser.newPage()

    await page.setViewport({ width, height, deviceScaleFactor: 2 }) // @2x para alta resolução

    // networkidle2 = até 2 conexões pendentes (mais tolerante que networkidle0)
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 })

    // Aguarda Google Fonts renderizarem (necessário mesmo após networkidle0)
    await new Promise(r => setTimeout(r, 600))

    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height },
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
