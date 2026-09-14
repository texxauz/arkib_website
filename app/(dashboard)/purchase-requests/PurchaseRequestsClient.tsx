'use client'

import { useState, useEffect, useRef } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { useToast } from '@/components/ui/Toast'
import {
  Plus, X, ChevronDown, ShoppingCart, Clock, CheckCircle,
  XCircle, Truck, PackageCheck, MessageSquare, Send, CalendarDays,
  Copy, Check, ClipboardList, Trash2, Pencil,
} from 'lucide-react'

interface NameRow { full_name: string }

interface Comment {
  id: string
  request_id: string
  author_id: string
  author_name: string
  message: string
  created_at: string
}

interface PurchaseRequest {
  id: string
  item_name: string
  brand: string | null
  quantity: number
  unit: string
  urgency: 'normal' | 'urgent'
  notes: string | null
  needed_by: string | null
  status: 'pending' | 'approved' | 'rejected' | 'ordered' | 'received'
  requested_by: string
  review_notes: string | null
  adjusted_quantity: number | null
  supplier: string | null
  estimated_delivery: string | null
  received_quantity: number | null
  created_at: string
  updated_at: string
  requester: NameRow | null
  reviewer: NameRow | null
  orderer: NameRow | null
  receiver: NameRow | null
  supplier_product_id: string | null
  supplier_id: string | null
  supplier_name: string | null
  unit_price: number | null
}

interface ProductSearchResult {
  id: string
  item_name: string
  brand: string | null
  category: string | null
  size: string | null
  price_rm: number | null
  supplier_id: string
  suppliers: { name: string } | null
}

interface Props {
  requests: PurchaseRequest[]
  currentUserId: string
  currentUserRole: string
  currentUserName: string
}

const TABS = [
  { key: 'pending',  label: 'Pending',  },
  { key: 'approved', label: 'Approved', },
  { key: 'ordered',  label: 'Ordered',  },
  { key: 'received', label: 'Received', },
  { key: 'history',  label: 'History',  },
] as const

