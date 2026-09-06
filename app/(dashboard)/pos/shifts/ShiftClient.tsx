'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { Clock, TrendingUp, ShoppingBag, Wallet, AlertCircle, CheckCircle2, Eye, EyeOff, TriangleAlert, FileText, Copy, Printer, Save, Receipt, ChevronDown, ChevronUp } from 'lucide-react'

type PosShift = {
  id: string; opened_by: string; closed_by: string | null
  opened_at: string; closed_at: string | null
  opening_float: number; closing_cash: number | null
  expected_cash: number | null; variance: number | null
  revenue: number | null
  status: string; notes: string | null
  users_opened?: { full_name: string }
  users_closed?: { full_name: string } | null
}

type ShiftOrders = {
  count: number; revenue: number; subtotal: number; discount: number
  covers: number; payment_breakdown: Record<string, number>
  drinksSold: number; voidValue: number; voidCount: number
}

type NightReport = {
  date: string; staff: string; partTimeStaff: string
  salesBeforeDiscount: number; salesAfterDiscount: number
  cash: number; mastercard: number; visa: number; debit: number; qr: number
  drinksSold: number; guestsTables: number; guestsPax: number
  notableGuests: string; incidentReport: string; breakage: string
  freeShots: string; discount: number; voidValue: number; voidCount: number
}

type SettlementData = {
  shift: { opened_at: string; closed_at: string | null; opening_float: number; closing_cash: number | null; expected_cash: number | null; variance: number | null }
  openedBy: string
  closedBy: string | null
  revenue: { gross: number; discount: number; serviceCharge: number; taxAmount: number; voidValue: number; voidCount: number; net: number }
  payments: { cash: number; credit_card: number; qr_payment: number; online: number }
  floor: { orders: number; covers: number; drinksSold: number; discountedOrders: number }
  categories: { cocktails: number; beer: number; wine: number; food: number; others: number }
}

type Props = {
  openShift: PosShift | null
  shiftHistory: (PosShift & { night_report?: NightReport | null; night_report_saved_at?: string | null })[]
  shiftOrders: ShiftOrders | null
  userId: string
  userName: string
  isAdmin: boolean
}

