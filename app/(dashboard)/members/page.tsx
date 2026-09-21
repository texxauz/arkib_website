import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMembershipAccess } from '@/lib/membership-auth'
import { MembersClient } from './MembersClient'

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role, tab_permissions').eq('id', user.id).single()
  const access = getMembershipAccess(profile?.role, profile?.tab_permissions)
  if (access === 'none') redirect('/dashboard')

  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'

  const [{ data: members }, { data: rewards }, queueResult] = await Promise.all([
    supabase
      .from('members')
      .select('id, name, phone_normalized, credits_balance, total_spend, total_visits, last_visit_at, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('rewards').select('*').eq('is_active', true).order('credits_required'),
    isAdmin
      ? supabase.from('membership_credit_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
  ])

  return (
    <MembersClient
      initialMembers={members ?? []}
      initialRewards={rewards ?? []}
      pendingQueueCount={queueResult.count ?? 0}
      canEdit={access === 'edit'}
      isAdmin={isAdmin}
    />
  )
}
