export const revalidate = 30

import { createClient } from '@/lib/supabase/server'
import { FloorPlanClient } from './FloorPlanClient'
import { redirect } from 'next/navigation'

export default async function POSPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, tablesResult, ordersResult, configResult, staffResult] = await Promise.all([
    supabase.from('users').select('role, full_name, tab_permissions').eq('id', user.id).single(),
    supabase.from('pos_tables').select('id, name, section, capacity, pos_x, pos_y, shape, sort_order, is_active, current_order_id').eq('is_active', true).order('section').order('sort_order'),
    supabase.from('pos_orders').select('id, table_id, covers, opened_at, server_name, guest_name, total, status').eq('status', 'open'),
    supabase.from('pos_config').select('key, value'),
    supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
  ])

  const userProfile = profileResult.data
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'
  const configMap = Object.fromEntries((configResult.data ?? []).map(c => [c.key, c.value]))

  return (
    <FloorPlanClient
      initialTables={tablesResult.data ?? []}
      openOrders={ordersResult.data ?? []}
      userId={user.id}
      userName={userProfile?.full_name ?? 'Staff'}
      isAdmin={isAdmin ?? false}
      config={configMap}
      staffList={(staffResult.data ?? []).map(s => s.full_name).filter(Boolean) as string[]}
    />
  )
}
