export const revalidate = 30

import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  // Use Malaysia time (UTC+8) for today's date
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Fetch last 6 months of raw data so the client can filter by any period
  const sixMonthsAgo = new Date(Date.now() + 8 * 60 * 60 * 1000)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]

  const [
    { data: todaySales },
    { data: allSalesRaw },
    { data: allExpensesRaw },
    { data: allCOGSRaw },
    { data: allSpirits },
  ] = await Promise.all([
    supabase.from('daily_sales').select('date, total_revenue, total_collected, cocktails_revenue, beer_revenue, wine_revenue, food_revenue, others_revenue, cash_collected, credit_card_collected, qr_collected, transaction_count, is_balanced').eq('date', today).single(),
    supabase.from('daily_sales').select('date, total_revenue, total_collected, cocktails_revenue, beer_revenue, wine_revenue, food_revenue, others_revenue, transaction_count, discount_amount').gte('date', sixMonthsAgoStr).order('date', { ascending: true }),
    supabase.from('expenses').select('date, expense_period, category, amount').gte('date', sixMonthsAgoStr).is('deleted_at', null),
    supabase.from('cocktail_sales').select('date, total_cogs, total_revenue').gte('date', sixMonthsAgoStr),
    supabase.from('bar_spirits').select('name, full_bottles, min_bottles').not('min_bottles', 'is', null),
  ])

  return (
    <DashboardClient
      todaySales={todaySales as any}
      allSales={(allSalesRaw ?? []) as any[]}
      allExpenses={(allExpensesRaw ?? []) as any[]}
      allCOGS={(allCOGSRaw ?? []) as any[]}
      lowStock={(allSpirits ?? []).filter((s: any) => s.full_bottles < s.min_bottles).map((s: any) => ({ name: s.name, current_stock: s.full_bottles, min_stock_level: s.min_bottles }))}
    />
  )
}
