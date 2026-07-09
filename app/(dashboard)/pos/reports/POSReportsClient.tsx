'use client'

import { useState, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Search, AlertTriangle } from 'lucide-react'

type Order = {
  id: string
  table_name: string | null
  covers: number
  opened_at: string
  closed_at: string | null
  total: number
  discount_amount: number
  service_charge: number
  status: string
  server_name: string | null
}

type Item = {
  item_name: string
  category: string | null
  quantity: number
  unit_price: number
  voided_at: string | null
  created_at: string
}

type Payment = {
  method: string
  amount: number
  captured_at: string
}

type VoidedItem = {
  item_name: string
  quantity: number
  unit_price: number
  voided_at: string | null
  void_reason: string | null
  created_at: string
}

type DiscountLog = {
  payload: Record<string, unknown> | null
  created_at: string
}

interface Props {
  orders: Order[]
  items: Item[]
  payments: Payment[]
  voids: VoidedItem[]
  discountLogs: DiscountLog[]
  isAdmin: boolean
}

type Tab = 'overview' | 'items' | 'payments' | 'staff' | 'voids'

function fmtRM(n: number) {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#34d399',
  credit_card: '#38bdf8',
  debit_card: '#38bdf8',
  card: '#38bdf8',
  qr_payment: '#a78bfa',
  qr: '#a78bfa',
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  credit_card: 'Card',
  debit_card: 'Card',
  card: 'Card',
  qr_payment: 'QR',
  qr: 'QR',
}

// Normalize payment method keys for consistent grouping
function normalizeMethod(method: string): 'cash' | 'card' | 'qr' {
  const m = method.toLowerCase()
  if (m === 'cash') return 'cash'
  if (m === 'credit_card' || m === 'debit_card' || m === 'card') return 'card'
  return 'qr'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#9896A4] mb-1">{label}</p>
      <p className="text-[#F0EEF6] font-semibold">{fmtRM(payload[0].value)}</p>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CountTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#9896A4] mb-1">{label}</p>
      <p className="text-[#F0EEF6] font-semibold">{payload[0].value} orders</p>
    </div>
  )
}

