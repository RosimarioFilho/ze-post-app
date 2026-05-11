import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const jobId = req.nextUrl.searchParams.get('id')
  if (!jobId) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const { data: job, error } = await supabase
    .from('creative_jobs')
    .select(`
      id, status, current_agent, progress_pct,
      vision_analysis, palette, strategy, copy_output,
      art_direction, rendered_png_url, critique,
      correction_attempts, final_html, final_png_url,
      error_message, created_at, updated_at
    `)
    .eq('id', jobId)
    .single()

  if (error || !job) return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })

  return NextResponse.json(job)
}
