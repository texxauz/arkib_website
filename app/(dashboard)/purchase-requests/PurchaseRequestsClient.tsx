'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { useToast } from '@/components/ui/Toast'
import { Plus, X, ChevronDown, ShoppingCart, Clock, CheckCircle, XCircle, Truck, PackageCheck } from 'lucide-react'

interface NameRow { full_name: string }
interface PurchaseRequest {
  id: string
  item_name: string
  brand: string | null
  quantity: number
  unit: string
  urgency: 'normal' | 'urgent'
  notes: string | null
  status: 'pending' | 'approved' | 'rejected' | 'ordered' | 'received'
  requested_by: string
  review_notes: string | null
  created_at: string
  updated_at: string
  requester: NameRow | null
  reviewer: NameRow | null
  orderer: NameRow | null
  receiver: NameRow | null
}

interface Props {
  requests: PurchaseRequest[]
  currentUserId: string
  currentUserRole: string
  currentUserName: string
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: 'Pending',  color: 'bg-amber-500/15 text-amber-400 border-amber-500/20',    icon: <Clock size={11} /> },
  approved: { label: 'Approved', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20',       icon: <CheckCircle size={11} /> },
  rejected: { label: 'Rejected', color: 'bg-rose-500/15 text-rose-400 border-rose-500/20',       icon: <XCircle size={11} /> },
  ordered:  { label: 'Ordered',  color: 'bg-purple-500/15 text-purple-400 border-purple-500/20', icon: <Truck size={11} /> },
  received: { label: 'Received', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', icon: <PackageCheck size={11} /> },
}

const UNITS = ['bottles', 'cases', 'cartons', 'cans', 'kegs', 'litres', 'pcs']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: PurchaseRequest) => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({ itemName: '', brand: '', quantity: '', unit: 'bottles', urgency: 'normal', notes: '' })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.itemName || !form.quantity) { toast('Item name and quantity required', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/purchase-requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName: form.itemName, brand: form.brand || null, quantity: Number(form.quantity), unit: form.unit, urgency: form.urgency, notes: form.notes || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast('Request submitted', 'success')
      onCreated(data.request)
    } catch (e: any) {
      toast(e.message ?? 'Failed to submit', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#141417] border border-[#2A2A30] rounded-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A30]">
          <h2 className="text-[#F0EEF6] font-semibold">New Stock Request</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#2A2A30] transition-colors"><X size={16} className="text-[#9896A4]" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Item Name <span className="text-rose-400">*</span></label>
            <input
              type="text" required placeholder="e.g. Johnnie Walker Black Label"
              value={form.itemName} onChange={e => set('itemName', e.target.value)}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Brand <span className="text-[#5A5865]">(optional)</span></label>
            <input
              type="text" placeholder="e.g. Diageo"
              value={form.brand} onChange={e => set('brand', e.target.value)}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Quantity <span className="text-rose-400">*</span></label>
              <input
                type="number" required min="1" step="1" placeholder="e.g. 3"
                value={form.quantity} onChange={e => set('quantity', e.target.value)}
                className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
            <div>
              <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Unit</label>
              <select
                value={form.unit} onChange={e => set('unit', e.target.value)}
                className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Urgency</label>
            <div className="flex gap-2">
              {(['normal', 'urgent'] as const).map(u => (
                <button key={u} type="button" onClick={() => set('urgency', u)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.urgency === u
                    ? u === 'urgent' ? 'bg-rose-500/15 border-rose-500/40 text-rose-400' : 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#A78BFA]'
                    : 'border-[#2A2A30] text-[#9896A4] hover:bg-[#2A2A30]'}`}
                >
                  {u === 'urgent' ? 'Urgent' : 'Normal'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Notes <span className="text-[#5A5865]">(optional)</span></label>
            <textarea
              placeholder="e.g. Need before this weekend, almost out"
              value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[#2A2A30] text-[#9896A4] text-sm hover:bg-[#2A2A30] transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-[#8B5CF6] text-white text-sm font-medium hover:bg-[#7C3AED] transition-colors disabled:opacity-50">
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#141417] border border-[#2A2A30] rounded-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A30]">
          <h2 className="text-[#F0EEF6] font-semibold">Reject Request</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#2A2A30]"><X size={16} className="text-[#9896A4]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Reason <span className="text-[#5A5865]">(optional — shown to requester)</span></label>
            <textarea
              value={reason} onChange={e => setReason(e.target.value)}
              rows={3} placeholder="e.g. Already sufficient stock, will revisit next month"
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[#2A2A30] text-[#9896A4] text-sm hover:bg-[#2A2A30] transition-colors">Cancel</button>
            <button onClick={() => onConfirm(reason)} className="flex-1 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors">Reject</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Request Card ──────────────────────────────────────────────────────────────

function RequestCard({ req, isAdmin, onStatusChange }: {
  req: PurchaseRequest
  isAdmin: boolean
  onStatusChange: (id: string, status: string, reviewNotes?: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const meta = STATUS_META[req.status]

  return (
    <>
      <div className={`bg-[#141417] border rounded-xl overflow-hidden transition-colors ${req.urgency === 'urgent' ? 'border-rose-500/30' : 'border-[#2A2A30]'}`}>
        <div className="px-4 py-3.5 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[#F0EEF6] font-medium text-sm">{req.item_name}</span>
              {req.brand && <span className="text-[#5A5865] text-xs">· {req.brand}</span>}
              {req.urgency === 'urgent' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-rose-500/15 text-rose-400 border-rose-500/20 uppercase tracking-wide">Urgent</span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[#9896A4] text-xs">{Number(req.quantity)} {req.unit}</span>
              <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.color}`}>
                {meta.icon} {meta.label}
              </span>
              <span className="text-[#5A5865] text-xs">by {req.requester?.full_name ?? '—'} · {formatDate(req.created_at)}</span>
            </div>
          </div>

          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded hover:bg-[#2A2A30] transition-colors flex-shrink-0 mt-0.5">
            <ChevronDown size={14} className={`text-[#5A5865] transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {expanded && (
          <div className="px-4 pb-4 border-t border-[#2A2A30] pt-3 space-y-3">
            {req.notes && (
              <p className="text-[#9896A4] text-xs italic">"{req.notes}"</p>
            )}

            {req.review_notes && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                <p className="text-rose-400 text-xs font-medium mb-0.5">Rejection reason</p>
                <p className="text-rose-300 text-xs">{req.review_notes}</p>
              </div>
            )}

            <div className="space-y-1 text-xs text-[#5A5865]">
              {req.reviewer && <p>Reviewed by {req.reviewer.full_name}</p>}
              {req.orderer && <p>Ordered by {req.orderer.full_name}</p>}
              {req.receiver && <p>Received by {req.receiver.full_name}</p>}
            </div>

            {/* Action buttons — admin only */}
            {isAdmin && (
              <div className="flex gap-2 pt-1 flex-wrap">
                {req.status === 'pending' && (
                  <>
                    <button
                      onClick={() => onStatusChange(req.id, 'approved')}
                      className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600/15 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/25 transition-colors font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setRejecting(true)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/20 hover:bg-rose-500/25 transition-colors font-medium"
                    >
                      Reject
                    </button>
                  </>
                )}
                {req.status === 'approved' && (
                  <button
                    onClick={() => onStatusChange(req.id, 'ordered')}
                    className="px-3 py-1.5 text-xs rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/20 hover:bg-purple-500/25 transition-colors font-medium"
                  >
                    Mark as Ordered
                  </button>
                )}
                {req.status === 'ordered' && (
                  <button
                    onClick={() => onStatusChange(req.id, 'received')}
                    className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 transition-colors font-medium"
                  >
                    Mark as Received
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {rejecting && (
        <RejectModal
          onClose={() => setRejecting(false)}
          onConfirm={reason => { setRejecting(false); onStatusChange(req.id, 'rejected', reason) }}
        />
      )}
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function PurchaseRequestsClient({ requests: initial, currentUserId, currentUserRole, currentUserName }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [requests, setRequests] = useState<PurchaseRequest[]>(initial)
  const [creating, setCreating] = useState(false)
  const [tab, setTab] = useState<'active' | 'history'>('active')

  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'manager'
  const canRequest = isAdmin || currentUserRole === 'full_timer'

  const active = requests.filter(r => ['pending', 'approved', 'ordered'].includes(r.status))
  const history = requests.filter(r => ['rejected', 'received'].includes(r.status))
  const pendingCount = requests.filter(r => r.status === 'pending').length

  const handleStatusChange = async (id: string, status: string, reviewNotes?: string) => {
    try {
      const res = await fetch('/api/purchase-requests/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, status, reviewNotes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRequests(rs => rs.map(r => r.id === id ? { ...r, ...data.request } : r))
      toast(`Marked as ${status}`, 'success')
    } catch (e: any) {
      toast(e.message ?? 'Failed to update', 'error')
    }
  }

  const handleCreated = (req: PurchaseRequest) => {
    setRequests(rs => [req as any, ...rs])
    setCreating(false)
  }

  const shown = tab === 'active' ? active : history

  return (
    <div className="min-h-screen bg-[#0D0D10]">
      <TopBar
        title="Purchase Requests"
        subtitle="Request and track stock replenishment"
        actions={
          canRequest ? (
            <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> New Request
            </button>
          ) : undefined
        }
      />

      <div className="p-4 lg:p-6 max-w-3xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 bg-[#141417] border border-[#2A2A30] rounded-xl p-1 mb-6">
          {([
            { key: 'active', label: 'Active', count: active.length },
            { key: 'history', label: 'History', count: history.length },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-[#8B5CF6] text-white' : 'text-[#9896A4] hover:text-[#F0EEF6]'}`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-white/20' : 'bg-[#2A2A30]'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Pending alert for admin */}
        {isAdmin && pendingCount > 0 && tab === 'active' && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
            <Clock size={14} className="text-amber-400 flex-shrink-0" />
            <p className="text-amber-400 text-sm font-medium">
              {pendingCount} request{pendingCount > 1 ? 's' : ''} awaiting your approval
            </p>
          </div>
        )}

        {/* List */}
        {shown.length === 0 ? (
          <div className="text-center py-16 text-[#5A5865]">
            <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{tab === 'active' ? 'No active requests' : 'No history yet'}</p>
            {tab === 'active' && canRequest && (
              <button onClick={() => setCreating(true)} className="mt-3 text-[#8B5CF6] text-sm hover:text-[#A78BFA] transition-colors">
                + Submit a request
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map(r => (
              <RequestCard
                key={r.id}
                req={r}
                isAdmin={isAdmin}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {creating && (
        <CreateModal onClose={() => setCreating(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
