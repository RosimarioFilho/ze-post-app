import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import type { Profile } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, company:companies(*)')
    .eq('id', user.id)
    .single()

  if (profile && profile.onboarding_completed === false && !profile.company_id) {
    redirect('/onboarding')
  }

  const { count: pendingCount } = await supabase
    .from('approvals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente')
    .eq('company_id', profile?.company_id ?? '')

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar profile={profile as Profile} pendingCount={pendingCount ?? 0} />
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  )
}
