export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { DataManagerClient } from './DataManagerClient'
import { redirect } from 'next/navigation'

export default async function DataManagerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner' && profile?.role !== 'manager') redirect('/pos')

  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [{ data: orders }, { data: tables }, { data: menuItems }, { data: dailySales }, { data: salesBackups }] = await Promise.all([
    supabase.from('pos_orders')
      .select('id, table_name, section, server_name, covers, status, total, opened_at, closed_at')
      .gte('opened_at', from + 'T00:00:00')
      .order('opened_at', { ascending: false }),
    supabase.from('pos_tables')
      .select('id, name, section, capacity, sort_order, is_active, current_order_id')
      .order('section').order('sort_order'),
    supabase.from('menu_items')
      .select('id, name, category, price, cost_price, is_active, sort_order, stock_qty')
      .order('category').order('sort_order').order('name'),
    supabase.from('daily_sales')
      .select('date, cocktails_revenue, beer_revenue, wine_revenue, food_revenue, others_revenue, cash_collected, credit_card_collected, qr_collected, transaction_count, total_revenue, total_collected')
      .gte('date', from)
      .order('date', { ascending: false }),
    supabase.from('daily_sales_backup')
      .select('id, original_date, deleted_at, deleted_by_name, data')
      .order('deleted_at', { ascending: false })
      .limit(50),
  ])

  return (
    <DataManagerClient
      orders={orders ?? []}
      tables={tables ?? []}
      menuItems={menuItems ?? []}
      dailySales={dailySales ?? []}
      salesBackups={salesBackups ?? []}
    />
  )
}
