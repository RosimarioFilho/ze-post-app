import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SocialFormatId } from '@/lib/social-formats'

export const maxDuration = 30

const CONTENT_TYPE_MAP: Record<string, string> = {
  INSTAGRAM_POST:        'post_instagram',
  INSTAGRAM_CAROUSEL:    'carrossel',
  INSTAGRAM_STORIES:     'stories',
  INSTAGRAM_REELS_COVER: 'reels',
  FACEBOOK_POST:         'post_facebook',
  FACEBOOK_STORIES:      'stories',
  TIKTOK_COVER:          'post_instagram',
  YOUTUBE_THUMBNAIL:     'youtube',
  LINKEDIN_POST:         'post_linkedin_imagem',
  WHATSAPP_STATUS:       'stories',
}

// Recebe as URLs públicas das imagens já enviadas ao Supabase Storage
// pelo browser (via supabase-js client) e cria o registro na tabela contents.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      mediaUrls: string[]
      description: string
      formatId: SocialFormatId
    }

    const { mediaUrls, description, formatId } = body

    if (!mediaUrls?.length) {
      return NextResponse.json({ error: 'Nenhuma URL de imagem fornecida.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('company_id').eq('id', user.id).single()

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 400 })
    }

    const platform = formatId.split('_')[0].toLowerCase()

    const { data: content, error: insertError } = await supabase
      .from('contents')
      .insert({
        company_id:   profile.company_id,
        title:        description.slice(0, 150),
        status:       'aprovado',
        content_type: CONTENT_TYPE_MAP[formatId] ?? 'post_instagram',
        media_urls:   mediaUrls,
        platforms:    [platform],
      })
      .select('id')
      .single()

    if (insertError) throw new Error(`DB error: ${insertError.message}`)

    console.log(`[ze-premium/save] Conteúdo salvo: ${content.id}`)

    return NextResponse.json({ contentId: content.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ze-premium/save] Erro:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
