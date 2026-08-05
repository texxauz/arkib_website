export const revalidate = 30

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { POSReportsClient } from './POSReportsClient'
import { redirect } from 'next/navigation'

export default async function POSReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [{ data: orders }, { data: items }, { data: payments }, { data: voids }, { data: discountLogs }, { data: allMenuItems }, { data: cocktails }, { data: dailySales }, { data: cocktailSales }] = await Promise.all([
    // Fetch all-time orders — client filters by selected period
    supabase.from('pos_orders')
      .select('id, table_name, covers, opened_at, closed_at, subtotal, total, discount_amount, service_charge, status, server_name')
      .eq('status', 'closed')
      .order('opened_at', { ascending: false })
      .limit(5000),
    supabase.from('pos_order_items')
      .select('item_name, category, quantity, unit_price, discount, voided_at, created_at, order_id, added_by')
      .is('voided_at', null)
      .limit(20000),
    supabase.from('pos_payments')
      .select('method, amount, captured_at')
      .limit(20000),
    supabase.from('pos_order_items')
      .select('item_name, quantity, unit_price, voided_at, void_reason, created_at, voided_by, order_id')
      .not('voided_at', 'is', null)
      .limit(2000),
    supabase.from('pos_audit_log')
      .select('payload, created_at, actor_name')
      .eq('event', 'discount.applied')
      .limit(2000),
    supabase.from('menu_items')
      .select('id, name, category')
      .eq('is_active', true),
    // Cocktail cost data for profitability
    supabase.from('cocktails')
      .select('name, selling_price, total_cost')
      .eq('is_on_menu', true)
      .is('deleted_at', null),
    // Full sales history from daily_sales (goes back to June and beyond)
    supabase.from('daily_sales')
      .select('date, total_revenue, cocktails_revenue, beer_revenue, wine_revenue, food_revenue, others_revenue')
      .is('deleted_at', null)
      .order('date', { ascending: true }),
    // Per-cocktail quantities from EON submissions — use admin client to bypass RLS
    admin.from('cocktail_sales')
      .select('date, cocktail_name, quantity, unit_price, category')
      .order('date', { ascending: true }),
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
      cocktailCosts={cocktails ?? []}
      dailySales={dailySales ?? []}
      cocktailSales={cocktailSales ?? []}
      isAdmin={isAdmin ?? false}
    />
  )
}