export function POSReportsClient({ orders, items, payments, voids, discountLogs, isAdmin }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [itemSearch, setItemSearch] = useState('')
  const [itemSort, setItemSort] = useState<'qty' | 'revenue'>('revenue')

  // ── Core stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0)
    const totalOrders = orders.length
    const totalCovers = orders.reduce((s, o) => s + o.covers, 0)
    const avgSpend = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const avgCovers = totalOrders > 0 ? totalCovers / totalOrders : 0
    const totalDiscounts = orders.reduce((s, o) => s + o.discount_amount, 0)
    return { totalRevenue, totalOrders, totalCovers, avgSpend, avgCovers, totalDiscounts }
  }, [orders])

  // ── Daily revenue ────────────────────────────────────────────────────────────
  const dailyRevenue = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of orders) {
      const day = o.opened_at.slice(0, 10)
      map[day] = (map[day] ?? 0) + o.total
    }
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, revenue]) => ({ date: fmtDate(date), revenue }))
  }, [orders])

  // ── Top 10 items ────────────────────────────────────────────────────────────
  const topItems = useMemo(() => {
    const map: Record<string, { qty: number; revenue: number }> = {}
    for (const item of items) {
      if (item.voided_at) continue
      if (!map[item.item_name]) map[item.item_name] = { qty: 0, revenue: 0 }
      map[item.item_name].qty += item.quantity
      map[item.item_name].revenue += item.quantity * item.unit_price
    }
    return Object.entries(map)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([name, v]) => ({ name, ...v }))
  }, [items])

  // ── Hourly breakdown ─────────────────────────────────────────────────────────
  const hourlyData = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, '0')}:00`, count: 0 }))
    for (const o of orders) {
      const h = new Date(o.opened_at).getHours()
      counts[h].count++
    }
    return counts
  }, [orders])

  // ── Items tab ────────────────────────────────────────────────────────────────
  const allItemRows = useMemo(() => {
    const map: Record<string, { category: string | null; qty: number; unit_price: number; revenue: number }> = {}
    for (const item of items) {
      if (item.voided_at) continue
      if (!map[item.item_name]) map[item.item_name] = { category: item.category, qty: 0, unit_price: item.unit_price, revenue: 0 }
      map[item.item_name].qty += item.quantity
      map[item.item_name].revenue += item.quantity * item.unit_price
    }
    return Object.entries(map).map(([name, v]) => ({ name, ...v }))
  }, [items])

  const filteredItems = useMemo(() => {
    const q = itemSearch.toLowerCase()
    const rows = q ? allItemRows.filter(r => r.name.toLowerCase().includes(q)) : allItemRows
    return [...rows].sort((a, b) => itemSort === 'qty' ? b.qty - a.qty : b.revenue - a.revenue)
  }, [allItemRows, itemSearch, itemSort])

  // ── Payments ─────────────────────────────────────────────────────────────────
  const paymentStats = useMemo(() => {
    const map: Record<string, number> = { cash: 0, card: 0, qr: 0 }
    for (const p of payments) {
      const key = normalizeMethod(p.method)
      map[key] = (map[key] ?? 0) + p.amount
    }
    return map
  }, [payments])

  const paymentPieData = useMemo(() =>
    Object.entries(paymentStats)
      .filter(([, amount]) => amount > 0)
      .map(([method, amount]) => ({
        name: PAYMENT_LABELS[method] ?? method,
        value: amount,
        fill: PAYMENT_COLORS[method] ?? '#6B7280',
      })),
    [paymentStats]
  )

  const recentPayments = useMemo(() =>
    [...payments].sort((a, b) => b.captured_at.localeCompare(a.captured_at)).slice(0, 20),
    [payments]
  )

  // ── Voids ────────────────────────────────────────────────────────────────────
  const totalVoidValue = useMemo(() =>
    voids.reduce((s, v) => s + v.quantity * v.unit_price, 0),
    [voids]
  )

  // ── Staff performance ────────────────────────────────────────────────────────
  const staffStats = useMemo(() => {
    const map: Record<string, { orders: number; revenue: number; covers: number }> = {}
    for (const o of orders) {
      const name = o.server_name ?? 'Unknown'
      if (!map[name]) map[name] = { orders: 0, revenue: 0, covers: 0 }
      map[name].orders++
      map[name].revenue += o.total
      map[name].covers += o.covers
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v, avgSpend: v.orders > 0 ? v.revenue / v.orders : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [orders])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'items', label: 'Items Sold' },
    { id: 'payments', label: 'Payments' },
    { id: 'staff', label: 'Staff' },
    ...(isAdmin ? [{ id: 'voids' as Tab, label: 'Voids & Discounts' }] : []),
  ]

  return (
    <div className="space-y-6">
      <TopBar
        title="POS Reports"
        subtitle="Last 30 days"
      />

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
              activeTab === tab.id
                ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/40 text-[#A78BFA]'
                : 'bg-[#141417] border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:border-[#3A3A42]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Revenue', value: fmtRM(stats.totalRevenue), color: 'text-emerald-400' },
              { label: 'Orders Closed', value: stats.totalOrders.toString(), color: 'text-[#F0EEF6]' },
              { label: 'Avg Spend / Order', value: fmtRM(stats.avgSpend), color: 'text-[#A78BFA]' },
              { label: 'Total Covers', value: stats.totalCovers.toString(), color: 'text-sky-400' },
            ].map(card => (
              <div key={card.label} className="card">
                <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-2">{card.label}</p>
                <p className={`font-bold text-xl tabular-nums ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Daily revenue bar chart */}
          <div className="card">
            <p className="section-title mb-4">Daily Revenue</p>
            {dailyRevenue.length === 0 ? (
              <p className="text-[#5A5865] text-sm text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyRevenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#9896A4', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#9896A4', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `RM ${(v / 1000).toFixed(0)}k`}
                    width={52}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#8B5CF6', opacity: 0.08 }} />
                  <Bar dataKey="revenue" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top 10 items */}
          <div className="card">
            <p className="section-title mb-4">Top 10 Items</p>
            {topItems.length === 0 ? (
              <p className="text-[#5A5865] text-sm">No items recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                      <th className="text-left py-2 pr-4">#</th>
                      <th className="text-left py-2 pr-4">Item</th>
                      <th className="text-right py-2 px-4">Qty Sold</th>
                      <th className="text-right py-2 pl-4">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topItems.map((item, i) => (
                      <tr key={item.name} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                        <td className="py-2.5 pr-4 text-[#5A5865] text-xs tabular-nums">{i + 1}</td>
                        <td className="py-2.5 pr-4 text-[#F0EEF6]">{item.name}</td>
                        <td className="py-2.5 px-4 text-right text-[#9896A4] tabular-nums">{item.qty}</td>
                        <td className="py-2.5 pl-4 text-right text-emerald-400 font-medium tabular-nums">{fmtRM(item.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Hourly heatmap */}
          <div className="card">
            <p className="section-title mb-4">Orders by Hour</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={hourlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="hour"
                  tick={{ fill: '#9896A4', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fill: '#9896A4', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip content={<CountTooltip />} cursor={{ fill: '#F59E0B', opacity: 0.08 }} />
                <Bar dataKey="count" fill="#F59E0B" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── ITEMS TAB ────────────────────────────────────────────────────────── */}
      {activeTab === 'items' && (
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
              <input
                type="text"
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                placeholder="Search items…"
                className="input w-full pl-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#9896A4] text-xs uppercase tracking-wider">Sort by</span>
              <div className="flex gap-1">
                {(['revenue', 'qty'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setItemSort(s)}
                    className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                      itemSort === s
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/40 text-[#A78BFA]'
                        : 'bg-[#141417] border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6]'
                    }`}
                  >
                    {s === 'revenue' ? 'Revenue' : 'Qty'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                  <th className="text-left py-2 pr-4">Item</th>
                  <th className="text-left py-2 pr-4">Category</th>
                  <th className="text-right py-2 px-4">Qty</th>
                  <th className="text-right py-2 px-4">Unit Price</th>
                  <th className="text-right py-2 pl-4">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-[#5A5865] text-sm">No items found</td>
                  </tr>
                ) : (
                  filteredItems.map(row => (
                    <tr key={row.name} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                      <td className="py-2.5 pr-4 text-[#F0EEF6]">{row.name}</td>
                      <td className="py-2.5 pr-4">
                        {row.category ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/20">
                            {row.category}
                          </span>
                        ) : (
                          <span className="text-[#5A5865] text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right text-[#9896A4] tabular-nums">{row.qty}</td>
                      <td className="py-2.5 px-4 text-right text-[#9896A4] tabular-nums">{fmtRM(row.unit_price)}</td>
                      <td className="py-2.5 pl-4 text-right text-emerald-400 font-medium tabular-nums">{fmtRM(row.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PAYMENTS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Method stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['cash', 'card', 'qr'] as const).map(method => {
              const amount = paymentStats[method] ?? 0
              const colorMap = {
                cash: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'text-emerald-300' },
                card: { bg: 'bg-sky-500/10 border-sky-500/20', text: 'text-sky-400', label: 'text-sky-300' },
                qr: { bg: 'bg-[#8B5CF6]/10 border-[#8B5CF6]/20', text: 'text-[#A78BFA]', label: 'text-[#C4B5FD]' },
              }
              const c = colorMap[method]
              return (
                <div key={method} className={`rounded-xl border p-4 ${c.bg}`}>
                  <p className={`text-xs uppercase tracking-wider mb-2 ${c.label}`}>{PAYMENT_LABELS[method]}</p>
                  <p className={`font-bold text-2xl tabular-nums ${c.text}`}>{fmtRM(amount)}</p>
                </div>
              )
            })}
          </div>

          {/* Pie chart + legend */}
          {paymentPieData.length > 0 && (
            <div className="card">
              <p className="section-title mb-4">Payment Split</p>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={paymentPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {paymentPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => fmtRM(Number(v))}
                      contentStyle={{ background: '#1A1A1E', border: '1px solid #2A2A30', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: '#F0EEF6' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-3">
                  {paymentPieData.map(entry => {
                    const total = paymentPieData.reduce((s, e) => s + e.value, 0)
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0'
                    return (
                      <div key={entry.name} className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: entry.fill }} />
                        <span className="text-[#9896A4] text-sm w-14">{entry.name}</span>
                        <span className="text-[#F0EEF6] font-semibold tabular-nums text-sm">{fmtRM(entry.value)}</span>
                        <span className="text-[#5A5865] text-xs tabular-nums">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Recent payments */}
          <div className="card">
            <p className="section-title mb-4">Recent Payments</p>
            {recentPayments.length === 0 ? (
              <p className="text-[#5A5865] text-sm">No payments recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                      <th className="text-left py-2 pr-4">Method</th>
                      <th className="text-right py-2 px-4">Amount</th>
                      <th className="text-right py-2 pl-4">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((p, i) => {
                      const key = normalizeMethod(p.method)
                      return (
                        <tr key={i} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                          <td className="py-2.5 pr-4">
                            <span
                              className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium border"
                              style={{
                                color: PAYMENT_COLORS[key] ?? '#9896A4',
                                background: (PAYMENT_COLORS[key] ?? '#9896A4') + '18',
                                borderColor: (PAYMENT_COLORS[key] ?? '#9896A4') + '40',
                              }}
                            >
                              {PAYMENT_LABELS[key] ?? p.method}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right text-[#F0EEF6] font-medium tabular-nums">{fmtRM(p.amount)}</td>
                          <td className="py-2.5 pl-4 text-right text-[#9896A4] text-xs">{fmtDatetime(p.captured_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STAFF TAB ────────────────────────────────────────────────────────── */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          {staffStats.length === 0 ? (
            <div className="card">
              <p className="text-[#5A5865] text-sm text-center py-8">No closed orders in this period</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {staffStats.slice(0, 4).map(s => (
                  <div key={s.name} className="card">
                    <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-1 truncate">{s.name}</p>
                    <p className="text-emerald-400 font-bold text-lg tabular-nums">{fmtRM(s.revenue)}</p>
                    <p className="text-[#5A5865] text-xs mt-1">{s.orders} orders · {s.covers} covers</p>
                  </div>
                ))}
              </div>

              {/* Full table */}
              <div className="card overflow-x-auto">
                <p className="section-title mb-4">Performance Breakdown — Last 30 Days</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                      <th className="text-left py-2 pr-4">Server</th>
                      <th className="text-right py-2 px-4">Orders</th>
                      <th className="text-right py-2 px-4">Covers</th>
                      <th className="text-right py-2 px-4">Avg / Order</th>
                      <th className="text-right py-2 pl-4">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffStats.map((s, i) => (
                      <tr key={s.name} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#8B5CF6]/20 text-[#A78BFA] text-xs flex items-center justify-center font-medium shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-[#F0EEF6] font-medium">{s.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right text-[#9896A4] tabular-nums">{s.orders}</td>
                        <td className="py-2.5 px-4 text-right text-[#9896A4] tabular-nums">{s.covers}</td>
                        <td className="py-2.5 px-4 text-right text-[#9896A4] tabular-nums">{fmtRM(s.avgSpend)}</td>
                        <td className="py-2.5 pl-4 text-right text-emerald-400 font-semibold tabular-nums">{fmtRM(s.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[#2A2A30]">
                      <td className="py-2.5 pr-4 text-[#9896A4] text-xs font-medium">Total</td>
                      <td className="py-2.5 px-4 text-right text-[#9896A4] tabular-nums text-xs">{staffStats.reduce((s, r) => s + r.orders, 0)}</td>
                      <td className="py-2.5 px-4 text-right text-[#9896A4] tabular-nums text-xs">{staffStats.reduce((s, r) => s + r.covers, 0)}</td>
                      <td className="py-2.5 px-4" />
                      <td className="py-2.5 pl-4 text-right text-emerald-400 font-bold tabular-nums text-xs">{fmtRM(staffStats.reduce((s, r) => s + r.revenue, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── VOIDS TAB (admin only) ────────────────────────────────────────────── */}
      {activeTab === 'voids' && isAdmin && (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card">
              <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-2">Total Void Value</p>
              <p className="text-rose-400 font-bold text-2xl tabular-nums">{fmtRM(totalVoidValue)}</p>
            </div>
            <div className="card">
              <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-2">Void Incidents</p>
              <p className="text-[#F0EEF6] font-bold text-2xl tabular-nums">{voids.length}</p>
            </div>
            <div className="card">
              <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-2">Total Discounts Given</p>
              <p className="text-amber-400 font-bold text-2xl tabular-nums">{fmtRM(stats.totalDiscounts)}</p>
              <p className="text-[#5A5865] text-xs mt-1">{discountLogs.length} discount events</p>
            </div>
          </div>

          {/* Voided items table */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-rose-400" />
              <p className="section-title">Voided Items</p>
            </div>
            {voids.length === 0 ? (
              <p className="text-[#5A5865] text-sm">No voided items in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                      <th className="text-left py-2 pr-4">Item</th>
                      <th className="text-right py-2 px-4">Qty</th>
                      <th className="text-right py-2 px-4">Value</th>
                      <th className="text-left py-2 px-4">Reason</th>
                      <th className="text-right py-2 pl-4">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voids.map((v, i) => (
                      <tr key={i} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                        <td className="py-2.5 pr-4 text-[#F0EEF6]">{v.item_name}</td>
                        <td className="py-2.5 px-4 text-right text-[#9896A4] tabular-nums">{v.quantity}</td>
                        <td className="py-2.5 px-4 text-right text-rose-400 font-medium tabular-nums">{fmtRM(v.quantity * v.unit_price)}</td>
                        <td className="py-2.5 px-4 text-[#9896A4] text-xs">
                          {v.void_reason ?? <span className="text-[#5A5865]">—</span>}
                        </td>
                        <td className="py-2.5 pl-4 text-right text-[#5A5865] text-xs whitespace-nowrap">
                          {fmtDate(v.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Discount log */}
          {discountLogs.length > 0 && (
            <div className="card">
              <p className="section-title mb-4">Discount Events</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                      <th className="text-left py-2 pr-4">Date</th>
                      <th className="text-left py-2 pl-4">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discountLogs.map((d, i) => (
                      <tr key={i} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                        <td className="py-2.5 pr-4 text-[#9896A4] text-xs whitespace-nowrap">{fmtDatetime(d.created_at)}</td>
                        <td className="py-2.5 pl-4 text-[#5A5865] text-xs font-mono">
                          {d.payload ? JSON.stringify(d.payload) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
