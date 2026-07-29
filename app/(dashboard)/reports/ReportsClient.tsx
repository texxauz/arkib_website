'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { formatCurrency, formatMonth, EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, Lightbulb, Download,
  ChevronLeft, ChevronRight, CreditCard, Banknote, QrCode, Globe,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts'
import type { Database } from '@/types/database'

type DailySale = Database['public']['Tables']['daily_sales']['Row']
type Expense = Database['public']['Tables']['expenses']['Row']
type Cocktail = Database['public']['Tables']['cocktails']['Row']

interface Props {
  initialSales: DailySale[]
  initialExpenses: Expense[]
  initialCocktails: Cocktail[]
  initialMonth: number
  initialYear: number
}

const REVENUE_COLORS: Record<string, string> = {
  Cocktails: '#8B5CF6',
  Beer: '#F59E0B',
  Wine: '#EC4899',
  Food: '#10B981',
  Others: '#6B7280',
}

const PAYMENT_COLORS: Record<string, string> = {
  Cash: '#10B981',
  Card: '#8B5CF6',
  QR: '#F59E0B',
  Online: '#3B82F6',
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
    const avgByDay = Object.entries(byDay).map(([d, revs]) => ({
      day: d,
      avg: revs.reduce((a, b) => a + b, 0) / revs.length,
    }))
    avgByDay.sort((a, b) => b.avg - a.avg)
    const best = avgByDay[0]
    const worst = avgByDay[avgByDay.length - 1]
    if (best && worst && best.day !== worst.day) {
      const diff = ((best.avg - worst.avg) / worst.avg * 100).toFixed(0)
      insights.push({ type: 'info', text: `${best.day} generates ${diff}% higher revenue than ${worst.day}` })
    }

    const weekdays = sales.filter(s => [1, 2, 3, 4].includes(new Date(s.date).getDay()))
    const weekends = sales.filter(s => [0, 5, 6].includes(new Date(s.date).getDay()))
    if (weekdays.length > 0 && weekends.length > 0) {
      const avgWeekday = weekdays.reduce((s, r) => s + r.total_revenue, 0) / weekdays.length
      const avgWeekend = weekends.reduce((s, r) => s + r.total_revenue, 0) / weekends.length
      if (avgWeekend > avgWeekday) {
        insights.push({ type: 'good', text: `Weekend sales average ${formatCurrency(avgWeekend)} vs ${formatCurrency(avgWeekday)} on weekdays` })
      }
    }

    const totalTx = sales.reduce((s, r) => s + (r.transaction_count ?? 0), 0)
    const totalRev = sales.reduce((s, r) => s + r.total_revenue, 0)
    if (totalTx > 0) {
      insights.push({ type: 'info', text: `Average order value this month: ${formatCurrency(totalRev / totalTx)} across ${totalTx} transactions` })
    }
  }

  if (expenses.length > 0) {
    const byCategory = expenses.reduce((acc: Record<string, number>, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
      return acc
    }, {})
    const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
    if (top) insights.push({ type: 'info', text: `Biggest expense: ${EXPENSE_CATEGORY_LABELS[top[0]] ?? top[0]} at ${formatCurrency(top[1])}` })
  }

  if (cocktails.length > 0) {
    const best = cocktails[0]
    const worst = cocktails[cocktails.length - 1]
    if (best?.profit_margin) insights.push({ type: 'good', text: `Highest margin cocktail: ${best.name} at ${best.profit_margin.toFixed(0)}%` })
    if (worst?.profit_margin && worst.profit_margin < 50) insights.push({ type: 'bad', text: `Lowest margin: ${worst.name} at ${worst.profit_margin.toFixed(0)}% — consider repricing` })
  }

  return insights
}

// Custom tooltip for bar chart
function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-xs">
      <p className="text-[#9896A4] mb-1">{label}</p>
      <p className="text-[#F0EEF6] font-semibold">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

function PaymentTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-xs">
      <p className="text-[#9896A4] mb-1">{payload[0].name}</p>
      <p className="text-[#F0EEF6] font-semibold">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function ReportsClient({ initialSales, initialExpenses, initialCocktails, initialMonth, initialYear }: Props) {
  const [month, setMonth] = useState(initialMonth)
  const [year, setYear] = useState(initialYear)
  const [sales, setSales] = useState<DailySale[]>(initialSales)
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [cocktails, setCocktails] = useState<Cocktail[]>(initialCocktails)
  const [loading, setLoading] = useState(false)

  const fetchMonth = useCallback(async (m: number, y: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/monthly?month=${m}&year=${y}`)
      if (res.ok) {
        const data = await res.json()
        setSales(data.sales)
        setExpenses(data.expenses)
        setCocktails(data.cocktails)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMonth(month, year)
  }, [month, year, fetchMonth])

  const navigateMonth = (dir: -1 | 1) => {
    let m = month + dir
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m)
    setYear(y)
  }

  // ─── Aggregates ───────────────────────────────────────────────────────────
  const totalRevenue = sales.reduce((s, r) => s + r.total_revenue, 0)
  const cocktailRevenue = sales.reduce((s, r) => s + r.cocktails_revenue, 0)
  const beerRevenue = sales.reduce((s, r) => s + r.beer_revenue, 0)
  const wineRevenue = sales.reduce((s, r) => s + r.wine_revenue, 0)
  const foodRevenue = sales.reduce((s, r) => s + r.food_revenue, 0)
  const othersRevenue = sales.reduce((s, r) => s + r.others_revenue, 0)

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const netProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  const expenseByCategory = expenses.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {})

  const totalTransactions = sales.reduce((s, r) => s + (r.transaction_count ?? 0), 0)
  const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

  // ─── Chart data ───────────────────────────────────────────────────────────
  const dailyChartData = sales.map(s => ({
    date: new Date(s.date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }),
    revenue: s.total_revenue,
    isWeekend: [0, 5, 6].includes(new Date(s.date).getDay()),
  }))

  const revenueMixData = [
    { name: 'Cocktails', value: cocktailRevenue },
    { name: 'Beer', value: beerRevenue },
    { name: 'Wine', value: wineRevenue },
    { name: 'Food', value: foodRevenue },
    { name: 'Others', value: othersRevenue },
  ].filter(d => d.value > 0)

  const cashCollected = sales.reduce((s, r) => s + r.cash_collected, 0)
  const cardCollected = sales.reduce((s, r) => s + r.credit_card_collected, 0)
  const qrCollected = sales.reduce((s, r) => s + r.qr_collected, 0)
  const onlineCollected = sales.reduce((s, r) => s + r.online_collected, 0)

  const paymentMixData = [
    { name: 'Cash', value: cashCollected, icon: Banknote, color: PAYMENT_COLORS.Cash },
    { name: 'Card', value: cardCollected, icon: CreditCard, color: PAYMENT_COLORS.Card },
    { name: 'QR', value: qrCollected, icon: QrCode, color: PAYMENT_COLORS.QR },
    { name: 'Online', value: onlineCollected, icon: Globe, color: PAYMENT_COLORS.Online },
  ].filter(d => d.value > 0)

  const totalCollected = paymentMixData.reduce((s, p) => s + p.value, 0)

  const insights = generateInsights(sales, expenses, cocktails)

  const isCurrentMonth = (() => {
    const nowMYT = new Date(Date.now() + 8 * 60 * 60 * 1000)
    return month === nowMYT.getUTCMonth() + 1 && year === nowMYT.getUTCFullYear()
  })()

  return (
    <div className={`space-y-6 transition-opacity duration-150 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
      <TopBar
        title="Reports"
        subtitle={formatMonth(month, year)}
        actions={
          <div className="flex items-center gap-2">
            {/* Month navigator */}
            <div className="flex items-center gap-1 bg-[#141417] border border-[#2A2A30] rounded-lg px-1 py-1">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-1 rounded hover:bg-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[#F0EEF6] text-xs font-medium px-2 min-w-[90px] text-center">
                {formatMonth(month, year)}
              </span>
              <button
                onClick={() => navigateMonth(1)}
                disabled={isCurrentMonth}
                className="p-1 rounded hover:bg-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 text-xs">
              <Download size={12} /> Export
            </button>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Revenue', value: formatCurrency(totalRevenue), color: 'text-emerald-400' },
          { label: 'Total Expenses', value: formatCurrency(totalExpenses), color: 'text-rose-400' },
          { label: 'Net Profit', value: formatCurrency(netProfit), color: netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400' },
          { label: 'Avg Order Value', value: totalTransactions > 0 ? formatCurrency(avgOrderValue) : '—', color: 'text-[#8B5CF6]' },
        ].map(k => (
          <div key={k.label} className="card py-3 px-4">
            <p className="text-[#9896A4] text-xs mb-1">{k.label}</p>
            <p className={`font-bold text-lg ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Daily revenue trend */}
      <div className="card">
        <p className="section-title mb-1 flex items-center gap-2">
          <TrendingUp size={14} className="text-emerald-400" /> Daily Revenue
        </p>
        <p className="text-[#5A5865] text-xs mb-4">Weekends highlighted</p>
        {dailyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyChartData} barCategoryGap="30%">
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#5A5865' }}
                axisLine={false}
                tickLine={false}
                interval={dailyChartData.length > 20 ? 2 : 0}
              />
              <YAxis
                tickFormatter={v => `RM${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 10, fill: '#5A5865' }}
                axisLine={false}
                tickLine={false}
                width={45}
              />
              <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                {dailyChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.isWeekend ? '#8B5CF6' : '#3B3B45'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[#5A5865] text-sm text-center py-10">No sales data for this month</p>
        )}
        <div className="flex items-center gap-4 mt-2 justify-end">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-[#8B5CF6]" /><span className="text-[#5A5865] text-xs">Weekend</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-[#3B3B45]" /><span className="text-[#5A5865] text-xs">Weekday</span></div>
        </div>
      </div>

      {/* Revenue mix + Payment mix side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue breakdown donut */}
        <div className="card">
          <p className="section-title mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-400" /> Revenue Mix
          </p>
          {revenueMixData.length > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={revenueMixData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {revenueMixData.map((entry) => (
                      <Cell key={entry.name} fill={REVENUE_COLORS[entry.name] ?? '#6B7280'} />
                    ))}
                  </Pie>
                  <Tooltip content={<PaymentTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-full space-y-2">
                {revenueMixData.map(entry => {
                  const pct = totalRevenue > 0 ? (entry.value / totalRevenue * 100).toFixed(1) : '0'
                  return (
                    <div key={entry.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: REVENUE_COLORS[entry.name] ?? '#6B7280' }} />
                        <span className="text-[#9896A4] text-xs">{entry.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#5A5865] text-xs">{pct}%</span>
                        <span className="text-[#F0EEF6] text-xs font-medium w-24 text-right">{formatCurrency(entry.value)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-[#5A5865] text-sm text-center py-10">No revenue data</p>
          )}
        </div>

        {/* Payment method split */}
        <div className="card">
          <p className="section-title mb-4 flex items-center gap-2">
            <CreditCard size={14} className="text-[#8B5CF6]" /> Payment Mix
          </p>
          {paymentMixData.length > 0 ? (
            <div className="space-y-4">
              {paymentMixData.map(p => {
                const Icon = p.icon
                const pct = totalCollected > 0 ? p.value / totalCollected * 100 : 0
                return (
                  <div key={p.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon size={13} style={{ color: p.color }} />
                        <span className="text-[#9896A4] text-xs">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#5A5865] text-xs">{pct.toFixed(1)}%</span>
                        <span className="text-[#F0EEF6] text-xs font-medium w-24 text-right">{formatCurrency(p.value)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-[#1A1A1E] rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: p.color }}
                      />
                    </div>
                  </div>
                )
              })}
              <div className="pt-2 border-t border-[#2A2A30] flex items-center justify-between">
                <span className="text-[#9896A4] text-xs">Total Collected</span>
                <span className="text-[#F0EEF6] text-sm font-semibold">{formatCurrency(totalCollected)}</span>
              </div>
              {Math.abs(totalCollected - totalRevenue) > 0.5 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9896A4]">Variance vs Revenue</span>
                  <span className={totalCollected >= totalRevenue ? 'text-emerald-400' : 'text-rose-400'}>
                    {totalCollected >= totalRevenue ? '+' : ''}{formatCurrency(totalCollected - totalRevenue)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[#5A5865] text-sm text-center py-10">No payment data</p>
          )}
        </div>
      </div>

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
          {totalTransactions > 0 && (
            <p className="text-[#5A5865] text-xs mt-1">{totalTransactions} transactions · avg {formatCurrency(avgOrderValue)}</p>
          )}
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

      {/* ── Weekly revenue trend ─────────────────────────────────────────── */}
      {sales.length > 0 && (() => {
        const weekMap: Record<number, number> = {}
        for (const s of sales) {
          const d = new Date(s.date)
          const weekNum = Math.ceil(d.getDate() / 7)
          weekMap[weekNum] = (weekMap[weekNum] ?? 0) + s.total_revenue
        }
        const weekData = Object.entries(weekMap)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([w, revenue]) => ({ week: `Week ${w}`, revenue }))
        if (weekData.length < 2) return null
        return (
          <div className="card">
            <p className="section-title mb-1">Weekly Revenue Trend</p>
            <p className="text-[#5A5865] text-xs mb-4">Revenue broken down by week this month</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weekData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="week" tick={{ fill: '#9896A4', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9896A4', fontSize: 11 }} axisLine={false} tickLine={false} width={56}
                  tickFormatter={v => `RM ${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v) => [`RM ${Number(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']}
                  contentStyle={{ background: '#1A1A1E', border: '1px solid #2A2A30', borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: '#F0EEF6' }}
                />
                <Bar dataKey="revenue" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      })()}

      {/* ── Break-even tracker ───────────────────────────────────────────── */}
      {(() => {
        if (sales.length === 0 || totalExpenses === 0) return null
        const daysInMonth = new Date(year, month, 0).getDate()
        const dailyFixedCost = totalExpenses / daysInMonth
        let breakEvenDay: number | null = null
        let cumulative = 0
        const cumulativeData: { day: string; revenue: number; costs: number }[] = []
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const daySale = sales.find(s => s.date === dateStr)
          cumulative += daySale?.total_revenue ?? 0
          const cumulativeCost = dailyFixedCost * day
          if (breakEvenDay === null && cumulative >= cumulativeCost) breakEvenDay = day
          if (daySale || day <= new Date().getDate()) {
            cumulativeData.push({ day: String(day), revenue: cumulative, costs: Math.round(cumulativeCost) })
          }
        }
        const isBroken = breakEvenDay !== null
        const shortfall = totalExpenses - totalRevenue
        return (
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="section-title mb-0.5">Break-Even Tracker</p>
                <p className="text-[#5A5865] text-xs">Cumulative revenue vs prorated expenses</p>
              </div>
              <div className="text-right">
                {isBroken ? (
                  <>
                    <p className="text-emerald-400 font-bold text-lg">Day {breakEvenDay}</p>
                    <p className="text-[#5A5865] text-xs">Break-even reached</p>
                  </>
                ) : (
                  <>
                    <p className="text-rose-400 font-bold text-lg">{formatCurrency(shortfall)} short</p>
                    <p className="text-[#5A5865] text-xs">Not yet profitable</p>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-[#1A1A1E] rounded-lg p-3">
                <p className="text-[#9896A4] text-xs mb-1">Monthly Expenses</p>
                <p className="text-rose-400 font-semibold tabular-nums">{formatCurrency(totalExpenses)}</p>
              </div>
              <div className="bg-[#1A1A1E] rounded-lg p-3">
                <p className="text-[#9896A4] text-xs mb-1">Revenue So Far</p>
                <p className="text-emerald-400 font-semibold tabular-nums">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="bg-[#1A1A1E] rounded-lg p-3">
                <p className="text-[#9896A4] text-xs mb-1">Net</p>
                <p className={`font-semibold tabular-nums ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
                </p>
              </div>
            </div>
            {cumulativeData.length > 1 && (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={cumulativeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fill: '#9896A4', fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fill: '#9896A4', fontSize: 10 }} axisLine={false} tickLine={false} width={56}
                    tickFormatter={v => `RM ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v, name) => [`RM ${Number(v).toLocaleString('en-MY', { minimumFractionDigits: 0 })}`, name === 'revenue' ? 'Revenue' : 'Costs']}
                    contentStyle={{ background: '#1A1A1E', border: '1px solid #2A2A30', borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: '#F0EEF6' }}
                  />
                  <Bar dataKey="costs" fill="#f43f5e" opacity={0.4} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="revenue" fill="#34d399" opacity={0.8} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="text-[#5A5865] text-xs mt-2">
              <span className="inline-block w-3 h-2 rounded-sm bg-emerald-400 opacity-80 mr-1" />Revenue &nbsp;
              <span className="inline-block w-3 h-2 rounded-sm bg-rose-400 opacity-40 mr-1 ml-2" />Prorated expenses
            </p>
          </div>
        )
      })()}

      {/* Cocktail performance */}
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
