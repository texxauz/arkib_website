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

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL REPORTING DEFINITIONS
//
// Gross Sales      = SUM(pos_orders.subtotal)
//                    subtotal is the pre-discount order total (item prices × qty,
//                    minus any per-item discounts already applied at the item level)
//
// Discounts        = SUM(pos_orders.discount_amount)
//                    order-level discounts only (Staff Discount, VIP, etc.)
//
// Net Sales        = Gross Sales − Discounts
//                  = SUM(pos_orders.subtotal − pos_orders.discount_amount)
//
// Service Charge   = SUM(pos_orders.service_charge)
//                    currently 0 (service_charge_enabled = false in pos_config)
//
// Revenue          = SUM(pos_orders.total)
//                  = Net Sales + Service Charge + Tax
//                    For pre-POS dates (before Jul 11 2026): daily_sales.total_revenue
//
// Voids            = SUM(voided_item.quantity × unit_price) for items where voided_at IS NOT NULL
//
// COGS (cocktails) = cocktails.total_cost × qty_sold
//
// Contribution     = Selling Price − COGS (RM; used as profitability axis in menu engineering)
// Margin %         = Contribution / Selling Price × 100 (supporting metric only)
// Theoretical      = Contribution × qty_sold  (uses CURRENT recipe cost — not historical unit_cost)
// Contribution       Historical actual contribution requires pos_order_items.unit_cost (handled separately)
// ─────────────────────────────────────────────────────────────────────────────

type Order = {
  id: string
  table_name: string | null
  covers: number
  opened_at: string
  closed_at: string | null
  subtotal: number
  total: number
  discount_amount: number
  discount_label: string | null
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
  order_id?: string | null  // present at runtime (joined from pos_order_items select); used for void incidence
}

type DiscountLog = {
  payload: Record<string, unknown> | null
  created_at: string
  actor_name?: string | null
  entity_id?: string | null  // orderId for discount.applied events — used for per-staff unique-order incidence
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
  // P2.7 Report Health — added to page.tsx SELECT
  is_balanced?: boolean | null
  total_collected?: number | null
}

type CocktailSaleRow = {
  date: string
  cocktail_name: string
  quantity: number
  unit_price: number
  category: string | null
}

type Period = 'today' | 'yesterday' | '7d' | '30d' | '90d' | '6m' | 'mtd' | 'ytd' | 'all'

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  '6m': 'Last 6 Months',
  mtd: 'Month to Date',
  ytd: 'Year to Date',
  all: 'All Time',
}

const PERIOD_SHORT: Record<Period, string> = {
  today: 'Today', yesterday: 'Yesterday', '7d': '7D', '30d': '30D',
  '90d': '90D', '6m': '6M', mtd: 'MTD', ytd: 'YTD', all: 'All',
}

interface PeriodRange {
  start: Date | null
  end: Date | null       // exclusive upper bound (null = open)
  prevStart: Date | null
  prevEnd: Date | null   // exclusive
  compLabel: string      // e.g. "vs Yesterday"
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getPeriodRange(period: Period, now: Date): PeriodRange {
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const today = sod(now)
  const tomorrow = new Date(today.getTime() + 86400000)
  const yesterday = new Date(today.getTime() - 86400000)
  const D = 86400000

  switch (period) {
    case 'today':
      return { start: today, end: tomorrow, prevStart: yesterday, prevEnd: today, compLabel: 'vs Yesterday' }
    case 'yesterday':
      return { start: yesterday, end: today, prevStart: new Date(yesterday.getTime() - D), prevEnd: yesterday, compLabel: 'vs Day Before' }
    case '7d': {
      const s = new Date(now.getTime() - 7 * D)
      return { start: s, end: null, prevStart: new Date(now.getTime() - 14 * D), prevEnd: s, compLabel: 'vs Prior 7D' }
    }
    case '30d': {
      const s = new Date(now.getTime() - 30 * D)
      return { start: s, end: null, prevStart: new Date(now.getTime() - 60 * D), prevEnd: s, compLabel: 'vs Prior 30D' }
    }
    case '90d': {
      const s = new Date(now.getTime() - 90 * D)
      return { start: s, end: null, prevStart: new Date(now.getTime() - 180 * D), prevEnd: s, compLabel: 'vs Prior 90D' }
    }
    case '6m': {
      const s = new Date(now.getTime() - 182 * D)
      return { start: s, end: null, prevStart: new Date(now.getTime() - 364 * D), prevEnd: s, compLabel: 'vs Prior 6M' }
    }
    case 'mtd': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1)
      const elapsedMs = today.getTime() - s.getTime()
      const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      return { start: s, end: null, prevStart: prevMonthStart, prevEnd: new Date(prevMonthStart.getTime() + elapsedMs), compLabel: 'vs Prev MTD' }
    }
    case 'ytd': {
      const s = new Date(today.getFullYear(), 0, 1)
      const elapsedMs = today.getTime() - s.getTime()
      const prevYearStart = new Date(today.getFullYear() - 1, 0, 1)
      return { start: s, end: null, prevStart: prevYearStart, prevEnd: new Date(prevYearStart.getTime() + elapsedMs), compLabel: 'vs Prev YTD' }
    }
    case 'all':
      return { start: null, end: null, prevStart: null, prevEnd: null, compLabel: '' }
  }
}

function inRange(date: Date, start: Date | null, end: Date | null): boolean {
  if (start && date < start) return false
  if (end && date >= end) return false
  return true
}

