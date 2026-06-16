'use client'
import { useMemo, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { formatCurrency, EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  salesData: {
    date: string
    total_revenue: number
    cocktails_revenue: number
    beer_revenue: number
    wine_revenue: number
    food_revenue: number
    others_revenue: number
  }[]
  cogsData: { date: string; total_cogs: number }[]
  expensesData: { date: string; expense_period: string | null; amount: number; category: string }[]
}

function monthKey(date: string) {
  return date.slice(0, 7) // YYYY-MM
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
}

export function PnlClient({ salesData, cogsData, expensesData }: Props) {
  const months = useMemo(() => {
    const map: Record<string, {
      revenue: number
      cocktails: number
      beer: number
      wine: number
      food: number
      others: number
      cogs: number
      expenses: number
      expenseByCategory: Record<string, number>
    }> = {}

    const ensure = (key: string) => {
      if (!map[key]) {
        map[key] = { revenue: 0, cocktails: 0, beer: 0, wine: 0, food: 0, others: 0, cogs: 0, expenses: 0, expenseByCategory: {} }
      }
      return map[key]
    }

    for (const s of salesData) {
      const e = ensure(monthKey(s.date))
      e.revenue += s.total_revenue
      e.cocktails += s.cocktails_revenue
      e.beer += s.beer_revenue
      e.wine += s.wine_revenue
      e.food += s.food_revenue
      e.others += s.others_revenue
    }
    for (const c of cogsData) {
      ensure(monthKey(c.date)).cogs += c.total_cogs
    }
    for (const ex of expensesData) {
      const e = ensure(monthKey(ex.expense_period ?? ex.date))
      e.expenses += ex.amount
      e.expenseByCategory[ex.category] = (e.expenseByCategory[ex.category] ?? 0) + ex.amount
    }

    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, v]) => {
        const grossProfit = v.revenue - v.cogs
        const netProfit = grossProfit - v.expenses
        const margin = v.revenue > 0 ? (netProfit / v.revenue) * 100 : 0
        return { key, ...v, grossProfit, netProfit, margin }
      })
  }, [salesData, cogsData, expensesData])

  const [selectedKey, setSelectedKey] = useState<string | null>(months[0]?.key ?? null)
  const selected = months.find(m => m.key === selectedKey) ?? months[0] ?? null

  return (
    <div className="space-y-6">
      <TopBar
        title="Profit & Loss"
        subtitle="Month-to-month investor view"
        actions={
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 text-xs">
            <Download size={12} /> Export
          </button>
        }
      />

      {months.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-[#5A5865] text-sm">No data yet</p>
        </div>
      ) : (
        <>
          {/* Month-over-month summary table */}
          <div className="card overflow-x-auto">
            <p className="section-title mb-4">Monthly Summary</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                  <th className="text-left py-2 pr-3">Month</th>
                  <th className="text-right py-2 px-3">Revenue</th>
                  <th className="text-right py-2 px-3">COGS</th>
                  <th className="text-right py-2 px-3">Gross Profit</th>
                  <th className="text-right py-2 px-3">Expenses</th>
                  <th className="text-right py-2 px-3">Net Profit</th>
                  <th className="text-right py-2 pl-3">Margin</th>
                </tr>
              </thead>
              <tbody>
                {months.map(m => (
                  <tr
                    key={m.key}
                    onClick={() => setSelectedKey(m.key)}
                    className={`border-b border-[#1A1A1E] cursor-pointer transition-colors ${m.key === selected?.key ? 'bg-[#8B5CF6]/10' : 'hover:bg-[#1A1A1E]'}`}
                  >
                    <td className="py-2.5 pr-3 text-[#F0EEF6] font-medium">{monthLabel(m.key)}</td>
                    <td className="py-2.5 px-3 text-right text-[#F0EEF6]">{formatCurrency(m.revenue)}</td>
                    <td className="py-2.5 px-3 text-right text-[#9896A4]">{formatCurrency(m.cogs)}</td>
                    <td className="py-2.5 px-3 text-right text-[#9896A4]">{formatCurrency(m.grossProfit)}</td>
                    <td className="py-2.5 px-3 text-right text-rose-400">{formatCurrency(m.expenses)}</td>
                    <td className={`py-2.5 px-3 text-right font-semibold ${m.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatCurrency(m.netProfit)}
                    </td>
                    <td className={`py-2.5 pl-3 text-right ${m.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {m.margin.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail breakdown for selected month */}
          {selected && (
            <div className="card">
              <div className="text-center mb-6 pb-4 border-b border-[#2A2A30]">
                <div className="text-[#8B5CF6] font-bold tracking-widest text-sm mb-1">ARKIB</div>
                <p className="text-[#F0EEF6] font-bold text-lg">{monthLabel(selected.key)} — P&L Detail</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                    <TrendingUp size={12} className="text-emerald-400" /> Revenue
                  </p>
                  <div className="space-y-2">
                    {[
                      ['Cocktails', selected.cocktails],
                      ['Beer', selected.beer],
                      ['Wine', selected.wine],
                      ['Food', selected.food],
                      ['Others', selected.others],
                    ].filter(([, v]) => (v as number) > 0).map(([label, amount]) => (
                      <div key={label as string} className="flex items-center justify-between py-1.5">
                        <span className="text-[#9896A4] text-sm">{label as string}</span>
                        <span className="text-[#F0EEF6] font-medium">{formatCurrency(amount as number)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-2 border-t border-[#2A2A30] mt-1">
                      <span className="text-[#F0EEF6] font-semibold">Total Revenue</span>
                      <span className="text-emerald-400 font-bold text-lg">{formatCurrency(selected.revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[#9896A4] text-sm">COGS</span>
                      <span className="text-[#F0EEF6] font-medium">{formatCurrency(selected.cogs)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-t border-[#2A2A30] mt-1">
                      <span className="text-[#F0EEF6] font-semibold">Gross Profit</span>
                      <span className="text-[#F0EEF6] font-bold text-lg">{formatCurrency(selected.grossProfit)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                    <TrendingDown size={12} className="text-rose-400" /> Operating Expenses
                  </p>
                  <div className="space-y-2">
                    {Object.entries(selected.expenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                      <div key={cat} className="flex items-center justify-between py-1.5">
                        <span className="text-[#9896A4] text-sm">{EXPENSE_CATEGORY_LABELS[cat] ?? cat}</span>
                        <span className="text-[#F0EEF6] font-medium">{formatCurrency(amt)}</span>
                      </div>
                    ))}
                    {Object.keys(selected.expenseByCategory).length === 0 && (
                      <p className="text-[#5A5865] text-sm">No expenses recorded</p>
                    )}
                    <div className="flex items-center justify-between py-2 border-t border-[#2A2A30] mt-1">
                      <span className="text-[#F0EEF6] font-semibold">Total Expenses</span>
                      <span className="text-rose-400 font-bold text-lg">{formatCurrency(selected.expenses)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`mt-6 rounded-xl p-5 text-center ${selected.netProfit >= 0 ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-rose-500/5 border border-rose-500/20'}`}>
                <p className="text-[#9896A4] text-sm mb-1">Net Profit</p>
                <p className={`font-bold text-3xl ${selected.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(selected.netProfit)}
                </p>
                <p className="text-[#9896A4] text-sm mt-1">Margin: {selected.margin.toFixed(1)}%</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
