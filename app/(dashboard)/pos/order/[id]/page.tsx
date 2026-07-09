export const revalidate = 0

import { unstable_cache } from 'next/cache'
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

  // Menu items change rarely — cache for 60s to avoid redundant fetches on every order open
  const getCachedMenuItems = unstable_cache(
    async () => {
      const sb = await createClient()
      const { data } = await sb.from('menu_items').select('id, name, category, price, is_active, sort_order').eq('is_active', true).order('category').order('sort_order').order('name')
      return data ?? []
    },
    ['pos-menu-items'],
    { revalidate: 60 }
  )

  const [{ data: order }, { data: items }, { data: cocktails }, menuItems, { data: config }, { data: tables }] = await Promise.all([
    supabase.from('pos_orders').select('id, table_id, table_name, section, server_name, covers, status, subtotal, discount_amount, service_charge, tax_amount, total, notes, opened_at, customer_name').eq('id', id).single(),
    supabase.from('pos_order_items').select('id, order_id, item_type, item_id, item_name, category, quantity, unit_price, unit_cost, discount, modifiers, notes, status, voided_at').eq('order_id', id).order('created_at'),
    supabase.from('cocktails').select('id, name, selling_price, total_cost').eq('is_on_menu', true).is('deleted_at', null).order('name'),
    getCachedMenuItems(),
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
      menuItems={menuItems}
      allTables={tables ?? []}
      userId={user.id}
      userName={userProfile?.full_name ?? 'Staff'}
      isAdmin={isAdmin}
      config={configMap}
    />
  )
}
