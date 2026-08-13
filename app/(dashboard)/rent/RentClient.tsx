'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatMonth, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Plus, Building, CheckCircle2, Clock, AlertTriangle, Pencil, Trash2, RotateCcw } from 'lucide-react'
import type { Database, FixedCostStatus, PaymentMethod } from '@/types/database'

type FixedCost = Database['public']['Tables']['fixed_costs']['Row']
type RentalRecord = Database['public']['Tables']['rental_records']['Row'] & { fixed_costs: { name: string; category: string } }

const emptyForm = { name: '', category: 'rental', amount: '', due_day: '1', notes: '' }
const COST_CATEGORIES = ['rental', 'electricity', 'water', 'internet', 'software', 'license', 'insurance', 'salary', 'other']
const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]

export function RentClient({ fixedCosts: initial, rentalRecords: initialRecords, month, year }: {
  fixedCosts: FixedCost[]
  rentalRecords: RentalRecord[]
  month: number
  year: number
}) {
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>(initial)
  const [records, setRecords] = useState<RentalRecord[]>(initialRecords)

  // Add modal
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(emptyForm)
  const [addLoading, setAddLoading] = useState(false)

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<FixedCost | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editMonthAmount, setEditMonthAmount] = useState('') // this month's record amount (may differ from template)
  const [editLoading, setEditLoading] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<FixedCost | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()

  const totalFixed = fixedCosts.reduce((s, c) => s + c.amount, 0)
  const totalPaid = records.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0)
  const totalUnpaid = totalFixed - totalPaid

  // ── Add ──────────────────────────────────────────────────────────
  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddLoading(true)
    const { error, data } = await supabase.from('fixed_costs').insert({
      name: addForm.name,
      category: addForm.category,
      amount: parseFloat(addForm.amount) || 0,
      due_day: parseInt(addForm.due_day) || 1,
      notes: addForm.notes || null,
    }).select().single()

    if (error) { toast(error.message, 'error') }
    else {
      setFixedCosts(prev => [...prev, data!])
      await supabase.from('rental_records').insert({ fixed_cost_id: data!.id, month, year, amount: data!.amount, status: 'unpaid' })
      toast('Fixed cost added', 'success')
      setAddOpen(false)
      setAddForm(emptyForm)
    }
    setAddLoading(false)
  }

  // ── Open edit ────────────────────────────────────────────────────
  const openEdit = (cost: FixedCost) => {
    const record = records.find(r => r.fixed_cost_id === cost.id)
    setEditTarget(cost)
    setEditForm({
      name: cost.name,
      category: cost.category,
      amount: String(cost.amount),
      due_day: String(cost.due_day ?? 1),
      notes: cost.notes ?? '',
    })
    setEditMonthAmount(String(record?.amount ?? cost.amount))
    setEditOpen(true)
  }

  // ── Save edit ────────────────────────────────────────────────────
  const handleEditCost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setEditLoading(true)

    const newAmount = parseFloat(editForm.amount) || 0
    const newMonthAmount = parseFloat(editMonthAmount) || newAmount

    // Update the fixed_costs template
    const { error: fcErr } = await supabase.from('fixed_costs').update({
      name: editForm.name,
      category: editForm.category,
      amount: newAmount,
      due_day: parseInt(editForm.due_day) || 1,
      notes: editForm.notes || null,
    }).eq('id', editTarget.id)

    if (fcErr) { toast(fcErr.message, 'error'); setEditLoading(false); return }

    setFixedCosts(prev => prev.map(c => c.id === editTarget.id
      ? { ...c, name: editForm.name, category: editForm.category, amount: newAmount, due_day: parseInt(editForm.due_day) || 1, notes: editForm.notes || null }
      : c
    ))

    // Update this month's rental_record amount if it exists and is not yet paid
    const record = records.find(r => r.fixed_cost_id === editTarget.id)
    if (record && record.status !== 'paid') {
      const { error: rrErr } = await supabase.from('rental_records').update({ amount: newMonthAmount }).eq('id', record.id)
      if (!rrErr) setRecords(prev => prev.map(r => r.id === record.id ? { ...r, amount: newMonthAmount } : r))
    } else if (!record) {
      // No record for this month yet — create one
      const { data: newRecord } = await supabase.from('rental_records').insert({
        fixed_cost_id: editTarget.id, month, year, amount: newMonthAmount, status: 'unpaid',
      }).select('*, fixed_costs(name, category)').single()
      if (newRecord) setRecords(prev => [...prev, newRecord as RentalRecord])
    }

    toast('Updated', 'success')
    setEditOpen(false)
    setEditTarget(null)
    setEditLoading(false)
  }

  // ── Mark paid / unpaid ───────────────────────────────────────────
  const handleMarkPaid = async (costId: string, amount: number, paymentMethod: PaymentMethod = 'bank_transfer') => {
    const existing = records.find(r => r.fixed_cost_id === costId)
    if (existing) {
      const { error, data } = await supabase.from('rental_records').update({
        status: 'paid', paid_date: new Date().toISOString().split('T')[0], payment_method: paymentMethod
      }).eq('id', existing.id).select('*, fixed_costs(name, category)').single()
      if (!error) setRecords(prev => prev.map(r => r.id === existing.id ? data as RentalRecord : r))
    } else {
      const { error, data } = await supabase.from('rental_records').insert({
        fixed_cost_id: costId, month, year, amount, status: 'paid',
        paid_date: new Date().toISOString().split('T')[0], payment_method: paymentMethod
      }).select('*, fixed_costs(name, category)').single()
      if (!error) setRecords(prev => [...prev, data as RentalRecord])
    }
    toast('Marked as paid', 'success')
  }

  const handleMarkUnpaid = async (costId: string) => {
    const record = records.find(r => r.fixed_cost_id === costId)
    if (!record) return
    const { error } = await supabase.from('rental_records').update({
      status: 'unpaid', paid_date: null, payment_method: null
    }).eq('id', record.id)
    if (!error) setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: 'unpaid' as FixedCostStatus, paid_date: null, payment_method: null } : r))
    toast('Marked as unpaid', 'success')
  }

  // ── Delete ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const { error } = await supabase.from('fixed_costs').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', deleteTarget.id)
    if (error) { toast(error.message, 'error') }
    else {
      setFixedCosts(prev => prev.filter(c => c.id !== deleteTarget.id))
      setRecords(prev => prev.filter(r => r.fixed_cost_id !== deleteTarget.id))
      toast('Deleted', 'success')
      setDeleteTarget(null)
    }
    setDeleteLoading(false)
  }

  const fa = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setAddForm(prev => ({ ...prev, [key]: e.target.value }))

  const fe = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="space-y-6">
      <TopBar
        title="Rent & Fixed Costs"
        subtitle={formatMonth(month, year)}
        actions={
          <button onClick={() => { setAddForm(emptyForm); setAddOpen(true) }} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Add Fixed Cost
          </button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-[#9896A4] text-xs uppercase tracking-wider">Total Fixed</p>
          <p className="text-[#F0EEF6] font-bold text-lg mt-1">{formatCurrency(totalFixed)}</p>
        </div>
        <div className="card text-center">
          <p className="text-[#9896A4] text-xs uppercase tracking-wider">Paid</p>
          <p className="text-emerald-400 font-bold text-lg mt-1">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="card text-center">
          <p className="text-[#9896A4] text-xs uppercase tracking-wider">Unpaid</p>
          <p className="text-amber-400 font-bold text-lg mt-1">{formatCurrency(totalUnpaid)}</p>
        </div>
      </div>

      {/* Cost list */}
      <div className="space-y-2">
        {fixedCosts.map(cost => {
          const record = records.find(r => r.fixed_cost_id === cost.id)
          const isPaid = record?.status === 'paid'
          const displayAmount = record?.amount ?? cost.amount
          return (
            <div key={cost.id} className={`card flex items-center justify-between gap-4 group ${isPaid ? 'opacity-80' : ''}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isPaid ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                  {isPaid ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Clock size={16} className="text-amber-400" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[#F0EEF6] font-medium text-sm truncate">{cost.name}</p>
                  <p className="text-[#5A5865] text-xs capitalize">{cost.category} · Due day {cost.due_day ?? 1}</p>
                  {isPaid && record?.paid_date && (
                    <p className="text-emerald-400 text-[10px]">Paid {record.paid_date}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <p className="text-[#F0EEF6] font-bold tabular-nums">{formatCurrency(displayAmount)}</p>

                {/* Edit button — always visible on hover */}
                <button
                  onClick={() => openEdit(cost)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#9896A4] hover:text-[#F0EEF6] hover:bg-[#2A2A30] transition-all"
                  title="Edit"
                >
                  <Pencil size={13} />
                </button>

                {/* Delete button */}
                <button
                  onClick={() => setDeleteTarget(cost)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#9896A4] hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>

                {/* Paid / Unpaid toggle */}
                {!isPaid ? (
                  <button onClick={() => handleMarkPaid(cost.id, displayAmount)} className="btn-secondary text-xs px-3 py-1.5">
                    Mark Paid
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="badge-green text-xs">Paid</span>
                    <button
                      onClick={() => handleMarkUnpaid(cost.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#9896A4] hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                      title="Mark as unpaid"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {fixedCosts.length === 0 && (
          <div className="text-center py-12 text-[#5A5865]">
            <Building size={40} className="mx-auto mb-3 opacity-30" />
            <p>No fixed costs added yet</p>
          </div>
        )}
      </div>

      {/* ── Add modal ── */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Fixed Cost">
        <form onSubmit={handleAddCost} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input type="text" value={addForm.name} onChange={fa('name')} className="input" placeholder="Bar Rental" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select value={addForm.category} onChange={fa('category')} className="input">
                {COST_CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount (RM)</label>
              <input type="number" step="0.01" min="0" value={addForm.amount} onChange={fa('amount')} className="input" required />
            </div>
            <div>
              <label className="label">Due Day of Month</label>
              <input type="number" min="1" max="31" value={addForm.due_day} onChange={fa('due_day')} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input type="text" value={addForm.notes} onChange={fa('notes')} className="input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setAddOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={addLoading} className="btn-primary flex-1 disabled:opacity-50">
              {addLoading ? 'Adding...' : 'Add Fixed Cost'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit modal ── */}
      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setEditTarget(null) }} title={`Edit — ${editTarget?.name ?? ''}`}>
        <form onSubmit={handleEditCost} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input type="text" value={editForm.name} onChange={fe('name')} className="input" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select value={editForm.category} onChange={fe('category')} className="input">
                {COST_CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Template Amount (RM)</label>
              <input type="number" step="0.01" min="0" value={editForm.amount} onChange={fe('amount')} className="input" required />
            </div>
            <div>
              <label className="label">Due Day of Month</label>
              <input type="number" min="1" max="31" value={editForm.due_day} onChange={fe('due_day')} className="input" />
            </div>
            <div>
              <label className="label">This Month's Amount (RM)</label>
              <input
                type="number" step="0.01" min="0"
                value={editMonthAmount}
                onChange={e => setEditMonthAmount(e.target.value)}
                className="input"
              />
              <p className="text-[#5A5865] text-[10px] mt-1">Only updates if this month is unpaid</p>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input type="text" value={editForm.notes} onChange={fe('notes')} className="input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setEditOpen(false); setEditTarget(null) }} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={editLoading} className="btn-primary flex-1 disabled:opacity-50">
              {editLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete confirm ── */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Fixed Cost" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">
            <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <p className="text-sm text-[#9896A4]">
              Delete <span className="text-[#F0EEF6] font-medium">{deleteTarget?.name}</span>?
              This removes the fixed cost template. Payment history is preserved.
            </p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="flex-1 px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium hover:bg-rose-500/20 transition-colors disabled:opacity-50"
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
