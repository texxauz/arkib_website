'use client'
import { TopBar } from '@/components/layout/TopBar'
import { formatCurrency, formatMonth, EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import { BarChart2, TrendingUp, TrendingDown, Lightbulb, Download } from 'lucide-react'
import type { Database } from '@/types/database'

type DailySale = Database['public']['Tables']['daily_sales']['Row']
type Expense = Database['public']['Tables']['expenses']['Row']
type Cocktail = Database['public']['Tables']['cocktails']['Row']
type Employee = Database['public']['Tables']['employees']['Row']

interface Props {
  monthlySales: DailySale[]
  monthlyExpenses: Expense[]
  cocktails: Cocktail[]
  employees: Employee[]
  month: number
  year: number
}

function generateInsights(sales: DailySale[], expenses: Expense[], cocktails: Cocktail[]) {
  const insights: { type: 'good' | 'bad' | 'info'; text: string }[] = []

  if (sales.length > 0) {
    const byDay: Record<string, number[]> = {}
    sales.forEach(s => {
      const day = new Date(s.date).toLocaleDateString('en-MY', { weekday: 'long' })
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(s.total_revenue)
    })
    const avgByDay = Object.entries(byDay).map(([d, revs]) => ({ day: d, avg: revs.reduce((a, b) => a + b, 0) / revs.length }))
    const best = avgByDay.sort((a, b) => b.avg - a.avg)[0]
    const worst = avgByDay[avgByDay.length - 1]
    if (best && worst && best.day !== worst.day) {
      const diff = ((best.avg - worst.avg) / worst.avg * 100).toFixed(0)
      insights.push({ type: 'info', text: `${best.day} generates ${diff}% higher revenue than ${worst.day}` })
    }

    const weekdays = sales.filter(s => [1,2,3,4].includes(new Date(s.date).getDay()))
    const weekends = sales.filter(s => [0,5,6].includes(new Date(s.date).getDay()))
    if (weekdays.length > 0 && weekends.length > 0) {
      const avgWeekday = weekdays.reduce((s, r) => s + r.total_revenue, 0) / weekdays.length
      const avgWeekend = weekends.reduce((s, r) => s + r.total_revenue, 0) / weekends.length
      if (avgWeekend > avgWeekday) {
        insights.push({ type: 'good', text: `Weekend sales average ${formatCurrency(avgWeekend)} vs ${formatCurrency(avgWeekday)} on weekdays` })
      }
    }
  }

  if (expenses.length > 0) {
    const byCategory = expenses.reduce((acc: Record<string, number>, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc
    }, {})
    const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
    if (top) insights.push({ type: 'info', text: `Your biggest expense this month is ${EXPENSE_CATEGORY_LABELS[top[0]] ?? top[0]}: ${formatCurrency(top[1])}` })
  }

  if (cocktails.length > 0) {
    const best = cocktails[0]
    const worst = cocktails[cocktails.length - 1]
    if (best?.profit_margin) insights.push({ type: 'good', text: `Your highest margin cocktail is ${best.name} at ${best.profit_margin.toFixed(0)}%` })
    if (worst?.profit_margin && worst.profit_margin < 50) insights.push({ type: 'bad', text: `Your lowest margin cocktail is ${worst.name} at ${worst.profit_margin.toFixed(0)}% — consider repricing` })
  }

  return insights
}

export function ReportsClient({ monthlySales, monthlyExpenses, cocktails, employees, month, year }: Props) {
  const totalRevenue = monthlySales.reduce((s, r) => s + r.total_revenue, 0)
  const cocktailRevenue = monthlySales.reduce((s, r) => s + r.cocktails_revenue, 0)
  const beerRevenue = monthlySales.reduce((s, r) => s + r.beer_revenue, 0)
  const wineRevenue = monthlySales.reduce((s, r) => s + r.wine_revenue, 0)
  const foodRevenue = monthlySales.reduce((s, r) => s + r.food_revenue, 0)
  const othersRevenue = monthlySales.reduce((s, r) => s + r.others_revenue, 0)

  const totalExpenses = monthlyExpenses.reduce((s, e) => s + e.amount, 0)
  const netProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  const expenseByCategory = monthlyExpenses.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc
  }, {})

  const insights = generateInsights(monthlySales, monthlyExpenses, cocktails)

  return (
    <div className="space-y-6">
      <TopBar
        title="Reports"
        subtitle={formatMonth(month, year)}
        actions={
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 text-xs">
            <Download size={12} /> Export
          </button>
        }
      />

      {/* Monthly P&L Report */}
      <div className="card">
        <div className="text-center mb-6 pb-4 border-b border-[#2A2A30]">
          <div className="text-[#8B5CF6] font-bold tracking-widest text-sm mb-1">ARKIB</div>
          <p className="text-[#F0EEF6] font-bold text-lg">{formatMonth(month, year)} — Monthly Report</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue */}
          <div>
            <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp size={12} className="text-emerald-400" /> Revenue
            </p>
            <div className="space-y-2">
              {[
                ['Cocktails', cocktailRevenue],
                ['Beer', beerRevenue],
                ['Wine', wineRevenue],
                ['Food', foodRevenue],
                ['Others', othersRevenue],
              ].filter(([, v]) => (v as number) > 0).map(([label, amount]) => (
                <div key={label as string} className="flex items-center justify-between py-1.5">
                  <span className="text-[#9896A4] text-sm">{label as string}</span>
                  <span className="text-[#F0EEF6] font-medium">{formatCurrency(amount as number)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 border-t border-[#2A2A30] mt-1">
                <span className="text-[#F0EEF6] font-semibold">Total Revenue</span>
                <span className="text-emerald-400 font-bold text-lg">{formatCurrency(totalRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Expenses */}
          <div>
            <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingDown size={12} className="text-rose-400" /> Expenses
            </p>
            <div className="space-y-2">
              {Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                <div key={cat} className="flex items-center justify-between py-1.5">
                  <span className="text-[#9896A4] text-sm">{EXPENSE_CATEGORY_LABELS[cat] ?? cat}</span>
                  <span className="text-[#F0EEF6] font-medium">{formatCurrency(amt)}</span>
                </div>
              ))}
              {Object.keys(expenseByCategory).length === 0 && (
                <p className="text-[#5A5865] text-sm">No expenses recorded</p>
              )}
              <div className="flex items-center justify-between py-2 border-t border-[#2A2A30] mt-1">
                <span className="text-[#F0EEF6] font-semibold">Total Expenses</span>
                <span className="text-rose-400 font-bold text-lg">{formatCurrency(totalExpenses)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className={`mt-6 rounded-xl p-5 text-center ${netProfit >= 0 ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-rose-500/5 border border-rose-500/20'}`}>
          <p className="text-[#9896A4] text-sm mb-1">Net Profit</p>
          <p className={`font-bold text-3xl ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(netProfit)}
          </p>
          <p className="text-[#9896A4] text-sm mt-1">Profit Margin: {profitMargin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Analytics Insights */}
      <div className="card">
        <p className="section-title mb-4 flex items-center gap-2">
          <Lightbulb size={16} className="text-[#D4AF37]" /> Analytics Insights
        </p>
        {insights.length > 0 ? (
          <div className="space-y-3">
            {insights.map((insight, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                insight.type === 'good' ? 'bg-emerald-500/5 border-emerald-500/20' :
                insight.type === 'bad' ? 'bg-rose-500/5 border-rose-500/20' :
                'bg-[#1A1A1E] border-[#2A2A30]'
              }`}>
                <span className="text-base mt-0.5">
                  {insight.type === 'good' ? '📈' : insight.type === 'bad' ? '⚠️' : '💡'}
                </span>
                <p className="text-[#F0EEF6] text-sm">{insight.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[#5A5865] text-sm">Add more data to generate insights</p>
        )}
      </div>

      {/* Top cocktails by margin */}
      {cocktails.length > 0 && (
        <div className="card">
          <p className="section-title mb-4">Cocktail Performance</p>
          <div className="space-y-2">
            {cocktails.slice(0, 8).map(c => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#F0EEF6] text-sm">{c.name}</span>
                    <span className={`text-xs font-medium ${(c.profit_margin ?? 0) >= 70 ? 'text-emerald-400' : (c.profit_margin ?? 0) >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {(c.profit_margin ?? 0).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-[#1A1A1E] rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${(c.profit_margin ?? 0) >= 70 ? 'bg-emerald-400' : (c.profit_margin ?? 0) >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                      style={{ width: `${Math.min(c.profit_margin ?? 0, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right w-20">
                  <p className="text-[#5A5865] text-[10px]">Cost</p>
                  <p className="text-[#9896A4] text-xs">{formatCurrency(c.total_cost ?? 0)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
