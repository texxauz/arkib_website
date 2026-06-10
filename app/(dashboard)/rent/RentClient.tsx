'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatMonth, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Plus, Building, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import type { Database, FixedCostStatus, PaymentMethod } from '@/types/database'

type FixedCost = Database['public']['Tables']['fixed_costs']['Row']
type RentalRecord = Database['public']['Tables']['rental_records']['Row'] & { fixed_costs: { name: string; category: string } }

const emptyForm = {
  name: '',
  category: 'rental',
  amount: '',
  due_day: '1',
  notes: '',
}

const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]

export function RentClient({ fixedCosts: initial, rentalRecords: initialRecords, month, year }: {
  fixedCosts: FixedCost[]
  rentalRecords: RentalRecord[]
  month: number
  year: number
}) {
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>(initial)
  const [records, setRecords] = useState<RentalRecord[]>(initialRecords)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const totalFixed = fixedCosts.reduce((s, c) => s + c.amount, 0)
  const totalPaid = records.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0)
  const totalUnpaid = totalFixed - totalPaid

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error, data } = await supabase.from('fixed_costs').insert({
      name: form.name,
      category: form.category,
      amount: parseFloat(form.amount) || 0,
      due_day: parseInt(form.due_day) || 1,
      notes: form.notes || null,
    }).select().single()

    if (error) { toast(error.message, 'error') }
    else {
      toast('Fixed cost added', 'success')
      setFixedCosts(prev => [...prev, data!])
      // Create record for current month
      await supabase.from('rental_records').insert({ fixed_cost_id: data!.id, month, year, amount: data!.amount, status: 'unpaid' })
      setModalOpen(false)
    }
    setLoading(false)
  }

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

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const COST_CATEGORIES = ['rental', 'electricity', 'water', 'internet', 'software', 'license', 'insurance', 'other']

  return (
    <div className="space-y-6">
      <TopBar
        title="Rent & Fixed Costs"
        subtitle={formatMonth(month, year)}
        actions={
          <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
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
          return (
            <div key={cost.id} className={`card flex items-center justify-between gap-4 ${isPaid ? 'opacity-70' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isPaid ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                  {isPaid ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Clock size={16} className="text-amber-400" />}
                </div>
                <div>
                  <p className="text-[#F0EEF6] font-medium text-sm">{cost.name}</p>
                  <p className="text-[#5A5865] text-xs capitalize">{cost.category} · Due day {cost.due_day}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[#F0EEF6] font-bold">{formatCurrency(cost.amount)}</p>
                {!isPaid ? (
                  <button onClick={() => handleMarkPaid(cost.id, cost.amount)} className="btn-secondary text-xs px-3 py-1.5">
                    Mark Paid
                  </button>
                ) : (
                  <span className="badge-green text-xs">Paid</span>
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Fixed Cost">
        <form onSubmit={handleAddCost} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input type="text" value={form.name} onChange={f('name')} className="input" placeholder="Office Rental" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select value={form.category} onChange={f('category')} className="input">
                {COST_CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount (RM)</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={f('amount')} className="input" required />
            </div>
            <div>
              <label className="label">Due Day of Month</label>
              <input type="number" min="1" max="31" value={form.due_day} onChange={f('due_day')} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input type="text" value={form.notes} onChange={f('notes')} className="input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Adding...' : 'Add Fixed Cost'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
