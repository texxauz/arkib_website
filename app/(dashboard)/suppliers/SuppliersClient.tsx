'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Plus, Truck, Edit2, Phone, Mail } from 'lucide-react'
import type { Database, ExpenseCategory } from '@/types/database'

type Supplier = Database['public']['Tables']['suppliers']['Row']

const emptyForm = {
  name: '', contact_person: '', phone: '', email: '', address: '',
  category: 'alcohol' as ExpenseCategory, payment_terms: '', notes: '',
}

const CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]

export function SuppliersClient({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const openCreate = () => { setEditId(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (s: Supplier) => {
    setEditId(s.id)
    setForm({
      name: s.name, contact_person: s.contact_person ?? '', phone: s.phone ?? '',
      email: s.email ?? '', address: s.address ?? '',
      category: (s.category ?? 'alcohol') as ExpenseCategory,
      payment_terms: s.payment_terms ?? '', notes: s.notes ?? '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const payload = { name: form.name, contact_person: form.contact_person || null, phone: form.phone || null, email: form.email || null, address: form.address || null, category: form.category, payment_terms: form.payment_terms || null, notes: form.notes || null }

    const { error, data } = editId
      ? await supabase.from('suppliers').update(payload).eq('id', editId).select().single()
      : await supabase.from('suppliers').insert(payload).select().single()

    if (error) { toast(error.message, 'error') }
    else {
      toast(editId ? 'Supplier updated' : 'Supplier added', 'success')
      setSuppliers(prev => editId ? prev.map(s => s.id === editId ? data! : s) : [...prev, data!])
      setModalOpen(false)
    }
    setLoading(false)
  }

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="space-y-6">
      <TopBar
        title="Suppliers"
        subtitle={`${suppliers.filter(s => s.is_active).length} active suppliers`}
        actions={
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Add Supplier
          </button>
        }
      />

      {suppliers.length === 0 ? (
        <EmptyState icon={<Truck size={40} />} title="No suppliers yet" action={<button onClick={openCreate} className="btn-primary">Add Supplier</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {suppliers.map(s => (
            <div key={s.id} className="card-hover">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[#F0EEF6] font-semibold text-sm">{s.name}</p>
                  <span className="badge-purple text-[10px] mt-1">{EXPENSE_CATEGORY_LABELS[s.category ?? 'others']}</span>
                </div>
                <button onClick={() => openEdit(s)} className="btn-ghost p-1.5"><Edit2 size={12} /></button>
              </div>
              <div className="space-y-1">
                {s.contact_person && <p className="text-[#9896A4] text-xs">{s.contact_person}</p>}
                {s.phone && <div className="flex items-center gap-1.5 text-[#9896A4] text-xs"><Phone size={10} />{s.phone}</div>}
                {s.email && <div className="flex items-center gap-1.5 text-[#9896A4] text-xs"><Mail size={10} />{s.email}</div>}
                {s.payment_terms && <p className="text-[#5A5865] text-xs mt-1">Terms: {s.payment_terms}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Supplier Name</label>
            <input type="text" value={form.name} onChange={f('name')} className="input" required />
          </div>
          <div>
            <label className="label">Category</label>
            <select value={form.category} onChange={f('category')} className="input">
              {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact Person</label>
              <input type="text" value={form.contact_person} onChange={f('contact_person')} className="input" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="tel" value={form.phone} onChange={f('phone')} className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={f('email')} className="input" />
            </div>
            <div>
              <label className="label">Payment Terms</label>
              <input type="text" value={form.payment_terms} onChange={f('payment_terms')} className="input" placeholder="Net 30" />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input type="text" value={form.address} onChange={f('address')} className="input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving...' : (editId ? 'Update' : 'Add Supplier')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
