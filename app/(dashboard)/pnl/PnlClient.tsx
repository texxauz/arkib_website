'use client'
import { useMemo, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { formatCurrency, EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import { Download, TrendingUp, TrendingDown, X, ArrowUp, ArrowDown, Minus } from 'lucide-react'

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

function pct(value: number, total: number) {
  if (total === 0) return 0
  return (value / total) * 100
}

function Trend({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous == null || previous === 0) return null
  const diff = ((current - previous) / Math.abs(previous)) * 100
  if (Math.abs(diff) < 0.5) return <Minus size={10} className="text-[#5A5865]" />
  if (diff > 0) return (
    <span className="flex items-center gap-0.5 text-emerald-400 text-[10px]">
      <ArrowUp size={9} />{diff.toFixed(1)}%
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-rose-400 text-[10px]">
      <ArrowDown size={9} />{Math.abs(diff).toFixed(1)}%
    </span>
  )
}

export function PnlClient({ salesData, cogsData, expensesData }: Props) {
  const allMonths = useMemo(() => {
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
      .sort((a, b) => a[0].localeCompare(b[0])) // ascending for range logic
      .map(([key, v]) => {
        const grossProfit = v.revenue - v.cogs
        const grossMargin = v.revenue > 0 ? (grossProfit / v.revenue) * 100 : 0
        const netProfit = grossProfit - v.expenses
        const margin = v.revenue > 0 ? (netProfit / v.revenue) * 100 : 0
        const expensePct = v.revenue > 0 ? (v.expenses / v.revenue) * 100 : 0
        return { key, ...v, grossProfit, grossMargin, netProfit, margin, expensePct }
      })
  }, [salesData, cogsData, expensesData])

  const earliestKey = allMonths[0]?.key ?? ''
  const latestKey = allMonths[allMonths.length - 1]?.key ?? ''

  const [fromKey, setFromKey] = useState<string>('')
  const [toKey, setToKey] = useState<string>('')

  const months = useMemo(() => {
    const from = fromKey || earliestKey
    const to = toKey || latestKey
    return [...allMonths]
      .filter(m => m.key >= from && m.key <= to)
      .reverse() // descending for display
  }, [allMonths, fromKey, toKey, earliestKey, latestKey])

  // Aggregated totals for the selected range
  const rangeTotals = useMemo(() => {
    const revenue = months.reduce((s, m) => s + m.revenue, 0)
    const cogs = months.reduce((s, m) => s + m.cogs, 0)
    const expenses = months.reduce((s, m) => s + m.expenses, 0)
    const grossProfit = revenue - cogs
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
    const netProfit = grossProfit - expenses
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0
    const expensePct = revenue > 0 ? (expenses / revenue) * 100 : 0
    const expenseByCategory: Record<string, number> = {}
    for (const m of months) {
      for (const [cat, amt] of Object.entries(m.expenseByCategory)) {
        expenseByCategory[cat] = (expenseByCategory[cat] ?? 0) + amt
      }
    }
    return { revenue, cogs, grossProfit, grossMargin, expenses, expensePct, netProfit, margin, expenseByCategory }
  }, [months])

  const isRangeFiltered = !!(fromKey || toKey)
  const rangeLabel = isRangeFiltered
    ? `${monthLabel(fromKey || earliestKey)} – ${monthLabel(toKey || latestKey)}`
    : null

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selected = months.find(m => m.key === selectedKey) ?? months[0] ?? null

  const monthOptions = [...allMonths].map(m => m.key)

  // For MoM trend: build a lookup by key from allMonths (ascending order)
  const monthByKey = useMemo(() => Object.fromEntries(allMonths.map(m => [m.key, m])), [allMonths])
  function prevMonth(key: string) {
    const [y, mo] = key.split('-').map(Number)
    const d = new Date(y, mo - 2) // mo-1 is current month index, mo-2 is previous
    const pk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return monthByKey[pk]
  }

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

      {/* Date range filter */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[#9896A4] text-xs uppercase tracking-wider">From</label>
            <select
              value={fromKey}
              onChange={e => { setFromKey(e.target.value); setSelectedKey(null) }}
              className="input text-sm min-w-[160px]"
            >
              <option value="">Earliest</option>
              {monthOptions.map(k => (
                <option key={k} value={k}>{monthLabel(k)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[#9896A4] text-xs uppercase tracking-wider">To</label>
            <select
              value={toKey}
              onChange={e => { setToKey(e.target.value); setSelectedKey(null) }}
              className="input text-sm min-w-[160px]"
            >
              <option value="">Latest</option>
              {monthOptions.map(k => (
                <option key={k} value={k}>{monthLabel(k)}</option>
              ))}
            </select>
          </div>
          {isRangeFiltered && (
            <button
              onClick={() => { setFromKey(''); setToKey(''); setSelectedKey(null) }}
              className="btn-secondary flex items-center gap-1.5 text-xs h-9"
            >
              <X size={12} /> Clear
            </button>
          )}
          {isRangeFiltered && months.length > 1 && (
            <div className="ml-auto text-right">
              <p className="text-[#9896A4] text-xs">{rangeLabel}</p>
              <p className="text-xs mt-0.5">
                <span className={rangeTotals.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  Net {formatCurrency(rangeTotals.netProfit)}
                </span>
                <span className="text-[#5A5865] mx-1">·</span>
                <span className="text-[#9896A4]">{months.length} months</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {months.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-[#5A5865] text-sm">No data for selected range</p>
        </div>
      ) : (
        <>
          {/* Range summary (only when multi-month range selected) */}
          {isRangeFiltered && months.length > 1 && (
            <div className="card">
              <p className="section-title mb-4">Range Summary — {rangeLabel}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Revenue', value: formatCurrency(rangeTotals.revenue), sub: null, color: 'text-emerald-400' },
                  { label: 'COGS', value: formatCurrency(rangeTotals.cogs), sub: null, color: 'text-[#9896A4]' },
                  { label: 'Gross Profit', value: formatCurrency(rangeTotals.grossProfit), sub: `${rangeTotals.grossMargin.toFixed(1)}% margin`, color: 'text-[#F0EEF6]' },
                  { label: 'Expenses', value: formatCurrency(rangeTotals.expenses), sub: `${rangeTotals.expensePct.toFixed(1)}% of rev`, color: 'text-rose-400' },
                  { label: 'Net Profit', value: formatCurrency(rangeTotals.netProfit), sub: null, color: rangeTotals.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400' },
                  { label: 'Net Margin', value: `${rangeTotals.margin.toFixed(1)}%`, sub: null, color: rangeTotals.margin >= 0 ? 'text-emerald-400' : 'text-rose-400' },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="bg-[#1A1A1E] rounded-lg p-3">
                    <p className="text-[#9896A4] text-xs mb-1">{label}</p>
                    <p className={`font-bold text-sm ${color}`}>{value}</p>
                    {sub && <p className="text-[#5A5865] text-[10px] mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Month-over-month summary table */}
          <div className="card">
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <p className="section-title mb-4">Monthly Summary</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                    <th className="text-left py-2 pr-3">Month</th>
                    <th className="text-right py-2 px-3">Revenue</th>
                    <th className="text-right py-2 px-3">Gross Profit</th>
                    <th className="text-right py-2 px-3">GM%</th>
                    <th className="text-right py-2 px-3">Expenses</th>
                    <th className="text-right py-2 px-3">Exp%</th>
                    <th className="text-right py-2 px-3">Net Profit</th>
                    <th className="text-right py-2 pl-3">NM%</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map(m => {
                    const prev = prevMonth(m.key)
                    return (
                      <tr
                        key={m.key}
                        onClick={() => setSelectedKey(m.key)}
                        className={`border-b border-[#1A1A1E] cursor-pointer transition-colors ${m.key === selected?.key ? 'bg-[#8B5CF6]/10' : 'hover:bg-[#1A1A1E]'}`}
                      >
                        <td className="py-2.5 pr-3 text-[#F0EEF6] font-medium whitespace-nowrap">{monthLabel(m.key)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="text-[#F0EEF6]">{formatCurrency(m.revenue)}</div>
                          <div className="flex justify-end mt-0.5"><Trend current={m.revenue} previous={prev?.revenue} /></div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="text-[#9896A4]">{formatCurrency(m.grossProfit)}</div>
                          <div className="flex justify-end mt-0.5"><Trend current={m.grossProfit} previous={prev?.grossProfit} /></div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#9896A4] text-xs">{m.grossMargin.toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-right text-rose-400">{formatCurrency(m.expenses)}</td>
                        <td className="py-2.5 px-3 text-right text-[#9896A4] text-xs">{m.expensePct.toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className={`font-semibold ${m.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(m.netProfit)}</div>
                          <div className="flex justify-end mt-0.5"><Trend current={m.netProfit} previous={prev?.netProfit} /></div>
                        </td>
                        <td className={`py-2.5 pl-3 text-right ${m.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {m.margin.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
                    <TrendingUp size={12} className="text-emerald-400" /> Revenue Breakdown
                  </p>
                  <div className="space-y-2">
                    {[
                      ['Cocktails', selected.cocktails],
                      ['Beer', selected.beer],
                      ['Wine', selected.wine],
                      ['Food', selected.food],
                      ['Others', selected.others],
                    ].filter(([, v]) => (v as number) > 0).map(([label, amount]) => {
                      const share = pct(amount as number, selected.revenue)
                      return (
                        <div key={label as string}>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-[#9896A4] text-sm">{label as string}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[#5A5865] text-xs">{share.toFixed(1)}%</span>
                              <span className="text-[#F0EEF6] font-medium w-24 text-right">{formatCurrency(amount as number)}</span>
                            </div>
                          </div>
                          {/* mini bar */}
                          <div className="h-0.5 bg-[#1A1A1E] rounded-full">
                            <div className="h-0.5 bg-[#8B5CF6]/50 rounded-full" style={{ width: `${share}%` }} />
                          </div>
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-between py-2 border-t border-[#2A2A30] mt-2">
                      <span className="text-[#F0EEF6] font-semibold">Total Revenue</span>
                      <span className="text-emerald-400 font-bold text-lg">{formatCurrency(selected.revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[#9896A4] text-sm">COGS</span>
                      <span className="text-[#F0EEF6] font-medium">{formatCurrency(selected.cogs)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-t border-[#2A2A30]">
                      <div>
                        <span className="text-[#F0EEF6] font-semibold">Gross Profit</span>
                        <span className="text-[#5A5865] text-xs ml-2">({selected.grossMargin.toFixed(1)}% margin)</span>
                      </div>
                      <span className="text-[#F0EEF6] font-bold text-lg">{formatCurrency(selected.grossProfit)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                    <TrendingDown size={12} className="text-rose-400" /> Operating Expenses
                    <span className="text-[#5A5865] text-[10px] normal-case ml-auto">{selected.expensePct.toFixed(1)}% of revenue</span>
                  </p>
                  <div className="space-y-2">
                    {Object.entries(selected.expenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                      const share = pct(amt, selected.expenses)
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-[#9896A4] text-sm">{EXPENSE_CATEGORY_LABELS[cat] ?? cat}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[#5A5865] text-xs">{share.toFixed(1)}%</span>
                              <span className="text-[#F0EEF6] font-medium w-24 text-right">{formatCurrency(amt)}</span>
                            </div>
                          </div>
                          <div className="h-0.5 bg-[#1A1A1E] rounded-full">
                            <div className="h-0.5 bg-rose-500/40 rounded-full" style={{ width: `${share}%` }} />
                          </div>
                        </div>
                      )
                    })}
                    {Object.keys(selected.expenseByCategory).length === 0 && (
                      <p className="text-[#5A5865] text-sm">No expenses recorded</p>
                    )}
                    <div className="flex items-center justify-between py-2 border-t border-[#2A2A30] mt-2">
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
                <div className="flex items-center justify-center gap-4 mt-2 text-sm text-[#9896A4]">
                  <span>Net margin: <span className={selected.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{selected.margin.toFixed(1)}%</span></span>
                  <span className="text-[#2A2A30]">|</span>
                  <span>Gross margin: <span className="text-[#F0EEF6]">{selected.grossMargin.toFixed(1)}%</span></span>
                  <span className="text-[#2A2A30]">|</span>
                  <span>Exp ratio: <span className="text-rose-400">{selected.expensePct.toFixed(1)}%</span></span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
