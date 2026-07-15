'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import {
  Users, Receipt, TrendingUp, ChevronDown, ChevronUp,
  Search, Calendar, CreditCard, Banknote, QrCode, Clock,
  Printer, Download, RotateCcw, Mail, Eye, X,
} from 'lucide-react'
import { ReceiptPrint, type ReceiptData } from '@/app/(dashboard)/pos/order/[id]/ReceiptPrint'
import { useToast } from '@/components/ui/Toast'

type Order = {
  id: string
  table_name: string | null
  section: string | null
  covers: number
  opened_at: string
  closed_at: string | null
  subtotal: number
  discount_amount: number
  discount_label: string | null
  service_charge: number
  tax_amount: number
  total: number
  server_name: string | null
  status: string
}

type Item = {
  id: string
  order_id: string
  item_name: string
  category: string | null
  quantity: number
  unit_price: number
  discount: number | null
  voided_at: string | null
}

type Payment = {
  order_id: string
  method: string
  amount: number
}

type ReceiptEmail = {
  id: string
  order_id: string
  sent_to: string
  sent_by_name: string | null
  sent_at: string
  receipt_html: string
}

interface Props {
  orders: Order[]
  items: Item[]
  payments: Payment[]
  receiptEmails: ReceiptEmail[]
  isAdmin: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  house_cocktail: 'House Cocktail',
  classic: 'Classic',
  beer: 'Beer',
  wine: 'Wine',
  whisky: 'Whisky',
  food: 'Food',
  mocktail: 'Mocktail',
  others: 'Others',
}

const METHOD_ICONS: Record<string, React.ReactNode> = {
  cash: <Banknote size={12} />,
  credit_card: <CreditCard size={12} />,
  debit_card: <CreditCard size={12} />,
  qr_payment: <QrCode size={12} />,
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  credit_card: 'Card',
  debit_card: 'Card',
  qr_payment: 'QR',
  online: 'Online',
}

