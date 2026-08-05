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
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { Search, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'

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
  discount?: number | null
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
  server_name?: string | null
}

type DiscountLog = {
  payload: Record<string, unknown> | null
  created_at: string
  actor_name?: string | null
}

type MenuItem = {
  id: string
  name: string
  category: string
}

type CocktailCost = {
  name: string
  selling_price: number
  total_cost: number
}

type DailySale = {
  date: string
  total_revenue: number
  cocktails_revenue: number | null
  beer_revenue: number | null
  wine_revenue: number | null
  food_revenue: number | null
  others_revenue: number | null
}

type CocktailSaleRow = {
  date: string
  cocktail_name: string
  quantity: number
  unit_price: number
  category: string | null
}

type Period = '30d' | '90d' | '6m' | '1y' | 'all'

const PERIOD_LABELS: Record<Period, string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '6m': 'Last 6 months',
  '1y': 'This year',
  'all': 'All time',
}

function periodCutoff(period: Period): Date | null {
  const now = new Date()
  if (period === '30d') return new Date(now.getTime() - 30 * 86400000)
  if (period === '90d') return new Date(now.getTime() - 90 * 86400000)
  if (period === '6m') return new Date(now.getTime() - 182 * 86400000)
  if (period === '1y') return new Date(now.getFullYear(), 0, 1)
  return null // all
}

interface Props {
  orders: Order[]
  items: Item[]
  payments: Payment[]
  voids: VoidedItem[]
  discountLogs: DiscountLog[]
  allMenuItems: MenuItem[]
  cocktailCosts: CocktailCost[]
  dailySales: DailySale[]
  cocktailSales: CocktailSaleRow[]
  isAdmin: boolean
}

type Tab = 'overview' | 'items' | 'payments' | 'staff' | 'operational' | 'cocktails' | 'voids'

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
  if (m === 'credit_card' || m === 'debit_card' || m === 'card' || m === 'visa' || m === 'mastercard') return 'card'
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

