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
    .select('*')
    .eq('id', jobId)
    .single()

  if (error || !job) return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })

  return NextResponse.json(job)
}
