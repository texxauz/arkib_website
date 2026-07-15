'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { Clock, TrendingUp, ShoppingBag, Wallet, AlertCircle, CheckCircle2, Eye, EyeOff, TriangleAlert } from 'lucide-react'

type PosShift = {
  id: string; opened_by: string; closed_by: string | null
  opened_at: string; closed_at: string | null
  opening_float: number; closing_cash: number | null
  expected_cash: number | null; variance: number | null
  status: string; notes: string | null
  users_opened?: { full_name: string }
  users_closed?: { full_name: string } | null
}

type ShiftOrders = {
  count: number; revenue: number; payment_breakdown: Record<string, number>
}

type Props = {
  openShift: PosShift | null
  shiftHistory: PosShift[]
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

export function ShiftClient({ openShift, shiftHistory, shiftOrders, userId, userName, isAdmin }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [openModal, setOpenModal] = useState(false)
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
            <button
              onClick={() => { setClosingCash(''); setShiftNotes(''); setCloseModal(true) }}
              className="shrink-0 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              Close Shift
            </button>
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

      {/* Shift History */}
      {shiftHistory.length > 0 && (
        <div className="bg-[#141417] border border-[#2A2A30] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2A2A30]">
            <h3 className="text-[#F0EEF6] font-medium text-sm">Shift History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E24]">
                  {['Date', 'Opened By', 'Closed By', 'Float', 'Revenue', 'Variance', 'Duration'].map(h => (
                    <th key={h} className="text-left text-[#5A5865] font-medium text-xs px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shiftHistory.map(shift => {
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
                        {shift.expected_cash != null ? formatCurrency(shift.expected_cash) : '—'}
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
    </div>
  )
}