function formatCurrency(amount: number) {
  return amount.toLocaleString('en-MY', { style: 'currency', currency: 'MYR' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDuration(openedAt: string, closedAt: string) {
  const ms = new Date(closedAt).getTime() - new Date(openedAt).getTime()
  const mins = Math.floor(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const DENOMINATIONS = [
  { label: 'RM 100', value: 100 },
  { label: 'RM 50',  value: 50 },
  { label: 'RM 20',  value: 20 },
  { label: 'RM 10',  value: 10 },
  { label: 'RM 5',   value: 5 },
  { label: 'RM 1',   value: 1 },
  { label: '50 sen', value: 0.5 },
  { label: '20 sen', value: 0.2 },
  { label: '10 sen', value: 0.1 },
  { label: '5 sen',  value: 0.05 },
]

function groupByMonth(shifts: ShiftClient['shiftHistory']) {
  const map: Record<string, typeof shifts> = {}
  for (const s of shifts) {
    const key = s.opened_at.slice(0, 7) // YYYY-MM
    if (!map[key]) map[key] = []
    map[key].push(s)
  }
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
}

// Trick to infer the type of shiftHistory items for use above
type ShiftClient = { shiftHistory: (PosShift & { night_report?: NightReport | null; night_report_saved_at?: string | null })[] }

export function ShiftClient({ openShift, shiftHistory, shiftOrders, userId, userName, isAdmin }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [openModal, setOpenModal] = useState(false)
  const [settlementModal, setSettlementModal] = useState(false)
  const [settlementData, setSettlementData] = useState<SettlementData | null>(null)
  const [settlementLoading, setSettlementLoading] = useState<string | null>(null)
  const [closeModal, setCloseModal] = useState(false)
  const [openFloat, setOpenFloat] = useState('0')
  const [openPassword, setOpenPassword] = useState('')
  const [closePassword, setClosePassword] = useState('')
  const [showOpenPwd, setShowOpenPwd] = useState(false)
  const [showClosePwd, setShowClosePwd] = useState(false)
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({})
  const [useCounter, setUseCounter] = useState(false)
  const [closingCash, setClosingCash] = useState('')
  const [shiftNotes, setShiftNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())
  const [editRevenueShiftId, setEditRevenueShiftId] = useState<string | null>(null)
  const [editRevenueValue, setEditRevenueValue] = useState('')
  const [savingRevenue, setSavingRevenue] = useState(false)

  // Night report state
  const [nightReportModal, setNightReportModal] = useState(false)
  const [viewReportModal, setViewReportModal] = useState(false)
  const [viewReportData, setViewReportData] = useState<NightReport | null>(null)
  const [viewReportShiftId, setViewReportShiftId] = useState<string | null>(null)
  const [editingHistoricalReport, setEditingHistoricalReport] = useState(false)
  const [reportSaving, setReportSaving] = useState(false)
  const [reportSaved, setReportSaved] = useState(false)
  const [nightReport, setNightReport] = useState<NightReport>({
    date: '', staff: '', partTimeStaff: '',
    salesBeforeDiscount: 0, salesAfterDiscount: 0,
    cash: 0, mastercard: 0, visa: 0, debit: 0, qr: 0,
    drinksSold: 0, guestsTables: 0, guestsPax: 0,
    notableGuests: '', incidentReport: '', breakage: '',
    freeShots: '', discount: 0, voidValue: 0, voidCount: 0,
  })

  function openNightReport() {
    if (!openShift) return
    const pb = shiftOrders?.payment_breakdown ?? {}
    setReportSaved(false)
    setNightReport({
      date: new Date(openShift.opened_at).toLocaleDateString('en-MY', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
      staff: openShift.users_opened?.full_name ?? userName,
      partTimeStaff: '',
      salesBeforeDiscount: shiftOrders?.subtotal ?? 0,
      salesAfterDiscount: shiftOrders?.revenue ?? 0,
      cash: pb.cash ?? 0,
      mastercard: pb.mastercard ?? 0,
      visa: pb.visa ?? 0,
      debit: pb.credit_card ?? 0,
      qr: (pb.qr_payment ?? 0),
      drinksSold: shiftOrders?.drinksSold ?? 0,
      guestsTables: shiftOrders?.count ?? 0,
      guestsPax: shiftOrders?.covers ?? 0,
      notableGuests: '', incidentReport: '', breakage: '',
      freeShots: '',
      discount: shiftOrders?.discount ?? 0,
      voidValue: shiftOrders?.voidValue ?? 0,
      voidCount: shiftOrders?.voidCount ?? 0,
    })
    setNightReportModal(true)
  }

  function buildReportText(r: NightReport): string {
    const fmt = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    return [
      `NIGHT REPORT — ARKIB BAR`,
      `──────────────────────────`,
      `Date            : ${r.date}`,
      `Staff           : ${r.staff}`,
      `Part time staff : ${r.partTimeStaff || '—'}`,
      ``,
      `── SALES ──────────────────`,
      `Sales (before discount) : ${fmt(r.salesBeforeDiscount)}`,
      `Sales (after discount)  : ${fmt(r.salesAfterDiscount)}`,
      `Discount                : ${fmt(r.discount)}`,
      ``,
      `── PAYMENTS ───────────────`,
      `Cash            : ${fmt(r.cash)}`,
      `Card (Mastercard): ${fmt(r.mastercard)}`,
      `Card (Visa)     : ${fmt(r.visa)}`,
      `Card (Debit)    : ${fmt(r.debit)}`,
      `QR Code         : ${fmt(r.qr)}`,
      ``,
      `── FLOOR ──────────────────`,
      `Drinks Sold     : ${r.drinksSold}`,
      `Guests (tables) : ${r.guestsTables}`,
      `Guests (pax)    : ${r.guestsPax}`,
      ``,
      `── NOTES ──────────────────`,
      `Notable Guests  : ${r.notableGuests || '—'}`,
      `Incident Report : ${r.incidentReport || '—'}`,
      `Breakage        : ${r.breakage || '—'}`,
      `Free Shots      : ${r.freeShots || '—'}`,
      `Void            : ${r.voidCount} items / ${fmt(r.voidValue)}`,
      `──────────────────────────`,
    ].join('\n')
  }

  async function handleCopyReport() {
    try {
      await navigator.clipboard.writeText(buildReportText(nightReport))
      toast('Report copied to clipboard', 'success')
    } catch {
      toast('Could not copy — please select and copy manually', 'error')
    }
  }

  function handlePrintReport() {
    const text = buildReportText(nightReport)
    const win = window.open('', '_blank', 'width=400,height=700')
    if (!win) { toast('Pop-up blocked — allow pop-ups and try again', 'error'); return }
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Night Report</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; background: #fff; white-space: pre-wrap; margin: 0; padding: 0; }
        @media screen { body { background: #111; color: #eee; padding: 16px; } }
      </style>
      </head><body>${text}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 300)
  }

  async function handleSaveReport() {
    const targetShiftId = editingHistoricalReport ? viewReportShiftId : openShift?.id
    if (!targetShiftId) return
    setReportSaving(true)
    try {
      const res = await fetch('/api/pos/save-night-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: targetShiftId, report: nightReport }),
      })
      if (!res.ok) { const e = await res.json(); toast(e.error ?? 'Failed to save', 'error'); return }

      // Keep shift revenue in sync with sales after discount when editing a historical report
      if (editingHistoricalReport) {
        await fetch('/api/admin/adjust-shift-revenue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shiftId: targetShiftId, revenue: nightReport.salesAfterDiscount }),
        })
      }

      setReportSaved(true)
      toast('Night report saved', 'success')
    } finally {
      setReportSaving(false)
    }
  }

  const denomTotal = DENOMINATIONS.reduce((s, d) => s + d.value * (denomCounts[d.value] ?? 0), 0)

  const expectedCash = openShift
    ? openShift.opening_float + (shiftOrders?.payment_breakdown?.cash ?? 0)
    : 0
  const effectiveClosingCash = useCounter ? denomTotal : parseFloat(closingCash || '0')
  const variance = effectiveClosingCash - expectedCash
  const cashInDrawer = openShift
    ? openShift.opening_float + (shiftOrders?.payment_breakdown?.cash ?? 0)
    : 0

  async function verifyPassword(password: string): Promise<boolean> {
    const res = await fetch('/api/pos/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast(err.error ?? 'Incorrect password', 'error')
      return false
    }
    return true
  }

  async function handleOpenShift() {
    if (!openPassword) { toast('Please enter your password', 'error'); return }
    setLoading(true)
    try {
      if (!await verifyPassword(openPassword)) return
      const res = await fetch('/api/pos/open-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingFloat: parseFloat(openFloat) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast(err.error ?? 'Failed to open shift', 'error')
        return
      }
      toast('Shift opened successfully', 'success')
      setOpenModal(false)
      setOpenPassword('')
      router.refresh()
    } catch {
      toast('Failed to open shift', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCloseShift() {
    if (!openShift) return
    if (!closePassword) { toast('Please enter your password', 'error'); return }
    setLoading(true)
    try {
      if (!await verifyPassword(closePassword)) return
      const res = await fetch('/api/pos/close-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: openShift.id,
          closingCash: effectiveClosingCash,
          notes: shiftNotes,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast(err.error ?? 'Failed to close shift', 'error')
        return
      }
      toast('Shift closed successfully', 'success')
      setCloseModal(false)
      setClosePassword('')
      router.refresh()
    } catch {
      toast('Failed to close shift', 'error')
    } finally {
      setLoading(false)
    }
  }

  const paymentMethods = ['cash', 'credit_card', 'qr_payment']
  const methodLabels: Record<string, string> = { cash: 'Cash', credit_card: 'Card', qr_payment: 'QR' }

  async function saveRevenueCorrection(shiftId: string) {
    const val = parseFloat(editRevenueValue)
    if (isNaN(val) || val < 0) { toast('Invalid amount', 'error'); return }
    setSavingRevenue(true)
    try {
      const res = await fetch('/api/admin/adjust-shift-revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId, revenue: val }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      toast('Shift revenue updated', 'success')
      setEditRevenueShiftId(null)
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update revenue', 'error')
    } finally {
      setSavingRevenue(false)
    }
  }

  async function openSettlement(shiftId: string) {
    setSettlementLoading(shiftId)
    try {
      const res = await fetch(`/api/pos/shift-settlement/${shiftId}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast(err?.error ? `Settlement error: ${err.error}` : 'Failed to load settlement data', 'error')
        return
      }
      setSettlementData(await res.json())
      setSettlementModal(true)
    } catch {
      toast('Failed to load settlement data', 'error')
    } finally {
      setSettlementLoading(null)
    }
  }

  function printSettlement() {
    if (!settlementData) return
    const d = settlementData
    const fmt = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    const pad = (l: string, r: string, w = 32) => {
      const gap = w - l.length - r.length
      return l + ' '.repeat(Math.max(1, gap)) + r
    }
    const lines = [
      '         ARKIB',
      '   SETTLEMENT RECEIPT',
      '--------------------------------',
      pad('Date', new Date(d.shift.opened_at).toLocaleDateString('en-MY', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })),
      pad('Shift', `${formatTime(d.shift.opened_at)} - ${d.shift.closed_at ? formatTime(d.shift.closed_at) : '--'}`),
      pad('Opened by', d.openedBy),
      pad('Closed by', d.closedBy ?? '—'),
      '--------------------------------',
      'SALES',
      pad('Gross Sales', fmt(d.revenue.gross)),
      pad('Discount', `- ${fmt(d.revenue.discount)}`),
      ...(d.revenue.serviceCharge > 0 ? [pad('Service Charge', fmt(d.revenue.serviceCharge))] : []),
      pad('Void Value', `- ${fmt(d.revenue.voidValue)}`),
      '--------------------------------',
      pad('TOTAL', fmt(d.revenue.net)),
      '--------------------------------',
      'PAYMENTS',
      pad('Cash', fmt(d.payments.cash)),
      pad('Card', fmt(d.payments.credit_card)),
      pad('QR', fmt(d.payments.qr_payment)),
      ...(d.payments.online > 0 ? [pad('Online', fmt(d.payments.online))] : []),
      '--------------------------------',
      'CASH RECONCILIATION',
      pad('Opening Float', fmt(d.shift.opening_float)),
      pad('Cash Sales', fmt(d.payments.cash)),
      pad('Expected in Drawer', fmt(d.shift.opening_float + d.payments.cash)),
      pad('Variance', fmt(d.shift.variance ?? 0)),
      '--------------------------------',
      'FLOOR',
      pad('Orders', String(d.floor.orders)),
      pad('Covers (pax)', String(d.floor.covers)),
      pad('Drinks Sold', String(d.floor.drinksSold)),
      pad('Discounted Orders', String(d.floor.discountedOrders)),
      pad('Void Items', String(d.revenue.voidCount)),
      '--------------------------------',
      `Printed: ${new Date().toLocaleString('en-MY')}`,
      '  ARKIB Bar Management System',
    ].join('\n')

    const win = window.open('', '_blank', 'width=400,height=750')
    if (!win) { toast('Pop-up blocked — allow pop-ups and try again', 'error'); return }
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Settlement Receipt</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; background: #fff; white-space: pre; margin: 0; padding: 0; }
        @media screen { body { background: #111; color: #eee; padding: 16px; } }
      </style>
      </head><body>${lines}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <TopBar
        title="Shift Management"
        subtitle={openShift ? `Shift started at ${formatTime(openShift.opened_at)}` : 'No active shift'}
        actions={
          !openShift ? (
            <button
              onClick={() => setOpenModal(true)}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Open Shift
            </button>
          ) : null
        }
      />

      {openShift ? (
        <>
          {/* Stale shift warning */}
          {(() => {
            const hoursOpen = (Date.now() - new Date(openShift.opened_at).getTime()) / 3600000
            if (hoursOpen < 10) return null
            return (
              <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-3">
                <TriangleAlert size={16} className="text-amber-400 shrink-0" />
                <p className="text-amber-300 text-sm flex-1">
                  This shift has been open for <strong>{Math.floor(hoursOpen)}h</strong> — staff may have forgotten to clock out. The system will auto-close it at the scheduled closing time.
                </p>
              </div>
            )
          })()}

          {/* Status banner */}
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-5">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-emerald-400 font-medium text-sm">Shift Open</span>
              <span className="text-[#9896A4] text-sm"> — started {formatTime(openShift.opened_at)} by {openShift.users_opened?.full_name ?? 'Staff'}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={openNightReport}
                className="flex items-center gap-1.5 bg-[#7B5EA7]/20 hover:bg-[#7B5EA7]/30 text-[#A78BFA] text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              >
                <FileText size={14} /> Night Report
              </button>
              <button
                onClick={() => { setClosingCash(''); setShiftNotes(''); setCloseModal(true) }}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              >
                Close Shift
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[#9896A4] text-xs mb-2">
                <ShoppingBag size={13} />
                Orders
              </div>
              <p className="text-[#F0EEF6] text-2xl font-bold">{shiftOrders?.count ?? 0}</p>
            </div>
            <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[#9896A4] text-xs mb-2">
                <TrendingUp size={13} />
                Revenue
              </div>
              <p className="text-[#F0EEF6] text-2xl font-bold">{formatCurrency(shiftOrders?.revenue ?? 0)}</p>
            </div>
            <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 text-[#9896A4] text-xs mb-2">
                <Wallet size={13} />
                Cash in Drawer
              </div>
              <p className="text-[#F0EEF6] text-2xl font-bold">{formatCurrency(cashInDrawer)}</p>
              <p className="text-[#5A5865] text-xs mt-1">Float: {formatCurrency(openShift.opening_float)}</p>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4 mb-6">
            <h3 className="text-[#9896A4] text-xs font-medium uppercase tracking-wider mb-3">Payment Breakdown</h3>
            <div className="grid grid-cols-3 gap-3">
              {paymentMethods.map(method => (
                <div key={method} className="bg-[#0E0E11] rounded-lg p-3 text-center">
                  <p className="text-[#9896A4] text-xs mb-1">{methodLabels[method]}</p>
                  <p className="text-[#F0EEF6] font-semibold text-sm">
                    {formatCurrency(shiftOrders?.payment_breakdown?.[method] ?? 0)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* No open shift — open shift card */
        <div className="bg-[#141417] border border-[#2A2A30] rounded-2xl p-8 flex flex-col items-center justify-center text-center mb-6">
          <div className="bg-[#7C3AED]/10 rounded-full p-4 mb-4">
            <Clock size={28} className="text-[#7C3AED]" />
          </div>
          <h2 className="text-[#F0EEF6] font-semibold text-lg mb-1">No Active Shift</h2>
          <p className="text-[#9896A4] text-sm mb-5 max-w-xs">Open a new shift to start recording orders and track your daily sales.</p>
          <button
            onClick={() => setOpenModal(true)}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Open Shift
          </button>
        </div>
      )}

      {/* Shift History — grouped by month */}
      {shiftHistory.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[#F0EEF6] font-medium text-sm px-1">Shift History</h3>
          {groupByMonth(shiftHistory).map(([monthKey, shifts], idx) => {
            const isCollapsed = collapsedMonths.has(monthKey)
            const monthRevenue = shifts.reduce((s, sh) => s + (sh.revenue ?? 0), 0)
            return (
              <div key={monthKey} className="bg-[#141417] border border-[#2A2A30] rounded-xl overflow-hidden">
                {/* Month header */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1A1A1E] transition-colors"
                  onClick={() => setCollapsedMonths(prev => {
                    const next = new Set(prev)
                    if (next.has(monthKey)) next.delete(monthKey)
                    else next.add(monthKey)
                    return next
                  })}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[#F0EEF6] font-medium text-sm">{monthLabel(monthKey)}</span>
                    <span className="text-[#5A5865] text-xs">{shifts.length} shift{shifts.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isCollapsed ? <ChevronDown size={14} className="text-[#5A5865]" /> : <ChevronUp size={14} className="text-[#5A5865]" />}
                  </div>
                </button>

                {/* Shifts table */}
                {!isCollapsed && (
                  <div className="overflow-x-auto border-t border-[#2A2A30]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#1E1E24]">
                          {['Date', 'Opened By', 'Closed By', 'Float', 'Revenue', 'Variance', 'Duration', ''].map(h => (
                            <th key={h} className="text-left text-[#5A5865] font-medium text-xs px-4 py-2.5">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shifts.map(shift => {
                          const v = shift.variance ?? 0
                          return (
                            <tr key={shift.id} className="border-b border-[#1E1E24] last:border-0 hover:bg-[#1A1A1E] transition-colors">
                              <td className="px-4 py-3 text-[#9896A4] whitespace-nowrap">
                                {formatDate(shift.opened_at)}
                              </td>
                              <td className="px-4 py-3 text-[#F0EEF6] whitespace-nowrap">
                                {shift.users_opened?.full_name ?? '—'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {shift.notes?.startsWith('Auto-closed') ? (
                                  <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
                                    <TriangleAlert size={11} /> Auto-closed
                                  </span>
                                ) : (
                                  <span className="text-[#9896A4]">{shift.users_closed?.full_name ?? '—'}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-[#9896A4] whitespace-nowrap">
                                {formatCurrency(shift.opening_float)}
                              </td>
                              <td className="px-4 py-3 text-[#F0EEF6] whitespace-nowrap">
                                {isAdmin && editRevenueShiftId === shift.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={editRevenueValue}
                                      onChange={e => setEditRevenueValue(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') saveRevenueCorrection(shift.id); if (e.key === 'Escape') setEditRevenueShiftId(null) }}
                                      autoFocus
                                      style={{ width: '90px', fontSize: '12px', padding: '2px 6px', borderRadius: '6px', border: '1px solid #6C63FF', background: '#141417', color: '#F0EEF6', outline: 'none' }}
                                    />
                                    <button onClick={() => saveRevenueCorrection(shift.id)} disabled={savingRevenue} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', border: 'none', background: '#6C63FF', color: '#fff', cursor: 'pointer', opacity: savingRevenue ? 0.6 : 1 }}>
                                      {savingRevenue ? '…' : '✓'}
                                    </button>
                                    <button onClick={() => setEditRevenueShiftId(null)} style={{ fontSize: '11px', color: '#5A5865', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                                  </div>
                                ) : (
                                  <span
                                    className={isAdmin ? 'cursor-pointer hover:text-[#A78BFA] transition-colors' : ''}
                                    title={isAdmin ? 'Click to correct revenue' : undefined}
                                    onClick={isAdmin ? () => { setEditRevenueShiftId(shift.id); setEditRevenueValue(shift.revenue?.toFixed(2) ?? '0') } : undefined}
                                  >
                                    {shift.revenue != null ? formatCurrency(shift.revenue) : '—'}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {shift.variance != null ? (
                                  <span className={v < 0 ? 'text-red-400' : v > 0 ? 'text-emerald-400' : 'text-[#9896A4]'}>
                                    {v >= 0 ? '+' : ''}{formatCurrency(v)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3 text-[#9896A4] whitespace-nowrap">
                                {shift.closed_at ? formatDuration(shift.opened_at, shift.closed_at) : '—'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  {shift.night_report && (
                                    <button
                                      onClick={() => { setViewReportData(shift.night_report!); setViewReportShiftId(shift.id); setViewReportModal(true) }}
                                      className="flex items-center gap-1 text-[#A78BFA] text-xs hover:text-[#C4B5FD] transition-colors"
                                    >
                                      <FileText size={11} /> Report
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openSettlement(shift.id)}
                                    disabled={settlementLoading === shift.id}
                                    className="flex items-center gap-1 text-[#9896A4] text-xs hover:text-[#A78BFA] transition-colors disabled:opacity-50"
                                  >
                                    <Receipt size={11} />
                                    {settlementLoading === shift.id ? '…' : 'Settlement'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Night Report Modal ─────────────────────────────────────────────── */}
      <Modal isOpen={nightReportModal} onClose={() => { setNightReportModal(false); setEditingHistoricalReport(false) }} title="Night Report" size="lg">
        <div className="space-y-5">
          {/* Auto-filled section */}
          <div>
            <p className="text-[#5A5865] text-xs uppercase tracking-wider mb-3">
              {editingHistoricalReport ? 'Edit report figures' : 'Auto-filled by system'}
            </p>
            {editingHistoricalReport ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  ['Sales (before discount)', 'salesBeforeDiscount'],
                  ['Sales (after discount)', 'salesAfterDiscount'],
                  ['Cash', 'cash'],
                  ['Card (Mastercard)', 'mastercard'],
                  ['Card (Visa)', 'visa'],
                  ['Card (Debit/Other)', 'debit'],
                  ['QR Code', 'qr'],
                  ['Drinks Sold', 'drinksSold'],
                  ['Guests (tables)', 'guestsTables'],
                  ['Guests (pax)', 'guestsPax'],
                  ['Discount', 'discount'],
                ] as [string, keyof NightReport][]).map(([label, key]) => (
                  <div key={key}>
                    <label className="block text-[#9896A4] text-xs font-medium mb-1.5">{label}</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={nightReport[key] as number}
                      onChange={e => setNightReport(r => ({ ...r, [key]: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Date', value: nightReport.date },
                  { label: 'Staff (Opened By)', value: nightReport.staff },
                  { label: 'Sales (before discount)', value: `RM ${nightReport.salesBeforeDiscount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}` },
                  { label: 'Sales (after discount)', value: `RM ${nightReport.salesAfterDiscount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}` },
                  { label: 'Cash', value: `RM ${nightReport.cash.toLocaleString('en-MY', { minimumFractionDigits: 2 })}` },
                  { label: 'Card (Mastercard)', value: `RM ${nightReport.mastercard.toLocaleString('en-MY', { minimumFractionDigits: 2 })}` },
                  { label: 'Card (Visa)', value: `RM ${nightReport.visa.toLocaleString('en-MY', { minimumFractionDigits: 2 })}` },
                  { label: 'Card (Debit/Other)', value: `RM ${nightReport.debit.toLocaleString('en-MY', { minimumFractionDigits: 2 })}` },
                  { label: 'QR Code', value: `RM ${nightReport.qr.toLocaleString('en-MY', { minimumFractionDigits: 2 })}` },
                  { label: 'Drinks Sold', value: nightReport.drinksSold.toString() },
                  { label: 'Guests (tables)', value: nightReport.guestsTables.toString() },
                  { label: 'Guests (pax)', value: nightReport.guestsPax.toString() },
                  { label: 'Discount', value: `RM ${nightReport.discount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}` },
                  { label: 'Void', value: `${nightReport.voidCount} items / RM ${nightReport.voidValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5">
                    <p className="text-[#5A5865] text-xs mb-0.5">{label}</p>
                    <p className="text-[#F0EEF6] text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual fields */}
          <div>
            <p className="text-[#5A5865] text-xs uppercase tracking-wider mb-3">Fill in manually</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Part Time Staff</label>
                <input type="text" value={nightReport.partTimeStaff}
                  onChange={e => setNightReport(r => ({ ...r, partTimeStaff: e.target.value }))}
                  placeholder="Names of part time staff tonight…"
                  className="w-full bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#7C3AED] transition-colors" />
              </div>
              <div>
                <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Notable Guests</label>
                <input type="text" value={nightReport.notableGuests}
                  onChange={e => setNightReport(r => ({ ...r, notableGuests: e.target.value }))}
                  placeholder="e.g. VIP tables, regulars, influencers…"
                  className="w-full bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#7C3AED] transition-colors" />
              </div>
              <div>
                <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Incident Report</label>
                <textarea value={nightReport.incidentReport}
                  onChange={e => setNightReport(r => ({ ...r, incidentReport: e.target.value }))}
                  rows={3} placeholder="Any incidents tonight? Leave blank if none."
                  className="w-full bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#7C3AED] transition-colors resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Breakage</label>
                  <input type="text" value={nightReport.breakage}
                    onChange={e => setNightReport(r => ({ ...r, breakage: e.target.value }))}
                    placeholder="e.g. 2 glasses, 1 bottle"
                    className="w-full bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#7C3AED] transition-colors" />
                </div>
                <div>
                  <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Free Shots</label>
                  <input type="text" value={nightReport.freeShots}
                    onChange={e => setNightReport(r => ({ ...r, freeShots: e.target.value }))}
                    placeholder="e.g. 4 shots to Table 3"
                    className="w-full bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#7C3AED] transition-colors" />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-[#2A2A30]">
            <button onClick={handleSaveReport} disabled={reportSaving}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${reportSaved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#7B5EA7]/20 text-[#A78BFA] border border-[#7B5EA7]/30 hover:bg-[#7B5EA7]/30'}`}>
              <Save size={14} />{reportSaving ? 'Saving…' : reportSaved ? 'Saved ✓' : 'Save Report'}
            </button>
            <button onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] transition-all">
              <Copy size={14} /> Copy Text
            </button>
            <button onClick={handlePrintReport}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] transition-all">
              <Printer size={14} /> Print / PDF
            </button>
          </div>
        </div>
      </Modal>

      {/* ── View Past Report Modal ─────────────────────────────────────────── */}
      <Modal isOpen={viewReportModal} onClose={() => setViewReportModal(false)} title="Night Report" size="lg">
        {viewReportData && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['Date', viewReportData.date],
                ['Staff', viewReportData.staff],
                ['Part Time Staff', viewReportData.partTimeStaff || '—'],
                ['Sales (before discount)', `RM ${viewReportData.salesBeforeDiscount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`],
                ['Sales (after discount)', `RM ${viewReportData.salesAfterDiscount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`],
                ['Cash', `RM ${viewReportData.cash.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`],
                ['Card (Mastercard)', `RM ${viewReportData.mastercard.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`],
                ['Card (Visa)', `RM ${viewReportData.visa.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`],
                ['Card (Debit/Other)', `RM ${viewReportData.debit.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`],
                ['QR Code', `RM ${viewReportData.qr.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`],
                ['Drinks Sold', viewReportData.drinksSold.toString()],
                ['Guests (tables)', viewReportData.guestsTables.toString()],
                ['Guests (pax)', viewReportData.guestsPax.toString()],
                ['Discount', `RM ${viewReportData.discount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`],
                ['Void', `${viewReportData.voidCount} items / RM ${viewReportData.voidValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`],
                ['Notable Guests', viewReportData.notableGuests || '—'],
                ['Incident Report', viewReportData.incidentReport || '—'],
                ['Breakage', viewReportData.breakage || '—'],
                ['Free Shots', viewReportData.freeShots || '—'],
              ].map(([label, value]) => (
                <div key={label} className="bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5">
                  <p className="text-[#5A5865] text-xs mb-0.5">{label}</p>
                  <p className="text-[#F0EEF6] text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1 border-t border-[#2A2A30]">
              {isAdmin && (
                <button
                  onClick={() => {
                    if (!viewReportData || !viewReportShiftId) return
                    setNightReport({ ...viewReportData })
                    setReportSaved(false)
                    setEditingHistoricalReport(true)
                    setViewReportModal(false)
                    setNightReportModal(true)
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:text-violet-300 transition-all"
                >
                  <Save size={14} /> Edit Report
                </button>
              )}
              <button onClick={async () => { if (viewReportData) { try { await navigator.clipboard.writeText(buildReportText(viewReportData)); toast('Copied!', 'success') } catch { toast('Could not copy', 'error') } }}}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] transition-all">
                <Copy size={14} /> Copy Text
              </button>
              <button onClick={() => { if (viewReportData) { const text = buildReportText(viewReportData); const win = window.open('', '_blank', 'width=400,height=700'); if (!win) return; win.document.write(`<!DOCTYPE html><html><head><title>Night Report</title><style>@page{size:80mm auto;margin:4mm}body{font-family:'Courier New',monospace;font-size:11px;color:#000;white-space:pre-wrap;margin:0;padding:0}@media screen{body{background:#111;color:#eee;padding:16px}}</style></head><body>${text}</body></html>`); win.document.close(); win.focus(); setTimeout(()=>win.print(),300) }}}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] transition-all">
                <Printer size={14} /> Print / PDF
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Open Shift Modal */}
      <Modal isOpen={openModal} onClose={() => { setOpenModal(false); setOpenPassword('') }} title="Open New Shift" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Opening Float (MYR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openFloat}
              onChange={e => setOpenFloat(e.target.value)}
              className="w-full bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
              placeholder="0.00"
            />
            <p className="text-[#5A5865] text-xs mt-1">Enter the cash amount in the drawer at shift start.</p>
          </div>
          <div>
            <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Your Password</label>
            <div className="relative">
              <input
                type={showOpenPwd ? 'text' : 'password'}
                value={openPassword}
                onChange={e => setOpenPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleOpenShift()}
                className="w-full bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5 pr-10 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                placeholder="Enter your login password"
              />
              <button type="button" onClick={() => setShowOpenPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5865] hover:text-[#9896A4]">
                {showOpenPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setOpenModal(false); setOpenPassword('') }}
              className="flex-1 bg-[#1A1A1E] hover:bg-[#222228] text-[#9896A4] text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleOpenShift}
              disabled={loading || !openPassword}
              className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Opening…' : 'Open Shift'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Close Shift Modal */}
      <Modal isOpen={closeModal} onClose={() => setCloseModal(false)} title="Close Shift" size="sm">
        <div className="space-y-4">
          <div className="bg-[#0E0E11] rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-[#9896A4]">Opening Float</span>
              <span className="text-[#F0EEF6]">{formatCurrency(openShift?.opening_float ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9896A4]">Cash Sales</span>
              <span className="text-[#F0EEF6]">{formatCurrency(shiftOrders?.payment_breakdown?.cash ?? 0)}</span>
            </div>
            <div className="border-t border-[#2A2A30] pt-1.5 flex justify-between text-sm font-medium">
              <span className="text-[#9896A4]">Expected Cash</span>
              <span className="text-[#F0EEF6]">{formatCurrency(expectedCash)}</span>
            </div>
          </div>

          {/* Cash denomination counter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#9896A4] text-xs font-medium">Actual Cash Counted</label>
              <button
                type="button"
                onClick={() => {
                  setUseCounter(v => !v)
                  setDenomCounts({})
                  setClosingCash('')
                }}
                className="text-[#6C63FF] text-xs hover:text-[#A78BFA] transition-colors"
              >
                {useCounter ? 'Enter manually' : 'Use denomination counter'}
              </button>
            </div>

            {useCounter ? (
              <div className="space-y-2">
                {DENOMINATIONS.map(d => (
                  <div key={d.value} className="flex items-center gap-3 bg-[#0E0E11] rounded-lg px-3 py-2">
                    <span className="text-[#9896A4] text-sm w-16 shrink-0">{d.label}</span>
                    <button
                      type="button"
                      onClick={() => setDenomCounts(c => ({ ...c, [d.value]: Math.max(0, (c[d.value] ?? 0) - 1) }))}
                      className="w-7 h-7 rounded-md bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] text-lg leading-none flex items-center justify-center"
                    >−</button>
                    <span className="flex-1 text-center text-[#F0EEF6] font-mono text-sm tabular-nums">
                      {denomCounts[d.value] ?? 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDenomCounts(c => ({ ...c, [d.value]: (c[d.value] ?? 0) + 1 }))}
                      className="w-7 h-7 rounded-md bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] text-lg leading-none flex items-center justify-center"
                    >+</button>
                    <span className="text-[#5A5865] text-xs w-16 text-right tabular-nums shrink-0">
                      {((denomCounts[d.value] ?? 0) * d.value).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-[#1A1A1E] rounded-lg px-4 py-3 border border-[#2A2A30]">
                  <span className="text-[#9896A4] text-sm font-medium">Total Counted</span>
                  <span className="text-[#F0EEF6] font-bold text-lg tabular-nums">
                    {formatCurrency(denomTotal)}
                  </span>
                </div>
              </div>
            ) : (
              <input
                type="number"
                min="0"
                step="0.01"
                value={closingCash}
                onChange={e => setClosingCash(e.target.value)}
                className="w-full bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                placeholder="0.00"
              />
            )}
          </div>

          {(useCounter || closingCash !== '') && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${variance < 0 ? 'bg-red-500/10 border border-red-500/20' : variance > 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-[#0E0E11] border border-[#2A2A30]'}`}>
              {variance < 0 ? <AlertCircle size={14} className="text-red-400 shrink-0" /> : <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
              <span className="text-[#9896A4]">Variance:</span>
              <span className={`font-medium ${variance < 0 ? 'text-red-400' : variance > 0 ? 'text-emerald-400' : 'text-[#9896A4]'}`}>
                {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
              </span>
              {variance < 0 && <span className="text-red-400 text-xs ml-auto">Short</span>}
              {variance > 0 && <span className="text-emerald-400 text-xs ml-auto">Over</span>}
            </div>
          )}

          <div>
            <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Notes (optional)</label>
            <textarea
              value={shiftNotes}
              onChange={e => setShiftNotes(e.target.value)}
              rows={2}
              className="w-full bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#7C3AED] transition-colors resize-none"
              placeholder="Any notes for this shift…"
            />
          </div>

          <div>
            <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Your Password</label>
            <div className="relative">
              <input
                type={showClosePwd ? 'text' : 'password'}
                value={closePassword}
                onChange={e => setClosePassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCloseShift()}
                className="w-full bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5 pr-10 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                placeholder="Enter your login password"
              />
              <button type="button" onClick={() => setShowClosePwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5865] hover:text-[#9896A4]">
                {showClosePwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setCloseModal(false); setClosePassword('') }}
              className="flex-1 bg-[#1A1A1E] hover:bg-[#222228] text-[#9896A4] text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCloseShift}
              disabled={loading || (!useCounter && closingCash === '') || !closePassword}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Closing…' : 'Confirm Close'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Settlement Receipt Modal ───────────────────────────────────────── */}
      <Modal isOpen={settlementModal} onClose={() => { setSettlementModal(false); setSettlementData(null) }} title="Settlement Receipt" size="lg">
        {settlementData && (() => {
          const d = settlementData
          const fmt = (n: number) => n.toLocaleString('en-MY', { style: 'currency', currency: 'MYR' })
          const total = d.payments.cash + d.payments.credit_card + d.payments.qr_payment + d.payments.online
          const expectedCash = d.shift.opening_float + d.payments.cash
          const variance = d.shift.variance ?? 0
          const catTotal = d.categories.cocktails + d.categories.beer + d.categories.wine + d.categories.food + d.categories.others

          return (
            <div className="space-y-5">
              {/* Shift info */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Opened by', value: d.openedBy, sub: formatTime(d.shift.opened_at) },
                  { label: 'Closed by', value: d.closedBy ?? '—', sub: d.shift.closed_at ? formatTime(d.shift.closed_at) : '—' },
                  { label: 'Opening Float', value: fmt(d.shift.opening_float), sub: d.shift.closed_at ? formatDuration(d.shift.opened_at, d.shift.closed_at) : '—' },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="bg-[#0E0E11] border border-[#2A2A30] rounded-lg px-3 py-2.5">
                    <p className="text-[#5A5865] text-xs mb-0.5">{label}</p>
                    <p className="text-[#F0EEF6] text-sm font-semibold">{value}</p>
                    <p className="text-[#5A5865] text-xs mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Revenue */}
              <div className="bg-[#0E0E11] border border-[#2A2A30] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E1E24]">
                  <span className="text-[#5A5865] text-xs font-semibold uppercase tracking-wider">Revenue</span>
                  <span className="text-[#F0EEF6] text-xl font-bold tabular-nums">{fmt(d.revenue.net)}</span>
                </div>
                {[
                  { label: 'Gross Sales', value: fmt(d.revenue.gross), red: false },
                  { label: 'Discounts', value: `−${fmt(d.revenue.discount)}`, red: d.revenue.discount > 0 },
                  ...(d.revenue.serviceCharge > 0 ? [{ label: 'Service Charge', value: fmt(d.revenue.serviceCharge), red: false }] : []),
                  { label: `Voids (${d.revenue.voidCount} items)`, value: `−${fmt(d.revenue.voidValue)}`, red: d.revenue.voidValue > 0 },
                ].map(({ label, value, red }) => (
                  <div key={label} className="flex justify-between px-4 py-2 border-b border-[#1E1E24] last:border-0">
                    <span className="text-[#9896A4] text-sm">{label}</span>
                    <span className={`text-sm font-medium tabular-nums ${red ? 'text-rose-400' : 'text-[#F0EEF6]'}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Payments */}
              <div className="bg-[#0E0E11] border border-[#2A2A30] rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#1E1E24]">
                  <span className="text-[#5A5865] text-xs font-semibold uppercase tracking-wider">Payment Breakdown</span>
                </div>
                <div className="grid grid-cols-4 divide-x divide-[#1E1E24]">
                  {[
                    { method: 'Cash', amount: d.payments.cash },
                    { method: 'Card', amount: d.payments.credit_card },
                    { method: 'QR', amount: d.payments.qr_payment },
                    { method: 'Online', amount: d.payments.online },
                  ].map(({ method, amount }) => (
                    <div key={method} className="px-3 py-3 text-center">
                      <p className="text-[#5A5865] text-[10px] mb-1">{method}</p>
                      <p className={`text-sm font-semibold tabular-nums ${amount > 0 ? 'text-[#F0EEF6]' : 'text-[#3A3A42]'}`}>
                        {amount > 0 ? amount.toLocaleString('en-MY', { minimumFractionDigits: 0 }) : '—'}
                      </p>
                      {total > 0 && amount > 0 && (
                        <p className="text-[#5A5865] text-[10px] mt-0.5">{Math.round(amount / total * 100)}%</p>
                      )}
                    </div>
                  ))}
                </div>
                {/* Cash reconciliation */}
                <div className="flex items-center gap-3 px-4 py-3 border-t border-[#1E1E24] flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#5A5865] text-[10px]">Float</span>
                    <span className="text-[#F0EEF6] text-sm font-semibold tabular-nums">{fmt(d.shift.opening_float)}</span>
                  </div>
                  <span className="text-[#3A3A42] text-base">+</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#5A5865] text-[10px]">Cash Sales</span>
                    <span className="text-[#F0EEF6] text-sm font-semibold tabular-nums">{fmt(d.payments.cash)}</span>
                  </div>
                  <span className="text-[#3A3A42] text-base">=</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#5A5865] text-[10px]">Expected in Drawer</span>
                    <span className="text-[#F0EEF6] text-sm font-semibold tabular-nums">{fmt(expectedCash)}</span>
                  </div>
                  <div className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${Math.abs(variance) < 0.01 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : variance < 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                    {Math.abs(variance) < 0.01 ? '✓ Balanced' : variance < 0 ? `Short ${fmt(Math.abs(variance))}` : `Over ${fmt(variance)}`}
                  </div>
                </div>
              </div>

              {/* Floor + Categories */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0E0E11] border border-[#2A2A30] rounded-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-[#1E1E24]">
                    <span className="text-[#5A5865] text-[10px] font-semibold uppercase tracking-wider">Floor</span>
                  </div>
                  {[
                    { label: 'Orders', value: d.floor.orders },
                    { label: 'Covers (pax)', value: d.floor.covers },
                    { label: 'Drinks sold', value: d.floor.drinksSold },
                    { label: 'Discounted orders', value: d.floor.discountedOrders },
                    { label: 'Void items', value: d.revenue.voidCount },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between px-3 py-2 border-b border-[#1E1E24] last:border-0">
                      <span className="text-[#9896A4] text-xs">{label}</span>
                      <span className="text-[#F0EEF6] text-xs font-semibold tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-[#0E0E11] border border-[#2A2A30] rounded-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-[#1E1E24]">
                    <span className="text-[#5A5865] text-[10px] font-semibold uppercase tracking-wider">Category Mix</span>
                  </div>
                  {[
                    { label: 'Cocktails', value: d.categories.cocktails },
                    { label: 'Beer', value: d.categories.beer },
                    { label: 'Wine / Whisky', value: d.categories.wine },
                    { label: 'Food', value: d.categories.food },
                    { label: 'Others', value: d.categories.others },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center px-3 py-2 border-b border-[#1E1E24] last:border-0">
                      <span className="text-[#9896A4] text-xs">{label}</span>
                      <div className="text-right">
                        <span className={`text-xs font-semibold tabular-nums ${value > 0 ? 'text-[#F0EEF6]' : 'text-[#3A3A42]'}`}>
                          {value > 0 ? fmt(value) : '—'}
                        </span>
                        {catTotal > 0 && value > 0 && (
                          <span className="text-[#5A5865] text-[10px] ml-1">({Math.round(value / catTotal * 100)}%)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1 border-t border-[#2A2A30]">
                <button
                  onClick={printSettlement}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#7C3AED] hover:bg-[#6D28D9] text-white transition-colors"
                >
                  <Printer size={13} /> Print Receipt
                </button>
                <button
                  onClick={async () => {
                    const d2 = settlementData
                    if (!d2) return
                    const fmt2 = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
                    const text = [
                      'SETTLEMENT RECEIPT — ARKIB BAR',
                      '──────────────────────────────',
                      `Date     : ${new Date(d2.shift.opened_at).toLocaleDateString('en-MY', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`,
                      `Shift    : ${formatTime(d2.shift.opened_at)} – ${d2.shift.closed_at ? formatTime(d2.shift.closed_at) : '--'}`,
                      `Opened by: ${d2.openedBy}`,
                      `Closed by: ${d2.closedBy ?? '—'}`,
                      '',
                      '── REVENUE ───────────────────',
                      `Gross Sales : ${fmt2(d2.revenue.gross)}`,
                      `Discount    : −${fmt2(d2.revenue.discount)}`,
                      `Voids       : −${fmt2(d2.revenue.voidValue)} (${d2.revenue.voidCount} items)`,
                      `TOTAL       : ${fmt2(d2.revenue.net)}`,
                      '',
                      '── PAYMENTS ──────────────────',
                      `Cash        : ${fmt2(d2.payments.cash)}`,
                      `Card        : ${fmt2(d2.payments.credit_card)}`,
                      `QR          : ${fmt2(d2.payments.qr_payment)}`,
                      `Online      : ${fmt2(d2.payments.online)}`,
                      '',
                      '── CASH DRAWER ───────────────',
                      `Float       : ${fmt2(d2.shift.opening_float)}`,
                      `Cash Sales  : ${fmt2(d2.payments.cash)}`,
                      `Expected    : ${fmt2(d2.shift.opening_float + d2.payments.cash)}`,
                      `Variance    : ${fmt2(d2.shift.variance ?? 0)}`,
                      '',
                      '── FLOOR ─────────────────────',
                      `Orders      : ${d2.floor.orders}`,
                      `Covers (pax): ${d2.floor.covers}`,
                      `Drinks sold : ${d2.floor.drinksSold}`,
                      `Discounted  : ${d2.floor.discountedOrders} orders`,
                    ].join('\n')
                    try { await navigator.clipboard.writeText(text); toast('Copied to clipboard', 'success') }
                    catch { toast('Could not copy — please select and copy manually', 'error') }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] transition-colors"
                >
                  <Copy size={13} /> Copy Text
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
