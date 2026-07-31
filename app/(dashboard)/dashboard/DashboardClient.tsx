'use client'
import { useState, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { StatCard } from '@/components/ui/StatCard'
import { formatCurrency, EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import {
  TrendingUp, DollarSign, ArrowDownCircle, BarChart2,
  AlertTriangle, CheckCircle2, ShoppingCart, ChevronLeft, ChevronRight, CalendarDays
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

interface Props {
  todaySales: {
    total_revenue: number
    transaction_count: number
    cocktails_revenue: number
    beer_revenue: number
    food_revenue: number
    is_balanced: boolean
  } | null
  allSales: { date: string; total_revenue: number; cocktails_revenue: number; beer_revenue: number; wine_revenue: number; food_revenue: number; others_revenue: number; total_collected: number; transaction_count: number; discount_amount?: number }[]
  allExpenses: { date: string; expense_period: string | null; category: string; amount: number }[]
  allCOGS: { date: string; total_cogs: number; total_revenue: number }[]
  lowStock: { name: string; current_stock: number; min_stock_level: number }[]
}

type PeriodMode = 'week' | 'month' | 'custom'

const CHART_COLORS = ['#8B5CF6', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#EC4899']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1A1A1E] border border-[#2A2A30] rounded-lg p-3 shadow-xl">
        <p className="text-[#9896A4] text-xs mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-[#F0EEF6] text-sm font-medium">{p.name}: {formatCurrency(p.value)}</p>
        ))}
      </div>
    )
  }
  return null
}

// Returns Mon of the ISO week containing `date`
function weekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function addWeeks(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n * 7)
  return d
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

function formatDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function weekLabel(mon: Date): string {
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
  return `${fmt(mon)} – ${fmt(sun)}`
}

function monthLabelFull(d: Date): string {
  return d.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
}

