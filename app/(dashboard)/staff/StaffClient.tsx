'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Plus, Users, Edit2, Clock, DollarSign } from 'lucide-react'
import type { Database, SalaryType } from '@/types/database'

type Employee = Database['public']['Tables']['employees']['Row']

const emptyForm = {
  full_name: '',
  position: '',
  phone: '',
  email: '',
  start_date: new Date().toISOString().split('T')[0],
  salary_type: 'hourly' as SalaryType,
  hourly_rate: '',
  fixed_monthly_salary: '',
  notes: '',
}

export function StaffClient({ initialEmployees }: { initialEmployees: Employee[] }) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const openCreate = () => { setEditId(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (emp: Employee) => {
    setEditId(emp.id)
    setForm({
      full_name: emp.full_name,
      position: emp.position,
      phone: emp.phone ?? '',
      email: emp.email ?? '',
      start_date: emp.start_date,
      salary_type: emp.salary_type,
      hourly_rate: String(emp.hourly_rate ?? ''),
      fixed_monthly_salary: String(emp.fixed_monthly_salary ?? ''),
      notes: emp.notes ?? '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const payload = {
      full_name: form.full_name,
      position: form.position,
      phone: form.phone || null,
      email: form.email || null,
      start_date: form.start_date,
      salary_type: form.salary_type,
      hourly_rate: form.salary_type === 'hourly' ? parseFloat(form.hourly_rate) || null : null,
      fixed_monthly_salary: form.salary_type === 'fixed' ? parseFloat(form.fixed_monthly_salary) || null : null,
      notes: form.notes || null,
    }

    const { error, data } = editId
      ? await supabase.from('employees').update(payload).eq('id', editId).select().single()
      : await supabase.from('employees').insert(payload).select().single()

    if (error) { toast(error.message, 'error') }
    else {
      toast(editId ? 'Employee updated' : 'Employee added', 'success')
      setEmployees(prev => editId ? prev.map(e => e.id === editId ? data! : e) : [...prev, data!])
      setModalOpen(false)
    }
    setLoading(false)
  }

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const active = employees.filter(e => e.is_active)
  const inactive = employees.filter(e => !e.is_active)

  return (
    <div className="space-y-6">
      <TopBar
        title="Staff"
        subtitle={`${active.length} active employees`}
        actions={
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Add Employee
          </button>
        }
      />

      {employees.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title="No employees yet"
          action={<button onClick={openCreate} className="btn-primary">Add First Employee</button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {active.map(emp => (
            <div key={emp.id} className="card-hover">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center text-white font-bold text-sm">
                    {emp.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[#F0EEF6] font-semibold text-sm">{emp.full_name}</p>
                    <p className="text-[#9896A4] text-xs">{emp.position}</p>
                  </div>
                </div>
                <button onClick={() => openEdit(emp)} className="btn-ghost p-1.5"><Edit2 size={12} /></button>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-[#9896A4]">
                  {emp.salary_type === 'hourly'
                    ? <><Clock size={11} /><span>{formatCurrency(emp.hourly_rate ?? 0)}/hr (Hourly)</span></>
                    : <><DollarSign size={11} /><span>{formatCurrency(emp.fixed_monthly_salary ?? 0)}/mo (Fixed)</span></>}
                </div>
                <div className="text-xs text-[#5A5865]">Started {formatDate(emp.start_date)}</div>
                {emp.phone && <div className="text-xs text-[#9896A4]">{emp.phone}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <div>
          <p className="text-[#5A5865] text-xs font-medium uppercase tracking-wider mb-3">Inactive</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 opacity-50">
            {inactive.map(emp => (
              <div key={emp.id} className="card">
                <p className="text-[#9896A4] font-medium text-sm">{emp.full_name}</p>
                <p className="text-[#5A5865] text-xs">{emp.position}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Employee' : 'Add Employee'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Full Name</label>
              <input type="text" value={form.full_name} onChange={f('full_name')} className="input" required />
            </div>
            <div>
              <label className="label">Position</label>
              <input type="text" value={form.position} onChange={f('position')} className="input" placeholder="Bartender" required />
            </div>
            <div>
              <label className="label">Start Date</label>
              <input type="date" value={form.start_date} onChange={f('start_date')} className="input" required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="tel" value={form.phone} onChange={f('phone')} className="input" placeholder="+601X-XXXXXXX" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={f('email')} className="input" />
            </div>
          </div>

          <div>
            <label className="label">Salary Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['hourly', 'fixed'] as SalaryType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, salary_type: type }))}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${form.salary_type === type ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#A78BFA]' : 'border-[#2A2A30] text-[#9896A4]'}`}
                >
                  {type === 'hourly' ? '⏱ Hourly Rate' : '📅 Fixed Monthly'}
                </button>
              ))}
            </div>
          </div>

          {form.salary_type === 'hourly' ? (
            <div>
              <label className="label">Hourly Rate (RM)</label>
              <input type="number" step="0.01" min="0" value={form.hourly_rate} onChange={f('hourly_rate')} className="input" placeholder="10.00" />
            </div>
          ) : (
            <div>
              <label className="label">Fixed Monthly Salary (RM)</label>
              <input type="number" step="0.01" min="0" value={form.fixed_monthly_salary} onChange={f('fixed_monthly_salary')} className="input" placeholder="2000.00" />
            </div>
          )}

          <div>
            <label className="label">Notes</label>
            <input type="text" value={form.notes} onChange={f('notes')} className="input" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving...' : (editId ? 'Update' : 'Add Employee')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
