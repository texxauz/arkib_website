import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'
import { formatMonth, getCurrentMonth, getCurrentYear } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const month = getCurrentMonth()
  const year = getCurrentYear()

  const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const lastOfMonth = new Date(year, month, 0).toISOString().split('T')[0]

  // Fetch today's sales
  const { data: todaySales } = await supabase
    .from('daily_sales')
    .select('*')
    .eq('date', today)
    .single()

  // Fetch monthly sales
  const { data: monthlySalesRaw } = await supabase
    .from('daily_sales')
    .select('*')
    .gte('date', firstOfMonth)
    .lte('date', lastOfMonth)
    .order('date', { ascending: true })
  const monthlySales = (monthlySalesRaw ?? []) as any[]

  // Fetch monthly expenses
  const { data: monthlyExpensesRaw } = await supabase
    .from('expenses')
    .select('category, amount')
    .gte('date', firstOfMonth)
    .lte('date', lastOfMonth)
    .is('deleted_at', null)
  const monthlyExpenses = (monthlyExpensesRaw ?? []) as any[]

  // Fetch monthly target
  const { data: targetRaw } = await supabase
    .from('monthly_targets')
    .select('revenue_target')
    .eq('month', month)
    .eq('year', year)
    .single()
  const target = targetRaw as any

  // Fetch low stock ingredients
  const { data: lowStock } = await supabase
    .from('ingredients')
    .select('name, current_stock, min_stock_level')
    .filter('current_stock', 'lte', 'min_stock_level')
    .eq('is_active', true)
    .limit(5)

  // Compute daily chart data for last 30 days
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().split('T')[0]
  })

  const { data: last30SalesRaw } = await supabase
    .from('daily_sales')
    .select('date, total_revenue')
    .in('date', last30Days)
  const last30Sales = (last30SalesRaw ?? []) as any[]

  const chartData = last30Days.map(date => {
    const sale = last30Sales.find((s: any) => s.date === date)
    return {
      date: new Date(date).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' }),
      revenue: sale?.total_revenue ?? 0,
    }
  })

  const totalMonthlyRevenue = monthlySales.reduce((sum: number, s: any) => sum + s.total_revenue, 0)
  const totalMonthlyExpenses = monthlyExpenses.reduce((sum: number, e: any) => sum + e.amount, 0)
  const netProfit = totalMonthlyRevenue - totalMonthlyExpenses
  const targetRevenue = target?.revenue_target ?? 0

  const expenseByCategory = monthlyExpenses.reduce((acc: Record<string, number>, e: any) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {})

  return (
    <DashboardClient
      todaySales={todaySales as any}
      monthlyRevenue={totalMonthlyRevenue}
      monthlyExpenses={totalMonthlyExpenses}
      netProfit={netProfit}
      targetRevenue={targetRevenue}
      chartData={chartData}
      expenseByCategory={expenseByCategory}
      monthlySales={monthlySales}
      lowStock={(lowStock ?? []) as any}
      month={month}
      year={year}
    />
  )
}
