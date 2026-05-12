import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Aumenta limite de body para HTML com imagens externas
export const config = { api: { bodyParser: { sizeLimit: '16mb' } } }

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

    // networkidle0 garante que todas as imagens externas (Supabase) e fontes carregam
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 45000 })

    // Aguarda Google Fonts renderizarem completamente
    await new Promise(r => setTimeout(r, 1000))

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
