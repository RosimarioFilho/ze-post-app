import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    let { html, width = 1080, height = 1080 } = await req.json()
    if (!html) return NextResponse.json({ error: 'HTML obrigatório' }, { status: 400 })

    // Baixa imagens externas (Supabase) server-side e converte para base64
    // Evita que Chromium headless precise fazer requests externos
    const imgMatch = html.match(/<img src="(https?:\/\/[^"]+)"/)
    if (imgMatch) {
      try {
        const imgRes = await fetch(imgMatch[1])
        if (imgRes.ok) {
          const imgBuf = await imgRes.arrayBuffer()
          const imgB64 = Buffer.from(imgBuf).toString('base64')
          const imgMime = imgRes.headers.get('content-type') || 'image/jpeg'
          html = html.replace(imgMatch[1], `data:${imgMime};base64,${imgB64}`)
        }
      } catch { /* usa URL original se download falhar */ }
    }

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
    await page.setViewport({ width, height, deviceScaleFactor: 2 })

    // Imagem já está embutida como base64 — só aguarda fontes e DOM
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 1200))

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