type TabKey = typeof TABS[number]['key']

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: 'Pending',  color: 'bg-amber-500/15 text-amber-400 border-amber-500/20',       icon: <Clock size={11} /> },
  approved: { label: 'Approved', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20',          icon: <CheckCircle size={11} /> },
  rejected: { label: 'Rejected', color: 'bg-rose-500/15 text-rose-400 border-rose-500/20',          icon: <XCircle size={11} /> },
  ordered:  { label: 'Ordered',  color: 'bg-purple-500/15 text-purple-400 border-purple-500/20',    icon: <Truck size={11} /> },
  received: { label: 'Received', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', icon: <PackageCheck size={11} /> },
}

const UNITS = ['bottles', 'cases', 'cartons', 'cans', 'kegs', 'litres', 'pcs']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true })
}

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: PurchaseRequest) => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    itemName: '', brand: '', quantity: '', unit: 'bottles',
    urgency: 'normal', notes: '', neededBy: '',
    supplierProductId: '', supplierId: '', supplierName: '', unitPrice: '',
  })
  const [saving, setSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (productSearch.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/purchase-requests/search-products?q=${encodeURIComponent(productSearch)}`)
        const data = await res.json()
        setSearchResults(data.products ?? [])
      } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [productSearch])

  const selectProduct = (p: ProductSearchResult) => {
    setSelectedProduct(p)
    setProductSearch('')
    setSearchResults([])
    set('itemName', p.item_name)
    set('brand', p.brand ?? '')
    set('supplierProductId', p.id)
    set('supplierId', p.supplier_id)
    set('supplierName', p.suppliers?.name ?? '')
    set('unitPrice', p.price_rm != null ? String(p.price_rm) : '')
  }

  const clearProduct = () => {
    setSelectedProduct(null)
    set('supplierProductId', '')
    set('supplierId', '')
    set('supplierName', '')
    set('unitPrice', '')
  }

  const estimatedCost = form.unitPrice && form.quantity
    ? (parseFloat(form.unitPrice) * parseFloat(form.quantity))
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.itemName || !form.quantity) { toast('Item name and quantity required', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/purchase-requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: form.itemName, brand: form.brand || null,
          quantity: Number(form.quantity), unit: form.unit,
          urgency: form.urgency, notes: form.notes || null,
          neededBy: form.neededBy || null,
          supplierProductId: form.supplierProductId || null,
          supplierId: form.supplierId || null,
          supplierName: form.supplierName || null,
          unitPrice: form.unitPrice ? parseFloat(form.unitPrice) : null,
        }),
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
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 bg-black/70" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#141417] border border-[#2A2A30] rounded-xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A30]">
          <h2 className="text-[#F0EEF6] font-semibold">New Stock Request</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#2A2A30] transition-colors"><X size={16} className="text-[#9896A4]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Catalogue search */}
          <div className="relative">
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Search Supplier Catalogue</label>
            <input
              type="text"
              placeholder="Type to search products…"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
            />
            {searching && (
              <p className="text-[#5A5865] text-xs mt-1">Searching…</p>
            )}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-[#141417] border border-[#2A2A30] rounded-xl shadow-xl z-10 max-h-64 overflow-y-auto">
                {searchResults.map(p => (
                  <div
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className="px-4 py-3 hover:bg-[#1A1A1E] cursor-pointer flex justify-between items-start gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[#F0EEF6] text-sm font-medium truncate">{p.item_name}</p>
                      <p className="text-[#5A5865] text-xs">
                        {[p.brand, p.suppliers?.name].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {p.price_rm != null && (
                      <span className="text-emerald-400 text-xs font-medium tabular-nums flex-shrink-0">RM {p.price_rm.toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected product pill */}
          {selectedProduct && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
              <p className="text-emerald-400 text-xs">
                ✓ From catalogue: <span className="font-medium">{selectedProduct.item_name}</span>
                {selectedProduct.suppliers?.name && ` · ${selectedProduct.suppliers.name}`}
                {selectedProduct.price_rm != null && ` · RM ${selectedProduct.price_rm.toFixed(2)}`}
              </p>
              <button type="button" onClick={clearProduct} className="text-[#5A5865] text-xs hover:text-[#9896A4] flex-shrink-0">× Clear</button>
            </div>
          )}

          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Item Name <span className="text-rose-400">*</span></label>
            <input type="text" required placeholder="e.g. Johnnie Walker Black Label"
              value={form.itemName} onChange={e => set('itemName', e.target.value)}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]" />
          </div>
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Brand <span className="text-[#5A5865]">(optional)</span></label>
            <input type="text" placeholder="e.g. Diageo"
              value={form.brand} onChange={e => set('brand', e.target.value)}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Quantity <span className="text-rose-400">*</span></label>
              <input type="number" required min="1" step="0.5" placeholder="e.g. 3"
                value={form.quantity} onChange={e => set('quantity', e.target.value)}
                className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]" />
            </div>
            <div>
              <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Unit</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)}
                className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {estimatedCost != null && !isNaN(estimatedCost) && (
            <p className="text-emerald-400 text-xs font-medium">Estimated cost: RM {estimatedCost.toFixed(2)}</p>
          )}
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Needed By <span className="text-[#5A5865]">(optional)</span></label>
            <input type="date" value={form.neededBy} onChange={e => set('neededBy', e.target.value)}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]" />
          </div>
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Urgency</label>
            <div className="flex gap-2">
              {(['normal', 'urgent'] as const).map(u => (
                <button key={u} type="button" onClick={() => set('urgency', u)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.urgency === u
                    ? u === 'urgent' ? 'bg-rose-500/15 border-rose-500/40 text-rose-400' : 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#A78BFA]'
                    : 'border-[#2A2A30] text-[#9896A4] hover:bg-[#2A2A30]'}`}>
                  {u === 'urgent' ? 'Urgent' : 'Normal'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Notes <span className="text-[#5A5865]">(optional)</span></label>
            <textarea placeholder="e.g. Almost out, need before Friday"
              value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] resize-none" />
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

// ── Approve Modal ─────────────────────────────────────────────────────────────

function ApproveModal({ req, onClose, onConfirm }: {
  req: PurchaseRequest
  onClose: () => void
  onConfirm: (adjustedQty: number | null) => void
}) {
  const [adjQty, setAdjQty] = useState(String(req.quantity))
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 bg-black/70" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#141417] border border-[#2A2A30] rounded-xl w-full max-w-sm overflow-hidden my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A30]">
          <h2 className="text-[#F0EEF6] font-semibold">Approve Request</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#2A2A30]"><X size={16} className="text-[#9896A4]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">
              Approved Quantity <span className="text-[#5A5865]">(requested: {req.quantity} {req.unit})</span>
            </label>
            <div className="flex gap-2">
              <input type="number" min="0.5" step="0.5" value={adjQty} onChange={e => setAdjQty(e.target.value)}
                className="flex-1 bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]" />
              <span className="flex items-center text-[#9896A4] text-sm px-2">{req.unit}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[#2A2A30] text-[#9896A4] text-sm hover:bg-[#2A2A30] transition-colors">Cancel</button>
            <button
              onClick={() => onConfirm(Number(adjQty) !== req.quantity ? Number(adjQty) : null)}
              className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Order Modal ───────────────────────────────────────────────────────────────

function OrderModal({ onClose, onConfirm }: {
  onClose: () => void
  onConfirm: (supplier: string, estimatedDelivery: string) => void
}) {
  const [supplier, setSupplier] = useState('')
  const [estDelivery, setEstDelivery] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 bg-black/70" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#141417] border border-[#2A2A30] rounded-xl w-full max-w-sm overflow-hidden my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A30]">
          <h2 className="text-[#F0EEF6] font-semibold">Mark as Ordered</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#2A2A30]"><X size={16} className="text-[#9896A4]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Supplier <span className="text-[#5A5865]">(optional)</span></label>
            <input type="text" placeholder="e.g. Tong Woh Group" value={supplier} onChange={e => setSupplier(e.target.value)}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]" />
          </div>
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Est. Delivery Date <span className="text-[#5A5865]">(optional)</span></label>
            <input type="date" value={estDelivery} onChange={e => setEstDelivery(e.target.value)}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[#2A2A30] text-[#9896A4] text-sm hover:bg-[#2A2A30] transition-colors">Cancel</button>
            <button onClick={() => onConfirm(supplier, estDelivery)}
              className="flex-1 px-4 py-2 rounded-lg bg-[#8B5CF6] text-white text-sm font-medium hover:bg-[#7C3AED] transition-colors">
              Confirm Order
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Receive Modal ─────────────────────────────────────────────────────────────

function ReceiveModal({ req, onClose, onConfirm }: {
  req: PurchaseRequest
  onClose: () => void
  onConfirm: (receivedQty: number) => void
}) {
  const expected = req.adjusted_quantity ?? req.quantity
  const [rcvQty, setRcvQty] = useState(String(expected))
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 bg-black/70" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#141417] border border-[#2A2A30] rounded-xl w-full max-w-sm overflow-hidden my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A30]">
          <h2 className="text-[#F0EEF6] font-semibold">Mark as Received</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#2A2A30]"><X size={16} className="text-[#9896A4]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">
              Actual Quantity Received <span className="text-[#5A5865]">(expected: {expected} {req.unit})</span>
            </label>
            <div className="flex gap-2">
              <input type="number" min="0.5" step="0.5" value={rcvQty} onChange={e => setRcvQty(e.target.value)}
                className="flex-1 bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]" />
              <span className="flex items-center text-[#9896A4] text-sm px-2">{req.unit}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[#2A2A30] text-[#9896A4] text-sm hover:bg-[#2A2A30] transition-colors">Cancel</button>
            <button onClick={() => onConfirm(Number(rcvQty))}
              className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
              Confirm Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({ req, onClose, onSaved }: {
  req: PurchaseRequest
  onClose: () => void
  onSaved: (updated: PurchaseRequest) => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    itemName: req.item_name,
    brand: req.brand ?? '',
    quantity: String(req.adjusted_quantity ?? req.quantity),
    unit: req.unit,
    urgency: req.urgency,
    notes: req.notes ?? '',
    neededBy: req.needed_by ? req.needed_by.slice(0, 10) : '',
    unitPrice: req.unit_price != null ? String(req.unit_price) : '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const estimatedCost = form.unitPrice && form.quantity
    ? Number(form.unitPrice) * Number(form.quantity) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/purchase-requests/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: req.id,
          itemName: form.itemName,
          brand: form.brand || null,
          quantity: Number(form.quantity),
          unit: form.unit,
          urgency: form.urgency,
          notes: form.notes || null,
          neededBy: form.neededBy || null,
          unitPrice: form.unitPrice !== '' ? Number(form.unitPrice) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast('Request updated', 'success')
      onSaved(data.request)
    } catch (e: any) {
      toast(e.message ?? 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 bg-black/70" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#141417] border border-[#2A2A30] rounded-xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A30]">
          <h2 className="text-[#F0EEF6] font-semibold">Edit Request</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#2A2A30]"><X size={16} className="text-[#9896A4]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Item Name <span className="text-rose-400">*</span></label>
            <input type="text" required value={form.itemName} onChange={e => set('itemName', e.target.value)}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]" />
          </div>
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Brand <span className="text-[#5A5865]">(optional)</span></label>
            <input type="text" value={form.brand} onChange={e => set('brand', e.target.value)}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Quantity <span className="text-rose-400">*</span></label>
              <input type="number" required min="0.5" step="0.5" value={form.quantity} onChange={e => set('quantity', e.target.value)}
                className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]" />
            </div>
            <div>
              <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Unit</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)}
                className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Unit Price (RM) <span className="text-[#5A5865]">(optional)</span></label>
            <input type="number" min="0" step="0.01" placeholder="e.g. 170.00" value={form.unitPrice} onChange={e => set('unitPrice', e.target.value)}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]" />
          </div>
          {estimatedCost != null && (
            <div className="flex items-center justify-between bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2">
              <span className="text-[#5A5865] text-xs">Total cost</span>
              <span className="text-emerald-400 text-sm font-semibold tabular-nums">RM {estimatedCost.toFixed(2)}</span>
            </div>
          )}
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Needed By <span className="text-[#5A5865]">(optional)</span></label>
            <input type="date" value={form.neededBy} onChange={e => set('neededBy', e.target.value)}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]" />
          </div>
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Urgency</label>
            <div className="flex gap-2">
              {(['normal', 'urgent'] as const).map(u => (
                <button key={u} type="button" onClick={() => set('urgency', u)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.urgency === u
                    ? u === 'urgent' ? 'bg-rose-500/15 border-rose-500/40 text-rose-400' : 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#A78BFA]'
                    : 'border-[#2A2A30] text-[#9896A4] hover:bg-[#2A2A30]'}`}>
                  {u === 'urgent' ? 'Urgent' : 'Normal'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Notes <span className="text-[#5A5865]">(optional)</span></label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[#2A2A30] text-[#9896A4] text-sm hover:bg-[#2A2A30] transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-[#8B5CF6] text-white text-sm font-medium hover:bg-[#7C3AED] transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Changes'}
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
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 bg-black/70" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#141417] border border-[#2A2A30] rounded-xl w-full max-w-sm overflow-hidden my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A30]">
          <h2 className="text-[#F0EEF6] font-semibold">Reject Request</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#2A2A30]"><X size={16} className="text-[#9896A4]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Reason <span className="text-[#5A5865]">(optional)</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              rows={3} placeholder="e.g. Already sufficient stock"
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] resize-none" />
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

// ── Comment Thread ────────────────────────────────────────────────────────────

function CommentThread({ requestId, currentUserId, currentUserName }: {
  requestId: string
  currentUserId: string
  currentUserName: string
}) {
  const { toast } = useToast()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/purchase-requests/comments?requestId=${requestId}`)
      .then(r => r.json())
      .then(d => setComments(d.comments ?? []))
      .finally(() => setLoading(false))
  }, [requestId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  const handleSend = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/purchase-requests/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setComments(c => [...c, data.comment])
      setMessage('')
    } catch (e: any) {
      toast(e.message ?? 'Failed to send', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border-t border-[#2A2A30] pt-3 mt-1">
      <p className="text-[#9896A4] text-xs font-medium mb-3 flex items-center gap-1.5">
        <MessageSquare size={11} /> Comments {comments.length > 0 && `(${comments.length})`}
      </p>
      {loading ? (
        <p className="text-[#5A5865] text-xs py-2">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-[#5A5865] text-xs py-2 italic">No comments yet.</p>
      ) : (
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          {comments.map(c => {
            const isMe = c.author_id === currentUserId
            return (
              <div key={c.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  isMe ? 'bg-[#8B5CF6]/15 border border-[#8B5CF6]/20 text-[#F0EEF6]' : 'bg-[#1A1A1E] border border-[#2A2A30] text-[#F0EEF6]'
                }`}>
                  {c.message}
                </div>
                <p className="text-[#5A5865] text-[10px] mt-0.5 px-1">
                  {isMe ? 'You' : c.author_name} · {formatDate(c.created_at)} {formatTime(c.created_at)}
                </p>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Ask a question or leave a note…"
          className="flex-1 bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-1.5 text-[#F0EEF6] text-xs focus:outline-none focus:border-[#8B5CF6]"
        />
        <button onClick={handleSend} disabled={sending || !message.trim()}
          className="p-2.5 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/20 text-[#A78BFA] hover:bg-[#8B5CF6]/25 transition-colors disabled:opacity-40">
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Request Card (used in Pending tab) ────────────────────────────────────────

function RequestCard({ req, isAdmin, currentUserId, currentUserName, onStatusChange, onDelete, onEdit }: {
  req: PurchaseRequest
  isAdmin: boolean
  currentUserId: string
  currentUserName: string
  onStatusChange: (id: string, status: string, extra?: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onEdit: (updated: PurchaseRequest) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [modal, setModal] = useState<'reject' | 'approve' | 'order' | 'receive' | 'edit' | null>(null)
  const meta = STATUS_META[req.status]
  const effectiveQty = req.adjusted_quantity ?? req.quantity

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
              <span className="text-[#9896A4] text-xs">
                {Number(effectiveQty)} {req.unit}
                {req.adjusted_quantity && req.adjusted_quantity !== req.quantity && (
                  <span className="text-[#5A5865] ml-1">(requested {Number(req.quantity)})</span>
                )}
              </span>
              {req.unit_price != null && (
                <span className="text-emerald-400 text-xs font-medium tabular-nums">
                  RM {(req.unit_price * (req.adjusted_quantity ?? req.quantity)).toFixed(2)}
                </span>
              )}
              {req.supplier_name && !req.supplier && (
                <span className="text-[#5A5865] text-xs">· {req.supplier_name}</span>
              )}
              <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.color}`}>
                {meta.icon} {meta.label}
              </span>
              <span className="text-[#5A5865] text-xs">by {req.requester?.full_name ?? '—'} · {formatDate(req.created_at)}</span>
              {req.needed_by && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400">
                  <CalendarDays size={10} /> Needed by {formatDate(req.needed_by)}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded hover:bg-[#2A2A30] transition-colors flex-shrink-0 mt-0.5">
            <ChevronDown size={14} className={`text-[#5A5865] transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {expanded && (
          <div className="px-4 pb-4 border-t border-[#2A2A30] pt-3 space-y-3">
            {req.notes && <p className="text-[#9896A4] text-xs italic">"{req.notes}"</p>}
            {req.review_notes && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                <p className="text-rose-400 text-xs font-medium mb-0.5">Rejection reason</p>
                <p className="text-rose-300 text-xs">{req.review_notes}</p>
              </div>
            )}
            <div className="space-y-1 text-xs text-[#5A5865]">
              {req.reviewer && <p>Reviewed by {req.reviewer.full_name}</p>}
              {req.supplier && <p>Supplier: <span className="text-[#9896A4]">{req.supplier}</span></p>}
              {req.estimated_delivery && <p>Est. delivery: <span className="text-[#9896A4]">{formatDate(req.estimated_delivery)}</span></p>}
              {req.orderer && <p>Ordered by {req.orderer.full_name}</p>}
              {req.received_quantity != null && <p>Received qty: <span className="text-[#9896A4]">{req.received_quantity} {req.unit}</span></p>}
              {req.receiver && <p>Received by {req.receiver.full_name}</p>}
            </div>

            {isAdmin && (
              <div className="flex gap-2 pt-1 flex-wrap items-center">
                {req.status === 'pending' && (
                  <>
                    <button onClick={() => setModal('approve')}
                      className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600/15 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/25 transition-colors font-medium">
                      Approve
                    </button>
                    <button onClick={() => setModal('reject')}
                      className="px-3 py-1.5 text-xs rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/20 hover:bg-rose-500/25 transition-colors font-medium">
                      Reject
                    </button>
                  </>
                )}
                {req.status === 'approved' && (
                  <button onClick={() => setModal('order')}
                    className="px-3 py-1.5 text-xs rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/20 hover:bg-purple-500/25 transition-colors font-medium">
                    Mark as Ordered
                  </button>
                )}
                {req.status === 'ordered' && (
                  <button onClick={() => setModal('receive')}
                    className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 transition-colors font-medium">
                    Mark as Received
                  </button>
                )}
                <button onClick={() => setModal('edit')}
                  className="p-2.5 rounded-lg text-[#5A5865] hover:text-[#A78BFA] hover:bg-[#8B5CF6]/10 transition-colors ml-auto"
                  title="Edit request">
                  <Pencil size={14} />
                </button>
                <button onClick={() => onDelete(req.id)}
                  className="p-2.5 rounded-lg text-[#5A5865] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Delete request">
                  <Trash2 size={14} />
                </button>
              </div>
            )}

            <CommentThread requestId={req.id} currentUserId={currentUserId} currentUserName={currentUserName} />
          </div>
        )}
      </div>

      {modal === 'reject' && (
        <RejectModal onClose={() => setModal(null)} onConfirm={reason => { setModal(null); onStatusChange(req.id, 'rejected', { reviewNotes: reason }) }} />
      )}
      {modal === 'approve' && (
        <ApproveModal req={req} onClose={() => setModal(null)} onConfirm={adjQty => { setModal(null); onStatusChange(req.id, 'approved', { adjustedQuantity: adjQty }) }} />
      )}
      {modal === 'order' && (
        <OrderModal onClose={() => setModal(null)} onConfirm={(supplier, estDelivery) => { setModal(null); onStatusChange(req.id, 'ordered', { supplier, estimatedDelivery: estDelivery }) }} />
      )}
      {modal === 'receive' && (
        <ReceiveModal req={req} onClose={() => setModal(null)} onConfirm={rcvQty => { setModal(null); onStatusChange(req.id, 'received', { receivedQuantity: rcvQty }) }} />
      )}
      {modal === 'edit' && (
        <EditModal req={req} onClose={() => setModal(null)} onSaved={updated => { setModal(null); onEdit(updated) }} />
      )}
    </>
  )
}

// ── Approved Table Row ────────────────────────────────────────────────────────

function ApprovedRow({ req, isAdmin, onStatusChange, onDelete, onEdit }: {
  req: PurchaseRequest
  isAdmin: boolean
  onStatusChange: (id: string, status: string, extra?: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onEdit: (updated: PurchaseRequest) => void
}) {
  const [modal, setModal] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const effectiveQty = req.adjusted_quantity ?? req.quantity

  return (
    <>
      <tr className="border-b border-[#2A2A30] hover:bg-[#1A1A1E] transition-colors">
        <td className="px-4 py-3">
          <div>
            <p className="text-[#F0EEF6] text-sm font-medium">{req.item_name}</p>
            {req.brand && <p className="text-[#5A5865] text-xs">{req.brand}</p>}
          </div>
        </td>
        <td className="px-4 py-3 text-[#9896A4] text-sm whitespace-nowrap">
          {req.supplier_name ?? req.supplier ?? <span className="text-[#5A5865]">—</span>}
        </td>
        <td className="px-4 py-3 text-[#F0EEF6] text-sm tabular-nums">
          {Number(effectiveQty)}
          {req.adjusted_quantity && req.adjusted_quantity !== req.quantity && (
            <span className="text-[#5A5865] text-xs ml-1">(req. {Number(req.quantity)})</span>
          )}
        </td>
        <td className="px-4 py-3 text-[#9896A4] text-sm">{req.unit}</td>
        <td className="px-4 py-3">
          {req.urgency === 'urgent'
            ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-rose-500/15 text-rose-400 border-rose-500/20 uppercase">Urgent</span>
            : <span className="text-[#5A5865] text-xs">Normal</span>}
        </td>
        <td className="px-4 py-3 text-[#9896A4] text-xs">
          {req.needed_by ? formatDate(req.needed_by) : '—'}
        </td>
        <td className="px-4 py-3 text-[#5A5865] text-xs">{req.requester?.full_name ?? '—'}</td>
        <td className="px-4 py-3 text-emerald-400 text-sm tabular-nums">
          {req.unit_price != null ? `RM ${req.unit_price.toFixed(2)}` : '—'}
        </td>
        <td className="px-4 py-3 text-emerald-400 text-sm tabular-nums font-medium">
          {req.unit_price != null ? `RM ${(req.unit_price * effectiveQty).toFixed(2)}` : '—'}
        </td>
        {isAdmin && (
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setModal(true)}
                className="px-2.5 py-1 text-xs rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/20 hover:bg-purple-500/25 transition-colors font-medium whitespace-nowrap">
                Mark Ordered
              </button>
              <button onClick={() => setEditOpen(true)} className="p-2.5 rounded-lg text-[#5A5865] hover:text-[#A78BFA] hover:bg-[#8B5CF6]/10 transition-colors" title="Edit">
                <Pencil size={14} />
              </button>
              <button onClick={() => onDelete(req.id)} className="p-2.5 rounded-lg text-[#5A5865] hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </td>
        )}
      </tr>
      {modal && (
        <OrderModal
          onClose={() => setModal(false)}
          onConfirm={(supplier, estDelivery) => { setModal(false); onStatusChange(req.id, 'ordered', { supplier, estimatedDelivery: estDelivery }) }}
        />
      )}
      {editOpen && <EditModal req={req} onClose={() => setEditOpen(false)} onSaved={updated => { setEditOpen(false); onEdit(updated) }} />}
    </>
  )
}

// ── Ordered Table Row ─────────────────────────────────────────────────────────

function OrderedRow({ req, isAdmin, onStatusChange, onDelete, onEdit }: {
  req: PurchaseRequest
  isAdmin: boolean
  onStatusChange: (id: string, status: string, extra?: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onEdit: (updated: PurchaseRequest) => void
}) {
  const [modal, setModal] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const effectiveQty = req.adjusted_quantity ?? req.quantity

  return (
    <>
      <tr className="border-b border-[#2A2A30] hover:bg-[#1A1A1E] transition-colors">
        <td className="px-4 py-3">
          <div>
            <p className="text-[#F0EEF6] text-sm font-medium">{req.item_name}</p>
            {req.brand && <p className="text-[#5A5865] text-xs">{req.brand}</p>}
          </div>
        </td>
        <td className="px-4 py-3 text-[#F0EEF6] text-sm tabular-nums">{Number(effectiveQty)} {req.unit}</td>
        <td className="px-4 py-3 text-[#9896A4] text-sm">{req.supplier ?? '—'}</td>
        <td className="px-4 py-3 text-[#9896A4] text-xs">
          {req.estimated_delivery ? formatDate(req.estimated_delivery) : '—'}
        </td>
        <td className="px-4 py-3 text-[#5A5865] text-xs">{req.orderer?.full_name ?? '—'}</td>
        {isAdmin && (
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setModal(true)}
                className="px-2.5 py-1 text-xs rounded-lg bg-emerald-600/15 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/25 transition-colors font-medium whitespace-nowrap">
                Mark Received
              </button>
              <button onClick={() => setEditOpen(true)} className="p-2.5 rounded-lg text-[#5A5865] hover:text-[#A78BFA] hover:bg-[#8B5CF6]/10 transition-colors" title="Edit">
                <Pencil size={14} />
              </button>
              <button onClick={() => onDelete(req.id)} className="p-2.5 rounded-lg text-[#5A5865] hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </td>
        )}
      </tr>
      {modal && (
        <ReceiveModal
          req={req}
          onClose={() => setModal(false)}
          onConfirm={rcvQty => { setModal(false); onStatusChange(req.id, 'received', { receivedQuantity: rcvQty }) }}
        />
      )}
      {editOpen && <EditModal req={req} onClose={() => setEditOpen(false)} onSaved={updated => { setEditOpen(false); onEdit(updated) }} />}
    </>
  )
}

// ── Copy Button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }
  return (
    <button onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2A2A30] text-[#9896A4] text-xs font-medium hover:bg-[#3A3A40] hover:text-[#F0EEF6] transition-colors">
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy Order List'}
    </button>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ tab, onNew }: { tab: TabKey; onNew?: () => void }) {
  const messages: Record<TabKey, string> = {
    pending: 'No pending requests',
    approved: 'No approved requests',
    ordered: 'Nothing on order',
    received: 'No received items',
    history: 'No history yet',
  }
  return (
    <div className="text-center py-16 text-[#5A5865]">
      <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">{messages[tab]}</p>
      {tab === 'pending' && onNew && (
        <button onClick={onNew} className="mt-3 text-[#8B5CF6] text-sm hover:text-[#A78BFA] transition-colors">
          + Submit a request
        </button>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function PurchaseRequestsClient({ requests: initial, currentUserId, currentUserRole, currentUserName }: Props) {
  const { toast } = useToast()
  const [requests, setRequests] = useState<PurchaseRequest[]>(initial)
  const [creating, setCreating] = useState(false)
  const [tab, setTab] = useState<TabKey>('pending')

  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'manager'
  const canRequest = isAdmin || currentUserRole === 'full_timer'

  const byStatus = {
    pending:  requests.filter(r => r.status === 'pending'),
    approved: requests.filter(r => r.status === 'approved'),
    ordered:  requests.filter(r => r.status === 'ordered'),
    received: requests.filter(r => r.status === 'received'),
    history:  requests.filter(r => r.status === 'rejected'),
  }

  const handleEdit = (updated: PurchaseRequest) => {
    setRequests(rs => rs.map(r => r.id === updated.id ? { ...r, ...updated } : r))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this request? This cannot be undone.')) return
    try {
      const res = await fetch('/api/purchase-requests/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRequests(rs => rs.filter(r => r.id !== id))
      toast('Request deleted', 'success')
    } catch (e: any) {
      toast(e.message ?? 'Failed to delete', 'error')
    }
  }

  const handleStatusChange = async (id: string, status: string, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/purchase-requests/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, status, ...extra }),
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

  // Generate copy text for approved items
  const approvedCopyText = (() => {
    const items = byStatus.approved
    if (items.length === 0) return ''
    const date = new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })
    const lines = items.map((r, i) => {
      const qty = r.adjusted_quantity ?? r.quantity
      let line = `${i + 1}. ${r.item_name}`
      if (r.brand) line += ` (${r.brand})`
      line += ` — ${qty} ${r.unit}`
      if (r.unit_price != null) line += ` — RM ${(r.unit_price * qty).toFixed(2)}`
      if (r.urgency === 'urgent') line += ' ⚡ URGENT'
      if (r.needed_by) line += ` — needed by ${formatDate(r.needed_by)}`
      return line
    })
    const total = items.reduce((sum, r) => r.unit_price ? sum + r.unit_price * (r.adjusted_quantity ?? r.quantity) : sum, 0)
    const totalLine = total > 0 ? `\nTotal: RM ${total.toFixed(2)}` : ''
    return `ARKIB Stock Order — ${date}\n\n${lines.join('\n')}${totalLine}`
  })()

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

      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 bg-[#141417] border border-[#2A2A30] rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map(t => {
            const count = byStatus[t.key].length
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-[#8B5CF6] text-white' : 'text-[#9896A4] hover:text-[#F0EEF6]'}`}>
                {t.label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-white/20' : 'bg-[#2A2A30]'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Pending alert */}
        {isAdmin && byStatus.pending.length > 0 && tab !== 'pending' && (
          <button onClick={() => setTab('pending')}
            className="w-full mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 hover:bg-amber-500/15 transition-colors text-left">
            <Clock size={14} className="text-amber-400 flex-shrink-0" />
            <p className="text-amber-400 text-sm font-medium">
              {byStatus.pending.length} request{byStatus.pending.length > 1 ? 's' : ''} awaiting approval
            </p>
          </button>
        )}

        {/* ── Pending Tab ── */}
        {tab === 'pending' && (
          <>
            {isAdmin && byStatus.pending.length > 0 && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                <Clock size={14} className="text-amber-400 flex-shrink-0" />
                <p className="text-amber-400 text-sm font-medium">
                  {byStatus.pending.length} request{byStatus.pending.length > 1 ? 's' : ''} awaiting your approval
                </p>
              </div>
            )}
            {byStatus.pending.length === 0
              ? <EmptyState tab="pending" onNew={canRequest ? () => setCreating(true) : undefined} />
              : (
                <div className="space-y-2">
                  {byStatus.pending.map(r => (
                    <RequestCard key={r.id} req={r} isAdmin={isAdmin} currentUserId={currentUserId}
                      currentUserName={currentUserName} onStatusChange={handleStatusChange} onDelete={handleDelete} onEdit={handleEdit} />
                  ))}
                </div>
              )}
          </>
        )}

        {/* ── Approved Tab — table view with copy ── */}
        {tab === 'approved' && (
          <>
            {byStatus.approved.length === 0
              ? <EmptyState tab="approved" />
              : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[#5A5865] text-xs">{byStatus.approved.length} item{byStatus.approved.length > 1 ? 's' : ''} ready to order</p>
                      {byStatus.approved.some(r => r.unit_price != null) && (
                        <p className="text-emerald-400 text-sm font-semibold mt-0.5">
                          Total: RM {byStatus.approved.reduce((sum, r) => {
                            if (r.unit_price == null) return sum
                            return sum + r.unit_price * (r.adjusted_quantity ?? r.quantity)
                          }, 0).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <CopyButton text={approvedCopyText} />
                    </div>
                  </div>
                  <div className="bg-[#141417] border border-[#2A2A30] rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#2A2A30]">
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Item</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Supplier</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Qty</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Unit</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Priority</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Needed By</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Requester</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Unit Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Total</th>
                            {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Action</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {byStatus.approved.map(r => (
                            <ApprovedRow key={r.id} req={r} isAdmin={isAdmin} onStatusChange={handleStatusChange} onDelete={handleDelete} onEdit={handleEdit} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
          </>
        )}

        {/* ── Ordered Tab — table view ── */}
        {tab === 'ordered' && (
          <>
            {byStatus.ordered.length === 0
              ? <EmptyState tab="ordered" />
              : (
                <div className="bg-[#141417] border border-[#2A2A30] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#2A2A30]">
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Item</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Supplier</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Est. Delivery</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Ordered By</th>
                          {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {byStatus.ordered.map(r => (
                          <OrderedRow key={r.id} req={r} isAdmin={isAdmin} onStatusChange={handleStatusChange} onDelete={handleDelete} onEdit={handleEdit} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </>
        )}

        {/* ── Received Tab ── */}
        {tab === 'received' && (
          <>
            {byStatus.received.length === 0
              ? <EmptyState tab="received" />
              : (
                <div className="bg-[#141417] border border-[#2A2A30] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#2A2A30]">
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Item</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Ordered</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Received</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Supplier</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Received By</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Date</th>
                          {isAdmin && <th className="px-4 py-3" />}
                        </tr>
                      </thead>
                      <tbody>
                        {byStatus.received.map(r => (
                          <tr key={r.id} className="border-b border-[#2A2A30] hover:bg-[#1A1A1E] transition-colors">
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-[#F0EEF6] text-sm font-medium">{r.item_name}</p>
                                {r.brand && <p className="text-[#5A5865] text-xs">{r.brand}</p>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[#9896A4] text-sm tabular-nums">{Number(r.adjusted_quantity ?? r.quantity)} {r.unit}</td>
                            <td className="px-4 py-3 text-emerald-400 text-sm tabular-nums font-medium">
                              {r.received_quantity != null ? `${r.received_quantity} ${r.unit}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-[#9896A4] text-sm">{r.supplier ?? '—'}</td>
                            <td className="px-4 py-3 text-[#5A5865] text-xs">{r.receiver?.full_name ?? '—'}</td>
                            <td className="px-4 py-3 text-[#5A5865] text-xs">{formatDate(r.updated_at)}</td>
                            {isAdmin && (
                              <td className="px-4 py-3">
                                <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg text-[#5A5865] hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Delete">
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </>
        )}

        {/* ── History Tab (rejected) ── */}
        {tab === 'history' && (
          <>
            {byStatus.history.length === 0
              ? <EmptyState tab="history" />
              : (
                <div className="space-y-2">
                  {byStatus.history.map(r => (
                    <RequestCard key={r.id} req={r} isAdmin={isAdmin} currentUserId={currentUserId}
                      currentUserName={currentUserName} onStatusChange={handleStatusChange} onDelete={handleDelete} onEdit={handleEdit} />
                  ))}
                </div>
              )}
          </>
        )}
      </div>

      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={handleCreated} />}
    </div>
  )
}
