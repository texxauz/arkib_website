'use client'
import { TopBar } from '@/components/layout/TopBar'
import { StatCard } from '@/components/ui/StatCard'
import { formatCurrency, formatMonth, EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import {
  TrendingUp, DollarSign, ArrowDownCircle, BarChart2,
  AlertTriangle, CheckCircle2, ShoppingCart
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

interface DashboardClientProps {
  todaySales: {
    total_revenue: number
    transaction_count: number
    cocktails_revenue: number
    beer_revenue: number
    food_revenue: number
    is_balanced: boolean
  } | null
  monthlyRevenue: number
  monthlyExpenses: number
  netProfit: number
  targetRevenue: number
  chartData: { date: string; revenue: number }[]
  expenseByCategory: Record<string, number>
  monthlySales: { date: string; total_revenue: number; cocktails_revenue: number; beer_revenue: number; food_revenue: number }[]
  lowStock: { name: string; current_stock: number; min_stock_level: number }[]
  month: number
  year: number
}

const CHART_COLORS = ['#8B5CF6', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#EC4899']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1A1A1E] border border-[#2A2A30] rounded-lg p-3 shadow-xl">
        <p className="text-[#9896A4] text-xs mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-[#F0EEF6] text-sm font-medium">
            {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function DashboardClient({
  todaySales, monthlyRevenue, monthlyExpenses, netProfit,
  targetRevenue, chartData, expenseByCategory, monthlySales,
  lowStock, month, year
}: DashboardClientProps) {
  const targetProgress = targetRevenue > 0 ? Math.min((monthlyRevenue / targetRevenue) * 100, 100) : 0
  const avgDailySales = monthlySales.length > 0 ? monthlyRevenue / monthlySales.length : 0

  const topCategory = todaySales ? (
    [
      { name: 'Cocktails', value: todaySales.cocktails_revenue },
      { name: 'Beer', value: todaySales.beer_revenue },
      { name: 'Food', value: todaySales.food_revenue },
    ].sort((a, b) => b.value - a.value)[0]
  ) : null

  const pieData = Object.entries(expenseByCategory)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, value]) => ({ name: EXPENSE_CATEGORY_LABELS[key] ?? key, value }))

  const salesBreakdown = monthlySales.slice(-7).map(s => ({
    date: new Date(s.date).toLocaleDateString('en-MY', { weekday: 'short' }),
    cocktails: s.cocktails_revenue,
    beer: s.beer_revenue,
    food: s.food_revenue,
  }))

  return (
    <div className="space-y-6">
      <TopBar
        title="Dashboard"
        subtitle={formatMonth(month, year)}
      />

      {/* Today section */}
      <div>
        <p className="text-[#5A5865] text-xs font-medium uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
          Today
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Sales Today"
            value={todaySales?.total_revenue ?? 0}
            currency
            icon={<TrendingUp size={14} />}
            accent="purple"
            subtitle={todaySales ? (todaySales.is_balanced ? '✓ Balanced' : '⚠ Mismatch') : 'No entry yet'}
          />
          <StatCard
            title="Transactions"
            value={todaySales?.transaction_count ?? 0}
            icon={<ShoppingCart size={14} />}
            accent="gold"
            subtitle="Total transactions"
          />
          <StatCard
            title="Avg Spend"
            value={todaySales && todaySales.transaction_count > 0
              ? formatCurrency(todaySales.total_revenue / todaySales.transaction_count)
              : 'RM0.00'}
            icon={<DollarSign size={14} />}
            accent="green"
            subtitle="Per transaction"
          />
          <StatCard
            title="Top Category"
            value={topCategory?.name ?? '—'}
            icon={<BarChart2 size={14} />}
            accent="amber"
            subtitle={topCategory ? formatCurrency(topCategory.value) : 'No data'}
          />
        </div>
      </div>

      {/* Month section */}
      <div>
        <p className="text-[#5A5865] text-xs font-medium uppercase tracking-wider mb-3">{formatMonth(month, year)}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Monthly Revenue"
            value={monthlyRevenue}
            currency
            icon={<TrendingUp size={14} />}
            accent="purple"
          />
          <StatCard
            title="Monthly Expenses"
            value={monthlyExpenses}
            currency
            icon={<ArrowDownCircle size={14} />}
            accent="red"
          />
          <StatCard
            title="Net Profit"
            value={netProfit}
            currency
            icon={<DollarSign size={14} />}
            accent={netProfit >= 0 ? 'green' : 'red'}
          />
          <StatCard
            title="Avg Daily Sales"
            value={avgDailySales}
            currency
            icon={<BarChart2 size={14} />}
            accent="gold"
            subtitle={`${monthlySales.length} days tracked`}
          />
        </div>
      </div>

      {/* Target progress */}
      {targetRevenue > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#9896A4] text-xs font-medium uppercase tracking-wider">Monthly Target</p>
            <div className="flex items-center gap-1.5">
              {targetProgress >= 100
                ? <CheckCircle2 size={14} className="text-emerald-400" />
                : <AlertTriangle size={14} className="text-amber-400" />}
              <span className="text-[#F0EEF6] text-sm font-bold">{targetProgress.toFixed(1)}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-[#9896A4] mb-2">
            <span>{formatCurrency(monthlyRevenue)}</span>
            <span>Target: {formatCurrency(targetRevenue)}</span>
          </div>
          <div className="w-full bg-[#1A1A1E] rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] transition-all duration-500"
              style={{ width: `${targetProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="card lg:col-span-2">
          <p className="section-title mb-4">Revenue — Last 30 Days</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#5A5865', fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fill: '#5A5865', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `RM${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="#8B5CF6" strokeWidth={2} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expense breakdown */}
        <div className="card">
          <p className="section-title mb-4">Expenses by Category</p>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
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

      {/* Sales breakdown + low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Last 7 days breakdown */}
        <div className="card">
          <p className="section-title mb-4">Sales Mix — Last 7 Days</p>
          {salesBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={salesBreakdown}>
                <XAxis dataKey="date" tick={{ fill: '#5A5865', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#5A5865', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `RM${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="cocktails" stackId="a" fill="#8B5CF6" radius={[0,0,0,0]} />
                <Bar dataKey="beer" stackId="a" fill="#F59E0B" radius={[0,0,0,0]} />
                <Bar dataKey="food" stackId="a" fill="#10B981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-32 text-[#5A5865] text-sm">No recent sales</div>
          )}
          <div className="flex gap-4 mt-2">
            {[['Cocktails', '#8B5CF6'], ['Beer', '#F59E0B'], ['Food', '#10B981']].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[#9896A4] text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock alerts */}
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
