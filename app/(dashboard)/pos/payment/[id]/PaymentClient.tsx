'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  QrCode,
  Layers,
  CheckCircle2,
  Tag,
  Percent,
  ChevronRight,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { ReceiptPrint, type ReceiptData } from '@/app/(dashboard)/pos/order/[id]/ReceiptPrint'

// ─── Types ───────────────────────────────────────────────────────────────────

type PosOrder = {
  id: string
  table_name: string | null
  covers: number
  opened_at: string
  server_name: string | null
}

type OrderItem = {
  id: string
  item_name: string
  category: string | null
  quantity: number
  unit_price: number
  discount: number
}

type Discount = {
  id: string
  name: string
  type: string
  value: number
  requires_approval: boolean
}

type PayMethod = 'cash' | 'credit_card' | 'qr_payment' | 'mixed'

interface Props {
  order: PosOrder
  items: OrderItem[]
  discounts: Discount[]
  userId: string
  userName: string
  isAdmin: boolean
  config: Record<string, string>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(n: number) {
  return n % 1 === 0 ? `${n}%` : `${n.toFixed(1)}%`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PaymentClient({
  order,
  items,
  discounts,
  userId,
  userName,
  isAdmin,
  config,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()

  // Config-driven defaults
  const [serviceChargeOn, setServiceChargeOn] = useState(
    config.service_charge_enabled === 'true'
  )
  const [taxOn, setTaxOn] = useState(config.tax_enabled === 'true')
  const serviceChargePct = parseFloat(config.service_charge_pct ?? '10')
  const taxPct = parseFloat(config.tax_pct ?? '0')

  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null)
  const [approvalModal, setApprovalModal] = useState<{ open: boolean; discount: Discount | null }>({
    open: false,
    discount: null,
  })
  const [approvalPin, setApprovalPin] = useState('')
  const [payMethod, setPayMethod] = useState<PayMethod>('cash')
  const [cashEntered, setCashEntered] = useState('')
  const [mixedPayments, setMixedPayments] = useState({ cash: '', card: '', qr: '' })
  const [loading, setLoading] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)

  // ─── Calculations ───────────────────────────────────────────────────────────

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price - (item.discount ?? 0),
    0
  )

  const discountAmount = selectedDiscount
    ? selectedDiscount.type === 'percent'
      ? subtotal * (selectedDiscount.value / 100)
      : selectedDiscount.value
    : 0

  const afterDiscount = subtotal - discountAmount
  const serviceChargeAmount = serviceChargeOn ? afterDiscount * (serviceChargePct / 100) : 0
  const taxAmount = taxOn ? (afterDiscount + serviceChargeAmount) * (taxPct / 100) : 0
  const total = afterDiscount + serviceChargeAmount + taxAmount

  const cashValue = parseFloat(cashEntered || '0')
  const change = payMethod === 'cash' ? cashValue - total : 0

  // ─── Discount selection ─────────────────────────────────────────────────────

  function handleDiscountChip(discount: Discount) {
    if (selectedDiscount?.id === discount.id) {
      setSelectedDiscount(null)
      return
    }
    if (discount.requires_approval && !isAdmin) {
      setApprovalModal({ open: true, discount })
      setApprovalPin('')
      return
    }
    setSelectedDiscount(discount)
  }

  const [approvalLoading, setApprovalLoading] = useState(false)