function calcDelta(curr: number, prev: number): { pct: number; dir: 'up' | 'down' | 'flat' } | null {
  if (prev === 0) return null
  const pct = ((curr - prev) / prev) * 100
  return { pct, dir: pct > 1 ? 'up' : pct < -1 ? 'down' : 'flat' }
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


export function POSReportsClient({ orders: allOrders, items: allItems, payments: allPayments, voids: allVoids, discountLogs: allDiscountLogs, allMenuItems, cocktailCosts, dailySales, cocktailSales: allCocktailSales, isAdmin }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [itemSearch, setItemSearch] = useState('')
  const [itemSort, setItemSort] = useState<'qty' | 'revenue'>('revenue')
  const [period, setPeriod] = useState<Period>('30d')
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders' | 'covers' | 'avgSpend'>('revenue')
  const [heatmapMetric, setHeatmapMetric] = useState<'revenue' | 'orders' | 'covers' | 'revPerCover'>('revenue')

  // ── Period range ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [period])
  const range = useMemo(() => getPeriodRange(period, now), [period, now])

  // ── Current period filtering ─────────────────────────────────────────────────
  const orders = useMemo(() => allOrders.filter(o => inRange(new Date(o.opened_at), range.start, range.end)), [allOrders, range])
  const items = useMemo(() => allItems.filter(i => inRange(new Date(i.created_at), range.start, range.end)), [allItems, range])
  const payments = useMemo(() => allPayments.filter(p => inRange(new Date(p.captured_at), range.start, range.end)), [allPayments, range])
  const voids = useMemo(() => allVoids.filter(v => inRange(new Date(v.created_at), range.start, range.end)), [allVoids, range])
  const discountLogs = useMemo(() => allDiscountLogs.filter(d => inRange(new Date(d.created_at), range.start, range.end)), [allDiscountLogs, range])
  const filteredDailySales = useMemo(() => {
    const s = range.start ? localDateStr(range.start) : null
    const e = range.end ? localDateStr(range.end) : null
    return dailySales.filter(d => (!s || d.date >= s) && (!e || d.date < e))
  }, [dailySales, range])
  const cocktailSales = useMemo(() => {
    const s = range.start ? localDateStr(range.start) : null
    const e = range.end ? localDateStr(range.end) : null
    return allCocktailSales.filter(d => (!s || d.date >= s) && (!e || d.date < e))
  }, [allCocktailSales, range])

  // ── Previous period filtering (for KPI comparison) ───────────────────────────
  const prevOrders = useMemo(() => allOrders.filter(o => inRange(new Date(o.opened_at), range.prevStart, range.prevEnd)), [allOrders, range])
  const prevDailySales = useMemo(() => {
    const s = range.prevStart ? localDateStr(range.prevStart) : null
    const e = range.prevEnd ? localDateStr(range.prevEnd) : null
    return dailySales.filter(d => (!s || d.date >= s) && (!e || d.date < e))
  }, [dailySales, range])
  const prevVoids = useMemo(() => allVoids.filter(v => inRange(new Date(v.created_at), range.prevStart, range.prevEnd)), [allVoids, range])
  const prevDiscountLogs = useMemo(() => allDiscountLogs.filter(d => inRange(new Date(d.created_at), range.prevStart, range.prevEnd)), [allDiscountLogs, range])
  // pos_order_items for the previous period — used for cocktail trend calculation
  const prevPeriodItems = useMemo(() => allItems.filter(i => inRange(new Date(i.created_at), range.prevStart, range.prevEnd)), [allItems, range])
  // POS started July 11 2026 — EON cocktail_sales used only for pre-POS dates to avoid double-counting
  const POS_START = '2026-07-11'

  // All-time cocktail items: used for all-time rankings and monthly breakdown (ignores period filter)
  const allTimeItems = useMemo(() => {
    const posItems = allItems
      .filter(i => ['cocktail', 'house_cocktail', 'house cocktail', 'classic', 'classics'].includes((i.category ?? '').toLowerCase()))
      .map(i => ({ item_name: i.item_name, category: i.category, quantity: i.quantity, unit_price: i.unit_price, created_at: i.created_at }))
    const eonItems = allCocktailSales
      .filter(cs => cs.date < POS_START)
      .map(cs => ({ item_name: cs.cocktail_name, category: cs.category, quantity: cs.quantity, unit_price: cs.unit_price, created_at: cs.date + 'T00:00:00' }))
    return [...posItems, ...eonItems]
  }, [allItems, allCocktailSales])

  // Period-filtered cocktail items: used for profitability (respects selected period)
  const periodCocktailItems = useMemo(() => {
    const cocktailCategories = ['cocktail', 'house_cocktail', 'house cocktail', 'classic', 'classics']
    const posItems = items  // already period-filtered
      .filter(i => cocktailCategories.includes((i.category ?? '').toLowerCase()))
      .map(i => ({ item_name: i.item_name, quantity: i.quantity, unit_price: i.unit_price }))
    const eonItems = cocktailSales  // already period-filtered
      .filter(cs => cs.date < POS_START)
      .map(cs => ({ item_name: cs.cocktail_name, quantity: cs.quantity, unit_price: cs.unit_price }))
    return [...posItems, ...eonItems]
  }, [items, cocktailSales])

  // ── Core stats ───────────────────────────────────────────────────────────────
  // Revenue (totalRevenue): daily_sales.total_revenue — covers full history including pre-POS
  // Gross/Net Sales: pos_orders — POS-tracked orders only (Jul 11 2026+)
  const stats = useMemo(() => {
    const totalRevenue = filteredDailySales.reduce((s, d) => s + d.total_revenue, 0)
    const totalOrders = orders.length
    const totalCovers = orders.reduce((s, o) => s + o.covers, 0)
    // Gross Sales = subtotal (pre-order-discount; per-item discounts already reflected in subtotal)
    const grossSales = orders.reduce((s, o) => s + (o.subtotal ?? o.total), 0)
    // Discounts = order-level discount applied
    const totalDiscounts = orders.reduce((s, o) => s + o.discount_amount, 0)
    // Net Sales = Gross Sales - Discounts
    const netSales = grossSales - totalDiscounts
    // Service charge (currently 0 — disabled in config)
    const totalServiceCharge = orders.reduce((s, o) => s + (o.service_charge ?? 0), 0)
    // Avg spend per order = what customer actually paid (pos_orders.total)
    const avgSpend = totalOrders > 0 ? orders.reduce((s, o) => s + o.total, 0) / totalOrders : 0
    // Revenue per cover = pos_orders.total / pos_orders.covers (same source both sides — no daily_sales mixing)
    // Only reflects POS-era nights (Jul 11+). Pre-POS nights have no cover data; they are simply absent.
    const revenuePerCover = totalCovers > 0 ? orders.reduce((s, o) => s + o.total, 0) / totalCovers : 0
    return { totalRevenue, totalOrders, totalCovers, grossSales, totalDiscounts, netSales, totalServiceCharge, avgSpend, revenuePerCover }
  }, [filteredDailySales, orders])

  // ── Previous period stats (for KPI deltas) ───────────────────────────────────
  const prevStats = useMemo(() => {
    if (!range.prevStart) return null
    const totalRevenue = prevDailySales.reduce((s, d) => s + d.total_revenue, 0)
    const totalOrders = prevOrders.length
    const totalCovers = prevOrders.reduce((s, o) => s + o.covers, 0)
    const grossSales = prevOrders.reduce((s, o) => s + (o.subtotal ?? o.total), 0)
    const totalDiscounts = prevOrders.reduce((s, o) => s + o.discount_amount, 0)
    const netSales = grossSales - totalDiscounts
    const avgSpend = totalOrders > 0 ? prevOrders.reduce((s, o) => s + o.total, 0) / totalOrders : 0
    const revenuePerCover = totalCovers > 0 ? prevOrders.reduce((s, o) => s + o.total, 0) / totalCovers : 0
    return { totalRevenue, totalOrders, totalCovers, grossSales, netSales, avgSpend, revenuePerCover }
  }, [prevOrders, prevDailySales, range])

  // ── Daily performance chart data ──────────────────────────────────────────────
  // Revenue metric: daily_sales.total_revenue (canonical aggregate).
  // Orders / Covers / Avg Spend metrics: pos_orders (transaction-level).
  // Avg Spend = SUM(pos_orders.total) / COUNT(orders) per day — no daily_sales mixing.
  const dailyPerfData = useMemo(() => {
    if (chartMetric === 'revenue') {
      return [...filteredDailySales]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(s => ({ date: fmtDate(s.date), value: s.total_revenue }))
    }
    const byDate: Record<string, { orders: number; covers: number; revenue: number }> = {}
    for (const o of orders) {
      const d = localDateStr(new Date(o.opened_at))
      if (!byDate[d]) byDate[d] = { orders: 0, covers: 0, revenue: 0 }
      byDate[d].orders++
      byDate[d].covers += o.covers
      byDate[d].revenue += o.total
    }
    return Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date: fmtDate(date),
        value: chartMetric === 'orders' ? v.orders
          : chartMetric === 'covers' ? v.covers
          : v.orders > 0 ? v.revenue / v.orders : 0,
      }))
  }, [filteredDailySales, orders, chartMetric])

  // ── Merged item sales: pos_order_items (Jul 11+) + cocktail_sales pre-POS (Jun) ──
  const mergedItemMap = useMemo(() => {
    const map: Record<string, { category: string | null; qty: number; unit_price: number; revenue: number }> = {}
    for (const item of items) {
      if (item.voided_at) continue
      if (!map[item.item_name]) map[item.item_name] = { category: item.category, qty: 0, unit_price: item.unit_price, revenue: 0 }
      map[item.item_name].qty += item.quantity
      map[item.item_name].revenue += item.quantity * item.unit_price - (item.discount ?? 0)
    }
    // Add EON data only for pre-POS dates (June) to avoid double-counting
    for (const cs of cocktailSales) {
      if (cs.date >= POS_START) continue
      if (!map[cs.cocktail_name]) map[cs.cocktail_name] = { category: cs.category, qty: 0, unit_price: cs.unit_price, revenue: 0 }
      map[cs.cocktail_name].qty += cs.quantity
      map[cs.cocktail_name].revenue += cs.quantity * cs.unit_price
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

  // ── Day×Hour heatmap data (Mon=0 … Sun=6) ────────────────────────────────────
  // IMPORTANT: heatmap revenue = pos_orders.total attributed by order timestamp.
  // This differs from the canonical daily Revenue KPI (daily_sales.total_revenue).
  // If a manual EON correction is added to daily_sales, the heatmap total for that day
  // will not match the canonical daily figure — that is expected and acceptable.
  const heatmapData = useMemo(() => {
    const grid = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ revenue: 0, orders: 0, covers: 0 }))
    )
    for (const o of orders) {
      const d = new Date(o.opened_at)
      const dow = (d.getDay() + 6) % 7  // JS Sun=0 → Mon=0
      const h = d.getHours()
      grid[dow][h].revenue += o.total   // pos_orders.total (POS-era only)
      grid[dow][h].orders++
      grid[dow][h].covers += o.covers   // pos_orders.covers
    }
    return grid
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

  // ── Operational: operating hours (hours with at least 1 order) ───────────────
  const operatingHours = useMemo(() => {
    const hours: number[] = []
    for (let h = 0; h < 24; h++) {
      if (heatmapData.some(row => row[h].orders > 0)) hours.push(h)
    }
    return hours
  }, [heatmapData])

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

  // Cocktail profitability: uses period-filtered items so the table matches the selected period
  const cocktailProfitability = useMemo(() => {
    const soldMap: Record<string, number> = {}
    for (const it of periodCocktailItems) {
      soldMap[it.item_name] = (soldMap[it.item_name] ?? 0) + it.quantity
    }
    return cocktailCosts
      .map(c => {
        const qtySold = soldMap[c.name] ?? 0
        // Contribution Margin RM = Selling Price − current recipe cost (cocktails.total_cost snapshot)
        const margin = c.selling_price - c.total_cost
        // Theoretical Contribution = margin × qty sold using CURRENT recipe cost.
        // Not actual historical profit — actual profit would require pos_order_items.unit_cost.
        const theoreticalContribution = qtySold * margin
        const cogsPercent = c.selling_price > 0 ? (c.total_cost / c.selling_price) * 100 : 0
        const marginPct = 100 - cogsPercent
        return { name: c.name, qtySold, sellingPrice: c.selling_price, cost: c.total_cost, margin, cogsPercent, marginPct, theoreticalContribution }
      })
      .filter(c => c.qtySold > 0)
      .sort((a, b) => b.theoreticalContribution - a.theoreticalContribution)
  }, [periodCocktailItems, cocktailCosts])

  // ── Menu Engineering: Popularity × Contribution Margin quadrant ──────────────
  // Profitability axis = RM contribution margin (selling price − current recipe cost)
  // NOT margin % — a high-price cocktail contributing RM45 ranks above one contributing RM32
  // even if the latter has a higher margin %.
  const menuEngineering = useMemo(() => {
    if (cocktailProfitability.length < 2) return []

    // Previous period cocktail quantities (for Trend column)
    const cocktailCategories = ['cocktail', 'house_cocktail', 'house cocktail', 'classic', 'classics']
    const prevSoldMap: Record<string, number> = {}
    for (const i of prevPeriodItems) {
      if (!cocktailCategories.includes((i.category ?? '').toLowerCase())) continue
      prevSoldMap[i.item_name] = (prevSoldMap[i.item_name] ?? 0) + i.quantity
    }
    // EON cocktail_sales for pre-POS dates in the prev window
    if (range.prevStart) {
      const ps = localDateStr(range.prevStart)
      const pe = range.prevEnd ? localDateStr(range.prevEnd) : null
      for (const cs of allCocktailSales) {
        if (cs.date < POS_START && cs.date >= ps && (!pe || cs.date < pe)) {
          prevSoldMap[cs.cocktail_name] = (prevSoldMap[cs.cocktail_name] ?? 0) + cs.quantity
        }
      }
    }

    const qtys = [...cocktailProfitability].map(c => c.qtySold).sort((a, b) => a - b)
    const margins = [...cocktailProfitability].map(c => c.margin).sort((a, b) => a - b)
    const medQty = qtys[Math.floor(qtys.length / 2)]
    const medMargin = margins[Math.floor(margins.length / 2)]

    return cocktailProfitability.map(c => {
      const highQty = c.qtySold >= medQty
      const highMargin = c.margin >= medMargin
      const cls: 'Star' | 'Workhorse' | 'Puzzle' | 'Dog' =
        highQty && highMargin ? 'Star' :
        highQty ? 'Workhorse' :
        highMargin ? 'Puzzle' : 'Dog'

      // Trend vs previous period (by qty sold)
      const prevQty = prevSoldMap[c.name] ?? 0
      let trend: string
      if (!range.prevStart) {
        trend = '—'
      } else if (prevQty === 0 && c.qtySold > 0) {
        trend = 'New'
      } else if (prevQty === 0) {
        trend = '—'
      } else {
        const pct = ((c.qtySold - prevQty) / prevQty) * 100
        trend = pct > 1 ? `↑ ${pct.toFixed(0)}%` : pct < -1 ? `↓ ${Math.abs(pct).toFixed(0)}%` : '—'
      }

      return { ...c, cls, medQty, medMargin, prevQty, trend }
    })
  }, [cocktailProfitability, prevPeriodItems, allCocktailSales, range])

  // ── Things to Review: deterministic observations ──────────────────────────────
  const thingsToReview = useMemo(() => {
    const obs: { severity: 'warning' | 'info' | 'positive'; text: string }[] = []
    const MIN = 5
    const hasComp = !!prevStats && orders.length >= MIN && prevOrders.length >= MIN

    if (hasComp && prevStats) {
      // Revenue change
      const revDelta = calcDelta(stats.totalRevenue, prevStats.totalRevenue)
      if (revDelta && Math.abs(revDelta.pct) >= 10) {
        obs.push({
          severity: revDelta.dir === 'up' ? 'positive' : 'warning',
          text: `Revenue ${revDelta.dir === 'up' ? 'up' : 'down'} ${Math.abs(revDelta.pct).toFixed(0)}% ${range.compLabel.toLowerCase()} — ${fmtRM(stats.totalRevenue)} vs ${fmtRM(prevStats.totalRevenue)}`,
        })
      }
      // Rev/cover change
      if (stats.totalCovers >= MIN && prevStats.totalCovers >= MIN) {
        const rpcDelta = calcDelta(stats.revenuePerCover, prevStats.revenuePerCover)
        if (rpcDelta && rpcDelta.dir === 'down' && rpcDelta.pct <= -10) {
          obs.push({ severity: 'warning', text: `Revenue per cover down ${Math.abs(rpcDelta.pct).toFixed(0)}% ${range.compLabel.toLowerCase()} — check upselling (${fmtRM(stats.revenuePerCover)} vs ${fmtRM(prevStats.revenuePerCover)})` })
        }
      }
      // Order count change
      const ordDelta = calcDelta(stats.totalOrders, prevStats.totalOrders)
      if (ordDelta && ordDelta.dir === 'down' && ordDelta.pct <= -20) {
        obs.push({ severity: 'warning', text: `Order count down ${Math.abs(ordDelta.pct).toFixed(0)}% ${range.compLabel.toLowerCase()} (${stats.totalOrders} vs ${prevStats.totalOrders} orders)` })
      }
    }

    // Void incidence = % of orders that contained at least one voided item (by unique order_id)
    // Uses order_id present at runtime from pos_order_items select; typed optionally.
    if (orders.length >= 10) {
      const ordersWithVoids = new Set(voids.map(v => v.order_id).filter(Boolean))
      const voidIncidence = ordersWithVoids.size / orders.length
      if (voidIncidence > 0.10) {
        obs.push({ severity: 'warning', text: `Void incidence: ${(voidIncidence * 100).toFixed(0)}% of orders had a voided item (${ordersWithVoids.size} orders, ${voids.length} void lines) — review with staff` })
      }
    }

    // Discount incidence = % of orders that received a discount event
    if (orders.length >= 10 && discountLogs.length > 0) {
      const discountIncidence = discountLogs.length / orders.length
      if (discountIncidence > 0.20) {
        obs.push({ severity: 'info', text: `Discount incidence: discounts applied on ${(discountIncidence * 100).toFixed(0)}% of orders (${discountLogs.length} events)` })
      }
    }

    const order = { warning: 0, info: 1, positive: 2 } as const
    return obs.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 5)
  }, [orders, prevOrders, voids, discountLogs, stats, prevStats, range])

  // ── P2.1: Revenue driver interpretation ──────────────────────────────────────
  const revenueDriver = useMemo(() => {
    if (!prevStats || !range.prevStart) return null
    const MIN = 5
    if (orders.length < MIN || prevOrders.length < MIN) return null
    const revDelta = calcDelta(stats.totalRevenue, prevStats.totalRevenue)
    if (!revDelta || revDelta.dir === 'flat') return null
    const enoughCovers = stats.totalCovers >= MIN && prevStats.totalCovers >= MIN
    const coversDelta = enoughCovers ? calcDelta(stats.totalCovers, prevStats.totalCovers) : null
    const rpcDelta = enoughCovers ? calcDelta(stats.revenuePerCover, prevStats.revenuePerCover) : null
    const pct = Math.abs(revDelta.pct).toFixed(0)
    const dir = revDelta.dir
    if (!coversDelta || !rpcDelta) {
      return { text: `Revenue ${dir === 'up' ? 'up' : 'down'} ${pct}% ${range.compLabel.toLowerCase()}.`, dir }
    }
    const coversUp = coversDelta.dir === 'up'
    const rpcUp = rpcDelta.dir === 'up'
    const cPct = Math.abs(coversDelta.pct).toFixed(0)
    const rPct = Math.abs(rpcDelta.pct).toFixed(0)
    let text = ''
    if (dir === 'up') {
      if (coversUp && rpcUp)
        text = `Revenue ↑ ${pct}% — driven by both higher guest volume (+${cPct}%) and higher spend per guest (+${rPct}%).`
      else if (coversUp)
        text = `Revenue ↑ ${pct}% — guest volume up (+${cPct}%), but spend per guest down (−${rPct}%).`
      else
        text = `Revenue ↑ ${pct}% — spend per guest up (+${rPct}%) despite fewer covers (−${cPct}%).`
    } else {
      if (!coversUp && !rpcUp)
        text = `Revenue ↓ ${pct}% — fewer covers (−${cPct}%) and lower spend per guest (−${rPct}%).`
      else if (!coversUp)
        text = `Revenue ↓ ${pct}% — fewer covers (−${cPct}%), partly offset by higher spend per guest (+${rPct}%).`
      else
        text = `Revenue ↓ ${pct}% — lower spend per guest (−${rPct}%) despite more covers (+${cPct}%).`
    }
    return { text, dir }
  }, [stats, prevStats, orders, prevOrders, range])

  // ── P2.2: Category performance ────────────────────────────────────────────────
  const categoryStats = useMemo(() => {
    const CATS = [
      { key: 'cocktails_revenue' as const, label: 'Cocktails', color: '#A78BFA' },
      { key: 'beer_revenue' as const, label: 'Beer', color: '#F59E0B' },
      { key: 'wine_revenue' as const, label: 'Wine', color: '#38bdf8' },
      { key: 'food_revenue' as const, label: 'Food', color: '#FB923C' },
      { key: 'others_revenue' as const, label: 'Others', color: '#9896A4' },
    ]
    const sum = (arr: DailySale[], key: keyof DailySale) =>
      arr.reduce((s, d) => s + (Number(d[key]) || 0), 0)
    const total = sum(filteredDailySales, 'total_revenue')
    const overallChange = stats.totalRevenue - (prevStats?.totalRevenue ?? 0)
    // Contribution % is suppressed when overall revenue movement is too small to be meaningful.
    // Threshold: the larger of RM 200 absolute or 2% of the previous period's revenue.
    // This prevents e.g. ±RM 50 net movement producing 4000% category contributions.
    const prevTotal = prevStats?.totalRevenue ?? 0
    const minMeaningfulChange = Math.max(200, prevTotal * 0.02)
    const showContributionPct = Math.abs(overallChange) >= minMeaningfulChange
    return CATS.map(cat => {
      const rev = sum(filteredDailySales, cat.key)
      const prevRev = sum(prevDailySales, cat.key)
      const mix = total > 0 ? (rev / total) * 100 : 0
      const rmChange = rev - prevRev
      const pctChange = prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : null
      const contribution = showContributionPct && overallChange !== 0
        ? (rmChange / Math.abs(overallChange)) * 100 : null
      return { ...cat, rev, prevRev, mix, rmChange, pctChange, contribution }
    }).sort((a, b) => b.rev - a.rev)
  }, [filteredDailySales, prevDailySales, stats, prevStats])

  // ── P2.3: Guest / cover behaviour ────────────────────────────────────────────
  const guestBehavior = useMemo(() => {
    if (orders.length === 0) return null
    const singleCoverCount = orders.filter(o => o.covers === 1).length
    const singleCoverPct = singleCoverCount / orders.length
    const buckets = [
      { label: '1', min: 1, max: 1 },
      { label: '2', min: 2, max: 2 },
      { label: '3–4', min: 3, max: 4 },
      { label: '5–6', min: 5, max: 6 },
      { label: '7+', min: 7, max: Infinity },
    ]
    const bucketData = buckets.map(b => {
      const grp = orders.filter(o => o.covers >= b.min && o.covers <= b.max)
      const rev = grp.reduce((s, o) => s + o.total, 0)
      const covers = grp.reduce((s, o) => s + o.covers, 0)
      return {
        label: b.label,
        count: grp.length,
        pct: orders.length > 0 ? grp.length / orders.length : 0,
        rev,
        covers,
        avgTableSpend: grp.length > 0 ? rev / grp.length : 0,
        revPerCover: covers > 0 ? rev / covers : 0,
      }
    })
    const totalCovers = orders.reduce((s, o) => s + o.covers, 0)
    const avgPartySize = orders.length > 0 ? totalCovers / orders.length : 0
    return { bucketData, avgPartySize, singleCoverPct, orderCount: orders.length }
  }, [orders])

  // ── P2.4: Staff efficiency (extended with void/discount incidence) ────────────
  const staffEfficiency = useMemo(() => {
    const staffOrderIds: Record<string, Set<string>> = {}
    for (const o of orders) {
      const name = o.server_name ?? 'Unknown'
      if (!staffOrderIds[name]) staffOrderIds[name] = new Set()
      staffOrderIds[name].add(o.id)
    }
    const staffVoidOrderIds: Record<string, Set<string>> = {}
    for (const v of voids) {
      const name = v.server_name ?? 'Unknown'
      if (!staffVoidOrderIds[name]) staffVoidOrderIds[name] = new Set()
      if (v.order_id) staffVoidOrderIds[name].add(v.order_id)
    }
    // Discount incidence per staff: unique orders with ≥1 discount / staff's total orders.
    // entity_id = orderId for discount.applied events (set in apply-discount/route.ts).
    // Using entity_id (not payload) because payload does not contain order_id.
    const staffDiscountOrderIds: Record<string, Set<string>> = {}
    for (const d of discountLogs) {
      const name = d.actor_name ?? 'Unknown'
      if (!staffDiscountOrderIds[name]) staffDiscountOrderIds[name] = new Set()
      if (d.entity_id) staffDiscountOrderIds[name].add(d.entity_id)
    }
    return staffStats.map(s => {
      const myOrders = staffOrderIds[s.name]?.size ?? 0
      const voidOrders = staffVoidOrderIds[s.name]?.size ?? 0
      const discountOrders = staffDiscountOrderIds[s.name]?.size ?? 0
      return {
        ...s,
        voidOrders,
        voidIncidence: myOrders > 0 ? voidOrders / myOrders : 0,
        discountOrders,
        discountIncidence: myOrders > 0 ? discountOrders / myOrders : 0,
      }
    })
  }, [staffStats, voids, discountLogs, orders])

  // ── P2.5: Void analysis ───────────────────────────────────────────────────────
  const voidIncidenceStats = useMemo(() => {
    const curr = new Set(voids.map(v => v.order_id).filter(Boolean))
    const prev = new Set(prevVoids.map(v => v.order_id).filter(Boolean))
    return {
      curr: orders.length > 0 ? curr.size / orders.length : 0,
      prev: prevOrders.length > 0 ? prev.size / prevOrders.length : null,
      ordersWithVoids: curr.size,
      totalOrders: orders.length,
      totalVoidLines: voids.length,
      totalVoidValue: voids.reduce((s, v) => s + v.quantity * v.unit_price, 0),
    }
  }, [voids, prevVoids, orders, prevOrders])

  const voidsByStaff = useMemo(() => {
    const map: Record<string, { ords: Set<string>; lines: number; value: number }> = {}
    for (const v of voids) {
      const name = v.server_name ?? 'Unknown'
      if (!map[name]) map[name] = { ords: new Set(), lines: 0, value: 0 }
      if (v.order_id) map[name].ords.add(v.order_id)
      map[name].lines++
      map[name].value += v.quantity * v.unit_price
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, uniqueOrders: v.ords.size, lines: v.lines, value: v.value }))
      .sort((a, b) => b.value - a.value)
  }, [voids])

  const voidsByHour = useMemo(() => {
    const map: Record<number, { count: number; value: number }> = {}
    for (const v of voids) {
      const h = new Date(v.created_at).getHours()
      if (!map[h]) map[h] = { count: 0, value: 0 }
      map[h].count++
      map[h].value += v.quantity * v.unit_price
    }
    return Object.entries(map)
      .map(([h, v]) => ({ hour: Number(h), ...v }))
      .sort((a, b) => a.hour - b.hour)
  }, [voids])

  const voidReasonStats = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {}
    for (const v of voids) {
      const r = v.void_reason?.trim() || 'No reason provided'
      if (!map[r]) map[r] = { count: 0, value: 0 }
      map[r].count++
      map[r].value += v.quantity * v.unit_price
    }
    return Object.entries(map)
      .map(([reason, v]) => ({ reason, ...v }))
      .sort((a, b) => b.count - a.count)
  }, [voids])

  const topVoidedItems = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {}
    for (const v of voids) {
      if (!map[v.item_name]) map[v.item_name] = { count: 0, value: 0 }
      map[v.item_name].count += v.quantity
      map[v.item_name].value += v.quantity * v.unit_price
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [voids])

  // P2.5: Discount stats — settled pos_orders.discount_amount is the reliable source
  // Use audit logs only for staff attribution (event frequency), not dollar amounts.
  const discountOrderStats = useMemo(() => {
    const ordersWithDiscount = orders.filter(o => o.discount_amount > 0)
    const grossSales = orders.reduce((s, o) => s + (o.subtotal ?? o.total), 0)
    const totalDiscountValue = ordersWithDiscount.reduce((s, o) => s + o.discount_amount, 0)
    const byLabel: Record<string, { count: number; value: number }> = {}
    for (const o of orders) {
      if (o.discount_amount <= 0) continue
      const label = o.discount_label?.trim() || 'Unknown'
      if (!byLabel[label]) byLabel[label] = { count: 0, value: 0 }
      byLabel[label].count++
      byLabel[label].value += o.discount_amount
    }
    const byStaff: Record<string, { events: number }> = {}
    for (const d of discountLogs) {
      const name = d.actor_name ?? 'Unknown'
      if (!byStaff[name]) byStaff[name] = { events: 0 }
      byStaff[name].events++
    }
    return {
      incidence: orders.length > 0 ? ordersWithDiscount.length / orders.length : 0,
      ordersWithDiscount: ordersWithDiscount.length,
      totalOrders: orders.length,
      totalDiscountValue,
      discountValueRate: grossSales > 0 ? totalDiscountValue / grossSales : 0,
      byLabel: Object.entries(byLabel).map(([label, v]) => ({ label, ...v })).sort((a, b) => b.value - a.value),
      byStaff: Object.entries(byStaff).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.events - a.events),
    }
  }, [orders, discountLogs])

  // ── P2.6: Management summary (deterministic, max 6 observations) ──────────────
  const managementSummary = useMemo(() => {
    const obs: string[] = []
    const MIN = 5
    // 1. Revenue driver
    if (revenueDriver) obs.push(revenueDriver.text)
    // 2. Category growth driver
    if (prevStats && Math.abs(stats.totalRevenue - prevStats.totalRevenue) >= 100 && categoryStats.length > 0) {
      const overallChange = stats.totalRevenue - prevStats.totalRevenue
      const topCat = [...categoryStats].sort((a, b) => Math.abs(b.rmChange) - Math.abs(a.rmChange))[0]
      if (topCat && Math.abs(topCat.rmChange) >= 50 && topCat.rev > 0) {
        const verb = topCat.rmChange >= 0 ? 'contributed' : 'reduced revenue by'
        const direction = overallChange >= 0 ? 'revenue increase' : 'revenue decline'
        obs.push(`${topCat.label} ${verb} ${fmtRM(Math.abs(topCat.rmChange))} of the ${fmtRM(Math.abs(overallChange))} ${direction}.`)
      }
    }
    // 3. Peak trading period
    let peakDow = -1, peakHour = -1, peakVal = 0
    const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    for (let dow = 0; dow < 7; dow++) {
      for (let h = 0; h < 24; h++) {
        const v = heatmapData[dow][h].revenue
        if (v > peakVal) { peakVal = v; peakDow = dow; peakHour = h }
      }
    }
    if (peakDow >= 0 && peakVal > 0 && orders.length >= MIN) {
      obs.push(`Strongest trading: ${DOW[peakDow]} ${String(peakHour).padStart(2, '0')}:00–${String(peakHour + 1).padStart(2, '0')}:00 (${fmtRM(peakVal)}).`)
    }
    // 4. Menu opportunity
    const topStar = menuEngineering.find(c => c.cls === 'Star')
    if (topStar) {
      obs.push(`${topStar.name} is a Star — ${topStar.qtySold} sold, ${fmtRM(topStar.margin)} contribution margin.`)
    }
    // 5. Void issue
    if (orders.length >= 10) {
      const vi = voidIncidenceStats.curr
      const prevVi = voidIncidenceStats.prev
      if (vi > 0.08 && prevVi !== null && vi > prevVi * 1.2) {
        obs.push(`Void incidence rose from ${(prevVi * 100).toFixed(0)}% to ${(vi * 100).toFixed(0)}%.`)
      } else if (vi > 0.15) {
        obs.push(`Void incidence at ${(vi * 100).toFixed(0)}% — ${voidIncidenceStats.ordersWithVoids} orders contained voided items.`)
      }
    }
    return obs.slice(0, 6)
  }, [revenueDriver, stats, prevStats, categoryStats, heatmapData, orders, menuEngineering, voidIncidenceStats])

  // ── P2.7: Report health ───────────────────────────────────────────────────────
  // Missing report = a date where POS orders exist but daily_sales row is absent.
  // A day with no orders AND no daily_sales is not flagged — venue may be closed.
  const reportHealth = useMemo(() => {
    const posOrderDates = new Set(orders.map(o => localDateStr(new Date(o.opened_at))))
    const dailySalesDates = new Set(filteredDailySales.map(d => d.date))
    const missingReports = [...posOrderDates].filter(d => !dailySalesDates.has(d)).sort()
    const totalDays = filteredDailySales.length
    const unbalancedDays = filteredDailySales.filter(d => d.is_balanced === false).length
    const hasBalanceData = filteredDailySales.some(d => d.is_balanced != null)
    const totalRevenue = filteredDailySales.reduce((s, d) => s + d.total_revenue, 0)
    const totalCollected = filteredDailySales.reduce((s, d) => s + (d.total_collected ?? 0), 0)
    const hasCollectedData = filteredDailySales.some(d => d.total_collected != null && d.total_collected > 0)
    const discrepancy = hasCollectedData && totalCollected > 0 ? Math.abs(totalRevenue - totalCollected) : null
    const latestDate = filteredDailySales.length > 0
      ? filteredDailySales.reduce((a, b) => a.date > b.date ? a : b).date
      : null
    const isHealthy = missingReports.length === 0 && unbalancedDays === 0
    return { missingReports, totalDays, unbalancedDays, hasBalanceData, discrepancy, hasCollectedData, latestDate, isHealthy }
  }, [orders, filteredDailySales])

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
          <div className="flex gap-1 bg-[#0D0D0F] border border-[#2A2A30] rounded-lg p-1 flex-wrap">
            {(Object.keys(PERIOD_SHORT) as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  period === p
                    ? 'bg-[#8B5CF6] text-white'
                    : 'text-[#9896A4] hover:text-[#F0EEF6]'
                }`}
              >
                {PERIOD_SHORT[p]}
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

          {/* P2.7 Report Health — compact status indicator */}
          {(reportHealth.missingReports.length > 0 || reportHealth.unbalancedDays > 0 || !reportHealth.isHealthy) && (
            <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
              reportHealth.isHealthy
                ? 'bg-emerald-500/8 border-emerald-500/20'
                : 'bg-amber-500/8 border-amber-500/20'
            }`}>
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${reportHealth.isHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${reportHealth.isHealthy ? 'text-emerald-300' : 'text-amber-300'}`}>
                  Data Quality
                </p>
                <div className="space-y-0.5">
                  {reportHealth.missingReports.length > 0 && (
                    <p className="text-amber-200 text-xs">
                      {reportHealth.missingReports.length} trading day{reportHealth.missingReports.length > 1 ? 's' : ''} with POS orders but no EON report: {reportHealth.missingReports.slice(0, 3).join(', ')}{reportHealth.missingReports.length > 3 ? ` +${reportHealth.missingReports.length - 3} more` : ''}
                    </p>
                  )}
                  {reportHealth.hasBalanceData && reportHealth.unbalancedDays > 0 && (
                    <p className="text-amber-200 text-xs">{reportHealth.unbalancedDays} day{reportHealth.unbalancedDays > 1 ? 's' : ''} marked as unbalanced in EON submissions</p>
                  )}
                  {reportHealth.discrepancy != null && reportHealth.discrepancy > 50 && (
                    <p className="text-amber-200 text-xs">Revenue vs collected discrepancy: {fmtRM(reportHealth.discrepancy)}</p>
                  )}
                  {reportHealth.latestDate && (
                    <p className="text-[#9896A4] text-xs">Latest EON report: {reportHealth.latestDate}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* P2.6 Management Summary */}
          {managementSummary.length > 0 && (
            <div className="card">
              <p className="section-title mb-3">Summary</p>
              <div className="space-y-2">
                {managementSummary.map((text, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] mt-2 shrink-0" />
                    <p className="text-sm text-[#D4D2DC]">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Things to Review */}
          {thingsToReview.length > 0 && (
            <div className="card space-y-2">
              <p className="section-title mb-3">Things to Review</p>
              {thingsToReview.map((obs, i) => {
                const colors = {
                  warning: { bg: 'bg-rose-500/8 border-rose-500/20', dot: 'bg-rose-400', text: 'text-rose-200' },
                  info: { bg: 'bg-amber-500/8 border-amber-500/20', dot: 'bg-amber-400', text: 'text-amber-200' },
                  positive: { bg: 'bg-emerald-500/8 border-emerald-500/20', dot: 'bg-emerald-400', text: 'text-emerald-200' },
                }
                const c = colors[obs.severity]
                return (
                  <div key={i} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${c.bg}`}>
                    <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${c.dot}`} />
                    <p className={`text-sm ${c.text}`}>{obs.text}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* KPI row — P1.2 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Revenue',
                value: fmtRM(stats.totalRevenue),
                prev: prevStats?.totalRevenue,
                curr: stats.totalRevenue,
                color: 'text-emerald-400',
              },
              {
                label: 'Orders',
                value: stats.totalOrders.toString(),
                prev: prevStats?.totalOrders,
                curr: stats.totalOrders,
                color: 'text-[#F0EEF6]',
              },
              {
                label: 'Covers',
                value: stats.totalCovers.toString(),
                prev: prevStats?.totalCovers,
                curr: stats.totalCovers,
                color: 'text-sky-400',
              },
              {
                label: 'Rev / Cover',
                value: stats.revenuePerCover > 0 ? fmtRM(stats.revenuePerCover) : '—',
                prev: prevStats?.revenuePerCover,
                curr: stats.revenuePerCover,
                color: 'text-[#A78BFA]',
              },
            ].map(card => {
              const delta = card.prev != null ? calcDelta(card.curr, card.prev) : null
              return (
                <div key={card.label} className="card">
                  <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-2">{card.label}</p>
                  <p className={`font-bold text-xl tabular-nums ${card.color}`}>{card.value}</p>
                  {delta && (
                    <p className={`text-xs mt-1.5 flex items-center gap-1 tabular-nums ${
                      delta.dir === 'up' ? 'text-emerald-400' : delta.dir === 'down' ? 'text-rose-400' : 'text-[#5A5865]'
                    }`}>
                      {delta.dir === 'up' ? <TrendingUp size={11} /> : delta.dir === 'down' ? <TrendingDown size={11} /> : <Minus size={11} />}
                      {delta.dir !== 'flat' ? `${delta.dir === 'up' ? '+' : ''}${delta.pct.toFixed(1)}%` : '—'}
                      <span className="text-[#5A5865]">{range.compLabel}</span>
                    </p>
                  )}
                  {!delta && range.compLabel && (
                    <p className="text-[#5A5865] text-xs mt-1.5">No prior data</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Daily Performance chart — P1.3 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <p className="section-title">Daily Performance</p>
              <div className="flex gap-1">
                {([
                  { key: 'revenue', label: 'Revenue' },
                  { key: 'orders', label: 'Orders' },
                  { key: 'covers', label: 'Covers' },
                  { key: 'avgSpend', label: 'Avg Spend' },
                ] as const).map(m => (
                  <button
                    key={m.key}
                    onClick={() => setChartMetric(m.key)}
                    className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${
                      chartMetric === m.key
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/40 text-[#A78BFA]'
                        : 'bg-[#141417] border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {dailyPerfData.length === 0 ? (
              <p className="text-[#5A5865] text-sm text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyPerfData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fill: '#9896A4', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fill: '#9896A4', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={chartMetric === 'revenue' || chartMetric === 'avgSpend' ? 56 : 32}
                    tickFormatter={v =>
                      chartMetric === 'revenue' ? `RM${(v / 1000).toFixed(0)}k`
                      : chartMetric === 'avgSpend' ? `RM${v.toFixed(0)}`
                      : String(v)
                    }
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(v: unknown) =>
                      chartMetric === 'revenue' || chartMetric === 'avgSpend' ? fmtRM(Number(v)) : String(v)
                    }
                    contentStyle={{ background: '#1A1A1E', border: '1px solid #2A2A30', borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: '#F0EEF6' }}
                    labelStyle={{ color: '#9896A4' }}
                    cursor={{ fill: '#8B5CF6', opacity: 0.08 }}
                  />
                  <Bar dataKey="value" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* P2.2 Category Performance */}
          {filteredDailySales.length > 0 && (
            <div className="card">
              <div className="mb-4">
                <p className="section-title">Category Performance</p>
                <p className="text-[#5A5865] text-xs mt-0.5">From EON daily submissions · {PERIOD_LABELS[period]}</p>
              </div>
              {/* Category mix bar */}
              {(() => {
                const total = categoryStats.reduce((s, c) => s + c.rev, 0)
                if (total === 0) return <p className="text-[#5A5865] text-sm">No category data</p>
                return (
                  <div className="mb-5">
                    <div className="flex h-4 rounded-full overflow-hidden gap-px mb-2">
                      {categoryStats.filter(c => c.rev > 0).map(c => (
                        <div
                          key={c.key}
                          style={{ width: `${c.mix}%`, background: c.color }}
                          title={`${c.label}: ${c.mix.toFixed(1)}%`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {categoryStats.filter(c => c.rev > 0).map(c => (
                        <div key={c.key} className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c.color }} />
                          <span className="text-[#9896A4] text-xs">{c.label}</span>
                          <span className="text-xs tabular-nums" style={{ color: c.color }}>{c.mix.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
              {/* Management table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 640 }}>
                  <thead>
                    <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                      <th className="text-left py-2 pr-4">Category</th>
                      <th className="text-right py-2 px-3">Revenue</th>
                      <th className="text-right py-2 px-3">Mix %</th>
                      {range.prevStart && <th className="text-right py-2 px-3">Prev Period</th>}
                      {range.prevStart && <th className="text-right py-2 px-3">RM Change</th>}
                      {range.prevStart && <th className="text-right py-2 px-3">% Change</th>}
                      {range.prevStart && <th className="text-right py-2 pl-3">Contrib to Growth</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {categoryStats.map(c => (
                      <tr key={c.key} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: c.color }} />
                            <span className="text-[#F0EEF6]">{c.label}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-medium" style={{ color: c.color }}>
                          {c.rev > 0 ? fmtRM(c.rev) : <span className="text-[#5A5865]">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-[#9896A4]">
                          {c.mix > 0 ? `${c.mix.toFixed(1)}%` : '—'}
                        </td>
                        {range.prevStart && (
                          <td className="py-2.5 px-3 text-right tabular-nums text-[#5A5865]">
                            {c.prevRev > 0 ? fmtRM(c.prevRev) : '—'}
                          </td>
                        )}
                        {range.prevStart && (
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {c.prevRev > 0 || c.rev > 0 ? (
                              <span className={c.rmChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {c.rmChange >= 0 ? '+' : ''}{fmtRM(c.rmChange)}
                              </span>
                            ) : <span className="text-[#5A5865]">—</span>}
                          </td>
                        )}
                        {range.prevStart && (
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {c.pctChange !== null ? (
                              <span className={c.pctChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {c.pctChange >= 0 ? '+' : ''}{c.pctChange.toFixed(1)}%
                              </span>
                            ) : <span className="text-[#5A5865]">—</span>}
                          </td>
                        )}
                        {range.prevStart && (
                          <td className="py-2.5 pl-3 text-right tabular-nums">
                            {c.contribution !== null ? (
                              <span className={Math.abs(c.contribution) < 5 ? 'text-[#5A5865]' : c.contribution >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {c.contribution >= 0 ? '+' : ''}{c.contribution.toFixed(0)}%
                              </span>
                            ) : <span className="text-[#5A5865]">—</span>}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {range.prevStart && (
                <p className="text-[#5A5865] text-xs mt-3">Contribution to Growth = category RM change ÷ |overall revenue change|. Values may exceed ±100% if categories partially offset each other.</p>
              )}
            </div>
          )}

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

              {/* Full efficiency table — P2.4 */}
              <div className="card overflow-x-auto">
                <div className="mb-4">
                  <p className="section-title">Staff Efficiency — {PERIOD_LABELS[period]}</p>
                  <p className="text-[#5A5865] text-xs mt-0.5">Revenue Handled = attribution from order records, not causation. Void/discount incidence = % of that server's orders.</p>
                </div>
                <table className="w-full text-sm" style={{ minWidth: 700 }}>
                  <thead>
                    <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                      <th className="text-left py-2 pr-4">Server</th>
                      <th className="text-right py-2 px-3">Orders</th>
                      <th className="text-right py-2 px-3">Covers</th>
                      <th className="text-right py-2 px-3">Avg Check</th>
                      <th className="text-right py-2 px-3">Revenue Handled</th>
                      <th className="text-right py-2 px-3">Void Incid.</th>
                      <th className="text-right py-2 pl-3">Disc. Incid.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffEfficiency.map((s, i) => (
                      <tr key={s.name} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#8B5CF6]/20 text-[#A78BFA] text-xs flex items-center justify-center font-medium shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-[#F0EEF6] font-medium">{s.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums">{s.orders}</td>
                        <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums">{s.covers}</td>
                        <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums">{fmtRM(s.avgSpend)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold tabular-nums">{fmtRM(s.revenue)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          <span className={s.voidIncidence > 0.15 ? 'text-rose-400 font-semibold' : s.voidIncidence > 0.08 ? 'text-amber-400' : 'text-[#9896A4]'}>
                            {s.voidOrders > 0 ? `${(s.voidIncidence * 100).toFixed(0)}%` : '—'}
                          </span>
                        </td>
                        <td className="py-2.5 pl-3 text-right tabular-nums">
                          <span className={s.discountIncidence > 0.30 ? 'text-amber-400 font-semibold' : 'text-[#9896A4]'}>
                            {s.discountOrders > 0 ? `${(s.discountIncidence * 100).toFixed(0)}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[#2A2A30]">
                      <td className="py-2.5 pr-4 text-[#9896A4] text-xs font-medium">Total</td>
                      <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums text-xs">{staffEfficiency.reduce((s, r) => s + r.orders, 0)}</td>
                      <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums text-xs">{staffEfficiency.reduce((s, r) => s + r.covers, 0)}</td>
                      <td className="py-2.5 px-3" />
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-bold tabular-nums text-xs">{fmtRM(staffEfficiency.reduce((s, r) => s + r.revenue, 0))}</td>
                      <td className="py-2.5 px-3" />
                      <td className="py-2.5 pl-3" />
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

          {/* P2.3 Guest / Cover Behaviour */}
          {guestBehavior && (
            <div className="card">
              <div className="mb-4">
                <p className="section-title">Guest &amp; Cover Behaviour</p>
                <p className="text-[#5A5865] text-xs mt-0.5">From POS orders (Jul 11 2026+) · {PERIOD_LABELS[period]}</p>
              </div>
              {/* Cover data quality note */}
              {guestBehavior.singleCoverPct > 0.6 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 mb-4">
                  <p className="text-amber-200 text-xs">
                    {(guestBehavior.singleCoverPct * 100).toFixed(0)}% of orders in this period have covers = 1. Cover analysis depends on covers being entered accurately at order creation.
                  </p>
                </div>
              )}
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                <div>
                  <p className="text-[#5A5865] text-xs">Avg Party Size</p>
                  <p className="text-[#F0EEF6] font-bold text-xl tabular-nums">{guestBehavior.avgPartySize.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-[#5A5865] text-xs">Orders Analysed</p>
                  <p className="text-[#F0EEF6] font-bold text-xl tabular-nums">{guestBehavior.orderCount}</p>
                </div>
                <div>
                  <p className="text-[#5A5865] text-xs">Rev / Cover (overall)</p>
                  <p className="text-[#A78BFA] font-bold text-xl tabular-nums">
                    {stats.revenuePerCover > 0 ? fmtRM(stats.revenuePerCover) : '—'}
                  </p>
                </div>
              </div>
              {/* Party size breakdown table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 540 }}>
                  <thead>
                    <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                      <th className="text-left py-2 pr-4">Party Size</th>
                      <th className="text-right py-2 px-3">Orders</th>
                      <th className="text-right py-2 px-3">% of Orders</th>
                      <th className="text-right py-2 px-3">Avg Table Spend</th>
                      <th className="text-right py-2 pl-3">Rev / Cover</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guestBehavior.bucketData.filter(b => b.count > 0).map(b => (
                      <tr key={b.label} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                        <td className="py-2.5 pr-4 text-[#F0EEF6] font-medium">{b.label} guest{b.label === '1' ? '' : 's'}</td>
                        <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums">{b.count}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-[#1A1A1E] rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-[#8B5CF6]" style={{ width: `${b.pct * 100}%` }} />
                            </div>
                            <span className="text-[#9896A4] w-8 text-right">{(b.pct * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 tabular-nums">{fmtRM(b.avgTableSpend)}</td>
                        <td className="py-2.5 pl-3 text-right text-[#A78BFA] tabular-nums">{b.revPerCover > 0 ? fmtRM(b.revPerCover) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Day × Hour Trading Heatmap — P1.4 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <p className="section-title">Trading Heatmap</p>
                <p className="text-[#5A5865] text-xs mt-0.5">Day × hour activity ({PERIOD_LABELS[period]}) · Revenue = POS order totals by timestamp — may differ from canonical daily revenue if manual corrections exist</p>
              </div>
              <div className="flex gap-1">
                {([
                  { key: 'revenue', label: 'Revenue' },
                  { key: 'orders', label: 'Orders' },
                  { key: 'covers', label: 'Covers' },
                  { key: 'revPerCover', label: 'Rev/Cover' },
                ] as const).map(m => (
                  <button
                    key={m.key}
                    onClick={() => setHeatmapMetric(m.key)}
                    className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${
                      heatmapMetric === m.key
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/40 text-[#A78BFA]'
                        : 'bg-[#141417] border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {orders.length === 0 ? (
              <p className="text-[#5A5865] text-sm text-center py-8">No orders in this period</p>
            ) : (() => {
              const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
              // compute max for colour scaling
              let max = 0
              for (let dow = 0; dow < 7; dow++) {
                for (const h of operatingHours) {
                  const cell = heatmapData[dow][h]
                  const v = heatmapMetric === 'revenue' ? cell.revenue
                    : heatmapMetric === 'orders' ? cell.orders
                    : heatmapMetric === 'covers' ? cell.covers
                    : cell.covers > 0 ? cell.revenue / cell.covers : 0
                  if (v > max) max = v
                }
              }
              return (
                <div className="overflow-x-auto">
                  <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(${operatingHours.length}, minmax(28px, 1fr))`, gap: 3 }}>
                    {/* Hour labels */}
                    <div />
                    {operatingHours.map(h => (
                      <div key={h} className="text-center text-[#5A5865] text-[10px] pb-1">
                        {String(h).padStart(2, '0')}
                      </div>
                    ))}
                    {/* Rows */}
                    {DOW_LABELS.map((day, dow) => (
                      <>
                        <div key={day} className="text-[#9896A4] text-xs flex items-center pr-1">{day}</div>
                        {operatingHours.map(h => {
                          const cell = heatmapData[dow][h]
                          const v = heatmapMetric === 'revenue' ? cell.revenue
                            : heatmapMetric === 'orders' ? cell.orders
                            : heatmapMetric === 'covers' ? cell.covers
                            : cell.covers > 0 ? cell.revenue / cell.covers : 0
                          const intensity = max > 0 ? v / max : 0
                          const bg = intensity === 0 ? '#141417'
                            : intensity > 0.75 ? '#7c3aed'
                            : intensity > 0.5 ? '#5b21b6'
                            : intensity > 0.25 ? '#3b1a7a'
                            : '#241650'
                          const tipVal = v > 0
                            ? (heatmapMetric === 'revenue' || heatmapMetric === 'revPerCover' ? fmtRM(v) : String(Math.round(v)))
                            : ''
                          return (
                            <div
                              key={h}
                              className="rounded-sm"
                              style={{ background: bg, height: 26 }}
                              title={tipVal ? `${day} ${String(h).padStart(2, '0')}:00 — ${tipVal}` : `${day} ${String(h).padStart(2, '0')}:00`}
                            />
                          )
                        })}
                      </>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-3 justify-end">
                    {([['#7c3aed', 'Peak'], ['#5b21b6', 'Busy'], ['#3b1a7a', 'Slow'], ['#141417', 'None']] as const).map(([color, label]) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm border border-[#2A2A30]" style={{ background: color }} />
                        <span className="text-[#5A5865] text-xs">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
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
              <p className="text-[#5A5865] text-xs mt-0.5">Active menu items sold fewer than 3 times ({PERIOD_LABELS[period].toLowerCase()}) — consider removing or promoting</p>
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
              <p className="section-title mb-1">Cocktail Profitability — {PERIOD_LABELS[period]}</p>
              <p className="text-[#5A5865] text-xs mb-4">Contribution margin = selling price − current recipe cost. Theoretical Contribution = margin × units sold. Uses current recipe cost — not historical cost at time of sale.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 600 }}>
                  <thead>
                    <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                      <th className="text-left py-2 pr-4">Cocktail</th>
                      <th className="text-right py-2 px-3">Sold</th>
                      <th className="text-right py-2 px-3">Price</th>
                      <th className="text-right py-2 px-3">Cost</th>
                      <th className="text-right py-2 px-3">Margin</th>
                      <th className="text-right py-2 pl-4">Theoretical Contribution</th>
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
                        <td className="py-2.5 pl-4 text-right tabular-nums text-emerald-400 font-semibold">{fmtRM(c.theoreticalContribution)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Menu Engineering — P1.5 */}
          {menuEngineering.length >= 2 && (
            <div className="card">
              <p className="section-title mb-1">Menu Engineering — {PERIOD_LABELS[period]}</p>
              <p className="text-[#5A5865] text-xs mb-4">
                Classification: Popularity (qty sold) × Contribution Margin RM (selling price − current recipe cost).
                Thresholds: median qty = {menuEngineering[0]?.medQty ?? 0}, median contribution margin = {fmtRM(menuEngineering[0]?.medMargin ?? 0)}.
                Theoretical Contribution uses current recipe cost — not historical cost at time of sale.
              </p>

              {/* 2×2 quadrant grid */}
              {(() => {
                const stars = menuEngineering.filter(c => c.cls === 'Star')
                const workhorses = menuEngineering.filter(c => c.cls === 'Workhorse')
                const puzzles = menuEngineering.filter(c => c.cls === 'Puzzle')
                const dogs = menuEngineering.filter(c => c.cls === 'Dog')
                const quad = [
                  { label: 'Star', sub: 'High qty · High margin', items: stars, color: 'text-amber-400', bg: 'bg-amber-500/8 border-amber-500/20' },
                  { label: 'Workhorse', sub: 'High qty · Low margin', items: workhorses, color: 'text-sky-400', bg: 'bg-sky-500/8 border-sky-500/20' },
                  { label: 'Puzzle', sub: 'Low qty · High margin', items: puzzles, color: 'text-violet-400', bg: 'bg-violet-500/8 border-violet-500/20' },
                  { label: 'Dog', sub: 'Low qty · Low margin', items: dogs, color: 'text-[#5A5865]', bg: 'bg-[#1A1A1E] border-[#2A2A30]' },
                ]
                return (
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {quad.map(q => (
                      <div key={q.label} className={`rounded-xl border p-3 ${q.bg}`}>
                        <p className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${q.color}`}>{q.label}</p>
                        <p className="text-[#5A5865] text-[10px] mb-2">{q.sub}</p>
                        {q.items.length === 0 ? (
                          <p className="text-[#5A5865] text-xs italic">None</p>
                        ) : (
                          <div className="space-y-0.5">
                            {q.items.map(c => (
                              <p key={c.name} className="text-[#F0EEF6] text-xs truncate">{c.name}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* Management table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 780 }}>
                  <thead>
                    <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                      <th className="text-left py-2 pr-3">Cocktail</th>
                      <th className="text-center py-2 px-2">Class</th>
                      <th className="text-right py-2 px-2">Qty</th>
                      <th className="text-right py-2 px-2">Revenue</th>
                      <th className="text-right py-2 px-2">Cost</th>
                      <th className="text-right py-2 px-2">COGS%</th>
                      <th className="text-right py-2 px-2">Margin RM</th>
                      <th className="text-right py-2 px-2">Theoretical Contribution</th>
                      <th className="text-right py-2 pl-3">Trend (Qty)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuEngineering.map(c => {
                      const clsColors: Record<string, string> = {
                        Star: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                        Workhorse: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
                        Puzzle: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
                        Dog: 'bg-[#1A1A1E] text-[#5A5865] border-[#2A2A30]',
                      }
                      const trendColor = c.trend.startsWith('↑') ? 'text-emerald-400'
                        : c.trend.startsWith('↓') ? 'text-rose-400'
                        : c.trend === 'New' ? 'text-[#A78BFA]'
                        : 'text-[#5A5865]'
                      return (
                        <tr key={c.name} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                          <td className="py-2.5 pr-3 text-[#F0EEF6] font-medium">{c.name}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-semibold ${clsColors[c.cls]}`}>{c.cls}</span>
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-[#9896A4]">{c.qtySold}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-emerald-400">{fmtRM(c.qtySold * c.sellingPrice)}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-rose-400">{fmtRM(c.cost)}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-[#9896A4]">{c.cogsPercent.toFixed(0)}%</td>
                          <td className="py-2.5 px-2 text-right tabular-nums">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${c.marginPct >= 60 ? 'bg-emerald-500/10 text-emerald-400' : c.marginPct >= 40 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {fmtRM(c.margin)}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-emerald-400 font-semibold">{fmtRM(c.theoreticalContribution)}</td>
                          <td className={`py-2.5 pl-3 text-right tabular-nums text-xs font-medium ${trendColor}`}>{c.trend}</td>
                        </tr>
                      )
                    })}
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
              <table className="w-full text-sm" style={{ minWidth: 860 }}>
                <thead>
                  <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                    <th className="text-left py-2 pr-4">Month</th>
                    <th className="text-right py-2 px-3">Total</th>
                    <th className="text-right py-2 px-3">Cocktails</th>
                    <th className="text-right py-2 px-3">Beer</th>
                    <th className="text-right py-2 px-3">Wine</th>
                    <th className="text-right py-2 px-3">Food</th>
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
                      <td className="py-2.5 px-3 text-right tabular-nums text-amber-400">{m.beer > 0 ? fmtRM(m.beer) : '—'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-sky-400">{m.wine > 0 ? fmtRM(m.wine) : '—'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-orange-400">{m.food > 0 ? fmtRM(m.food) : '—'}</td>
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

      {/* ── VOIDS & DISCOUNTS TAB (admin only) — P2.5 expanded ───────────────── */}
      {activeTab === 'voids' && isAdmin && (
        <div className="space-y-6">

          {/* ── VOID SECTION ── */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-rose-400" />
              <p className="section-title">Void Analysis — {PERIOD_LABELS[period]}</p>
            </div>

            {/* Void KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div>
                <p className="text-[#5A5865] text-xs">Void Incidence</p>
                <p className={`font-bold text-xl tabular-nums ${voidIncidenceStats.curr > 0.15 ? 'text-rose-400' : voidIncidenceStats.curr > 0.08 ? 'text-amber-400' : 'text-[#F0EEF6]'}`}>
                  {voidIncidenceStats.totalOrders > 0 ? `${(voidIncidenceStats.curr * 100).toFixed(0)}%` : '—'}
                </p>
                <p className="text-[#5A5865] text-xs mt-0.5">{voidIncidenceStats.ordersWithVoids} of {voidIncidenceStats.totalOrders} orders</p>
                {voidIncidenceStats.prev !== null && (
                  <p className="text-[#5A5865] text-xs">Prev: {(voidIncidenceStats.prev * 100).toFixed(0)}%</p>
                )}
              </div>
              <div>
                <p className="text-[#5A5865] text-xs">Voided Line Items</p>
                <p className="text-[#F0EEF6] font-bold text-xl tabular-nums">{voidIncidenceStats.totalVoidLines}</p>
              </div>
              <div>
                <p className="text-[#5A5865] text-xs">Total Void Value</p>
                <p className="text-rose-400 font-bold text-xl tabular-nums">{fmtRM(voidIncidenceStats.totalVoidValue)}</p>
              </div>
              {(() => {
                const noReasonCount = voids.filter(v => !v.void_reason?.trim()).length
                const noReasonPct = voids.length > 0 ? noReasonCount / voids.length : 0
                return (
                  <div>
                    <p className="text-[#5A5865] text-xs">No Reason Provided</p>
                    <p className={`font-bold text-xl tabular-nums ${noReasonPct > 0.3 ? 'text-amber-400' : 'text-[#F0EEF6]'}`}>
                      {voids.length > 0 ? `${(noReasonPct * 100).toFixed(0)}%` : '—'}
                    </p>
                    <p className="text-[#5A5865] text-xs mt-0.5">{noReasonCount} of {voids.length} void lines</p>
                  </div>
                )
              })()}
            </div>

            {voids.length === 0 ? (
              <p className="text-[#5A5865] text-sm text-center py-4">No voided items in this period</p>
            ) : (
              <div className="space-y-6">

                {/* Top voided items + reasons side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Most voided items */}
                  <div>
                    <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-2">Most Voided Items</p>
                    <div className="space-y-1.5">
                      {topVoidedItems.slice(0, 7).map(item => (
                        <div key={item.name} className="flex items-center justify-between gap-2">
                          <span className="text-[#F0EEF6] text-sm truncate flex-1">{item.name}</span>
                          <span className="text-[#9896A4] text-xs tabular-nums shrink-0">{item.count}×</span>
                          <span className="text-rose-400 text-xs tabular-nums shrink-0 w-20 text-right">{fmtRM(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Void reasons */}
                  <div>
                    <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-2">Void Reasons (as recorded)</p>
                    <div className="space-y-1.5">
                      {voidReasonStats.slice(0, 7).map(r => (
                        <div key={r.reason} className="flex items-center justify-between gap-2">
                          <span className={`text-sm truncate flex-1 ${r.reason === 'No reason provided' ? 'text-[#5A5865] italic' : 'text-[#F0EEF6]'}`}>{r.reason}</span>
                          <span className="text-[#9896A4] text-xs tabular-nums shrink-0">{r.count}×</span>
                          <span className="text-rose-400 text-xs tabular-nums shrink-0 w-20 text-right">{fmtRM(r.value)}</span>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const noReasonCount = voids.filter(v => !v.void_reason?.trim()).length
                      const noReasonPct = voids.length > 0 ? (noReasonCount / voids.length * 100).toFixed(0) : '0'
                      return noReasonCount > 0 ? (
                        <p className="text-[#5A5865] text-xs mt-2">{noReasonPct}% of voids have no recorded reason.</p>
                      ) : null
                    })()}
                  </div>
                </div>

                {/* Voids by staff */}
                {voidsByStaff.length > 0 && (
                  <div>
                    <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-2">Voids by Staff</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                            <th className="text-left py-2 pr-4">Staff</th>
                            <th className="text-right py-2 px-3">Orders w/ Voids</th>
                            <th className="text-right py-2 px-3">Void Lines</th>
                            <th className="text-right py-2 pl-3">Void Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {voidsByStaff.map(s => (
                            <tr key={s.name} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                              <td className="py-2.5 pr-4 text-[#F0EEF6]">{s.name}</td>
                              <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums">{s.uniqueOrders}</td>
                              <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums">{s.lines}</td>
                              <td className="py-2.5 pl-3 text-right text-rose-400 tabular-nums">{fmtRM(s.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Voids by hour */}
                {voidsByHour.length > 0 && (
                  <div>
                    <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-2">Voids by Hour</p>
                    <div className="flex items-end gap-1 h-16">
                      {(() => {
                        const maxCount = Math.max(...voidsByHour.map(v => v.count))
                        return voidsByHour.map(v => (
                          <div key={v.hour} className="flex flex-col items-center gap-0.5 flex-1" title={`${String(v.hour).padStart(2, '0')}:00 — ${v.count} voids, ${fmtRM(v.value)}`}>
                            <div
                              className="w-full rounded-sm bg-rose-500/60"
                              style={{ height: `${maxCount > 0 ? (v.count / maxCount) * 52 : 4}px` }}
                            />
                            <span className="text-[#5A5865] text-[9px]">{v.hour}</span>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                )}

                {/* Detailed void list */}
                <div>
                  <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-2">All Voided Items</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                          <th className="text-left py-2 pr-3">Item</th>
                          <th className="text-right py-2 px-3">Qty</th>
                          <th className="text-right py-2 px-3">Value</th>
                          <th className="text-left py-2 px-3">Reason</th>
                          <th className="text-left py-2 px-3">Staff</th>
                          <th className="text-right py-2 pl-3">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {voids.map((v, i) => (
                          <tr key={i} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                            <td className="py-2.5 pr-3 text-[#F0EEF6]">{v.item_name}</td>
                            <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums">{v.quantity}</td>
                            <td className="py-2.5 px-3 text-right text-rose-400 font-medium tabular-nums">{fmtRM(v.quantity * v.unit_price)}</td>
                            <td className="py-2.5 px-3 text-[#9896A4] text-xs">
                              {v.void_reason?.trim() ? v.void_reason : <span className="text-[#5A5865] italic">—</span>}
                            </td>
                            <td className="py-2.5 px-3 text-[#5A5865] text-xs">{v.server_name ?? '—'}</td>
                            <td className="py-2.5 pl-3 text-right text-[#5A5865] text-xs whitespace-nowrap">{fmtDate(v.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── DISCOUNT SECTION ── */}
          <div className="card">
            <p className="section-title mb-4">Discount Analysis — {PERIOD_LABELS[period]}</p>

            {/* Discount KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div>
                <p className="text-[#5A5865] text-xs">Discount Incidence</p>
                <p className={`font-bold text-xl tabular-nums ${discountOrderStats.incidence > 0.3 ? 'text-amber-400' : 'text-[#F0EEF6]'}`}>
                  {discountOrderStats.totalOrders > 0 ? `${(discountOrderStats.incidence * 100).toFixed(0)}%` : '—'}
                </p>
                <p className="text-[#5A5865] text-xs mt-0.5">{discountOrderStats.ordersWithDiscount} of {discountOrderStats.totalOrders} orders</p>
              </div>
              <div>
                <p className="text-[#5A5865] text-xs">Discount Value</p>
                <p className="text-amber-400 font-bold text-xl tabular-nums">{fmtRM(discountOrderStats.totalDiscountValue)}</p>
                <p className="text-[#5A5865] text-xs mt-0.5">settled from orders</p>
              </div>
              <div>
                <p className="text-[#5A5865] text-xs">Discount Value Rate</p>
                <p className="text-[#F0EEF6] font-bold text-xl tabular-nums">
                  {discountOrderStats.discountValueRate > 0 ? `${(discountOrderStats.discountValueRate * 100).toFixed(1)}%` : '—'}
                </p>
                <p className="text-[#5A5865] text-xs mt-0.5">of gross sales</p>
              </div>
              <div>
                <p className="text-[#5A5865] text-xs">Audit Log Events</p>
                <p className="text-[#F0EEF6] font-bold text-xl tabular-nums">{discountLogs.length}</p>
                <p className="text-[#5A5865] text-xs mt-0.5">for staff attribution</p>
              </div>
            </div>

            {discountOrderStats.totalDiscountValue === 0 && discountLogs.length === 0 ? (
              <p className="text-[#5A5865] text-sm">No discounts in this period</p>
            ) : (
              <div className="space-y-5">
                {/* By discount type (from pos_orders settled values) */}
                {discountOrderStats.byLabel.length > 0 && (
                  <div>
                    <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-2">By Discount Type <span className="text-[#5A5865] normal-case">(settled order values)</span></p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                            <th className="text-left py-2 pr-4">Discount</th>
                            <th className="text-right py-2 px-4">Orders</th>
                            <th className="text-right py-2 pl-4">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {discountOrderStats.byLabel.map(d => (
                            <tr key={d.label} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                              <td className="py-2.5 pr-4 text-[#F0EEF6]">{d.label}</td>
                              <td className="py-2.5 px-4 text-right text-[#9896A4] tabular-nums">{d.count}</td>
                              <td className="py-2.5 pl-4 text-right text-amber-400 font-medium tabular-nums">{fmtRM(d.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* By staff (audit log attribution — event frequency, not dollar amounts) */}
                {discountOrderStats.byStaff.length > 0 && (
                  <div>
                    <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-2">By Staff <span className="text-[#5A5865] normal-case">(audit log event count)</span></p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                            <th className="text-left py-2 pr-4">Staff</th>
                            <th className="text-right py-2 pl-4">Discount Events</th>
                          </tr>
                        </thead>
                        <tbody>
                          {discountOrderStats.byStaff.map(s => (
                            <tr key={s.name} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                              <td className="py-2.5 pr-4 text-[#F0EEF6]">{s.name}</td>
                              <td className="py-2.5 pl-4 text-right text-[#9896A4] tabular-nums">{s.events}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[#5A5865] text-xs mt-2">Event count from audit log. Dollar amounts are settled order-level figures, not per-staff.</p>
                  </div>
                )}

                {/* Discount log */}
                {discountLogs.length > 0 && (
                  <div>
                    <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-2">Discount Events Log</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" style={{ minWidth: 560 }}>
                        <thead>
                          <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                            <th className="text-left py-2 pr-4">Date / Time</th>
                            <th className="text-left py-2 pr-4">Applied By</th>
                            <th className="text-left py-2 pr-4">Discount</th>
                            <th className="text-right py-2 pl-4">Amount (log)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {discountLogs.map((d, i) => {
                            const p = d.payload ?? {}
                            const discountName = typeof p.discount_name === 'string' ? p.discount_name : '—'
                            const discountType = typeof p.discount_type === 'string' ? p.discount_type : null
                            const discountValue = typeof p.discount_value === 'number' ? p.discount_value : null
                            const amount = typeof p.discount_amount === 'number' ? p.discount_amount
                              : typeof p.amount === 'number' ? p.amount : null
                            const typeLabel = discountType === 'percent' && discountValue != null
                              ? `${discountValue}% off`
                              : discountType === 'flat' && discountValue != null
                                ? `RM ${discountValue} off`
                                : discountType ?? null
                            return (
                              <tr key={i} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                                <td className="py-2.5 pr-4 text-[#9896A4] text-xs whitespace-nowrap">{fmtDatetime(d.created_at)}</td>
                                <td className="py-2.5 pr-4 text-[#F0EEF6] text-sm">{d.actor_name ?? '—'}</td>
                                <td className="py-2.5 pr-4">
                                  <span className="text-[#F0EEF6] text-sm">{discountName}</span>
                                  {typeLabel && <span className="text-[#5A5865] text-xs ml-2">({typeLabel})</span>}
                                </td>
                                <td className="py-2.5 pl-4 text-right">
                                  {amount != null
                                    ? <span className="text-amber-400 font-semibold tabular-nums">{fmtRM(amount)}</span>
                                    : <span className="text-[#5A5865]">—</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