export function POSReportsClient({ orders: allOrders, items: allItems, payments: allPayments, voids: allVoids, discountLogs: allDiscountLogs, allMenuItems, cocktailCosts, dailySales, cocktailSales: allCocktailSales, isAdmin }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [itemSearch, setItemSearch] = useState('')
  const [itemSort, setItemSort] = useState<'qty' | 'revenue'>('revenue')
  const [period, setPeriod] = useState<Period>('30d')

  // ── Period filtering ─────────────────────────────────────────────────────────
  const cutoff = useMemo(() => periodCutoff(period), [period])
  const orders = useMemo(() => cutoff ? allOrders.filter(o => new Date(o.opened_at) >= cutoff) : allOrders, [allOrders, cutoff])
  const items = useMemo(() => cutoff ? allItems.filter(i => new Date(i.created_at) >= cutoff) : allItems, [allItems, cutoff])
  const payments = useMemo(() => cutoff ? allPayments.filter(p => new Date(p.captured_at) >= cutoff) : allPayments, [allPayments, cutoff])
  const voids = useMemo(() => cutoff ? allVoids.filter(v => new Date(v.created_at) >= cutoff) : allVoids, [allVoids, cutoff])
  const discountLogs = useMemo(() => cutoff ? allDiscountLogs.filter(d => new Date(d.created_at) >= cutoff) : allDiscountLogs, [allDiscountLogs, cutoff])
  // daily_sales filtered by period — used for revenue chart & stats (has full history from June)
  const filteredDailySales = useMemo(() => cutoff ? dailySales.filter(s => new Date(s.date) >= cutoff) : dailySales, [dailySales, cutoff])
  // cocktail_sales filtered by period — EON per-cocktail quantities going back to June
  const cocktailSales = useMemo(() => cutoff ? allCocktailSales.filter(s => new Date(s.date) >= cutoff) : allCocktailSales, [allCocktailSales, cutoff])
  // Cocktail analytics: all-time, merging pos_order_items + cocktail_sales (no period filter)
  const allTimeItems = useMemo(() => {
    const posItemDates = new Set(allItems.map(i => i.created_at.slice(0, 10)))
    const posItems = allItems.filter(i =>
      ['cocktail', 'house_cocktail', 'house cocktail', 'classic', 'classics'].includes((i.category ?? '').toLowerCase())
    )
    // EON cocktail_sales for dates not covered by POS
    const eonItems = allCocktailSales
      .filter(cs => !posItemDates.has(cs.date))
      .map(cs => ({ item_name: cs.cocktail_name, category: cs.category, quantity: cs.quantity, unit_price: cs.unit_price, created_at: cs.date + 'T00:00:00' }))
    return [...posItems.map(i => ({ item_name: i.item_name, category: i.category, quantity: i.quantity, unit_price: i.unit_price, created_at: i.created_at })), ...eonItems]
  }, [allItems, allCocktailSales])

  // ── Core stats — use daily_sales for revenue (full history), pos_orders for order counts ──
  const stats = useMemo(() => {
    const totalRevenue = filteredDailySales.reduce((s, d) => s + d.total_revenue, 0)
    const totalOrders = orders.length
    const totalCovers = orders.reduce((s, o) => s + o.covers, 0)
    const avgSpend = totalOrders > 0 ? orders.reduce((s, o) => s + o.total, 0) / totalOrders : 0
    const avgCovers = totalOrders > 0 ? totalCovers / totalOrders : 0
    const totalDiscounts = orders.reduce((s, o) => s + o.discount_amount, 0)
    return { totalRevenue, totalOrders, totalCovers, avgSpend, avgCovers, totalDiscounts }
  }, [filteredDailySales, orders])

  // ── Daily revenue — from daily_sales (full EON history) ─────────────────────
  const dailyRevenue = useMemo(() => {
    return filteredDailySales
      .map(s => ({ date: fmtDate(s.date), revenue: s.total_revenue }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredDailySales])

  // ── Merged item sales: pos_order_items + cocktail_sales (EON) — union by name ─
  // cocktail_sales covers June onwards; pos_order_items from July 11.
  // We sum both sources so counts are correct regardless of period selected.
  const mergedItemMap = useMemo(() => {
    const map: Record<string, { category: string | null; qty: number; unit_price: number; revenue: number; source: 'pos' | 'eon' | 'both' }> = {}
    // POS order items
    for (const item of items) {
      if (item.voided_at) continue
      if (!map[item.item_name]) map[item.item_name] = { category: item.category, qty: 0, unit_price: item.unit_price, revenue: 0, source: 'pos' }
      map[item.item_name].qty += item.quantity
      map[item.item_name].revenue += item.quantity * item.unit_price - (item.discount ?? 0)
    }
    // EON cocktail_sales — add quantities not already counted by POS items for the same date
    // To avoid double-counting: cocktail_sales records are the EON-submitted totals.
    // Since EON entries predate the POS (June), and POS items start July 11, we include
    // cocktail_sales only for dates where no pos_order_items exist for that cocktail name.
    const posItemDates = new Set(items.map(i => i.created_at.slice(0, 10)))
    for (const cs of cocktailSales) {
      // Skip if this date has POS order items (POS is the source of truth for that day)
      if (posItemDates.has(cs.date)) continue
      const key = cs.cocktail_name
      if (!map[key]) map[key] = { category: cs.category, qty: 0, unit_price: cs.unit_price, revenue: 0, source: 'eon' }
      else if (map[key].source === 'pos') map[key].source = 'both'
      map[key].qty += cs.quantity
      map[key].revenue += cs.quantity * cs.unit_price
    }
    return map
  }, [items, cocktailSales])

  // ── Top 10 items ────────────────────────────────────────────────────────────
  const topItems = useMemo(() => {
    return Object.entries(mergedItemMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
  }, [mergedItemMap])

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
  const allItemRows = useMemo(() =>
    Object.entries(mergedItemMap).map(([name, v]) => ({ name, category: v.category, qty: v.qty, unit_price: v.unit_price, revenue: v.revenue })),
    [mergedItemMap]
  )

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

  // ── Operational: peak hours heatmap (revenue by hour) ────────────────────────
  const hourlyRevenue = useMemo(() => {
    const data = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, '0')}:00`, revenue: 0, orders: 0 }))
    for (const o of orders) {
      const h = new Date(o.opened_at).getHours()
      data[h].revenue += o.total
      data[h].orders++
    }
    return data
  }, [orders])

  // ── Operational: table turnover (avg minutes open per table) ─────────────────
  const tableTurnover = useMemo(() => {
    const map: Record<string, { totalMins: number; count: number }> = {}
    for (const o of orders) {
      if (!o.table_name || !o.closed_at) continue
      const mins = (new Date(o.closed_at).getTime() - new Date(o.opened_at).getTime()) / 60000
      if (mins <= 0 || mins > 600) continue // ignore bad data
      if (!map[o.table_name]) map[o.table_name] = { totalMins: 0, count: 0 }
      map[o.table_name].totalMins += mins
      map[o.table_name].count++
    }
    return Object.entries(map)
      .map(([table, v]) => ({ table, avgMins: Math.round(v.totalMins / v.count), orders: v.count }))
      .sort((a, b) => b.avgMins - a.avgMins)
  }, [orders])

  const overallAvgTurnover = useMemo(() => {
    if (!tableTurnover.length) return 0
    const total = tableTurnover.reduce((s, t) => s + t.avgMins * t.orders, 0)
    const count = tableTurnover.reduce((s, t) => s + t.orders, 0)
    return count > 0 ? Math.round(total / count) : 0
  }, [tableTurnover])

  // ── Operational: slow movers (menu items with 0 or low sales) ────────────────
  const slowMovers = useMemo(() => {
    const soldMap: Record<string, number> = {}
    for (const item of items) {
      soldMap[item.item_name] = (soldMap[item.item_name] ?? 0) + item.quantity
    }
    return allMenuItems
      .map(m => ({ name: m.name, category: m.category, qty: soldMap[m.name] ?? 0 }))
      .filter(m => m.qty < 3)
      .sort((a, b) => a.qty - b.qty)
  }, [items, allMenuItems])

  // ── Staff: void & discount rates ─────────────────────────────────────────────
  const staffVoidDiscount = useMemo(() => {
    const map: Record<string, { voids: number; voidValue: number; discounts: number; discountValue: number }> = {}
    for (const v of voids) {
      const name = v.server_name ?? 'Unknown'
      if (!map[name]) map[name] = { voids: 0, voidValue: 0, discounts: 0, discountValue: 0 }
      map[name].voids++
      map[name].voidValue += v.quantity * v.unit_price
    }
    for (const d of discountLogs) {
      const name = d.actor_name ?? 'Unknown'
      if (!map[name]) map[name] = { voids: 0, voidValue: 0, discounts: 0, discountValue: 0 }
      map[name].discounts++
      const amt = typeof d.payload?.discount_amount === 'number' ? d.payload.discount_amount : 0
      map[name].discountValue += amt
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.voidValue + b.discountValue - (a.voidValue + a.discountValue))
  }, [voids, discountLogs])

  // ── Cocktail analytics ───────────────────────────────────────────────────────
  // All-time top cocktails by qty
  const allTimeCocktailRankings = useMemo(() => {
    const map: Record<string, { qty: number; revenue: number }> = {}
    for (const it of allTimeItems) {
      if (!map[it.item_name]) map[it.item_name] = { qty: 0, revenue: 0 }
      map[it.item_name].qty += it.quantity
      map[it.item_name].revenue += it.quantity * it.unit_price
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
  }, [allTimeItems])

  // Monthly breakdown: { month: 'Aug 2026', topCocktail: string, topQty: number, totalQty: number, revenue: number }
  const monthlyBreakdown = useMemo(() => {
    const map: Record<string, Record<string, { qty: number; revenue: number }>> = {}
    for (const it of allTimeItems) {
      const d = new Date(it.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map[key]) map[key] = {}
      if (!map[key][it.item_name]) map[key][it.item_name] = { qty: 0, revenue: 0 }
      map[key][it.item_name].qty += it.quantity
      map[key][it.item_name].revenue += it.quantity * it.unit_price
    }
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, cocktails]) => {
        const entries = Object.entries(cocktails).sort((a, b) => b[1].qty - a[1].qty)
        const totalQty = entries.reduce((s, [, v]) => s + v.qty, 0)
        const totalRev = entries.reduce((s, [, v]) => s + v.revenue, 0)
        const [y, m] = key.split('-')
        const label = new Date(Number(y), Number(m) - 1).toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })
        return { key, label, topCocktail: entries[0]?.[0] ?? '—', topQty: entries[0]?.[1]?.qty ?? 0, totalQty, totalRev, entries }
      })
  }, [allTimeItems])

  // Weekly pattern: revenue and orders by day-of-week
  const weeklyPattern = useMemo(() => {
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const data = DAYS.map(d => ({ day: d, revenue: 0, orders: 0 }))
    for (const o of orders) {
      const dow = new Date(o.opened_at).getDay()
      data[dow].revenue += o.total
      data[dow].orders++
    }
    return data
  }, [orders])

  // Cocktail profitability: qty sold × margin per cocktail
  const cocktailProfitability = useMemo(() => {
    const soldMap: Record<string, number> = {}
    for (const it of allTimeItems) {
      soldMap[it.item_name] = (soldMap[it.item_name] ?? 0) + it.quantity
    }
    return cocktailCosts
      .map(c => {
        const qtySold = soldMap[c.name] ?? 0
        const margin = c.selling_price - c.total_cost
        const totalProfit = qtySold * margin
        const marginPct = c.selling_price > 0 ? (margin / c.selling_price) * 100 : 0
        return { name: c.name, qtySold, sellingPrice: c.selling_price, cost: c.total_cost, margin, marginPct, totalProfit }
      })
      .filter(c => c.qtySold > 0)
      .sort((a, b) => b.totalProfit - a.totalProfit)
  }, [allTimeItems, cocktailCosts])

  // Month-on-month revenue comparison — uses daily_sales which has full history back to June
  const momComparison = useMemo(() => {
    const revenueByMonth: Record<string, { total: number; cocktails: number; beer: number; wine: number; food: number; others: number }> = {}
    for (const s of dailySales) {
      const key = s.date.slice(0, 7) // 'YYYY-MM'
      if (!revenueByMonth[key]) revenueByMonth[key] = { total: 0, cocktails: 0, beer: 0, wine: 0, food: 0, others: 0 }
      revenueByMonth[key].total += s.total_revenue
      revenueByMonth[key].cocktails += s.cocktails_revenue ?? 0
      revenueByMonth[key].beer += s.beer_revenue ?? 0
      revenueByMonth[key].wine += s.wine_revenue ?? 0
      revenueByMonth[key].food += s.food_revenue ?? 0
      revenueByMonth[key].others += s.others_revenue ?? 0
    }
    const months = Object.keys(revenueByMonth).sort().reverse()
    return months.map(key => {
      const [y, m] = key.split('-')
      const prevKey = `${Number(y) - 1}-${m}`
      const thisData = revenueByMonth[key]
      const prevRev = revenueByMonth[prevKey]?.total ?? 0
      const pct = prevRev > 0 ? ((thisData.total - prevRev) / prevRev) * 100 : null
      const label = new Date(Number(y), Number(m) - 1).toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })
      return { label, key, thisRev: thisData.total, prevRev, pct, cocktails: thisData.cocktails, beer: thisData.beer, wine: thisData.wine, food: thisData.food, others: thisData.others }
    })
  }, [dailySales])

  // Selected month for cocktail drilldown
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const drilldownMonth = useMemo(() =>
    monthlyBreakdown.find(m => m.key === selectedMonth) ?? monthlyBreakdown[0] ?? null,
    [monthlyBreakdown, selectedMonth]
  )

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'items', label: 'Items Sold' },
    { id: 'payments', label: 'Payments' },
    { id: 'staff', label: 'Staff' },
    { id: 'operational', label: 'Operational' },
    { id: 'cocktails', label: 'Cocktails' },
    ...(isAdmin ? [{ id: 'voids' as Tab, label: 'Voids & Discounts' }] : []),
  ]

  return (
    <div className="space-y-6">
      <TopBar
        title="POS Reports"
        subtitle={PERIOD_LABELS[period]}
        actions={
          <div className="flex gap-1 bg-[#0D0D0F] border border-[#2A2A30] rounded-lg p-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  period === p
                    ? 'bg-[#8B5CF6] text-white'
                    : 'text-[#9896A4] hover:text-[#F0EEF6]'
                }`}
              >
                {p === 'all' ? 'All' : p === '1y' ? 'YTD' : p.toUpperCase()}
              </button>
            ))}
          </div>
        }
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

              {/* Void & discount rate per staff */}
              {isAdmin && staffVoidDiscount.length > 0 && (
                <div className="card overflow-x-auto">
                  <p className="section-title mb-1">Void & Discount Activity</p>
                  <p className="text-[#5A5865] text-xs mb-4">High rates may indicate training gaps or misuse</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                        <th className="text-left py-2 pr-4">Staff</th>
                        <th className="text-right py-2 px-4">Voids</th>
                        <th className="text-right py-2 px-4">Void Value</th>
                        <th className="text-right py-2 px-4">Discounts</th>
                        <th className="text-right py-2 pl-4">Discount Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffVoidDiscount.map((s, i) => (
                        <tr key={i} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                          <td className="py-2.5 pr-4 text-[#F0EEF6] font-medium">{s.name}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            <span className={s.voids > 3 ? 'text-rose-400 font-semibold' : 'text-[#9896A4]'}>{s.voids}</span>
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            <span className={s.voidValue > 50 ? 'text-rose-400 font-semibold' : 'text-[#9896A4]'}>{fmtRM(s.voidValue)}</span>
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            <span className={s.discounts > 3 ? 'text-amber-400 font-semibold' : 'text-[#9896A4]'}>{s.discounts}</span>
                          </td>
                          <td className="py-2.5 pl-4 text-right tabular-nums">
                            <span className={s.discountValue > 100 ? 'text-amber-400 font-semibold' : 'text-[#9896A4]'}>{fmtRM(s.discountValue)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

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

      {/* ── OPERATIONAL TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'operational' && (
        <div className="space-y-6">
          {/* Peak hours — revenue heatmap */}
          <div className="card">
            <p className="section-title mb-1">Peak Hours — Revenue by Hour</p>
            <p className="text-[#5A5865] text-xs mb-4">When your bar makes the most money</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourlyRevenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="hour" tick={{ fill: '#9896A4', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: '#9896A4', fontSize: 11 }} axisLine={false} tickLine={false} width={52} tickFormatter={v => v > 0 ? `${(v / 1000).toFixed(0)}k` : '0'} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#8B5CF6', opacity: 0.08 }} />
                <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                  {hourlyRevenue.map((entry, i) => {
                    const max = Math.max(...hourlyRevenue.map(h => h.revenue))
                    const pct = max > 0 ? entry.revenue / max : 0
                    const fill = pct > 0.7 ? '#a78bfa' : pct > 0.4 ? '#7c3aed' : pct > 0.1 ? '#4c1d95' : '#2A2A30'
                    return <Cell key={i} fill={fill} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 justify-end">
              {[['#a78bfa', 'Peak'], ['#7c3aed', 'Busy'], ['#4c1d95', 'Slow'], ['#2A2A30', 'Quiet']].map(([color, label]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
                  <span className="text-[#5A5865] text-xs">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Table turnover */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="section-title">Table Turnover</p>
                <p className="text-[#5A5865] text-xs mt-0.5">Average minutes from order open to close</p>
              </div>
              <div className="text-right">
                <p className="text-[#9896A4] text-xs uppercase tracking-wider">Overall Avg</p>
                <p className="text-[#A78BFA] font-bold text-xl tabular-nums">{overallAvgTurnover} min</p>
              </div>
            </div>
            {tableTurnover.length === 0 ? (
              <p className="text-[#5A5865] text-sm text-center py-6">No closed orders with timing data</p>
            ) : (
              <div className="space-y-2">
                {tableTurnover.map(t => {
                  const pct = overallAvgTurnover > 0 ? Math.min((t.avgMins / (overallAvgTurnover * 1.5)) * 100, 100) : 50
                  const color = t.avgMins > overallAvgTurnover * 1.3 ? 'bg-rose-500' : t.avgMins < overallAvgTurnover * 0.7 ? 'bg-emerald-500' : 'bg-[#7B5EA7]'
                  return (
                    <div key={t.table} className="flex items-center gap-3">
                      <span className="text-[#F0EEF6] text-sm w-20 shrink-0 truncate">{t.table}</span>
                      <div className="flex-1 h-2 bg-[#1A1A1E] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[#9896A4] text-xs tabular-nums w-16 text-right">{t.avgMins} min</span>
                      <span className="text-[#5A5865] text-xs w-14 text-right">{t.orders} orders</span>
                    </div>
                  )
                })}
              </div>
            )}
            <p className="text-[#5A5865] text-xs mt-4">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Fast turnover &nbsp;
              <span className="inline-block w-2 h-2 rounded-full bg-[#7B5EA7] mr-1 ml-2" />Normal &nbsp;
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1 ml-2" />Long sit
            </p>
          </div>

          {/* Slow movers */}
          <div className="card">
            <div className="mb-4">
              <p className="section-title">Slow Movers</p>
              <p className="text-[#5A5865] text-xs mt-0.5">Active menu items sold fewer than 3 times in the last 30 days — consider removing or promoting</p>
            </div>
            {slowMovers.length === 0 ? (
              <p className="text-emerald-400 text-sm text-center py-6">All menu items are selling well!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                      <th className="text-left py-2 pr-4">Item</th>
                      <th className="text-left py-2 pr-4">Category</th>
                      <th className="text-right py-2 pl-4">Sold (30d)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slowMovers.map((m, i) => (
                      <tr key={i} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                        <td className="py-2.5 pr-4 text-[#F0EEF6]">{m.name}</td>
                        <td className="py-2.5 pr-4">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/20">
                            {m.category}
                          </span>
                        </td>
                        <td className="py-2.5 pl-4 text-right">
                          <span className={`font-bold tabular-nums ${m.qty === 0 ? 'text-rose-400' : 'text-amber-400'}`}>{m.qty}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COCKTAILS TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'cocktails' && (
        <div className="space-y-6">

          {/* All-time top cocktails */}
          <div className="card">
            <p className="section-title mb-4">All-Time Top Cocktails</p>
            {allTimeCocktailRankings.length === 0 ? (
              <p className="text-[#5A5865] text-sm">No cocktail data yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                      <th className="text-left py-2 w-8">#</th>
                      <th className="text-left py-2 pr-4">Cocktail</th>
                      <th className="text-right py-2 px-4">Total Sold</th>
                      <th className="text-right py-2 pl-4">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTimeCocktailRankings.slice(0, 15).map((c, i) => (
                      <tr key={c.name} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                        <td className="py-2.5 text-[#5A5865] text-xs tabular-nums">{i + 1}</td>
                        <td className="py-2.5 pr-4 text-[#F0EEF6] font-medium">
                          {i === 0 && <span className="text-amber-400 mr-1.5">★</span>}
                          {c.name}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[#A78BFA] font-semibold">{c.qty}</td>
                        <td className="py-2.5 pl-4 text-right tabular-nums text-emerald-400 font-medium">{fmtRM(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Monthly drilldown */}
          <div className="card">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <p className="section-title">Monthly Cocktail Breakdown</p>
              <select
                className="input text-sm py-1.5 w-auto"
                value={selectedMonth ?? monthlyBreakdown[0]?.key ?? ''}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                {monthlyBreakdown.map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
            {drilldownMonth ? (
              <>
                <div className="flex gap-4 mb-4 flex-wrap">
                  <div>
                    <p className="text-[#5A5865] text-xs">Total Cocktails Sold</p>
                    <p className="text-[#F0EEF6] font-bold text-xl tabular-nums">{drilldownMonth.totalQty}</p>
                  </div>
                  <div>
                    <p className="text-[#5A5865] text-xs">Cocktail Revenue</p>
                    <p className="text-emerald-400 font-bold text-xl tabular-nums">{fmtRM(drilldownMonth.totalRev)}</p>
                  </div>
                  <div>
                    <p className="text-[#5A5865] text-xs">Top Seller</p>
                    <p className="text-amber-400 font-bold text-base">★ {drilldownMonth.topCocktail} ({drilldownMonth.topQty})</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                        <th className="text-left py-2 w-8">#</th>
                        <th className="text-left py-2 pr-4">Cocktail</th>
                        <th className="text-right py-2 px-4">Qty</th>
                        <th className="text-right py-2 px-4">% of Month</th>
                        <th className="text-right py-2 pl-4">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drilldownMonth.entries.map(([name, v], i) => (
                        <tr key={name} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                          <td className="py-2.5 text-[#5A5865] text-xs tabular-nums">{i + 1}</td>
                          <td className="py-2.5 pr-4 text-[#F0EEF6]">{name}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[#A78BFA] font-semibold">{v.qty}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[#9896A4]">
                            {drilldownMonth.totalQty > 0 ? ((v.qty / drilldownMonth.totalQty) * 100).toFixed(1) : '0'}%
                          </td>
                          <td className="py-2.5 pl-4 text-right tabular-nums text-emerald-400">{fmtRM(v.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-[#5A5865] text-sm">No data available</p>
            )}
          </div>

          {/* Weekly pattern */}
          <div className="card">
            <p className="section-title mb-4">Revenue by Day of Week (Last 30 Days)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyPattern} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: '#9896A4', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9896A4', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `RM${(v / 1000).toFixed(0)}k`} width={52} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#8B5CF6', opacity: 0.08 }} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {weeklyPattern.map((entry, i) => (
                    <Cell key={i} fill={entry.revenue === Math.max(...weeklyPattern.map(d => d.revenue)) ? '#F59E0B' : '#8B5CF6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[#5A5865] text-xs mt-2 text-center">Gold bar = highest revenue day</p>
          </div>

          {/* Cocktail profitability */}
          {cocktailProfitability.length > 0 && (
            <div className="card">
              <p className="section-title mb-1">Cocktail Profitability (All-Time)</p>
              <p className="text-[#5A5865] text-xs mb-4">Total profit = units sold × (selling price − cost). Sorted by total profit generated.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 600 }}>
                  <thead>
                    <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                      <th className="text-left py-2 pr-4">Cocktail</th>
                      <th className="text-right py-2 px-3">Sold</th>
                      <th className="text-right py-2 px-3">Price</th>
                      <th className="text-right py-2 px-3">Cost</th>
                      <th className="text-right py-2 px-3">Margin</th>
                      <th className="text-right py-2 pl-4">Total Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cocktailProfitability.map((c, i) => (
                      <tr key={c.name} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                        <td className="py-2.5 pr-4 text-[#F0EEF6] font-medium">{c.name}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-[#9896A4]">{c.qtySold}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-[#9896A4]">{fmtRM(c.sellingPrice)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-rose-400">{fmtRM(c.cost)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${c.marginPct >= 60 ? 'bg-emerald-500/10 text-emerald-400' : c.marginPct >= 40 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {c.marginPct.toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-2.5 pl-4 text-right tabular-nums text-emerald-400 font-semibold">{fmtRM(c.totalProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Month-on-month comparison */}
          <div className="card">
            <p className="section-title mb-1">Monthly Revenue History</p>
            <p className="text-[#5A5865] text-xs mb-4">From your End of Night submissions. % change vs same month last year.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 700 }}>
                <thead>
                  <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                    <th className="text-left py-2 pr-4">Month</th>
                    <th className="text-right py-2 px-3">Total</th>
                    <th className="text-right py-2 px-3">Cocktails</th>
                    <th className="text-right py-2 px-3">Wine</th>
                    <th className="text-right py-2 px-3">Others</th>
                    <th className="text-right py-2 px-3">vs Last Year</th>
                    <th className="text-right py-2 pl-4">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {momComparison.map(m => (
                    <tr key={m.key} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                      <td className="py-2.5 pr-4 text-[#F0EEF6] font-medium">{m.label}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-emerald-400 font-semibold">{fmtRM(m.thisRev)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#A78BFA]">{m.cocktails > 0 ? fmtRM(m.cocktails) : '—'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-sky-400">{m.wine > 0 ? fmtRM(m.wine) : '—'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#9896A4]">{m.others > 0 ? fmtRM(m.others) : '—'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#5A5865]">{m.prevRev > 0 ? fmtRM(m.prevRev) : '—'}</td>
                      <td className="py-2.5 pl-4 text-right">
                        {m.pct === null ? (
                          <span className="text-[#5A5865] text-xs">—</span>
                        ) : m.pct > 0 ? (
                          <span className="text-emerald-400 font-medium text-xs flex items-center justify-end gap-1">
                            <TrendingUp size={12} />+{m.pct.toFixed(1)}%
                          </span>
                        ) : m.pct < 0 ? (
                          <span className="text-rose-400 font-medium text-xs flex items-center justify-end gap-1">
                            <TrendingDown size={12} />{m.pct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[#9896A4] text-xs flex items-center justify-end gap-1">
                            <Minus size={12} />0%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