  async function handleApprovalSubmit() {
    if (approvalPin.trim().length < 4) {
      toast('Enter a 4-digit manager PIN', 'error')
      return
    }
    setApprovalLoading(true)
    const res = await fetch('/api/pos/verify-manager-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: approvalPin.trim() }),
    })
    setApprovalLoading(false)
    if (!res.ok) {
      toast('Invalid manager PIN', 'error')
      setApprovalPin('')
      return
    }
    if (approvalModal.discount) setSelectedDiscount(approvalModal.discount)
    setApprovalModal({ open: false, discount: null })
    setApprovalPin('')
  }

  // ─── Payment submission ─────────────────────────────────────────────────────

  async function handlePay() {
    if (total <= 0) {
      toast('Nothing to charge', 'error')
      return
    }

    // Validate cash entry
    if (payMethod === 'cash' && cashValue < total) {
      toast('Cash entered is less than the total', 'error')
      return
    }

    // Build payments array
    let payments: { method: string; amount: number }[] = []

    if (payMethod === 'cash') {
      payments = [{ method: 'cash', amount: total }]
    } else if (payMethod === 'credit_card') {
      payments = [{ method: 'credit_card', amount: total }]
    } else if (payMethod === 'qr_payment') {
      payments = [{ method: 'qr_payment', amount: total }]
    } else {
      // mixed
      const cash = parseFloat(mixedPayments.cash || '0')
      const card = parseFloat(mixedPayments.card || '0')
      const qr = parseFloat(mixedPayments.qr || '0')
      const mixedTotal = cash + card + qr
      if (Math.abs(mixedTotal - total) > 0.01) {
        toast(`Mixed payments must sum to RM ${fmt(total)}`, 'error')
        return
      }
      if (cash > 0) payments.push({ method: 'cash', amount: cash })
      if (card > 0) payments.push({ method: 'credit_card', amount: card })
      if (qr > 0) payments.push({ method: 'qr_payment', amount: qr })
    }

    setLoading(true)
    try {
      const res = await fetch('/api/pos/close-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          payments,
          discountAmount,
          discountLabel: selectedDiscount?.name ?? null,
          serviceCharge: serviceChargeAmount,
          taxAmount,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to close order')
      toast('Payment collected', 'success')

      // Build receipt data and show receipt instead of navigating immediately
      const receipt: ReceiptData = {
        orderId: order.id,
        tableName: order.table_name,
        serverName: order.server_name,
        covers: order.covers,
        openedAt: order.opened_at,
        closedAt: new Date().toISOString(),
        items: items.map(i => ({ ...i, voided_at: null })),
        subtotal,
        discountAmount,
        discountLabel: selectedDiscount?.name ?? null,
        serviceCharge: serviceChargeAmount,
        taxAmount,
        total,
        payments,
        footerNote: config.receipt_footer_note ?? 'Thank you for visiting Arkib!',
      }
      setReceiptData(receipt)
      setShowReceipt(true)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  // ─── Grouped items for the summary ─────────────────────────────────────────

  const categories = [...new Set(items.map(i => i.category ?? 'Other'))]

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    {showReceipt && receiptData && (
      <ReceiptPrint
        data={receiptData}
        onClose={() => router.push('/pos')}
      />
    )}
    <div className="min-h-screen bg-[#0A0A0B] p-4 sm:p-6">
      <TopBar
        title="Collect Payment"
        subtitle={`${order.table_name ?? 'Walk-in'} · ${order.covers} cover${order.covers !== 1 ? 's' : ''} · ${order.server_name ?? userName}`}
        actions={
          <button
            onClick={() => router.push(`/pos/order/${order.id}`)}
            className="flex items-center gap-1.5 text-sm text-[#9896A4] hover:text-[#F0EEF6] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#141417] border border-transparent hover:border-[#2A2A30]"
          >
            <ArrowLeft size={14} />
            Back to order
          </button>
        }
      />

      {/* Two-column layout on md+ */}
      <div className="flex flex-col md:flex-row gap-4 items-start">

        {/* ── LEFT: Order summary ─────────────────────────────────────────── */}
        <div className="w-full md:w-[340px] shrink-0 flex flex-col gap-3">
          <div className="bg-[#141417] border border-[#2A2A30] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2A2A30] flex items-center justify-between">
              <span className="text-[#F0EEF6] font-semibold text-sm">Order Items</span>
              <span className="text-[#5A5865] text-xs">{items.length} item{items.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="divide-y divide-[#1A1A1E] max-h-[420px] overflow-y-auto">
              {categories.map(cat => {
                const catItems = items.filter(i => (i.category ?? 'Other') === cat)
                return (
                  <div key={cat}>
                    <div className="px-4 py-1.5 bg-[#111113]">
                      <span className="text-[#5A5865] text-[10px] font-semibold uppercase tracking-widest">
                        {cat}
                      </span>
                    </div>
                    {catItems.map(item => {
                      const lineTotal = item.quantity * item.unit_price - (item.discount ?? 0)
                      return (
                        <div key={item.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="mt-0.5 text-[#5A5865] text-xs font-medium w-5 text-right shrink-0 tabular-nums">
                              {item.quantity}×
                            </span>
                            <div className="min-w-0">
                              <p className="text-[#F0EEF6] text-sm leading-snug truncate">{item.item_name}</p>
                              {item.discount > 0 && (
                                <p className="text-[#5A5865] text-xs line-through tabular-nums">
                                  RM {fmt(item.quantity * item.unit_price)}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-[#F0EEF6] text-sm tabular-nums shrink-0 font-medium">
                            RM {fmt(lineTotal)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {items.length === 0 && (
                <div className="px-4 py-8 text-center text-[#5A5865] text-sm">
                  No items on this order.
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-[#2A2A30] flex items-center justify-between bg-[#111113]">
              <span className="text-[#9896A4] text-sm">Subtotal</span>
              <span className="text-[#F0EEF6] font-semibold tabular-nums">RM {fmt(subtotal)}</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Payment panel ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Discounts */}
          {discounts.length > 0 && (
            <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Tag size={13} className="text-[#9896A4]" />
                <span className="text-[#9896A4] text-xs font-semibold uppercase tracking-widest">Discount</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {discounts.map(d => {
                  const active = selectedDiscount?.id === d.id
                  return (
                    <button
                      key={d.id}
                      onClick={() => handleDiscountChip(d)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        active
                          ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/50 text-[#A78BFA]'
                          : 'bg-[#1A1A1E] border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:border-[#3A3A42]'
                      }`}
                    >
                      {d.type === 'percent' ? <Percent size={12} /> : <Tag size={12} />}
                      {d.name}
                      <span className="text-xs opacity-70">
                        {d.type === 'percent' ? `${d.value}%` : `RM ${fmt(d.value)}`}
                      </span>
                      {d.requires_approval && (
                        <span className="text-[10px] opacity-50 ml-0.5">🔒</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Charges */}
          <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Percent size={13} className="text-[#9896A4]" />
              <span className="text-[#9896A4] text-xs font-semibold uppercase tracking-widest">Charges</span>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center justify-between cursor-pointer select-none group">
                <div>
                  <span className="text-[#F0EEF6] text-sm">Service Charge</span>
                  <span className="text-[#5A5865] text-xs ml-2">{pct(serviceChargePct)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setServiceChargeOn(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    serviceChargeOn ? 'bg-[#8B5CF6]' : 'bg-[#2A2A30]'
                  }`}
                  aria-checked={serviceChargeOn}
                  role="switch"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      serviceChargeOn ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>

              {taxPct > 0 && (
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <div>
                    <span className="text-[#F0EEF6] text-sm">Tax</span>
                    <span className="text-[#5A5865] text-xs ml-2">{pct(taxPct)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTaxOn(v => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      taxOn ? 'bg-[#8B5CF6]' : 'bg-[#2A2A30]'
                    }`}
                    aria-checked={taxOn}
                    role="switch"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        taxOn ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              )}
            </div>
          </div>

          {/* Totals breakdown */}
          <div className="bg-[#141417] border border-[#2A2A30] rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex flex-col gap-1.5">
              <TotalRow label="Subtotal" value={`RM ${fmt(subtotal)}`} />
              {discountAmount > 0 && selectedDiscount && (
                <TotalRow
                  label={`Discount — ${selectedDiscount.name}`}
                  value={`− RM ${fmt(discountAmount)}`}
                  muted
                  accent="text-emerald-400"
                />
              )}
              {serviceChargeOn && (
                <TotalRow
                  label={`Service Charge (${pct(serviceChargePct)})`}
                  value={`+ RM ${fmt(serviceChargeAmount)}`}
                  muted
                />
              )}
              {taxOn && taxPct > 0 && (
                <TotalRow
                  label={`Tax (${pct(taxPct)})`}
                  value={`+ RM ${fmt(taxAmount)}`}
                  muted
                />
              )}
            </div>
            <div className="px-4 py-3.5 bg-[#111113] border-t border-[#2A2A30] flex items-center justify-between">
              <span className="text-[#F0EEF6] font-bold text-base">Total</span>
              <span className="text-[#F0EEF6] font-bold text-2xl tabular-nums tracking-tight">
                RM {fmt(total)}
              </span>
            </div>
          </div>

          {/* Payment method */}
          <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard size={13} className="text-[#9896A4]" />
              <span className="text-[#9896A4] text-xs font-semibold uppercase tracking-widest">Payment Method</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { key: 'cash', label: 'Cash', Icon: Banknote },
                  { key: 'credit_card', label: 'Card', Icon: CreditCard },
                  { key: 'qr_payment', label: 'QR', Icon: QrCode },
                  { key: 'mixed', label: 'Mixed', Icon: Layers },
                ] as const
              ).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setPayMethod(key)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-all ${
                    payMethod === key
                      ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/50 text-[#A78BFA]'
                      : 'bg-[#1A1A1E] border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:border-[#3A3A42]'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cash input */}
          {payMethod === 'cash' && (
            <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4 flex flex-col gap-3">
              <div>
                <label className="label">Cash Tendered (RM)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder={fmt(total)}
                  value={cashEntered}
                  onChange={e => setCashEntered(e.target.value)}
                  className="input text-lg font-semibold"
                />
              </div>
              {cashEntered !== '' && (
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium border ${
                  change >= 0
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}>
                  <span>{change >= 0 ? 'Change' : 'Shortfall'}</span>
                  <span className="tabular-nums font-semibold">
                    RM {fmt(Math.abs(change))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Mixed inputs */}
          {payMethod === 'mixed' && (
            <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4 flex flex-col gap-3">
              <p className="text-[#5A5865] text-xs">Split the total across methods. Must sum to RM {fmt(total)}.</p>
              {(
                [
                  { key: 'cash', label: 'Cash (RM)' },
                  { key: 'card', label: 'Card (RM)' },
                  { key: 'qr', label: 'QR (RM)' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                    value={mixedPayments[key]}
                    onChange={e => setMixedPayments(prev => ({ ...prev, [key]: e.target.value }))}
                    className="input tabular-nums"
                  />
                </div>
              ))}
              {/* Running sum indicator */}
              {(() => {
                const sum =
                  parseFloat(mixedPayments.cash || '0') +
                  parseFloat(mixedPayments.card || '0') +
                  parseFloat(mixedPayments.qr || '0')
                const diff = sum - total
                if (Math.abs(diff) < 0.001) return null
                return (
                  <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border ${
                    diff > 0
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}>
                    <span>{diff > 0 ? 'Over by' : 'Short by'}</span>
                    <span className="tabular-nums">RM {fmt(Math.abs(diff))}</span>
                  </div>
                )
              })()}
            </div>
          )}

          {/* QR placeholder */}
          {payMethod === 'qr_payment' && (
            <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-6 flex flex-col items-center gap-3">
              <div className="w-40 h-40 bg-[#1A1A1E] border-2 border-dashed border-[#3A3A42] rounded-xl flex flex-col items-center justify-center gap-2 text-[#5A5865]">
                <QrCode size={48} strokeWidth={1} />
                <span className="text-xs text-center leading-snug px-2">QR code appears here</span>
              </div>
              <p className="text-[#9896A4] text-sm font-medium">Scan DuitNow QR</p>
              <p className="text-[#5A5865] text-xs text-center">
                Present the code to the customer. Tap Collect Payment once confirmed.
              </p>
            </div>
          )}

          {/* Collect button */}
          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#8B5CF6] hover:bg-[#6D28D9] active:scale-[0.98] text-white font-semibold text-base transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            {loading ? 'Processing…' : `Collect RM ${fmt(total)}`}
          </button>

          {/* Back link */}
          <button
            onClick={() => router.push(`/pos/order/${order.id}`)}
            className="flex items-center justify-center gap-1.5 text-sm text-[#5A5865] hover:text-[#9896A4] transition-colors py-1"
          >
            <ArrowLeft size={13} />
            Back to order
          </button>
        </div>
      </div>

      {/* Manager approval modal */}
      <Modal
        isOpen={approvalModal.open}
        onClose={() => setApprovalModal({ open: false, discount: null })}
        title="Manager Approval Required"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-[#9896A4] text-sm leading-relaxed">
            <span className="text-[#F0EEF6] font-medium">{approvalModal.discount?.name}</span>{' '}
            requires manager approval. Enter a manager PIN to apply this discount.
          </p>
          <div>
            <label className="label">Manager PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••"
              value={approvalPin}
              onChange={e => setApprovalPin(e.target.value)}
              className="input text-center text-xl tracking-[0.5em]"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setApprovalModal({ open: false, discount: null })}
              className="flex-1 px-4 py-2 rounded-lg bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] text-sm hover:text-[#F0EEF6] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprovalSubmit}
              disabled={approvalLoading}
              className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <ChevronRight size={14} />
              {approvalLoading ? 'Verifying…' : 'Apply Discount'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
    </>
  )
}

// ─── Small helper component ───────────────────────────────────────────────────

function TotalRow({
  label,
  value,
  muted = false,
  accent,
}: {
  label: string
  value: string
  muted?: boolean
  accent?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-sm ${muted ? 'text-[#5A5865]' : 'text-[#9896A4]'}`}>{label}</span>
      <span className={`text-sm tabular-nums font-medium ${accent ?? (muted ? 'text-[#9896A4]' : 'text-[#F0EEF6]')}`}>
        {value}
      </span>
    </div>
  )
}
