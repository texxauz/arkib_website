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
    .from('users').select('role, full_name, pos_permissions').eq('id', user.id).single()
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'
  const posPerm = (userProfile?.pos_permissions ?? {}) as Record<string, boolean>
  const canCreateCustomItem = isAdmin || !!posPerm.create_custom_item
  const canCancelOrder = isAdmin || !!posPerm.cancel_order

  const [{ data: order }, { data: items }, { data: cocktails }, { data: menuItemsRaw }, { data: config }, { data: tables }] = await Promise.all([
    supabase.from('pos_orders').select('id, table_id, table_name, section, server_name, covers, status, subtotal, discount_amount, service_charge, tax_amount, total, notes, opened_at, customer_name').eq('id', id).single(),
    supabase.from('pos_order_items').select('id, order_id, item_type, item_id, item_name, category, quantity, unit_price, unit_cost, discount, modifiers, notes, status, voided_at').eq('order_id', id).order('created_at'),
    supabase.from('cocktails').select('id, name, selling_price, total_cost').eq('is_on_menu', true).is('deleted_at', null).order('name'),
    supabase.from('menu_items').select('id, name, category, price, cost_price, is_active, sort_order, stock_qty').eq('is_active', true).order('category').order('sort_order').order('name'),
    supabase.from('pos_config').select('key, value'),
    supabase.from('pos_tables').select('id, name, section, capacity, current_order_id').eq('is_active', true).order('section').order('name'),
  ])

  if (!order) redirect('/pos')

  const configMap = Object.fromEntries((config ?? []).map(c => [c.key, c.value]))

  return (
    <OrderTicketClient
      order={order}
      initialItems={items ?? []}
      cocktails={cocktails ?? []}
      menuItems={menuItemsRaw ?? []}
      allTables={tables ?? []}
      userId={user.id}
      userName={userProfile?.full_name ?? 'Staff'}
      isAdmin={isAdmin}
      canCreateCustomItem={canCreateCustomItem}
      canCancelOrder={canCancelOrder}
      config={configMap}
    />
  )
}
