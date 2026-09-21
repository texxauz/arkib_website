import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMembershipAccess } from '@/lib/membership-auth'
import { MemberDetailClient } from './MemberDetailClient'

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role, tab_permissions').eq('id', user.id).single()
  const access = getMembershipAccess(profile?.role, profile?.tab_permissions)
  if (access === 'none') redirect('/dashboard')

  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'

  const [{ data: member }, { data: ledger }] = await Promise.all([
    supabase.from('members').select('*').eq('id', id).single(),
    supabase.from('membership_ledger')
      .select('id, type, credits_delta, reason, order_id, created_at')
      .eq('member_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (!member) notFound()

  return (
    <MemberDetailClient
      member={member}
      ledger={ledger ?? []}
      canEdit={access === 'edit'}
      isAdmin={isAdmin}
    />
  )
}
