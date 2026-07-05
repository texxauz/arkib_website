import { createClient } from '@/lib/supabase/server'
import { ChecklistClient } from './ChecklistClient'
import { redirect } from 'next/navigation'

export default async function ChecklistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'

  const [{ data: items }, { data: logs }] = await Promise.all([
    supabase.from('checklist_items').select('*').eq('is_active', true).order('sort_order').order('created_at'),
    supabase.from('checklist_logs').select('*').order('submitted_at', { ascending: false }).limit(60),
  ])

  return (
    <ChecklistClient
      initialItems={items ?? []}
      initialLogs={logs ?? []}
      userId={user.id}
      userName={userProfile?.full_name ?? user.email ?? 'Staff'}
      isAdmin={isAdmin ?? false}
    />
  )
}
