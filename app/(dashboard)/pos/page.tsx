export const revalidate = 10

import { createClient } from '@/lib/supabase/server'
import { FloorPlanClient } from './FloorPlanClient'
import { redirect } from 'next/navigation'

export default async function POSPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users').select('role, full_name, tab_permissions').eq('id', user.id).single()
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'

  const [{ data: tables }, { data: orders }, { data: config }, { data: staffList }] = await Promise.all([
    supabase.from('pos_tables').select('*').eq('is_active', true).order('section').order('sort_order'),
    supabase.from('pos_orders').select('id, table_id, covers, opened_at, server_name, guest_name, total, status').eq('status', 'open'),
    supabase.from('pos_config').select('key, value'),
    supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
  ])

  const configMap = Object.fromEntries((config ?? []).map(c => [c.key, c.value]))

  return (
    <FloorPlanClient
      initialTables={tables ?? []}
      openOrders={orders ?? []}
      userId={user.id}
      userName={userProfile?.full_name ?? 'Staff'}
      isAdmin={isAdmin ?? false}
      config={configMap}
      staffList={(staffList ?? []).map(s => s.full_name).filter(Boolean) as string[]}
    />
  )
}
