'use client'
import { useState, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatDate, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Plus, Receipt, Filter, Trash2 } from 'lucide-react'
import type { Database, ExpenseCategory, PaymentMethod } from '@/types/database'

type Expense = Database['public']['Tables']['expenses']['Row']

const CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]
const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]

const CATEGORY_COLORS: Record<string, string> = {
  alcohol: 'bg-violet-500/20 text-violet-400',
  fresh_ingredients: 'bg-emerald-500/20 text-emerald-400',
  salary: 'bg-blue-500/20 text-blue-400',
  claims: 'bg-teal-500/20 text-teal-400',
  rental: 'bg-amber-500/20 text-amber-400',
  utilities: 'bg-cyan-500/20 text-cyan-400',
  marketing: 'bg-pink-500/20 text-pink-400',
  equipment: 'bg-orange-500/20 text-orange-400',
  others: 'bg-[#2A2A30] text-[#9896A4]',
}

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  expense_period: '',
  supplier_id: '',
  supplier_name: '',
  category: 'alcohol' as ExpenseCategory,
  description: '',
  amount: '',
  payment_method: 'cash' as PaymentMethod,
  notes: '',
}

export function ExpensesClient({
  initialExpenses,
  suppliers,
}: {
  initialExpenses: Expense[]
  suppliers: { id: string; name: string }[]
}) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const filtered = useMemo(() =>
    filterCategory === 'all' ? expenses : expenses.filter(e => e.category === filterCategory),
    [expenses, filterCategory]
  )

  const totalFiltered = filtered.reduce((sum, e) => sum + e.amount, 0)

  const byCategory = useMemo(() =>
    expenses.reduce((acc: Record<string, number>, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
      return acc
    }, {}),
    [expenses]
  )

  const openCreate = () => { setEditId(null); setForm(emptyForm); setModalOpen(true) }

  const openEdit = (e: Expense) => {
    setEditId(e.id)
    setForm({
      date: e.date,
      expense_period: e.expense_period ?? '',
      supplier_id: e.supplier_id ?? '',
      supplier_name: e.supplier_name ?? '',
      category: e.category,
      description: e.description,
      amount: String(e.amount),
      payment_method: e.payment_method,
      notes: e.notes ?? '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setLoading(true)

    const payload = {
      date: form.date,
      expense_period: form.expense_period || null,
      supplier_id: form.supplier_id || null,
      supplier_name: form.supplier_name || null,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      notes: form.notes || null,
    }

    const { error, data } = editId
      ? await supabase.from('expenses').update(payload).eq('id', editId).select().single()
      : await supabase.from('expenses').insert(payload).select().single()

    if (error) { toast(error.message, 'error') }
    else {
      toast(editId ? 'Expense updated' : 'Expense added', 'success')
      setExpenses(prev => editId ? prev.map(e => e.id === editId ? data! : e) : [data!, ...prev])
      setModalOpen(false)
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteLoading(true)
    const { error } = await supabase
      .from('expenses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', deleteId)
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Expense deleted', 'success')
      setExpenses(prev => prev.filter(e => e.id !== deleteId))
      setDeleteId(null)
      setModalOpen(false)
    }
    setDeleteLoading(false)
  }

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="space-y-6">
      <TopBar
        title="Expenses"
        subtitle="Track all business expenditures"
        actions={
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Add Expense
          </button>
        }
      />

      {/* Category summary */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([cat, amt]) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
            className={`card text-left transition-all ${filterCategory === cat ? 'border-[#8B5CF6]' : ''}`}
          >
            <p className="text-[#9896A4] text-[10px] truncate">{EXPENSE_CATEGORY_LABELS[cat] ?? cat}</p>
            <p className="text-[#F0EEF6] font-bold text-sm mt-0.5">{formatCurrency(amt)}</p>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-[#9896A4] text-xs">
          <Filter size={12} />
          <span>Filter:</span>
        </div>
        <button
          onClick={() => setFilterCategory('all')}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${filterCategory === 'all' ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#A78BFA]' : 'border-[#2A2A30] text-[#9896A4] hover:border-[#3A3A42]'}`}
        >
          All
        </button>
        {CATEGORIES.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilterCategory(filterCategory === key ? 'all' : key)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${filterCategory === key ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#A78BFA]' : 'border-[#2A2A30] text-[#9896A4] hover:border-[#3A3A42]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt size={40} />}
          title="No expenses found"
          action={<button onClick={openCreate} className="btn-primary">Add Expense</button>}
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[#9896A4] text-sm">{filtered.length} expenses</p>
            <p className="text-[#F0EEF6] font-bold">{formatCurrency(totalFiltered)}</p>
          </div>
          <div className="space-y-2">
            {filtered.map(expense => (
              <div key={expense.id} className="card-hover flex items-center justify-between gap-4">
                <button
                  onClick={() => openEdit(expense)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <span className={`badge text-[10px] flex-shrink-0 ${CATEGORY_COLORS[expense.category] ?? CATEGORY_COLORS.others}`}>
                    {EXPENSE_CATEGORY_LABELS[expense.category]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[#F0EEF6] text-sm font-medium truncate">{expense.description}</p>
                    <p className="text-[#9896A4] text-xs">
                      {formatDate(expense.date)} · {expense.supplier_name ?? 'No supplier'} · {PAYMENT_METHOD_LABELS[expense.payment_method]}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <p className="text-[#F0EEF6] font-bold">{formatCurrency(expense.amount)}</p>
                  <button
                    onClick={() => setDeleteId(expense.id)}
                    className="btn-ghost p-2 text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Expense' : 'Add Expense'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" value={form.date} onChange={f('date')} className="input" required />
            </div>
            <div>
              <label className="label">Category</label>
              <select value={form.category} onChange={f('category')} className="input">
                {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Attribute to Month (optional)</label>
            <input
              type="month"
              value={form.expense_period ? form.expense_period.slice(0, 7) : ''}
              onChange={(e) => setForm(prev => ({ ...prev, expense_period: e.target.value ? `${e.target.value}-01` : '' }))}
              className="input"
            />
            <p className="text-[#5A5865] text-xs mt-1">
              Only needed if this was paid in a different month than the cost belongs to (e.g. a May bill settled in June). Leave blank to use the Date above for P&amp;L.
            </p>
          </div>

          <div>
            <label className="label">Supplier</label>
            <select value={form.supplier_id} onChange={(e) => {
              const sel = suppliers.find(s => s.id === e.target.value)
              setForm(prev => ({ ...prev, supplier_id: e.target.value, supplier_name: sel?.name ?? '' }))
            }} className="input">
              <option value="">Select supplier (optional)</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {!form.supplier_id && (
            <div>
              <label className="label">Supplier Name (manual)</label>
              <input type="text" value={form.supplier_name} onChange={f('supplier_name')} className="input" placeholder="Type supplier name" />
            </div>
          )}

          <div>
            <label className="label">Description</label>
            <input type="text" value={form.description} onChange={f('description')} className="input" placeholder="What was purchased" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (RM)</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={f('amount')} className="input" placeholder="0.00" required />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select value={form.payment_method} onChange={f('payment_method')} className="input">
                {PAYMENT_METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <input type="text" value={form.notes} onChange={f('notes')} className="input" placeholder="Any notes" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            {editId && (
              <button
                type="button"
                onClick={() => { setDeleteId(editId); setModalOpen(false) }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 transition-all"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving...' : (editId ? 'Update' : 'Add Expense')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Expense" size="sm">
        <div className="space-y-4">
          <p className="text-[#9896A4] text-sm">
            Are you sure you want to delete this expense? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 disabled:opacity-50 transition-all"
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