function fmt(n: number) {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtRaw(n: number) {
  return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function getDuration(opened: string, closed: string) {
  const ms = new Date(closed).getTime() - new Date(opened).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function getBusinessDateStr(iso: string) {
  const myt = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)
  if (myt.getUTCHours() < 6) myt.setUTCDate(myt.getUTCDate() - 1)
  return myt.toISOString().slice(0, 10)
}

export function SalesHistoryClient({ orders, items, payments, receiptEmails, isAdmin }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<string>('')
  const [reprintData, setReprintData] = useState<ReceiptData | null>(null)
  const [reopening, setReopening] = useState<string | null>(null)
  const [viewingReceiptHtml, setViewingReceiptHtml] = useState<string | null>(null)

  const itemsByOrder = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const item of items) {
      if (!m.has(item.order_id)) m.set(item.order_id, [])
      m.get(item.order_id)!.push(item)
    }
    return m
  }, [items])

  const paymentsByOrder = useMemo(() => {
    const m = new Map<string, Payment[]>()
    for (const p of payments) {
      if (!m.has(p.order_id)) m.set(p.order_id, [])
      m.get(p.order_id)!.push(p)
    }
    return m
  }, [payments])

  const emailsByOrder = useMemo(() => {
    const m = new Map<string, ReceiptEmail[]>()
    for (const e of receiptEmails) {
      if (!m.has(e.order_id)) m.set(e.order_id, [])
      m.get(e.order_id)!.push(e)
    }
    return m
  }, [receiptEmails])

  const availableDates = useMemo(() => {
    const dates = [...new Set(orders.map(o => getBusinessDateStr(o.opened_at)))]
    return dates.sort((a, b) => b.localeCompare(a))
  }, [orders])

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const q = search.toLowerCase()
      const matchesSearch = !q ||
        (o.table_name ?? '').toLowerCase().includes(q) ||
        (o.server_name ?? '').toLowerCase().includes(q) ||
        (o.section ?? '').toLowerCase().includes(q)
      const matchesDate = !dateFilter || getBusinessDateStr(o.opened_at) === dateFilter
      return matchesSearch && matchesDate
    })
  }, [orders, search, dateFilter])

  const stats = useMemo(() => {
    const totalRevenue = filtered.reduce((s, o) => s + (o.total ?? 0), 0)
    const totalCovers = filtered.reduce((s, o) => s + (o.covers ?? 0), 0)
    const avgBill = filtered.length > 0 ? totalRevenue / filtered.length : 0
    const avgPerCover = totalCovers > 0 ? totalRevenue / totalCovers : 0
    return { totalRevenue, totalCovers, avgBill, avgPerCover, count: filtered.length }
  }, [filtered])

  const grouped = useMemo(() => {
    const map = new Map<string, Order[]>()
    for (const o of filtered) {
      const d = getBusinessDateStr(o.opened_at)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(o)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  function buildReprintData(order: Order): ReceiptData {
    const orderItems = (itemsByOrder.get(order.id) ?? []).filter(i => !i.voided_at)
    const orderPayments = paymentsByOrder.get(order.id) ?? []
    return {
      orderId: order.id,
      tableName: order.table_name,
      serverName: order.server_name,
      covers: order.covers,
      openedAt: order.opened_at,
      closedAt: order.closed_at,
      items: orderItems.map(i => ({
        id: i.id,
        item_name: i.item_name,
        category: i.category,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount ?? 0,
        voided_at: i.voided_at,
      })),
      subtotal: order.subtotal ?? 0,
      discountAmount: order.discount_amount ?? 0,
      discountLabel: order.discount_label,
      serviceCharge: order.service_charge ?? 0,
      taxAmount: order.tax_amount ?? 0,
      total: order.total ?? 0,
      payments: orderPayments.map(p => ({ method: p.method, amount: p.amount })),
      footerNote: 'Thank you and Come Again!',
      isPreliminary: false,
    }
  }

  function exportCsv() {
    const header = ['Date', 'Table', 'Section', 'Server', 'Covers', 'Opened', 'Closed', 'Duration', 'Subtotal', 'Discount', 'Service Charge', 'Tax', 'Total', 'Payment Methods']
    const rows = filtered.map(o => {
      const orderPayments = paymentsByOrder.get(o.id) ?? []
      const payStr = orderPayments.map(p => `${METHOD_LABELS[p.method] ?? p.method} ${fmtRaw(p.amount)}`).join('; ')
      return [
        getBusinessDateStr(o.opened_at),
        o.table_name ?? 'Walk-in',
        o.section ?? '',
        o.server_name ?? '',
        o.covers,
        formatTime(o.opened_at),
        o.closed_at ? formatTime(o.closed_at) : '',
        o.closed_at ? getDuration(o.opened_at, o.closed_at) : '',
        fmtRaw(o.subtotal ?? 0),
        fmtRaw(o.discount_amount ?? 0),
        fmtRaw(o.service_charge ?? 0),
        fmtRaw(o.tax_amount ?? 0),
        fmtRaw(o.total ?? 0),
        payStr,
      ]
    })
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `arkib-sales-${dateFilter || 'all'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleReopen(orderId: string) {
    if (!confirm('Reopen this order? This will reverse payments and daily sales figures. The order will return to the floor and must be paid again.')) return
    setReopening(orderId)
    try {
      const res = await fetch('/api/pos/reopen-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to reopen')
      toast('Order reopened — it\'s back on the floor', 'success')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to reopen order', 'error')
    } finally {
      setReopening(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#0D0D10] text-[#F0EEF6] p-4 sm:p-6">
      <TopBar title="Sales History" subtitle="Closed bills by table" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#9896A4] text-xs mb-2">
            <Receipt size={13} /> Tables Served
          </div>
          <p className="text-[#F0EEF6] text-2xl font-bold">{stats.count}</p>
        </div>
        <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#9896A4] text-xs mb-2">
            <Users size={13} /> Total Covers
          </div>
          <p className="text-[#F0EEF6] text-2xl font-bold">{stats.totalCovers}</p>
        </div>
        <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#9896A4] text-xs mb-2">
            <TrendingUp size={13} /> Total Revenue
          </div>
          <p className="text-[#F0EEF6] text-lg font-bold">{fmt(stats.totalRevenue)}</p>
        </div>
        <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#9896A4] text-xs mb-2">
            <TrendingUp size={13} /> Avg Bill
          </div>
          <p className="text-[#F0EEF6] text-lg font-bold">{fmt(stats.avgBill)}</p>
          <p className="text-[#5A5865] text-xs mt-0.5">{fmt(stats.avgPerCover)} / cover</p>
        </div>
      </div>

      {/* Filters + Export */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
          <input
            type="text"
            placeholder="Search table, server, section…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#141417] border border-[#2A2A30] rounded-lg pl-9 pr-4 py-2 text-sm text-[#F0EEF6] placeholder-[#5A5865] focus:outline-none focus:border-[#6C63FF]/60"
          />
        </div>
        <div className="relative">
          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="bg-[#141417] border border-[#2A2A30] rounded-lg pl-9 pr-8 py-2 text-sm text-[#F0EEF6] focus:outline-none focus:border-[#6C63FF]/60 appearance-none"
          >
            <option value="">All dates</option>
            {availableDates.map(d => (
              <option key={d} value={d}>
                {new Date(d + 'T12:00:00').toLocaleDateString('en-MY', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 bg-[#141417] border border-[#2A2A30] hover:border-[#6C63FF]/40 rounded-lg px-4 py-2 text-sm text-[#9896A4] hover:text-[#F0EEF6] transition-colors shrink-0"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Grouped order list */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#5A5865]">
          <Receipt size={32} className="mb-3 opacity-40" />
          <p className="text-sm">No closed bills found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, dayOrders]) => {
            const dayRevenue = dayOrders.reduce((s, o) => s + (o.total ?? 0), 0)
            const dayCovers = dayOrders.reduce((s, o) => s + (o.covers ?? 0), 0)
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[#F0EEF6] font-semibold text-sm">
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-MY', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-[#5A5865] text-xs">{dayOrders.length} tables · {dayCovers} covers</span>
                  </div>
                  <span className="text-[#9896A4] text-sm font-medium">{fmt(dayRevenue)}</span>
                </div>

                <div className="rounded-xl border border-[#2A2A30] bg-[#141417] overflow-hidden divide-y divide-[#1E1E24]">
                  {dayOrders.map(order => {
                    const orderItems = (itemsByOrder.get(order.id) ?? []).filter(i => !i.voided_at)
                    const orderPayments = paymentsByOrder.get(order.id) ?? []
                    const orderEmails = emailsByOrder.get(order.id) ?? []
                    const isExpanded = expandedId === order.id

                    const categoryGroups = orderItems.reduce((acc, item) => {
                      const cat = item.category ?? 'others'
                      if (!acc[cat]) acc[cat] = []
                      acc[cat].push(item)
                      return acc
                    }, {} as Record<string, Item[]>)

                    return (
                      <div key={order.id}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : order.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1A1A20] transition-colors text-left"
                        >
                          <div className="shrink-0 w-10 h-10 rounded-lg bg-[#6C63FF]/15 border border-[#6C63FF]/20 flex flex-col items-center justify-center">
                            <span className="text-[#6C63FF] text-[10px] font-bold leading-none">
                              {(order.table_name ?? 'W').slice(0, 2).toUpperCase()}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[#F0EEF6] font-medium text-sm truncate">
                                {order.table_name ?? 'Walk-in'}
                              </span>
                              {order.section && (
                                <span className="text-[#5A5865] text-xs shrink-0">{order.section}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[#9896A4] text-xs">
                              <span className="flex items-center gap-1">
                                <Users size={10} /> {order.covers}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {formatTime(order.opened_at)}
                                {order.closed_at && ` · ${getDuration(order.opened_at, order.closed_at)}`}
                              </span>
                              {order.server_name && (
                                <span className="truncate">{order.server_name}</span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5 mr-2">
                            {orderPayments.map((p, i) => (
                              <span key={i} className="flex items-center gap-1 text-[#9896A4] text-xs bg-[#0E0E11] border border-[#2A2A30] rounded px-1.5 py-0.5">
                                {METHOD_ICONS[p.method] ?? <CreditCard size={12} />}
                                {fmt(p.amount)}
                              </span>
                            ))}
                          </div>

                          <div className="shrink-0 text-right mr-2">
                            <p className="text-[#F0EEF6] font-semibold text-sm">{fmt(order.total ?? 0)}</p>
                            {(order.discount_amount ?? 0) > 0 && (
                              <p className="text-amber-400 text-xs">-{fmt(order.discount_amount)}</p>
                            )}
                          </div>

                          {isExpanded
                            ? <ChevronUp size={14} className="text-[#5A5865] shrink-0" />
                            : <ChevronDown size={14} className="text-[#5A5865] shrink-0" />
                          }
                        </button>

                        {isExpanded && (
                          <div className="border-t border-[#1E1E24] bg-[#0E0E11] px-4 py-4">
                            {orderItems.length === 0 ? (
                              <p className="text-[#5A5865] text-xs">No items recorded.</p>
                            ) : (
                              <div className="space-y-3">
                                {Object.entries(categoryGroups).map(([cat, catItems]) => (
                                  <div key={cat}>
                                    <p className="text-[#5A5865] text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                                      {CATEGORY_LABELS[cat] ?? cat}
                                    </p>
                                    <div className="space-y-1">
                                      {catItems.map((item, i) => {
                                        const lineTotal = item.quantity * item.unit_price - (item.discount ?? 0)
                                        return (
                                          <div key={i} className="flex items-center justify-between text-sm">
                                            <span className="text-[#F0EEF6] flex-1 truncate">{item.item_name}</span>
                                            <span className="text-[#9896A4] mx-3 shrink-0 text-xs">×{item.quantity}</span>
                                            <span className="text-[#F0EEF6] shrink-0 font-medium">{fmt(lineTotal)}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Bill summary */}
                            <div className="mt-4 pt-3 border-t border-[#2A2A30] space-y-1 text-xs">
                              <div className="flex justify-between text-[#9896A4]">
                                <span>Subtotal</span>
                                <span>{fmt(order.subtotal ?? 0)}</span>
                              </div>
                              {(order.discount_amount ?? 0) > 0 && (
                                <div className="flex justify-between text-amber-400">
                                  <span>Discount{order.discount_label ? ` (${order.discount_label})` : ''}</span>
                                  <span>-{fmt(order.discount_amount)}</span>
                                </div>
                              )}
                              {(order.service_charge ?? 0) > 0 && (
                                <div className="flex justify-between text-[#9896A4]">
                                  <span>Service Charge</span>
                                  <span>{fmt(order.service_charge)}</span>
                                </div>
                              )}
                              {(order.tax_amount ?? 0) > 0 && (
                                <div className="flex justify-between text-[#9896A4]">
                                  <span>Tax</span>
                                  <span>{fmt(order.tax_amount)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-[#F0EEF6] font-semibold pt-1 border-t border-[#2A2A30]">
                                <span>Total</span>
                                <span>{fmt(order.total ?? 0)}</span>
                              </div>
                            </div>

                            {/* Payments */}
                            {orderPayments.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-[#2A2A30]">
                                <p className="text-[#5A5865] text-[10px] font-semibold uppercase tracking-wider mb-1.5">Payments</p>
                                <div className="flex flex-wrap gap-2">
                                  {orderPayments.map((p, i) => (
                                    <span key={i} className="flex items-center gap-1.5 text-xs bg-[#141417] border border-[#2A2A30] rounded-lg px-2.5 py-1.5 text-[#F0EEF6]">
                                      {METHOD_ICONS[p.method] ?? <CreditCard size={12} />}
                                      <span className="text-[#9896A4]">{METHOD_LABELS[p.method] ?? p.method}</span>
                                      <span className="font-medium">{fmt(p.amount)}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Email receipt log */}
                            {orderEmails.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-[#2A2A30]">
                                <p className="text-[#5A5865] text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <Mail size={10} /> Receipt Emails Sent
                                </p>
                                <div className="space-y-1.5">
                                  {orderEmails.map(e => (
                                    <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[#F0EEF6] truncate">{e.sent_to}</span>
                                        <span className="text-[#5A5865] shrink-0">
                                          {new Date(e.sent_at).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </span>
                                        {e.sent_by_name && (
                                          <span className="text-[#5A5865] shrink-0">by {e.sent_by_name}</span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => setViewingReceiptHtml(e.receipt_html)}
                                        className="shrink-0 flex items-center gap-1 text-[#6C63FF] hover:text-[#A78BFA] transition-colors"
                                      >
                                        <Eye size={11} /> View
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="mt-4 pt-3 border-t border-[#2A2A30] flex flex-wrap gap-2">
                              <button
                                onClick={() => setReprintData(buildReprintData(order))}
                                className="flex items-center gap-1.5 text-xs bg-[#141417] border border-[#2A2A30] hover:border-[#6C63FF]/40 rounded-lg px-3 py-1.5 text-[#9896A4] hover:text-[#F0EEF6] transition-colors"
                              >
                                <Printer size={12} />
                                Reprint Receipt
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleReopen(order.id)}
                                  disabled={reopening === order.id}
                                  className="flex items-center gap-1.5 text-xs bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 rounded-lg px-3 py-1.5 text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
                                >
                                  <RotateCcw size={12} />
                                  {reopening === order.id ? 'Reopening…' : 'Reopen Order'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {reprintData && (
        <ReceiptPrint
          data={reprintData}
          onClose={() => setReprintData(null)}
        />
      )}

      {/* View emailed receipt modal */}
      {viewingReceiptHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-lg bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 bg-[#1a0a2e]">
              <span className="text-white text-sm font-semibold">Emailed Receipt</span>
              <button
                onClick={() => setViewingReceiptHtml(null)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <iframe
                srcDoc={viewingReceiptHtml}
                className="w-full border-0"
                style={{ minHeight: '600px' }}
                title="Receipt"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
