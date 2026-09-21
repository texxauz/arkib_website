export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { getCachedCocktails, getCachedMenuItems } from '@/lib/pos-menu-cache'
import { OrderTicketClient } from './OrderTicketClient'
import { redirect } from 'next/navigation'

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const [{ data: { user } }, { id }] = await Promise.all([
    supabase.auth.getUser(),
    params,
  ])
  if (!user) redirect('/login')

  const [profileResult, orderResult, itemsResult, cocktails, menuItemsRaw, configResult] = await Promise.all([
    supabase.from('users').select('role, full_name, pos_permissions').eq('id', user.id).single(),
    supabase.from('pos_orders').select('id, table_id, table_name, section, server_name, covers, status, subtotal, discount_amount, discount_label, service_charge, tax_amount, total, notes, opened_at, customer_name').eq('id', id).single(),
    supabase.from('pos_order_items').select('id, order_id, item_type, item_id, item_name, category, quantity, unit_price, unit_cost, discount, modifiers, notes, status, voided_at').eq('order_id', id).order('created_at'),
    getCachedCocktails(),
    getCachedMenuItems(),
    supabase.from('pos_config').select('key, value'),
  ])

  const userProfile = profileResult.data
  const order = orderResult.data
  const items = itemsResult.data

  if (!order) redirect('/pos')

  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'
  const posPerm = (userProfile?.pos_permissions ?? {}) as Record<string, boolean>
  const canCreateCustomItem = isAdmin || !!posPerm.create_custom_item
  const canCancelOrder = isAdmin || !!posPerm.cancel_order
  const configMap = Object.fromEntries((configResult.data ?? []).map(c => [c.key, c.value]))

  return (
    <OrderTicketClient
      order={order}
      initialItems={items ?? []}
      cocktails={cocktails}
      menuItems={menuItemsRaw}
      userId={user.id}
      userName={userProfile?.full_name ?? 'Staff'}
      isAdmin={isAdmin ?? false}
      canCreateCustomItem={canCreateCustomItem}
      canCancelOrder={canCancelOrder}
      config={configMap}
    />
  )
}
