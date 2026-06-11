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

  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
  const eightWeeksAgoStr = eightWeeksAgo.toISOString().split('T')[0]

  const [
    { data: todaySales },
    { data: monthlySalesRaw },
    { data: monthlyExpensesRaw },
    { data: targetRaw },
    { data: last30SalesRaw },
    { data: weeklySalesRaw },
    { data: weeklyExpensesRaw },
    { data: monthlyCOGSRaw },
  ] = await Promise.all([
    supabase.from('daily_sales').select('*').eq('date', today).single(),
    supabase.from('daily_sales').select('*').gte('date', firstOfMonth).lte('date', lastOfMonth).order('date', { ascending: true }),
    supabase.from('expenses').select('category, amount').gte('date', firstOfMonth).lte('date', lastOfMonth).is('deleted_at', null),
    supabase.from('monthly_targets').select('revenue_target').eq('month', month).eq('year', year).single(),
    supabase.from('daily_sales').select('date, total_revenue').in('date', last30Days),
    supabase.from('daily_sales').select('date, total_revenue').gte('date', eightWeeksAgoStr).order('date'),
    supabase.from('expenses').select('date, amount').gte('date', eightWeeksAgoStr).is('deleted_at', null),
    supabase.from('cocktail_sales').select('date, total_cogs, total_revenue').gte('date', firstOfMonth).lte('date', lastOfMonth),
  ])

  const monthlySales = (monthlySalesRaw ?? []) as any[]
  const monthlyExpenses = (monthlyExpensesRaw ?? []) as any[]
  const last30Sales = (last30SalesRaw ?? []) as any[]

  const chartData = last30Days.map(date => {
    const sale = last30Sales.find((s: any) => s.date === date)
    return {
      date: new Date(date + 'T00:00:00').toLocaleDateString('en-MY', { month: 'short', day: 'numeric' }),
      revenue: sale?.total_revenue ?? 0,
    }
  })

  const totalMonthlyRevenue = monthlySales.reduce((sum: number, s: any) => sum + s.total_revenue, 0)
  const totalMonthlyExpenses = monthlyExpenses.reduce((sum: number, e: any) => sum + e.amount, 0)
  const monthlyCOGS = (monthlyCOGSRaw ?? []).reduce((sum: number, r: any) => sum + (r.total_cogs ?? 0), 0)
  const netProfit = totalMonthlyRevenue - totalMonthlyExpenses

  const expenseByCategory = monthlyExpenses.reduce((acc: Record<string, number>, e: any) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {})

  // Group by ISO week for weekly P&L
  const getISOWeek = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    const day = d.getDay() || 7
    d.setDate(d.getDate() + 4 - day)
    const yearStart = new Date(d.getFullYear(), 0, 1)
    const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
  }
  const weekLabel = (weekKey: string) => {
    const [y, w] = weekKey.split('-W')
    const d = new Date(parseInt(y), 0, 1 + (parseInt(w) - 1) * 7)
    d.setDate(d.getDate() - d.getDay() + 1)
    return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
  }

  const weeklySalesMap: Record<string, number> = {}
  for (const s of (weeklySalesRaw ?? [])) {
    const wk = getISOWeek(s.date)
    weeklySalesMap[wk] = (weeklySalesMap[wk] ?? 0) + s.total_revenue
  }
  const weeklyExpensesMap: Record<string, number> = {}
  for (const e of (weeklyExpensesRaw ?? [])) {
    const wk = getISOWeek(e.date)
    weeklyExpensesMap[wk] = (weeklyExpensesMap[wk] ?? 0) + e.amount
  }

  const allWeeks = [...new Set([...Object.keys(weeklySalesMap), ...Object.keys(weeklyExpensesMap)])].sort().slice(-8)
  const weeklyPnL = allWeeks.map(wk => ({
    week: weekLabel(wk),
    revenue: weeklySalesMap[wk] ?? 0,
    expenses: weeklyExpensesMap[wk] ?? 0,
    profit: (weeklySalesMap[wk] ?? 0) - (weeklyExpensesMap[wk] ?? 0),
  }))

  return (
    <DashboardClient
      todaySales={todaySales as any}
      monthlyRevenue={totalMonthlyRevenue}
      monthlyExpenses={totalMonthlyExpenses}
      monthlyCOGS={monthlyCOGS}
      netProfit={netProfit}
      targetRevenue={targetRaw?.revenue_target ?? 0}
      chartData={chartData}
      expenseByCategory={expenseByCategory}
      monthlySales={monthlySales}
      weeklyPnL={weeklyPnL}
      lowStock={[]}
      month={month}
      year={year}
    />
  )
}
