'use client'

import { useEffect, useState, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { formatCurrency, EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import {
  Download, ChevronLeft, ChevronRight, AlertTriangle,
  ChevronDown, ChevronUp, FileText, ExternalLink,
  CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown,
  Info, Shield,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpenseLine {
  id: string; date: string; category: string
  description: string; amount: number
  supplier_name: string | null; receipt_url: string | null
}

interface RentalRecord {
  id: string; name: string; amount: number; status: string
  due_date: string | null; paid_date: string | null
  payment_method: string | null; receipt_url: string | null; notes: string | null
}

interface StartupObligation {
  id: string; name: string; type: string
  originalAmount: number; paidAmount: number; remaining: number
  status: string; notes: string | null
}

interface PnlData {
  month: string; year: number; monthNum: number
  profitShareRate: number; isOutsideContractPeriod: boolean
  revenue: { total: number; cocktails: number; beer: number; wine: number; food: number; others: number }
  cogs: number
  cogsBreakdown: { name: string; qty: number; totalCogs: number }[]
  cogsComplete: boolean; cogsZeroCount: number
  grossProfit: number
  operatingExpenses: {
    total: number; nonRentalTotal: number
    byCategory: Record<string, number>
    lines: ExpenseLine[]
    rental: { total: number; records: RentalRecord[] }
  }
  capexItems: ExpenseLine[]
  grossOperatingProfit: number
  potentialInvestorEntitlement: number
  tenantProfit: number
  hasManualAdjustments: boolean
  manualAdjustments: { id: string; actorName: string | null; event: string; entityId: string | null; payload: Record<string, unknown> | null; createdAt: string }[]
  startupObligations: StartupObligation[]
  totalObligationsRemaining: number
  founderRemuneration: {
    totalAccrued: number; totalPaid: number; outstanding: number
    currentMonthAccrual: number
    records: { month: number; year: number; accrual_amount: number; paid_amount: number }[]
  }
  distributionStatus: 'eligible' | 'deferred_obligations' | 'deferred_negative_gop'
  distributionDeferralReasons: string[]
  actualInvestorDistribution: number
  cashEstimate: number | null
  isOwner: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
}

function rm(n: number, parens = false) {
  const s = formatCurrency(Math.abs(n))
  if (parens && n < 0) return `(${s})`
  if (parens && n > 0) return s
  return s
}

function pct(n: number) { return `${(n * 100).toFixed(0)}%` }

function contractTierLabel(rate: number) {
  if (rate === 0.15) return '15%'
  if (rate === 0.30) return '30%'
  return `${(rate * 100).toFixed(0)}%`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[#5A5865] mb-3">{children}</p>
}

function Divider() {
  return <div className="border-t border-[#2A2A30] my-2" />
}

function PnlLine({
  label, value, indent = 0, bold = false, color, sub, toggle, onToggle,
}: {
  label: string; value: string; indent?: number; bold?: boolean
  color?: string; sub?: string; toggle?: boolean; onToggle?: () => void
}) {
  return (
    <div className={`flex items-baseline justify-between py-1.5`} style={{ paddingLeft: indent * 16 }}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-sm leading-snug ${bold ? 'text-[#F0EEF6] font-semibold' : 'text-[#9896A4]'}`}>{label}</span>
        {onToggle && (
          <button onClick={onToggle} className="text-[#5A5865] hover:text-[#9896A4] print:hidden shrink-0">
            {toggle ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </div>
      <div className="text-right shrink-0 pl-4">
        <span className={`text-sm font-medium tabular-nums ${color ?? (bold ? 'text-[#F0EEF6]' : 'text-[#F0EEF6]')}`}>{value}</span>
        {sub && <p className="text-[#5A5865] text-[10px]">{sub}</p>}
      </div>
    </div>
  )
}

function TotalLine({ label, value, color, large = false }: { label: string; value: string; color?: string; large?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-t border-[#2A2A30] mt-1">
      <span className={`font-semibold ${large ? 'text-base' : 'text-sm'} text-[#F0EEF6] tracking-wide`}>{label}</span>
      <span className={`font-bold tabular-nums ${large ? 'text-base' : 'text-sm'} ${color ?? 'text-[#F0EEF6]'}`}>{value}</span>
    </div>
  )
}

function ExpandButton({ open, onToggle, count }: { open: boolean; onToggle: () => void; count?: number }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-1 text-[#5A5865] hover:text-[#8B5CF6] text-xs mt-1 print:hidden transition-colors">
      {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      {open ? 'Hide details' : `View details${count !== undefined ? ` (${count})` : ''}`}
    </button>
  )
}

function DetailPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 mb-1 bg-[#0F0F12] border border-[#2A2A30] rounded-xl p-4 space-y-2 print:hidden">
      {children}
    </div>
  )
}

function ObligationRow({ o }: { o: StartupObligation }) {
  const cleared = o.remaining <= 0
  return (
    <div className={`rounded-xl border p-4 ${cleared ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-[#2A2A30] bg-[#141417]'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[#F0EEF6] text-sm font-medium">{o.name}</p>
          {o.notes && <p className="text-[#5A5865] text-xs mt-0.5 max-w-xs">{o.notes}</p>}
        </div>
        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${
          cleared
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          {cleared ? 'CLEARED' : 'OUTSTANDING'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Original</p>
          <p className="text-[#9896A4] text-sm font-medium tabular-nums">{formatCurrency(o.originalAmount)}</p>
        </div>
        <div>
          <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Paid</p>
          <p className="text-emerald-400 text-sm font-medium tabular-nums">{formatCurrency(o.paidAmount)}</p>
        </div>
        <div>
          <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Remaining</p>
          <p className={`text-sm font-bold tabular-nums ${cleared ? 'text-emerald-400' : 'text-[#F0EEF6]'}`}>
            {formatCurrency(o.remaining)}
          </p>
        </div>
      </div>
      {!cleared && (
        <div className="mt-3">
          <div className="h-1.5 bg-[#2A2A30] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#8B5CF6] rounded-full transition-all"
              style={{ width: `${Math.min(100, (o.paidAmount / o.originalAmount) * 100)}%` }}
            />
          </div>
          <p className="text-[#5A5865] text-[10px] mt-1 text-right">
            {((o.paidAmount / o.originalAmount) * 100).toFixed(0)}% settled
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function LandlordPnlClient({ userRole }: { userRole: string }) {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const [year,  setYear]  = useState(now.getUTCFullYear())
  const [month, setMonth] = useState(now.getUTCMonth() + 1)
  const [data,  setData]  = useState<PnlData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Progressive disclosure state — all collapsed by default
  const [showCogs,     setShowCogs]     = useState(false)
  const [showOpex,     setShowOpex]     = useState(false)
  const [showRental,   setShowRental]   = useState(false)
  const [showAudit,    setShowAudit]    = useState(false)
  const [showDocs,     setShowDocs]     = useState(false)
  const [showRecon,    setShowRecon]    = useState(false)

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/landlord/pnl?year=${y}&month=${m}`)
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Failed'); return }
      setData(await res.json())
    } catch { setError('Network error') } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(year, month) }, [year, month, fetchData])

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  const gopPositive = (data?.grossOperatingProfit ?? 0) >= 0

  return (
    <div className="space-y-0 print:space-y-4">
      {/* ── SECTION A: HEADER ─────────────────────────────────────────────── */}
      <TopBar
        title="Investor P&L"
        subtitle="Monthly Profit & Loss and Distribution Review"
        actions={
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 text-xs print:hidden">
            <Download size={12} /> Export / Print
          </button>
        }
      />

      <div className="max-w-[1200px] mx-auto px-4 pb-12 space-y-5 mt-4">

        {/* Month navigation */}
        <div className="flex items-center justify-between print:hidden">
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

        {/* Print header */}
        <div className="hidden print:block text-center border-b border-gray-300 pb-4 mb-4">
          <p className="font-bold text-xl tracking-widest">ARKIB</p>
          <p className="text-sm text-gray-600">Investor Monthly Profit & Loss Account</p>
          <p className="font-semibold mt-1">{monthLabel(year, month)}</p>
          <p className="text-xs text-gray-400">Generated: {new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>

        {loading && (
          <div className="card text-center py-16">
            <div className="animate-pulse text-[#5A5865] text-sm">Loading financial data…</div>
          </div>
        )}

        {error && (
          <div className="card bg-rose-500/5 border-rose-500/20">
            <p className="text-rose-400 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Warnings */}
            {data.isOutsideContractPeriod && (
              <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
                <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-300 text-sm">This period is outside the contractual profit-sharing window (01 Jul 2025 – 31 Jul 2028). No rate applies.</p>
              </div>
            )}
            {data.hasManualAdjustments && (
              <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
                <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-amber-300 text-sm font-medium">{data.manualAdjustments.length} manual revenue adjustment{data.manualAdjustments.length !== 1 ? 's' : ''} included</p>
                  <p className="text-[#9896A4] text-xs mt-0.5">All adjustments were made by authorised personnel. Figures remain accurate.</p>
                </div>
              </div>
            )}
            {!data.cogsComplete && (
              <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
                <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-300 text-sm">{data.cogsZeroCount} cocktail{data.cogsZeroCount !== 1 ? 's' : ''} have no cost recorded. COGS may be understated. Run Recalculate COGS in Data Manager.</p>
              </div>
            )}

            {/* ── SECTION B: PERFORMANCE SUMMARY ──────────────────────────── */}
            <div className="grid grid-cols-3 gap-4">
              {/* Revenue */}
              <div className="card text-center">
                <p className="text-[#5A5865] text-[10px] uppercase tracking-widest mb-2">Revenue</p>
                <p className="text-emerald-400 font-bold text-2xl tabular-nums">{formatCurrency(data.revenue.total)}</p>
                <p className="text-[#5A5865] text-xs mt-1">{monthLabel(year, month)}</p>
              </div>
              {/* Gross Profit */}
              <div className="card text-center">
                <p className="text-[#5A5865] text-[10px] uppercase tracking-widest mb-2">Gross Profit</p>
                <p className={`font-bold text-2xl tabular-nums ${data.grossProfit >= 0 ? 'text-[#F0EEF6]' : 'text-rose-400'}`}>
                  {data.grossProfit < 0 ? `(${formatCurrency(Math.abs(data.grossProfit))})` : formatCurrency(data.grossProfit)}
                </p>
                {data.revenue.total > 0 && (
                  <p className="text-[#5A5865] text-xs mt-1">
                    {((data.grossProfit / data.revenue.total) * 100).toFixed(1)}% margin
                  </p>
                )}
              </div>
              {/* GOP */}
              <div className={`card text-center border ${gopPositive ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-rose-500/25 bg-rose-500/5'}`}>
                <p className="text-[#5A5865] text-[10px] uppercase tracking-widest mb-2">
                  Gross Operating Profit
                </p>
                <p className={`font-bold text-2xl tabular-nums flex items-center justify-center gap-2 ${gopPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {gopPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  {data.grossOperatingProfit < 0
                    ? `(${formatCurrency(Math.abs(data.grossOperatingProfit))})`
                    : formatCurrency(data.grossOperatingProfit)}
                </p>
                {data.revenue.total > 0 && (
                  <p className="text-[#5A5865] text-xs mt-1">
                    {((data.grossOperatingProfit / data.revenue.total) * 100).toFixed(1)}% GOP margin
                  </p>
                )}
              </div>
            </div>

            {/* ── SECTION C: P&L STATEMENT ─────────────────────────────────── */}
            <div className="card print:shadow-none print:border print:border-gray-200">
              <div className="border-b border-[#2A2A30] pb-3 mb-4 print:border-gray-300">
                <p className="text-[#8B5CF6] text-[10px] uppercase tracking-[0.15em] font-semibold mb-0.5 print:text-gray-600">ARKIB</p>
                <p className="text-[#F0EEF6] font-bold">Profit & Loss Statement — {monthLabel(year, month)}</p>
              </div>

              {/* REVENUE */}
              <SectionLabel>Revenue</SectionLabel>
              {data.revenue.cocktails > 0 && <PnlLine label="Cocktails" value={formatCurrency(data.revenue.cocktails)} indent={1} />}
              {data.revenue.beer      > 0 && <PnlLine label="Beer"      value={formatCurrency(data.revenue.beer)}      indent={1} />}
              {data.revenue.wine      > 0 && <PnlLine label="Wine"      value={formatCurrency(data.revenue.wine)}      indent={1} />}
              {data.revenue.food      > 0 && <PnlLine label="Food"      value={formatCurrency(data.revenue.food)}      indent={1} />}
              {data.revenue.others    > 0 && <PnlLine label="Others"    value={formatCurrency(data.revenue.others)}    indent={1} />}
              <TotalLine label="TOTAL REVENUE" value={formatCurrency(data.revenue.total)} color="text-emerald-400" />

              <div className="mt-4 mb-1">
                <PnlLine
                  label="Less: Cost of Goods Sold (COGS)"
                  value={`(${formatCurrency(data.cogs)})`}
                  bold
                  color="text-[#9896A4]"
                  toggle={showCogs}
                  onToggle={() => setShowCogs(v => !v)}
                />
                {showCogs && data.cogsBreakdown.length > 0 && (
                  <DetailPanel>
                    <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-2">COGS by Item</p>
                    {data.cogsBreakdown.map(c => (
                      <div key={c.name} className="flex items-center justify-between text-xs py-1 border-b border-[#2A2A30] last:border-0">
                        <span className="text-[#9896A4]">{c.name} <span className="text-[#5A5865]">×{c.qty}</span></span>
                        <span className={`tabular-nums ${c.totalCogs === 0 ? 'text-amber-400' : 'text-[#F0EEF6]'}`}>{formatCurrency(c.totalCogs)}</span>
                      </div>
                    ))}
                  </DetailPanel>
                )}
              </div>

              {/* GROSS PROFIT */}
              <div className={`rounded-xl px-4 py-3 my-3 border ${data.grossProfit >= 0 ? 'bg-[#1A1A1E] border-[#2A2A30]' : 'bg-rose-500/5 border-rose-500/20'}`}>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[#F0EEF6] font-semibold text-sm">GROSS PROFIT</p>
                    <p className="text-[#5A5865] text-[10px] mt-0.5">Revenue less COGS</p>
                  </div>
                  <span className={`font-bold text-lg tabular-nums ${data.grossProfit >= 0 ? 'text-[#F0EEF6]' : 'text-rose-400'}`}>
                    {data.grossProfit < 0 ? `(${formatCurrency(Math.abs(data.grossProfit))})` : formatCurrency(data.grossProfit)}
                  </span>
                </div>
              </div>

              {/* OPERATING EXPENSES */}
              <div className="mt-4 mb-1">
                <SectionLabel>Operating Expenses</SectionLabel>

                {/* Rental */}
                <PnlLine
                  label="Rental"
                  value={formatCurrency(data.operatingExpenses.rental.total)}
                  indent={1}
                  toggle={showRental}
                  onToggle={() => setShowRental(v => !v)}
                />
                {showRental && data.operatingExpenses.rental.records.length > 0 && (
                  <DetailPanel>
                    {data.operatingExpenses.rental.records.map(r => (
                      <div key={r.id} className="flex items-start justify-between py-1.5 border-b border-[#2A2A30] last:border-0">
                        <div>
                          <p className="text-[#9896A4] text-xs">{r.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {r.status === 'paid'   && <span className="text-emerald-400 text-[10px] flex items-center gap-0.5"><CheckCircle2 size={10}/> Paid</span>}
                            {r.status === 'unpaid' && <span className="text-amber-400 text-[10px] flex items-center gap-0.5"><Clock size={10}/> Unpaid</span>}
                            {r.status === 'overdue'&& <span className="text-rose-400 text-[10px] flex items-center gap-0.5"><XCircle size={10}/> Overdue</span>}
                          </div>
                        </div>
                        <p className="text-[#F0EEF6] text-sm tabular-nums">{formatCurrency(r.amount)}</p>
                      </div>
                    ))}
                  </DetailPanel>
                )}

                {/* Other opex categories */}
                {Object.entries(data.operatingExpenses.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amt]) => (
                    <PnlLine
                      key={cat}
                      label={cat === 'salary' ? 'Payroll (Aggregate)' : (EXPENSE_CATEGORY_LABELS[cat] ?? cat)}
                      value={formatCurrency(amt)}
                      indent={1}
                    />
                  ))}

                {/* Deferred founder remuneration (if accrued this month) */}
                {data.founderRemuneration.currentMonthAccrual > 0 && (
                  <PnlLine
                    label="Deferred Founder Remuneration"
                    value={formatCurrency(data.founderRemuneration.currentMonthAccrual)}
                    indent={1}
                    color="text-amber-400"
                    sub="Earned, payment deferred"
                  />
                )}

                <TotalLine
                  label="TOTAL OPERATING EXPENSES"
                  value={`(${formatCurrency(data.operatingExpenses.total)})`}
                  color="text-rose-400"
                />

                {/* Opex detail toggle */}
                {data.operatingExpenses.lines.length > 0 && (
                  <>
                    <ExpandButton open={showOpex} onToggle={() => setShowOpex(v => !v)} count={data.operatingExpenses.lines.length} />
                    {showOpex && (
                      <DetailPanel>
                        <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-2">Expense Transactions — payroll aggregate only</p>
                        {data.operatingExpenses.lines.map(e => (
                          <div key={e.id} className="flex items-start justify-between py-1.5 border-b border-[#2A2A30] last:border-0">
                            <div className="min-w-0">
                              <p className="text-[#9896A4] text-xs truncate">{e.description}</p>
                              <p className="text-[#5A5865] text-[10px] mt-0.5">
                                {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                                {e.supplier_name ? ` · ${e.supplier_name}` : ''}
                                {` · ${e.date}`}
                              </p>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <p className="text-[#F0EEF6] text-sm tabular-nums">{formatCurrency(e.amount)}</p>
                              {e.receipt_url && (
                                <a href={e.receipt_url} target="_blank" rel="noreferrer" className="text-[#8B5CF6] text-[10px] flex items-center gap-0.5 justify-end mt-0.5">
                                  <FileText size={9}/> Doc <ExternalLink size={8}/>
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </DetailPanel>
                    )}
                  </>
                )}

                {/* Capex note */}
                {data.capexItems.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 bg-[#0F0F12] border border-[#2A2A30] rounded-xl px-3 py-2.5 print:hidden">
                    <Info size={13} className="text-[#5A5865] shrink-0 mt-0.5" />
                    <p className="text-[#5A5865] text-xs">
                      {data.capexItems.length} capital expenditure item{data.capexItems.length !== 1 ? 's' : ''} ({data.capexItems.map(c => formatCurrency(c.amount)).join(', ')}) excluded from operating expenses — classified as balance-sheet capex.
                    </p>
                  </div>
                )}
              </div>

              {/* GROSS OPERATING PROFIT */}
              <div className={`rounded-xl px-5 py-4 mt-4 border ${gopPositive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[#F0EEF6] font-bold tracking-wide">GROSS OPERATING PROFIT</p>
                    <p className="text-[#5A5865] text-[10px] mt-0.5">Gross Profit less all Operating Expenses</p>
                  </div>
                  <div className="text-right">
                    <span className={`font-bold text-2xl tabular-nums ${gopPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {data.grossOperatingProfit < 0
                        ? `(${formatCurrency(Math.abs(data.grossOperatingProfit))})`
                        : formatCurrency(data.grossOperatingProfit)}
                    </span>
                    {data.revenue.total > 0 && (
                      <p className="text-[#5A5865] text-[10px] mt-1">{((data.grossOperatingProfit / data.revenue.total) * 100).toFixed(1)}% GOP margin</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Print footer */}
              <div className="hidden print:block mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-1">
                <p>Basis: Contractual Tenancy Agreement · Rate: {contractTierLabel(data.profitShareRate)}</p>
                <p>Rental sourced from rental payment records. COGS sourced from transactional cocktail sales. Capex items excluded from operating expenses.</p>
                {data.hasManualAdjustments && <p>⚠ Revenue includes {data.manualAdjustments.length} manual adjustment(s).</p>}
              </div>
            </div>

            {/* ── SECTION D: DATA RECONCILIATION ──────────────────────────── */}
            <div className="card print:hidden">
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Data Reconciliation</SectionLabel>
                <button onClick={() => setShowRecon(v => !v)} className="text-[#5A5865] hover:text-[#9896A4] text-xs flex items-center gap-1">
                  {showRecon ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
                  {showRecon ? 'Less' : 'Detail'}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#0F0F12] rounded-xl p-3 text-center border border-[#2A2A30]">
                  <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">COGS Coverage</p>
                  <p className={`text-sm font-semibold ${data.cogsComplete ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {data.cogsComplete ? 'Complete' : 'Partial'}
                  </p>
                </div>
                <div className="bg-[#0F0F12] rounded-xl p-3 text-center border border-[#2A2A30]">
                  <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Manual Adj.</p>
                  <p className={`text-sm font-semibold ${data.hasManualAdjustments ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {data.hasManualAdjustments ? `${data.manualAdjustments.length} adjustment${data.manualAdjustments.length !== 1 ? 's' : ''}` : 'None'}
                  </p>
                </div>
                <div className="bg-[#0F0F12] rounded-xl p-3 text-center border border-[#2A2A30]">
                  <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Capex Excluded</p>
                  <p className={`text-sm font-semibold ${data.capexItems.length > 0 ? 'text-[#A78BFA]' : 'text-[#5A5865]'}`}>
                    {data.capexItems.length > 0 ? `${data.capexItems.length} item${data.capexItems.length !== 1 ? 's' : ''}` : 'None'}
                  </p>
                </div>
                <div className="bg-[#0F0F12] rounded-xl p-3 text-center border border-[#2A2A30]">
                  <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Rental Source</p>
                  <p className="text-emerald-400 text-sm font-semibold">Records</p>
                </div>
              </div>

              {showRecon && data.hasManualAdjustments && data.manualAdjustments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-[#5A5865] text-[10px] uppercase tracking-wider">Manual Adjustment Log</p>
                  {data.manualAdjustments.map(adj => (
                    <div key={adj.id} className="bg-[#0F0F12] border border-[#2A2A30] rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[#F0EEF6] text-xs font-medium">{adj.event?.replace(/_/g, ' ')}</span>
                        <span className="text-[#5A5865] text-[10px] whitespace-nowrap">{new Date(adj.createdAt).toLocaleDateString('en-MY')}</span>
                      </div>
                      <p className="text-[#9896A4] text-[10px] mt-0.5">By: {adj.actorName ?? 'Unknown'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── SECTION E: INVESTOR PROFIT SHARE ────────────────────────── */}
            <div className={`card border ${data.potentialInvestorEntitlement > 0 ? 'border-[#8B5CF6]/30' : 'border-[#2A2A30]'}`}>
              <SectionLabel>Investor Profit Share</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                <div>
                  <p className="text-[#5A5865] text-xs mb-1">Gross Operating Profit</p>
                  <p className={`font-bold text-xl tabular-nums ${gopPositive ? 'text-[#F0EEF6]' : 'text-rose-400'}`}>
                    {data.grossOperatingProfit < 0
                      ? `(${formatCurrency(Math.abs(data.grossOperatingProfit))})`
                      : formatCurrency(data.grossOperatingProfit)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[#5A5865] text-xs mb-1">Contractual Rate</p>
                  {data.isOutsideContractPeriod ? (
                    <p className="text-[#5A5865] font-bold text-xl">N/A</p>
                  ) : (
                    <div>
                      <p className="text-[#A78BFA] font-bold text-3xl">{pct(data.profitShareRate)}</p>
                      <p className="text-[#5A5865] text-[10px] mt-0.5">
                        {data.profitShareRate === 0.15 ? '01 Jul 2025 – 30 Jun 2026' : '01 Jul 2026 – 31 Jul 2028'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-right sm:text-right">
                  <p className="text-[#5A5865] text-xs mb-1">Potential Investor Entitlement</p>
                  <p className={`font-bold text-xl tabular-nums ${data.potentialInvestorEntitlement > 0 ? 'text-[#A78BFA]' : 'text-[#5A5865]'}`}>
                    {formatCurrency(data.potentialInvestorEntitlement)}
                  </p>
                  {data.grossOperatingProfit < 0 && (
                    <p className="text-[#5A5865] text-[10px] mt-0.5">No profit generated</p>
                  )}
                </div>
              </div>

              {data.potentialInvestorEntitlement > 0 && (
                <div className="mt-4 bg-[#0F0F12] border border-[#2A2A30] rounded-xl px-4 py-3">
                  <p className="text-[#9896A4] text-xs">
                    Potential investor entitlement has been calculated at {pct(data.profitShareRate)} of Gross Operating Profit per the Tenancy Agreement.
                    This represents the contractual calculation. Actual cash distribution depends on the agreed startup recovery and working-capital conditions detailed below.
                  </p>
                </div>
              )}
            </div>

            {/* ── SECTION F: STARTUP RECOVERY WATERFALL ───────────────────── */}
            <div className="card">
              <div className="mb-4">
                <SectionLabel>Startup Recovery & Distribution</SectionLabel>
                <p className="text-[#9896A4] text-xs">
                  Existing obligations must be satisfied before investor cash distributions under the agreed commercial arrangement.
                </p>
              </div>

              <div className="space-y-3">
                {/* Startup obligations from DB */}
                {data.startupObligations.length === 0 && (
                  <p className="text-[#5A5865] text-sm">No recovery obligations configured. Ask the owner to set these up.</p>
                )}
                {data.startupObligations.map(o => (
                  <ObligationRow key={o.id} o={o} />
                ))}

                {/* Deferred founder remuneration */}
                {data.founderRemuneration.totalAccrued > 0 && (
                  <div className={`rounded-xl border p-4 ${data.founderRemuneration.outstanding <= 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-[#F0EEF6] text-sm font-medium">Deferred Founder Remuneration</p>
                        <p className="text-[#5A5865] text-xs mt-0.5">RM{(data.founderRemuneration.currentMonthAccrual / 1000).toFixed(0)}k/month · Earned, payment deferred pending cash availability</p>
                      </div>
                      <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${
                        data.founderRemuneration.outstanding <= 0
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {data.founderRemuneration.outstanding <= 0 ? 'CLEARED' : 'DEFERRED'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Total Accrued</p>
                        <p className="text-[#9896A4] text-sm font-medium tabular-nums">{formatCurrency(data.founderRemuneration.totalAccrued)}</p>
                      </div>
                      <div>
                        <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Paid</p>
                        <p className="text-emerald-400 text-sm font-medium tabular-nums">{formatCurrency(data.founderRemuneration.totalPaid)}</p>
                      </div>
                      <div>
                        <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Outstanding</p>
                        <p className={`text-sm font-bold tabular-nums ${data.founderRemuneration.outstanding <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {formatCurrency(data.founderRemuneration.outstanding)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Total obligations summary */}
              {(data.startupObligations.length > 0 || data.founderRemuneration.totalAccrued > 0) && (
                <div className="mt-4 pt-4 border-t border-[#2A2A30] flex items-baseline justify-between">
                  <p className="text-[#9896A4] text-sm font-medium">Total Recovery Obligations Remaining</p>
                  <p className={`font-bold text-lg tabular-nums ${(data.totalObligationsRemaining + data.founderRemuneration.outstanding) <= 0 ? 'text-emerald-400' : 'text-[#F0EEF6]'}`}>
                    {formatCurrency(data.totalObligationsRemaining + data.founderRemuneration.outstanding)}
                  </p>
                </div>
              )}
            </div>

            {/* ── SECTION G: DISTRIBUTION GATE ────────────────────────────── */}
            <div className={`card border-2 ${
              data.distributionStatus === 'eligible'
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-[#2A2A30]'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  data.distributionStatus === 'eligible' ? 'bg-emerald-500/20' : 'bg-[#1A1A1E]'
                }`}>
                  <Shield size={18} className={data.distributionStatus === 'eligible' ? 'text-emerald-400' : 'text-[#5A5865]'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="text-[#F0EEF6] font-bold">
                      {data.distributionStatus === 'eligible'
                        ? 'Distribution Eligible'
                        : 'Investor Distribution Deferred'}
                    </p>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                      data.distributionStatus === 'eligible'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-[#1A1A1E] text-[#9896A4] border-[#2A2A30]'
                    }`}>
                      {data.distributionStatus === 'eligible' ? 'ELIGIBLE' : 'DEFERRED'}
                    </span>
                  </div>

                  {data.distributionStatus !== 'eligible' && (
                    <p className="text-[#9896A4] text-sm mb-3">
                      {data.distributionStatus === 'deferred_negative_gop'
                        ? 'No Gross Operating Profit was generated this period. No profit-share is payable.'
                        : 'Potential investor entitlement has been calculated per the contractual rate. Cash distribution is currently deferred under the agreed startup recovery and working-capital arrangement.'}
                    </p>
                  )}

                  {data.distributionStatus === 'deferred_obligations' && data.distributionDeferralReasons.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      {data.distributionDeferralReasons.map((reason, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-[#5A5865] mt-1.5 shrink-0" />
                          <p className="text-[#9896A4] text-xs">{reason}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                    <div className="bg-[#0F0F12] border border-[#2A2A30] rounded-xl p-3">
                      <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Potential Entitlement</p>
                      <p className={`font-bold text-base tabular-nums ${data.potentialInvestorEntitlement > 0 ? 'text-[#A78BFA]' : 'text-[#5A5865]'}`}>
                        {formatCurrency(data.potentialInvestorEntitlement)}
                      </p>
                    </div>
                    <div className="bg-[#0F0F12] border border-[#2A2A30] rounded-xl p-3">
                      <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Actual Distribution</p>
                      <p className="font-bold text-base tabular-nums text-[#5A5865]">
                        {formatCurrency(data.actualInvestorDistribution)}
                      </p>
                    </div>
                    <div className="bg-[#0F0F12] border border-[#2A2A30] rounded-xl p-3">
                      <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Status</p>
                      <p className={`font-semibold text-sm ${data.distributionStatus === 'eligible' ? 'text-emerald-400' : 'text-[#9896A4]'}`}>
                        {data.distributionStatus === 'eligible' ? 'Eligible for Distribution' :
                         data.distributionStatus === 'deferred_negative_gop' ? 'No Profit Generated' :
                         'Distribution Deferred'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SECTION H: FINANCIAL POSITION ───────────────────────────── */}
            {data.isOwner && (
              <div className="card">
                <SectionLabel>Financial Position</SectionLabel>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {data.cashEstimate !== null && (
                    <div className="bg-[#0F0F12] border border-[#2A2A30] rounded-xl p-3">
                      <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Cash (Est.)</p>
                      <p className={`font-bold text-base tabular-nums ${(data.cashEstimate ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(data.cashEstimate ?? 0)}
                      </p>
                      <p className="text-[#5A5865] text-[10px] mt-0.5">Treasury estimate</p>
                    </div>
                  )}
                  {data.startupObligations.map(o => (
                    <div key={o.id} className="bg-[#0F0F12] border border-[#2A2A30] rounded-xl p-3">
                      <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1 truncate">{o.name}</p>
                      <p className={`font-bold text-base tabular-nums ${o.remaining <= 0 ? 'text-emerald-400' : 'text-[#F0EEF6]'}`}>
                        {formatCurrency(o.remaining)}
                      </p>
                      <p className="text-[#5A5865] text-[10px] mt-0.5">{o.remaining <= 0 ? 'Cleared' : 'Outstanding'}</p>
                    </div>
                  ))}
                  {data.founderRemuneration.totalAccrued > 0 && (
                    <div className="bg-[#0F0F12] border border-[#2A2A30] rounded-xl p-3">
                      <p className="text-[#5A5865] text-[10px] uppercase tracking-wider mb-1">Deferred Remuneration</p>
                      <p className={`font-bold text-base tabular-nums ${data.founderRemuneration.outstanding <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {formatCurrency(data.founderRemuneration.outstanding)}
                      </p>
                      <p className="text-[#5A5865] text-[10px] mt-0.5">Payable to founders</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SECTION I: SUPPORTING DOCUMENTS ─────────────────────────── */}
            <div className="card print:hidden">
              <button onClick={() => setShowDocs(v => !v)} className="w-full flex items-center justify-between">
                <SectionLabel>Supporting Documents</SectionLabel>
                {showDocs ? <ChevronUp size={14} className="text-[#5A5865]" /> : <ChevronDown size={14} className="text-[#5A5865]" />}
              </button>
              {!showDocs && (
                <p className="text-[#5A5865] text-xs -mt-1">
                  {[...data.operatingExpenses.lines, ...data.capexItems].filter(e => e.receipt_url).length +
                   data.operatingExpenses.rental.records.filter(r => r.receipt_url).length} document{
                     ([...data.operatingExpenses.lines, ...data.capexItems].filter(e => e.receipt_url).length +
                      data.operatingExpenses.rental.records.filter(r => r.receipt_url).length) !== 1 ? 's' : ''} available — click to expand
                </p>
              )}
              {showDocs && (
                <div className="mt-3 space-y-2">
                  {data.operatingExpenses.rental.records.filter(r => r.receipt_url).map(r => (
                    <a key={r.id} href={r.receipt_url!} target="_blank" rel="noreferrer"
                      className="flex items-center justify-between p-3 bg-[#0F0F12] border border-[#2A2A30] rounded-xl hover:border-[#8B5CF6]/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-[#8B5CF6]" />
                        <span className="text-[#F0EEF6] text-sm">{r.name}</span>
                      </div>
                      <ExternalLink size={12} className="text-[#5A5865]" />
                    </a>
                  ))}
                  {[...data.operatingExpenses.lines, ...data.capexItems].filter(e => e.receipt_url).map(e => (
                    <a key={e.id} href={e.receipt_url!} target="_blank" rel="noreferrer"
                      className="flex items-center justify-between p-3 bg-[#0F0F12] border border-[#2A2A30] rounded-xl hover:border-[#8B5CF6]/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={14} className="text-[#8B5CF6] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[#F0EEF6] text-sm truncate">{e.description}</p>
                          <p className="text-[#5A5865] text-[10px]">{EXPENSE_CATEGORY_LABELS[e.category] ?? e.category} · {formatCurrency(e.amount)}</p>
                        </div>
                      </div>
                      <ExternalLink size={12} className="text-[#5A5865] shrink-0 ml-3" />
                    </a>
                  ))}
                  {([...data.operatingExpenses.lines, ...data.capexItems].filter(e => e.receipt_url).length +
                    data.operatingExpenses.rental.records.filter(r => r.receipt_url).length) === 0 && (
                    <p className="text-[#5A5865] text-sm text-center py-4">No documents attached this period</p>
                  )}
                </div>
              )}
            </div>

            {/* ── SECTION J: AUDIT TRAIL ───────────────────────────────────── */}
            <div className="card print:hidden">
              <button onClick={() => setShowAudit(v => !v)} className="w-full flex items-center justify-between">
                <SectionLabel>Audit & Adjustments</SectionLabel>
                {showAudit ? <ChevronUp size={14} className="text-[#5A5865]" /> : <ChevronDown size={14} className="text-[#5A5865]" />}
              </button>
              {!showAudit && (
                <p className="text-[#5A5865] text-xs -mt-1">
                  {data.manualAdjustments.length > 0
                    ? `${data.manualAdjustments.length} manual adjustment${data.manualAdjustments.length !== 1 ? 's' : ''} — click to expand`
                    : 'No adjustments this period'}
                </p>
              )}
              {showAudit && (
                <div className="mt-3">
                  {data.manualAdjustments.length === 0 ? (
                    <p className="text-[#5A5865] text-sm text-center py-4">No manual adjustments recorded this period</p>
                  ) : (
                    <div className="space-y-2">
                      {data.manualAdjustments.map(adj => (
                        <div key={adj.id} className="bg-[#0F0F12] border border-[#2A2A30] rounded-xl p-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[#F0EEF6] text-sm font-medium">{adj.event?.replace(/_/g, ' ')}</span>
                            <span className="text-[#5A5865] text-[10px] whitespace-nowrap">{new Date(adj.createdAt).toLocaleString('en-MY')}</span>
                          </div>
                          <p className="text-[#9896A4] text-xs mt-0.5">By: {adj.actorName ?? 'Unknown'}</p>
                          {adj.payload && (
                            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                              {adj.payload.before != null && <><span className="text-[#5A5865]">Before</span><span className="text-[#9896A4]">{String(adj.payload.before)}</span></>}
                              {adj.payload.after  != null && <><span className="text-[#5A5865]">After</span><span className="text-[#F0EEF6]">{String(adj.payload.after)}</span></>}
                              {adj.payload.reason != null && <><span className="text-[#5A5865]">Reason</span><span className="text-[#9896A4]">{String(adj.payload.reason)}</span></>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
