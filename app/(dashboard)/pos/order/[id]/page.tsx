export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { OrderTicketClient } from './OrderTicketClient'
import { redirect } from 'next/navigation'

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const { data: userProfile } = await supabase
    .from('users').select('role, full_name').eq('id', user.id).single()
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'

  const [{ data: order }, { data: items }, { data: cocktails }, { data: menuItems }, { data: config }, { data: tables }] = await Promise.all([
    supabase.from('pos_orders').select('*').eq('id', id).single(),
    supabase.from('pos_order_items').select('*').eq('order_id', id).order('created_at'),
    supabase.from('cocktails').select('id, name, selling_price, total_cost').eq('is_on_menu', true).is('deleted_at', null).order('name'),
    supabase.from('menu_items').select('*').eq('is_active', true).order('category').order('sort_order').order('name'),
    supabase.from('pos_config').select('key, value'),
    supabase.from('pos_tables').select('id, name, section, capacity, current_order_id').eq('is_active', true).order('section').order('sort_order'),
  ])

  if (!order) redirect('/pos')

  const configMap = Object.fromEntries((config ?? []).map(c => [c.key, c.value]))

  return (
    <OrderTicketClient
      order={order}
      initialItems={items ?? []}
      cocktails={cocktails ?? []}
      menuItems={menuItems ?? []}
      allTables={tables ?? []}
      userId={user.id}
      userName={userProfile?.full_name ?? 'Staff'}
      isAdmin={isAdmin}
      config={configMap}
    />
  )
}
