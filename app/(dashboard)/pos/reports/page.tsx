export const revalidate = 30

import { createClient } from '@/lib/supabase/server'
import { POSReportsClient } from './POSReportsClient'
import { redirect } from 'next/navigation'

export default async function POSReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'

  // Last 30 days
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  // All-time: 2 years back for cocktail trend/MoM analysis
  const allTimeFrom = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [{ data: orders }, { data: items }, { data: payments }, { data: voids }, { data: discountLogs }, { data: allMenuItems }, { data: allTimeItems }, { data: cocktails }] = await Promise.all([
    supabase.from('pos_orders')
      .select('id, table_name, covers, opened_at, closed_at, total, discount_amount, service_charge, status, server_name')
      .gte('opened_at', from + 'T00:00:00')
      .eq('status', 'closed')
      .order('opened_at', { ascending: false }),
    supabase.from('pos_order_items')
      .select('item_name, category, quantity, unit_price, voided_at, created_at, order_id, added_by')
      .gte('created_at', from + 'T00:00:00')
      .is('voided_at', null),
    supabase.from('pos_payments')
      .select('method, amount, captured_at')
      .gte('captured_at', from + 'T00:00:00'),
    supabase.from('pos_order_items')
      .select('item_name, quantity, unit_price, voided_at, void_reason, created_at, voided_by')
      .gte('created_at', from + 'T00:00:00')
      .not('voided_at', 'is', null),
    supabase.from('pos_audit_log')
      .select('payload, created_at, actor_name')
      .eq('event', 'discount.applied')
      .gte('created_at', from + 'T00:00:00'),
    supabase.from('menu_items')
      .select('id, name, category')
      .eq('is_active', true),
    // All-time items for cocktail analytics (qty + date, no price needed)
    supabase.from('pos_order_items')
      .select('item_name, category, quantity, unit_price, created_at')
      .gte('created_at', allTimeFrom + 'T00:00:00')
      .is('voided_at', null)
      .in('category', ['Cocktail', 'cocktail', 'House Cocktail', 'house_cocktail', 'Classic', 'classic', 'Classics']),
    // Cocktail cost data for profitability
    supabase.from('cocktails')
      .select('name, selling_price, total_cost')
      .eq('is_on_menu', true)
      .is('deleted_at', null),
  ])

  // Build server_name lookup from orders (order_id → server_name)
  const orderServerMap = Object.fromEntries((orders ?? []).map(o => [o.id, o.server_name]))

  // Attach server_name to voids via order_id lookup
  const voidsWithServer = (voids ?? []).map(v => ({
    ...v,
    server_name: orderServerMap[(v as any).order_id] ?? null,
  }))

  return (
    <POSReportsClient
      orders={orders ?? []}
      items={items ?? []}
      payments={payments ?? []}
      voids={voidsWithServer}
      discountLogs={discountLogs ?? []}
      allMenuItems={allMenuItems ?? []}
      allTimeItems={allTimeItems ?? []}
      cocktailCosts={cocktails ?? []}
      isAdmin={isAdmin ?? false}
    />
  )
}
