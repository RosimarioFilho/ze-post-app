import { NextRequest, NextResponse } from 'next/server'

// Endpoints reais de validação por plataforma
const VALIDATION_ENDPOINTS: Record<string, (token: string, appId?: string) => Promise<{ ok: boolean; account?: string; error?: string }>> = {
  instagram: async (token) => {
    const res = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,username,name&access_token=${token}`)
    const data = await res.json()
    if (!res.ok || data.error) {
      return { ok: false, error: data?.error?.message ?? 'Token inválido ou expirado' }
    }
    return { ok: true, account: data.username || data.name || data.id }
  },
  facebook: async (token) => {
    const res = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${token}`)
    const data = await res.json()
    if (!res.ok || data.error) {
      return { ok: false, error: data?.error?.message ?? 'Token inválido ou expirado' }
    }
    return { ok: true, account: data.name }
  },
  linkedin: async (token) => {
    // Endpoint moderno (OpenID Connect — escopo openid profile)
    const userinfo = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (userinfo.ok) {
      const data = await userinfo.json()
      return { ok: true, account: data.name ?? data.email ?? 'LinkedIn' }
    }

    // Endpoint legado (escopo r_liteprofile — Marketing Developer Platform)
    const me = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        Authorization: `Bearer ${token}`,
        'LinkedIn-Version': '202405',
      },
    })
    if (me.ok) {
      const data = await me.json()
      return { ok: true, account: `${data.localizedFirstName ?? ''} ${data.localizedLastName ?? ''}`.trim() || 'LinkedIn' }
    }

    // Erro detalhado
    let errorMsg = 'Token LinkedIn inválido ou sem permissões'
    try {
      const err = await me.json()
      if (err?.message) errorMsg = `LinkedIn: ${err.message}`
    } catch {}
    return { ok: false, error: errorMsg }
  },
  twitter: async (token) => {
    const res = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok) {
      return { ok: false, error: data?.detail ?? data?.title ?? 'Bearer Token inválido' }
    }
    return { ok: true, account: data.data?.username ?? 'Twitter' }
  },
  tiktok: async () => {
    return { ok: true, account: 'Validação TikTok requer OAuth' }
  },
  youtube: async (token) => {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&access_token=${token}`
    )
    const data = await res.json()
    if (!res.ok || data.error) {
      return { ok: false, error: data?.error?.message ?? 'Token YouTube inválido' }
    }
    const channel = data.items?.[0]?.snippet?.title
    return { ok: true, account: channel ?? 'Canal YouTube' }
  },
}

export async function POST(req: NextRequest) {
  try {
    const { platform, accessToken, appId } = await req.json()
    if (!platform || !accessToken) {
      return NextResponse.json({ ok: false, error: 'Plataforma e token obrigatórios' }, { status: 400 })
    }
    const validator = VALIDATION_ENDPOINTS[platform]
    if (!validator) return NextResponse.json({ ok: false, error: 'Plataforma não suportada' })

    const result = await validator(accessToken, appId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Erro ao testar conexão:', err)
    return NextResponse.json({ ok: false, error: 'Falha de rede ao validar' }, { status: 500 })
  }
}
