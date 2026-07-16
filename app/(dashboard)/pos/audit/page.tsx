export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { AuditClient } from './AuditClient'
import { redirect } from 'next/navigation'

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (!userProfile || !['owner', 'manager'].includes(userProfile.role)) {
    redirect('/pos')
  }

  const { data: logs } = await supabase
    .from('pos_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  return <AuditClient initialLogs={logs ?? []} />
}
