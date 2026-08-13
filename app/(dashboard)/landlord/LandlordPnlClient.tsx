'use client'

import { useEffect, useState, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { formatCurrency, EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import {
  Download, ChevronLeft, ChevronRight, AlertTriangle,
  Info, X, ExternalLink, FileText, CheckCircle2, XCircle,
  TrendingUp, TrendingDown, ChevronDown, ChevronUp,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PnlData {
  month: string
  year: number
  monthNum: number
  profitShareRate: number
  isOutsideContractPeriod: boolean
  revenue: {
    total: number
    cocktails: number
    beer: number
    wine: number
    food: number
    others: number
  }
  cogs: number
  cogsBreakdown: { name: string; qty: number; totalCogs: number }[]
  grossProfit: number
  operatingExpenses: {
    total: number
    nonRentalTotal: number
    byCategory: Record<string, number>
    lines: {
      id: string
      date: string
      category: string
      description: string
      amount: number
      supplier_name: string | null
      receipt_url: string | null
    }[]
    rental: {
      total: number
      records: {
        id: string
        name: string
        amount: number
        status: string
        due_date: string | null
        paid_date: string | null
        payment_method: string | null
        receipt_url: string | null
        notes: string | null
      }[]
    }
  }
  grossOperatingProfit: number
  landlordEntitlement: number
  tenantProfit: number
  status: 'profit_share_payable' | 'no_profit_share_payable'
  hasManualAdjustments: boolean
  manualAdjustments: {
    id: string
    actorName: string | null
    event: string
    entityId: string | null
    payload: Record<string, unknown> | null
    createdAt: string
  }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
}

function contractTierLabel(rate: number) {
  if (rate === 0.15) return '15% (01 Jul 2025 – 30 Jun 2026)'
  if (rate === 0.30) return '30% (01 Jul 2026 – 31 Jul 2028)'
  return `${(rate * 100).toFixed(0)}%`
}

function statusBadge(status: string) {
  if (status === 'paid') return <span className="inline-flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle2 size={11} /> Paid</span>
  if (status === 'unpaid') return <span className="inline-flex items-center gap-1 text-amber-400 text-xs"><AlertTriangle size={11} /> Unpaid</span>
  if (status === 'overdue') return <span className="inline-flex items-center gap-1 text-rose-400 text-xs"><XCircle size={11} /> Overdue</span>
  return <span className="text-[#9896A4] text-xs capitalize">{status}</span>
}

function PnlRow({ label, value, sub, indent = false, bold = false, color = '' }: {
  label: string; value: string; sub?: string; indent?: boolean; bold?: boolean; color?: string
}) {
  return (
    <div className={`flex items-baseline justify-between py-1.5 ${indent ? 'pl-4' : ''}`}>
      <span className={`text-sm ${bold ? 'text-[#F0EEF6] font-semibold' : 'text-[#9896A4]'}`}>{label}</span>
      <div className="text-right">
        <span className={`text-sm font-medium tabular-nums ${color || (bold ? 'text-[#F0EEF6]' : 'text-[#F0EEF6]')}`}>{value}</span>
        {sub && <p className="text-[#5A5865] text-[10px]">{sub}</p>}
      </div>
    </div>
  )
}

function Divider({ label }: { label?: string }) {
  if (!label) return <div className="border-t border-[#2A2A30] my-1" />
  return (
    <div className="flex items-center gap-2 my-2">
      <div className="flex-1 border-t border-[#2A2A30]" />
      <span className="text-[#5A5865] text-[10px] uppercase tracking-widest">{label}</span>
      <div className="flex-1 border-t border-[#2A2A30]" />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function LandlordPnlClient({ userRole }: { userRole: string }) {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000) // Malaysia time
  const [year, setYear] = useState(now.getUTCFullYear())
  const [month, setMonth] = useState(now.getUTCMonth() + 1)
  const [data, setData] = useState<PnlData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Detail panel states
  const [showExpenseLines, setShowExpenseLines] = useState(false)
  const [showCogsBreakdown, setShowCogsBreakdown] = useState(false)
  const [showAdjustments, setShowAdjustments] = useState(false)
  const [showRentalDetail, setShowRentalDetail] = useState(false)

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/landlord/pnl?year=${y}&month=${m}`)
      if (!res.ok) {
        const j = await res.json()
        setError(j.error ?? 'Failed to load')
        return
      }
      setData(await res.json())
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(year, month) }, [year, month, fetchData])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <TopBar
        title="Landlord P&L"
        subtitle="Monthly Gross Operating Profit & Contractual Entitlement"
        actions={
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 text-xs print:hidden">
            <Download size={12} /> Export / Print
          </button>
        }
      />

      {/* Month selector */}
      <div className="card flex items-center justify-between print:hidden">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-[#1A1A1E] text-[#9896A4] hover:text-[#F0EEF6] transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-[#F0EEF6] font-bold text-lg">{monthLabel(year, month)}</p>
          <p className="text-[#5A5865] text-xs">Monthly Profit & Loss Account</p>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-[#1A1A1E] text-[#9896A4] hover:text-[#F0EEF6] transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Print header (hidden on screen) */}
      <div className="hidden print:block text-center border-b border-gray-300 pb-4 mb-4">
        <p className="font-bold text-xl">ARKIB</p>
        <p className="text-sm text-gray-600">Monthly Profit & Loss Account</p>
        <p className="font-semibold">{monthLabel(year, month)}</p>
        <p className="text-xs text-gray-500 mt-1">Prepared for Landlord / Management Review</p>
        <p className="text-xs text-gray-500">Generated: {new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>

      {loading && (
        <div className="card text-center py-12">
          <div className="animate-pulse text-[#5A5865]">Loading P&L data…</div>
        </div>
      )}

      {error && (
        <div className="card bg-rose-500/5 border-rose-500/20">
          <p className="text-rose-400 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Outside contract period warning */}
          {data.isOutsideContractPeriod && (
            <div className="card bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300 text-sm">
                This period is outside the defined contractual period (01 Jul 2025 – 31 Jul 2028). No contractual profit-share rate is applicable.
              </p>
            </div>
          )}

          {/* Manual adjustment warning */}
          {data.hasManualAdjustments && (
            <div className="card bg-amber-500/5 border border-amber-500/20 flex items-start gap-3 print:border-gray-300">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-amber-300 text-sm font-medium">
                  ⚠ Manual adjustment{data.manualAdjustments.length !== 1 ? 's' : ''} included in this period
                </p>
                <p className="text-[#9896A4] text-xs mt-0.5">
                  {data.manualAdjustments.length} adjustment{data.manualAdjustments.length !== 1 ? 's' : ''} recorded to revenue data.
                  All figures remain accurate — adjustments were made by authorised personnel.
                </p>
                <button
                  onClick={() => setShowAdjustments(v => !v)}
                  className="mt-2 text-amber-400 text-xs underline underline-offset-2 print:hidden"
                >
                  {showAdjustments ? 'Hide detail' : 'View adjustment log'}
                </button>
              </div>
            </div>
          )}

          {/* Adjustment detail panel */}
          {showAdjustments && data.manualAdjustments.length > 0 && (
            <div className="card print:hidden">
              <div className="flex items-center justify-between mb-3">
                <p className="section-title">Manual Adjustment Log</p>
                <button onClick={() => setShowAdjustments(false)} className="text-[#5A5865] hover:text-[#9896A4]"><X size={14} /></button>
              </div>
              <div className="space-y-3">
                {data.manualAdjustments.map(adj => (
                  <div key={adj.id} className="bg-[#1A1A1E] rounded-lg p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#F0EEF6] text-sm font-medium">{adj.event?.replace(/_/g, ' ')}</span>
                      <span className="text-[#5A5865] text-xs whitespace-nowrap">
                        {new Date(adj.createdAt).toLocaleString('en-MY')}
                      </span>
                    </div>
                    <p className="text-[#9896A4] text-xs">By: {adj.actorName ?? 'Unknown'}</p>
                    {adj.payload && (
                      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                        {adj.payload.before != null && (
                          <><span className="text-[#5A5865]">Before</span><span className="text-[#9896A4]">{String(adj.payload.before)}</span></>
                        )}
                        {adj.payload.after != null && (
                          <><span className="text-[#5A5865]">After</span><span className="text-[#F0EEF6]">{String(adj.payload.after)}</span></>
                        )}
                        {adj.payload.reason != null && (
                          <><span className="text-[#5A5865]">Reason</span><span className="text-[#9896A4] col-span-1">{String(adj.payload.reason)}</span></>
                        )}
                        {adj.payload.description != null && (
                          <><span className="text-[#5A5865]">Note</span><span className="text-[#9896A4] col-span-1">{String(adj.payload.description)}</span></>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Main P&L Statement ─────────────────────────────────────── */}
          <div className="card print:shadow-none print:border print:border-gray-200">
            {/* Header */}
            <div className="text-center mb-6 pb-4 border-b border-[#2A2A30] print:border-gray-300">
              <div className="text-[#8B5CF6] font-bold tracking-widest text-sm mb-1 print:text-gray-800">ARKIB</div>
              <p className="text-[#F0EEF6] font-bold text-lg print:text-gray-900">{monthLabel(year, month)}</p>
              <p className="text-[#9896A4] text-xs print:text-gray-600">Monthly Profit & Loss Account — Landlord / Management View</p>
            </div>

            {/* REVENUE */}
            <div className="mb-2">
              <p className="text-[#8B5CF6] text-xs uppercase tracking-widest font-semibold mb-1 print:text-gray-700">Revenue</p>
              <PnlRow label="Cocktails" value={formatCurrency(data.revenue.cocktails)} indent />
              <PnlRow label="Beer" value={formatCurrency(data.revenue.beer)} indent />
              <PnlRow label="Wine" value={formatCurrency(data.revenue.wine)} indent />
              <PnlRow label="Food" value={formatCurrency(data.revenue.food)} indent />
              <PnlRow label="Others" value={formatCurrency(data.revenue.others)} indent />
              <Divider />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#F0EEF6] font-bold">REVENUE</span>
                <div className="text-right">
                  <span className="text-emerald-400 font-bold text-lg tabular-nums">{formatCurrency(data.revenue.total)}</span>
                  {data.hasManualAdjustments && (
                    <p className="text-amber-400 text-[10px] flex items-center justify-end gap-0.5 mt-0.5">
                      <AlertTriangle size={9} /> {data.manualAdjustments.length} manual adjustment{data.manualAdjustments.length !== 1 ? 's' : ''} included
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* LESS COGS */}
            <div className="mb-2">
              <PnlRow
                label="LESS: Cost of Goods Sold (COGS)"
                value={`(${formatCurrency(data.cogs)})`}
                bold
                color="text-[#9896A4]"
              />
              {/* COGS toggle */}
              <button
                onClick={() => setShowCogsBreakdown(v => !v)}
                className="flex items-center gap-1 text-[#5A5865] text-xs pl-4 pb-1 hover:text-[#9896A4] print:hidden"
              >
                {showCogsBreakdown ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {showCogsBreakdown ? 'Hide' : 'Show'} cocktail breakdown
              </button>
              {showCogsBreakdown && data.cogsBreakdown.length > 0 && (
                <div className="ml-4 mb-2 bg-[#1A1A1E] rounded-lg p-3 print:hidden">
                  <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-2">COGS Breakdown by Cocktail</p>
                  <div className="space-y-1">
                    {data.cogsBreakdown.map(c => (
                      <div key={c.name} className="flex items-center justify-between text-xs">
                        <span className="text-[#9896A4]">{c.name} <span className="text-[#5A5865]">×{c.qty}</span></span>
                        <span className="text-[#F0EEF6] tabular-nums">{formatCurrency(c.totalCogs)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* GROSS PROFIT */}
            <div className="bg-[#1A1A1E] rounded-lg px-4 py-3 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#F0EEF6] font-bold">GROSS PROFIT</p>
                  <p className="text-[#5A5865] text-[10px]">Revenue less COGS</p>
                </div>
                <span className={`font-bold text-xl tabular-nums ${data.grossProfit >= 0 ? 'text-[#F0EEF6]' : 'text-rose-400'}`}>
                  {data.grossProfit < 0 ? `(${formatCurrency(Math.abs(data.grossProfit))})` : formatCurrency(data.grossProfit)}
                </span>
              </div>
              {data.revenue.total > 0 && (
                <p className="text-[#5A5865] text-xs mt-1">
                  Gross margin: {((data.grossProfit / data.revenue.total) * 100).toFixed(1)}%
                </p>
              )}
            </div>

            {/* LESS OPERATING EXPENSES */}
            <div className="mb-2">
              <p className="text-[#8B5CF6] text-xs uppercase tracking-widest font-semibold mb-1 print:text-gray-700">Less: Operating Expenses</p>

              {/* Rental (authoritative — from rental_records) */}
              <div>
                <div className="flex items-center justify-between py-1.5 pl-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[#9896A4] text-sm">Rental</span>
                    <button
                      onClick={() => setShowRentalDetail(v => !v)}
                      className="text-[#5A5865] hover:text-[#9896A4] print:hidden"
                    >
                      {showRentalDetail ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  </div>
                  <span className="text-[#F0EEF6] text-sm font-medium tabular-nums">{formatCurrency(data.operatingExpenses.rental.total)}</span>
                </div>
                {showRentalDetail && data.operatingExpenses.rental.records.length > 0 && (
                  <div className="ml-4 mb-2 bg-[#1A1A1E] rounded-lg p-3 print:hidden">
                    {data.operatingExpenses.rental.records.map(r => (
                      <div key={r.id} className="flex items-start justify-between py-1.5 border-b border-[#2A2A30] last:border-0">
                        <div>
                          <p className="text-[#9896A4] text-xs">{r.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">{statusBadge(r.status)}</div>
                          {r.paid_date && <p className="text-[#5A5865] text-[10px] mt-0.5">Paid: {r.paid_date}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-[#F0EEF6] text-sm tabular-nums">{formatCurrency(r.amount)}</p>
                          {r.receipt_url && (
                            <a href={r.receipt_url} target="_blank" rel="noreferrer" className="text-[#8B5CF6] text-[10px] flex items-center gap-0.5 justify-end mt-0.5">
                              <FileText size={9} /> Receipt
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {data.operatingExpenses.rental.total === 0 && (
                  <p className="text-[#5A5865] text-xs pl-8 pb-1">No rental records for this period</p>
                )}
              </div>

              {/* Other expense categories */}
              {Object.entries(data.operatingExpenses.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => (
                  <PnlRow
                    key={cat}
                    label={cat === 'salary' ? 'Payroll (Aggregate)' : (EXPENSE_CATEGORY_LABELS[cat] ?? cat)}
                    value={formatCurrency(amt)}
                    indent
                  />
                ))}

              <Divider />
              <PnlRow
                label="TOTAL OPERATING EXPENSES"
                value={`(${formatCurrency(data.operatingExpenses.total)})`}
                bold
                color="text-rose-400"
              />

              {/* Expense lines toggle */}
              {data.operatingExpenses.lines.length > 0 && (
                <div className="mt-1">
                  <button
                    onClick={() => setShowExpenseLines(v => !v)}
                    className="flex items-center gap-1 text-[#5A5865] text-xs hover:text-[#9896A4] print:hidden"
                  >
                    {showExpenseLines ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    {showExpenseLines ? 'Hide' : 'View'} individual expense lines ({data.operatingExpenses.lines.length})
                  </button>
                  {showExpenseLines && (
                    <div className="mt-2 bg-[#1A1A1E] rounded-lg p-3 print:hidden">
                      <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-2">Individual Expense Lines — excludes payroll detail</p>
                      <div className="space-y-2">
                        {data.operatingExpenses.lines.map(e => (
                          <div key={e.id} className="flex items-start justify-between py-1 border-b border-[#2A2A30] last:border-0">
                            <div>
                              <p className="text-[#9896A4] text-xs">{e.description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[#5A5865] text-[10px]">{EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}</span>
                                {e.supplier_name && <span className="text-[#5A5865] text-[10px]">· {e.supplier_name}</span>}
                                <span className="text-[#5A5865] text-[10px]">· {e.date}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="text-[#F0EEF6] text-sm tabular-nums">{formatCurrency(e.amount)}</p>
                              {e.receipt_url && (
                                <a href={e.receipt_url} target="_blank" rel="noreferrer" className="text-[#8B5CF6] text-[10px] flex items-center gap-0.5 justify-end mt-0.5">
                                  <FileText size={9} /> Doc <ExternalLink size={8} />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* GROSS OPERATING PROFIT */}
            <div className={`rounded-xl px-4 py-4 mb-4 ${data.grossOperatingProfit >= 0 ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-rose-500/5 border border-rose-500/20'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[#F0EEF6] font-bold flex items-center gap-2">
                    GROSS OPERATING PROFIT
                    {data.grossOperatingProfit >= 0
                      ? <TrendingUp size={14} className="text-emerald-400" />
                      : <TrendingDown size={14} className="text-rose-400" />
                    }
                  </p>
                  <p className="text-[#5A5865] text-[10px] mt-0.5">Gross Profit less all Operating Expenses including Rental</p>
                </div>
                <span className={`font-bold text-2xl tabular-nums ${data.grossOperatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {data.grossOperatingProfit < 0
                    ? `(${formatCurrency(Math.abs(data.grossOperatingProfit))})`
                    : formatCurrency(data.grossOperatingProfit)
                  }
                </span>
              </div>
              {data.revenue.total > 0 && (
                <p className="text-[#5A5865] text-xs mt-2">
                  GOP margin: {((data.grossOperatingProfit / data.revenue.total) * 100).toFixed(1)}%
                </p>
              )}
            </div>

            {/* LANDLORD ENTITLEMENT */}
            <Divider label="Contractual Profit Share" />
            <div className="space-y-1.5 mb-4">
              <div className="flex items-center justify-between py-1">
                <span className="text-[#9896A4] text-sm">Applicable Rate</span>
                <span className="text-[#F0EEF6] text-sm">
                  {data.isOutsideContractPeriod
                    ? 'Outside contract period'
                    : contractTierLabel(data.profitShareRate)
                  }
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[#9896A4] text-sm">Gross Operating Profit</span>
                <span className={`text-sm tabular-nums ${data.grossOperatingProfit >= 0 ? 'text-[#F0EEF6]' : 'text-rose-400'}`}>
                  {data.grossOperatingProfit < 0
                    ? `(${formatCurrency(Math.abs(data.grossOperatingProfit))})`
                    : formatCurrency(data.grossOperatingProfit)
                  }
                </span>
              </div>
              {data.grossOperatingProfit < 0 && (
                <div className="flex items-start gap-2 bg-[#1A1A1E] rounded-lg px-3 py-2 mt-1">
                  <Info size={13} className="text-[#5A5865] shrink-0 mt-0.5" />
                  <p className="text-[#9896A4] text-xs">
                    Gross Operating Profit is negative for this period. Per the Tenancy Agreement, no profit-share is payable when there is no profit to share.
                  </p>
                </div>
              )}
            </div>

            {/* Entitlement / profit boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={`rounded-xl p-4 text-center ${data.landlordEntitlement > 0 ? 'bg-[#8B5CF6]/10 border border-[#8B5CF6]/20' : 'bg-[#1A1A1E] border border-[#2A2A30]'}`}>
                <p className="text-[#9896A4] text-xs mb-1">LANDLORD ENTITLEMENT</p>
                <p className={`font-bold text-xl tabular-nums ${data.landlordEntitlement > 0 ? 'text-[#A78BFA]' : 'text-[#5A5865]'}`}>
                  {formatCurrency(data.landlordEntitlement)}
                </p>
                {data.status === 'no_profit_share_payable'
                  ? <p className="text-[#5A5865] text-[10px] mt-1">No Profit Share Payable</p>
                  : <p className="text-[#8B5CF6] text-[10px] mt-1">{(data.profitShareRate * 100).toFixed(0)}% of GOP</p>
                }
              </div>

              <div className="bg-[#1A1A1E] rounded-xl p-4 text-center border border-[#2A2A30]">
                <p className="text-[#9896A4] text-xs mb-1">TENANT PROFIT</p>
                <p className={`font-bold text-xl tabular-nums ${data.tenantProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {data.tenantProfit < 0
                    ? `(${formatCurrency(Math.abs(data.tenantProfit))})`
                    : formatCurrency(data.tenantProfit)
                  }
                </p>
                <p className="text-[#5A5865] text-[10px] mt-1">GOP less Landlord Entitlement</p>
              </div>

              <div className={`rounded-xl p-4 text-center border ${data.status === 'profit_share_payable' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#1A1A1E] border-[#2A2A30]'}`}>
                <p className="text-[#9896A4] text-xs mb-1">STATUS</p>
                <p className={`font-semibold text-sm ${data.status === 'profit_share_payable' ? 'text-emerald-400' : 'text-[#5A5865]'}`}>
                  {data.status === 'profit_share_payable' ? 'Profit Share Payable' : 'No Profit Share Payable'}
                </p>
                <p className="text-[#5A5865] text-[10px] mt-1">{monthLabel(year, month)}</p>
              </div>
            </div>

            {/* Print-only summary */}
            <div className="hidden print:block mt-6 border-t border-gray-200 pt-4 text-xs text-gray-500 space-y-1">
              <p>Contractual basis: Tenancy Agreement — {contractTierLabel(data.profitShareRate)}</p>
              <p>All figures in Malaysian Ringgit (MYR). COGS based on transactional cost at time of sale.</p>
              <p>Rental figures sourced from rental payment records. Operating expenses sourced from expense ledger (rental excluded to prevent double-counting).</p>
              {data.hasManualAdjustments && (
                <p>⚠ Revenue includes {data.manualAdjustments.length} manual adjustment(s) made by authorised personnel. Full audit log available on request.</p>
              )}
            </div>
          </div>

          {/* Data sources note */}
          <div className="flex items-start gap-3 bg-[#1A1A1E] border border-[#2A2A30] rounded-xl px-4 py-3 print:hidden">
            <Info size={14} className="text-[#5A5865] shrink-0 mt-0.5" />
            <div className="text-xs text-[#5A5865] space-y-0.5">
              <p><span className="text-[#9896A4]">Revenue</span> — daily sales records (POS)</p>
              <p><span className="text-[#9896A4]">COGS</span> — transactional cocktail sales; unit cost locked at time of sale</p>
              <p><span className="text-[#9896A4]">Rental</span> — rental payment records (authoritative); expenses with rental category excluded to prevent double-counting</p>
              <p><span className="text-[#9896A4]">Other expenses</span> — expense ledger; payroll shown as aggregate total only</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