export function DashboardClient({ todaySales, allSales, allExpenses, allCOGS, lowStock }: Props) {
  const [mode, setMode] = useState<PeriodMode>('month')
  // For month mode: anchor is first day of displayed month
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  // For week mode: anchor is Monday of displayed week
  const [weekAnchor, setWeekAnchor] = useState(() => weekStart(new Date()))
  // For custom mode: from/to date strings
  const [customFrom, setCustomFrom] = useState(() => formatDateStr(new Date()))
  const [customTo, setCustomTo] = useState(() => formatDateStr(new Date()))

  const { fromStr, toStr, periodLabel } = useMemo(() => {
    if (mode === 'week') {
      const mon = weekAnchor
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return { fromStr: formatDateStr(mon), toStr: formatDateStr(sun), periodLabel: weekLabel(mon) }
    } else if (mode === 'custom') {
      const from = customFrom
      const to = customTo >= customFrom ? customTo : customFrom
      const isSingleDay = from === to
      const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
      return {
        fromStr: from,
        toStr: to,
        periodLabel: isSingleDay ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`,
      }
    } else {
      const from = monthAnchor
      const to = new Date(from.getFullYear(), from.getMonth() + 1, 0)
      return { fromStr: formatDateStr(from), toStr: formatDateStr(to), periodLabel: monthLabelFull(from) }
    }
  }, [mode, monthAnchor, weekAnchor, customFrom, customTo])

  const isCurrentPeriod = useMemo(() => {
    if (mode === 'custom') return false
    const today = new Date(); today.setHours(0,0,0,0)
    if (mode === 'week') return formatDateStr(weekAnchor) === formatDateStr(weekStart(today))
    return monthAnchor.getFullYear() === today.getFullYear() && monthAnchor.getMonth() === today.getMonth()
  }, [mode, monthAnchor, weekAnchor])

  const prev = () => {
    if (mode === 'week') setWeekAnchor(d => addWeeks(d, -1))
    else if (mode === 'month') setMonthAnchor(d => addMonths(d, -1))
  }
  const next = () => {
    if (mode === 'week') setWeekAnchor(d => addWeeks(d, 1))
    else if (mode === 'month') setMonthAnchor(d => addMonths(d, 1))
  }
  const goNow = () => {
    if (mode === 'week') setWeekAnchor(weekStart(new Date()))
    else if (mode === 'month') setMonthAnchor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  }

  // Filtered data for selected period
  const periodSales = useMemo(() =>
    allSales.filter(s => s.date >= fromStr && s.date <= toStr), [allSales, fromStr, toStr])

  const periodExpenses = useMemo(() =>
    allExpenses.filter(e => {
      const d = e.expense_period ? e.expense_period.slice(0, 10) : e.date
      return d >= fromStr && d <= toStr
    }), [allExpenses, fromStr, toStr])

  const periodCOGS = useMemo(() =>
    allCOGS.filter(c => c.date >= fromStr && c.date <= toStr), [allCOGS, fromStr, toStr])

  const totalRevenue = periodSales.reduce((s, r) => s + r.total_revenue, 0)
  const totalExpenses = periodExpenses.reduce((s, e) => s + e.amount, 0)
  const totalCOGS = periodCOGS.reduce((s, c) => s + (c.total_cogs ?? 0), 0)
  const netProfit = totalRevenue - totalExpenses
  const avgDaily = periodSales.length > 0 ? totalRevenue / periodSales.length : 0
  const totalTransactions = periodSales.reduce((s, r) => s + (r.transaction_count ?? 0), 0)

  const expenseByCategory = useMemo(() =>
    periodExpenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc
    }, {}), [periodExpenses])

  const pieData = Object.entries(expenseByCategory)
    .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([key, value]) => ({ name: EXPENSE_CATEGORY_LABELS[key] ?? key, value }))

  // Chart: daily revenue for the selected period
  const revenueChartData = useMemo(() => {
    if (mode === 'week') {
      return periodSales.map(s => ({
        date: new Date(s.date + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric' }),
        revenue: s.total_revenue - (s.discount_amount ?? 0),
      }))
    }
    // Month: fill every day
    const map: Record<string, number> = {}
    for (const s of periodSales) map[s.date] = s.total_revenue - (s.discount_amount ?? 0)
    const result = []
    const cur = new Date(fromStr + 'T00:00:00')
    const end = new Date(toStr + 'T00:00:00')
    while (cur <= end) {
      const key = formatDateStr(cur)
      result.push({ date: cur.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }), revenue: map[key] ?? 0 })
      cur.setDate(cur.getDate() + 1)
    }
    return result
  }, [mode, periodSales, fromStr, toStr])

  // Sales mix chart
  const salesMixData = periodSales.slice(-7).map(s => ({
    date: new Date(s.date + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'short' }),
    cocktails: s.cocktails_revenue ?? 0,
    beer: s.beer_revenue ?? 0,
    food: s.food_revenue ?? 0,
  }))

  const todayTopCategory = todaySales ? (
    [
      { name: 'Cocktails', value: todaySales.cocktails_revenue },
      { name: 'Beer', value: todaySales.beer_revenue },
      { name: 'Food', value: todaySales.food_revenue },
    ].sort((a, b) => b.value - a.value)[0]
  ) : null

  return (
    <div className="space-y-6">
      <TopBar title="Dashboard" subtitle={periodLabel} />

      {/* Period picker */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-[#0D0D0F] border border-[#2A2A30] rounded-xl p-1">
          {(['week', 'month', 'custom'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${mode === m ? 'bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/30' : 'text-[#9896A4] hover:text-[#F0EEF6]'}`}>
              {m === 'week' ? 'Weekly' : m === 'month' ? 'Monthly' : 'Custom'}
            </button>
          ))}
        </div>

        {mode === 'custom' ? (
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-[#5A5865]" />
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="bg-[#141417] border border-[#2A2A30] rounded-lg px-3 py-1.5 text-sm text-[#F0EEF6] focus:outline-none focus:border-[#8B5CF6]/60"
            />
            <span className="text-[#5A5865] text-sm">to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={e => setCustomTo(e.target.value)}
              className="bg-[#141417] border border-[#2A2A30] rounded-lg px-3 py-1.5 text-sm text-[#F0EEF6] focus:outline-none focus:border-[#8B5CF6]/60"
            />
            <button
              onClick={() => { setCustomFrom(formatDateStr(new Date())); setCustomTo(formatDateStr(new Date())) }}
              className="btn-secondary text-xs"
            >
              Today
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={prev} className="btn-ghost p-2"><ChevronLeft size={16} /></button>
            <span className="text-[#F0EEF6] text-sm font-medium min-w-[180px] text-center">{periodLabel}</span>
            <button onClick={next} disabled={isCurrentPeriod} className="btn-ghost p-2 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        )}

        {!isCurrentPeriod && mode !== 'custom' && (
          <button onClick={goNow} className="btn-secondary text-xs">Today</button>
        )}
      </div>

      {/* Today section */}
      <div>
        <p className="text-[#5A5865] text-xs font-medium uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
          Today
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Sales Today" value={todaySales?.total_revenue ?? 0} currency
            icon={<TrendingUp size={14} />} accent="purple"
            subtitle={todaySales ? (todaySales.is_balanced ? '✓ Balanced' : '⚠ Mismatch') : 'No entry yet'} />
          <StatCard title="Transactions" value={todaySales?.transaction_count ?? 0}
            icon={<ShoppingCart size={14} />} accent="gold" subtitle="Total transactions" />
          <StatCard title="Avg Spend"
            value={todaySales && todaySales.transaction_count > 0
              ? formatCurrency(todaySales.total_revenue / todaySales.transaction_count) : 'RM0.00'}
            icon={<DollarSign size={14} />} accent="green" subtitle="Per transaction" />
          <StatCard title="Top Category" value={todayTopCategory?.name ?? '—'}
            icon={<BarChart2 size={14} />} accent="amber"
            subtitle={todayTopCategory ? formatCurrency(todayTopCategory.value) : 'No data'} />
        </div>
      </div>

      {/* Period KPIs */}
      <div>
        <p className="text-[#5A5865] text-xs font-medium uppercase tracking-wider mb-3">{periodLabel}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Revenue" value={totalRevenue} currency icon={<TrendingUp size={14} />} accent="purple" />
          <StatCard title="Expenses" value={totalExpenses} currency icon={<ArrowDownCircle size={14} />} accent="red" />
          <StatCard title="Net Profit" value={netProfit} currency icon={<DollarSign size={14} />} accent={netProfit >= 0 ? 'green' : 'red'} />
          <StatCard title={mode === 'week' ? 'Total Transactions' : 'Avg Daily Sales'}
            value={mode === 'week' ? totalTransactions : avgDaily}
            currency={mode !== 'week'}
            icon={<BarChart2 size={14} />} accent="gold"
            subtitle={mode === 'week' ? `${periodSales.length} days` : `${periodSales.length} days tracked`} />
        </div>
      </div>

      {/* COGS */}
      {totalCOGS > 0 && (
        <div>
          <p className="text-[#5A5865] text-xs font-medium uppercase tracking-wider mb-3">Cost of Goods Sold</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Revenue" value={totalRevenue} currency icon={<TrendingUp size={14} />} accent="purple" />
            <StatCard title="COGS" value={totalCOGS} currency icon={<ArrowDownCircle size={14} />} accent="red" subtitle="Ingredient cost" />
            <StatCard title="Gross Profit" value={totalRevenue - totalCOGS} currency icon={<DollarSign size={14} />} accent="green" />
            <div className="card">
              <p className="text-[#9896A4] text-xs mb-1">Gross Margin</p>
              <p className={`text-2xl font-bold ${(totalRevenue - totalCOGS) / totalRevenue >= 0.65 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {totalRevenue > 0 ? (((totalRevenue - totalCOGS) / totalRevenue) * 100).toFixed(1) : '0.0'}%
              </p>
              <p className="text-[#5A5865] text-[10px] mt-0.5">Before other expenses</p>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <p className="section-title mb-4">Revenue — {periodLabel}</p>
          {revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueChartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#5A5865', fontSize: 10 }} tickLine={false} axisLine={false} interval={mode === 'week' ? 0 : 4} />
                <YAxis tick={{ fill: '#5A5865', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `RM${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#8B5CF6" strokeWidth={2} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-[#5A5865] text-sm">No sales data for this period</div>
          )}
        </div>

        <div className="card">
          <p className="section-title mb-4">Expenses by Category</p>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.slice(0, 4).map(({ name, value }, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-[#9896A4] text-xs">{name}</span>
                    </div>
                    <span className="text-[#F0EEF6] text-xs font-medium">{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-[#5A5865] text-sm">No expense data</div>
          )}
        </div>
      </div>

      {/* Sales mix + Low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <p className="section-title mb-4">Sales Mix — {periodLabel}</p>
          {salesMixData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={salesMixData}>
                  <XAxis dataKey="date" tick={{ fill: '#5A5865', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#5A5865', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `RM${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="cocktails" stackId="a" fill="#8B5CF6" />
                  <Bar dataKey="beer" stackId="a" fill="#F59E0B" />
                  <Bar dataKey="food" stackId="a" fill="#10B981" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2">
                {[['Cocktails', '#8B5CF6'], ['Beer', '#F59E0B'], ['Food', '#10B981']].map(([label, color]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-[#9896A4] text-xs">{label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-[#5A5865] text-sm">No sales data</div>
          )}
        </div>

        <div className="card">
          <p className="section-title mb-4">Low Stock Alerts</p>
          {lowStock.length > 0 ? (
            <div className="space-y-2">
              {lowStock.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-[#1A1A1E] rounded-lg border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span className="text-[#F0EEF6] text-sm">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 text-xs font-medium">{item.current_stock} left</p>
                    <p className="text-[#5A5865] text-xs">Min: {item.min_stock_level}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <CheckCircle2 size={24} className="text-emerald-400" />
              <p className="text-[#9896A4] text-sm">All stock levels OK</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
