import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'
import { getCurrentMonth, getCurrentYear } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const month = getCurrentMonth()
  const year = getCurrentYear()

  const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const lastOfMonth = new Date(year, month, 0).toISOString().split('T')[0]

  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().split('T')[0]
  })

  // All queries fire in parallel
  const [
    { data: todaySales },
    { data: monthlySalesRaw },
    { data: monthlyExpensesRaw },
    { data: targetRaw },
    { data: last30SalesRaw },
  ] = await Promise.all([
    supabase.from('daily_sales').select('*').eq('date', today).single(),
    supabase.from('daily_sales').select('*').gte('date', firstOfMonth).lte('date', lastOfMonth).order('date', { ascending: true }),
    supabase.from('expenses').select('category, amount').gte('date', firstOfMonth).lte('date', lastOfMonth).is('deleted_at', null),
    supabase.from('monthly_targets').select('revenue_target').eq('month', month).eq('year', year).single(),
    supabase.from('daily_sales').select('date, total_revenue').in('date', last30Days),
  ])

  const monthlySales = (monthlySalesRaw ?? []) as any[]
  const monthlyExpenses = (monthlyExpensesRaw ?? []) as any[]
  const last30Sales = (last30SalesRaw ?? []) as any[]
  const target = targetRaw as any

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
      targetRevenue={target?.revenue_target ?? 0}
      chartData={chartData}
      expenseByCategory={expenseByCategory}
      monthlySales={monthlySales}
      lowStock={[]}
      month={month}
      year={year}
    />
  )
}
