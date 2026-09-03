import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PurchaseRequestsClient } from './PurchaseRequestsClient'

export const dynamic = 'force-dynamic'

export default async function PurchaseRequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
  if (!profile || !['owner', 'manager', 'full_timer'].includes(profile.role)) redirect('/')

  const { data: requests } = await supabase
    .from('purchase_requests')
    .select(`
      *,
      requester:users!purchase_requests_requested_by_fkey(full_name),
      reviewer:users!purchase_requests_reviewed_by_fkey(full_name),
      orderer:users!purchase_requests_ordered_by_fkey(full_name),
      receiver:users!purchase_requests_received_by_fkey(full_name)
    `)
    .order('created_at', { ascending: false })

  return (
    <PurchaseRequestsClient
      requests={requests ?? []}
      currentUserId={user.id}
      currentUserRole={profile.role}
      currentUserName={profile.full_name}
    />
  )
}
