'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { useToast } from '@/components/ui/Toast'
import { Printer, X, Plus, Trash2, Pencil, Eye } from 'lucide-react'

interface UserRow { id: string; full_name: string; role: string; is_active: boolean }
interface EmployeeRow { user_id: string; employment_type: string; monthly_salary: number | null; hourly_rate: number | null }
interface ShiftRow { id: string; user_id: string; clock_in: string; clock_out: string | null; hourly_rate: number; is_public_holiday: boolean }
interface LineItem { label: string; amount: number }
interface PayrollRecord {
  id: string; user_id: string; month: string; employment_type: string;
  basic_pay: number; hours_worked: number | null; hourly_rate: number | null;
  deductions: LineItem[]; deductions_total: number;
  claims: LineItem[]; claims_total: number;
  net_pay: number; notes: string | null; status: string; created_at: string;
}

interface Props {
  users: UserRow[]
  employees: EmployeeRow[]
  payrollRecords: PayrollRecord[]
  shifts: ShiftRow[]
  selectedMonth: string
  currentMonth: string
}

function formatMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

function calcHours(shifts: ShiftRow[], userId: string) {
  return shifts
    .filter(s => s.user_id === userId && s.clock_out)
    .reduce((sum, s) => {
      const ms = new Date(s.clock_out!).getTime() - new Date(s.clock_in).getTime()
      return sum + ms / 3_600_000
    }, 0)
}

// ── Voucher Modal ─────────────────────────────────────────────────────────────

function VoucherModal({ record, userName, month, onClose }: { record: PayrollRecord; userName: string; month: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 print:bg-transparent" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative bg-white text-black rounded-lg shadow-2xl w-full max-w-md mx-4 print:shadow-none print:rounded-none print:max-w-none print:mx-0 print:fixed print:inset-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 print:hidden">
          <span className="font-semibold text-sm text-gray-700">Payment Voucher</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors">
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-8 print:p-10" style={{ fontFamily: 'Georgia, serif' }}>
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-widest text-black">ARKIB</h1>
            <h2 className="text-sm tracking-wider text-gray-600 mt-1 uppercase">Payment Voucher</h2>
            <div className="mt-3 border-t border-b border-gray-300 py-2">
              <p className="text-sm text-gray-700">{formatMonth(month)}</p>
            </div>
          </div>

          <div className="mb-5 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Staff Name</span>
              <span className="font-semibold">{userName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Employment Type</span>
              <span className="font-semibold capitalize">{record.employment_type.replace('_', '-')}</span>
            </div>
          </div>

          <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #374151' }}>
                <th className="text-left py-2 font-semibold text-gray-700">Description</th>
                <th className="text-right py-2 font-semibold text-gray-700">Amount (RM)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: record.claims?.length ? '1px solid #E5E7EB' : '1px solid #D1D5DB' }}>
                <td className="py-2 text-gray-700">
                  {record.employment_type === 'part_time'
                    ? `${Number(record.hours_worked ?? 0).toFixed(2)} hrs × RM ${Number(record.hourly_rate ?? 0).toFixed(2)}/hr`
                    : 'Monthly Salary'}
                </td>
                <td className="py-2 text-right">{Number(record.basic_pay).toFixed(2)}</td>
              </tr>
              {(record.claims ?? []).map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td className="py-2 text-gray-600 pl-2">+ {c.label}</td>
                  <td className="py-2 text-right text-green-700">+{Number(c.amount).toFixed(2)}</td>
                </tr>
              ))}
              {(record.deductions ?? []).map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td className="py-2 text-gray-600 pl-2">– {d.label}</td>
                  <td className="py-2 text-right text-red-600">-{Number(d.amount).toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #374151' }}>
                <td className="pt-3 font-bold text-black">Net Pay</td>
                <td className="pt-3 text-right font-bold text-black">RM {Number(record.net_pay).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {record.notes && (
            <p className="text-xs text-gray-500 mb-6 italic">Note: {record.notes}</p>
          )}

          <div className="mt-8 pt-4 border-t border-gray-200 grid grid-cols-2 gap-6 text-xs text-gray-600">
            <div>
              <div className="border-b border-gray-400 mb-1 pb-6"></div>
              Prepared by
            </div>
            <div>
              <div className="border-b border-gray-400 mb-1 pb-6"></div>
              Received by
              <div className="mt-3 border-b border-gray-400 mb-1 pb-2"></div>
              Date
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print\\:fixed, .print\\:fixed * { visibility: visible !important; }
        }
      `}</style>
    </div>
  )
}

// ── Edit Rate Modal ───────────────────────────────────────────────────────────

function EditRateModal({ userId, userName, currentType, currentSalary, currentRate, onClose, onSaved }: {
  userId: string; userName: string
  currentType: string; currentSalary: number | null; currentRate: number | null
  onClose: () => void
  onSaved: (type: string, salary: number | null, rate: number | null) => void
}) {
  const { toast } = useToast()
  const [empType, setEmpType] = useState(currentType)
  const [salary, setSalary] = useState(String(currentSalary ?? ''))
  const [rate, setRate] = useState(String(currentRate ?? ''))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/payroll/update-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, employmentType: empType,
          monthlySalary: empType === 'full_time' ? Number(salary) : null,
          hourlyRate: empType === 'part_time' ? Number(rate) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast('Rate updated', 'success')
      onSaved(empType, empType === 'full_time' ? Number(salary) : null, empType === 'part_time' ? Number(rate) : null)
    } catch (e: any) {
      toast(e.message ?? 'Failed to update', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#141417] border border-[#2A2A30] rounded-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A30]">
          <div>
            <h2 className="text-[#F0EEF6] font-semibold">Edit Rate — {userName}</h2>
            <p className="text-[#9896A4] text-xs mt-0.5">Changes apply to future payroll runs</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#2A2A30] transition-colors">
            <X size={16} className="text-[#9896A4]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Employment Type</label>
            <div className="flex gap-2">
              {(['full_time', 'part_time'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setEmpType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${empType === t ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#A78BFA]' : 'border-[#2A2A30] text-[#9896A4] hover:bg-[#2A2A30]'}`}
                >
                  {t === 'full_time' ? 'Full-time' : 'Part-time'}
                </button>
              ))}
            </div>
          </div>

          {empType === 'full_time' ? (
            <div>
              <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Monthly Salary (RM)</label>
              <input
                type="number" step="0.01" min="0"
                value={salary}
                onChange={e => setSalary(e.target.value)}
                className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Hourly Rate (RM)</label>
              <input
                type="number" step="0.01" min="0"
                value={rate}
                onChange={e => setRate(e.target.value)}
                className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-[#2A2A30]">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[#2A2A30] text-[#9896A4] text-sm hover:bg-[#2A2A30] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-[#8B5CF6] text-white text-sm font-medium hover:bg-[#7C3AED] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Payroll Modal ────────────────────────────────────────────────────────

function EditModal({ userId, userName, month, employmentType, calcBasicPay, calcHoursWorked, calcHourlyRate, existingRecord, onClose, onSaved }: {
  userId: string; userName: string; month: string; employmentType: string
  calcBasicPay: number; calcHoursWorked: number | null; calcHourlyRate: number | null
  existingRecord: PayrollRecord | null
  onClose: () => void; onSaved: (record: PayrollRecord) => void
}) {
  const { toast } = useToast()
  const [basicPay, setBasicPay] = useState(String(existingRecord?.basic_pay ?? calcBasicPay))
  const [claims, setClaims] = useState<LineItem[]>(existingRecord?.claims ?? [])
  const [deductions, setDeductions] = useState<LineItem[]>(existingRecord?.deductions ?? [])
  const [notes, setNotes] = useState(existingRecord?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const addClaim = () => setClaims(c => [...c, { label: '', amount: 0 }])
  const removeClaim = (i: number) => setClaims(c => c.filter((_, j) => j !== i))
  const updateClaim = (i: number, field: 'label' | 'amount', val: string) =>
    setClaims(c => c.map((item, j) => j === i ? { ...item, [field]: field === 'amount' ? Number(val) : val } : item))

  const addDeduction = () => setDeductions(d => [...d, { label: '', amount: 0 }])
  const removeDeduction = (i: number) => setDeductions(d => d.filter((_, j) => j !== i))
  const updateDeduction = (i: number, field: 'label' | 'amount', val: string) =>
    setDeductions(d => d.map((item, j) => j === i ? { ...item, [field]: field === 'amount' ? Number(val) : val } : item))

  const claimsTotal = claims.reduce((s, c) => s + Number(c.amount), 0)
  const deductionsTotal = deductions.reduce((s, d) => s + Number(d.amount), 0)
  const netPay = Number(basicPay) + claimsTotal - deductionsTotal

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/payroll/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, month, employmentType, basicPay: Number(basicPay), hoursWorked: calcHoursWorked, hourlyRate: calcHourlyRate, claims, deductions, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast('Saved as draft', 'success')
      onSaved(data.record)
    } catch (e: any) {
      toast(e.message ?? 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const lineItemSection = (
    label: string,
    items: LineItem[],
    onAdd: () => void,
    onRemove: (i: number) => void,
    onUpdate: (i: number, field: 'label' | 'amount', val: string) => void,
    color: 'green' | 'red'
  ) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-[#9896A4] font-medium">{label}</label>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs text-[#8B5CF6] hover:text-[#A78BFA] transition-colors">
          <Plus size={12} /> Add
        </button>
      </div>
      {items.length === 0 && <p className="text-xs text-[#5A5865] italic">None</p>}
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input
            type="text" placeholder="Label"
            value={item.label}
            onChange={e => onUpdate(i, 'label', e.target.value)}
            className="flex-1 bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
          />
          <input
            type="number" step="0.01" min="0" placeholder="Amount"
            value={item.amount}
            onChange={e => onUpdate(i, 'amount', e.target.value)}
            className="w-28 bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
          />
          <button onClick={() => onRemove(i)} className="p-2 rounded hover:bg-[#2A2A30] transition-colors">
            <Trash2 size={14} className="text-[#9896A4] hover:text-rose-400" />
          </button>
        </div>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#141417] border border-[#2A2A30] rounded-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A30]">
          <div>
            <h2 className="text-[#F0EEF6] font-semibold">Payroll — {userName}</h2>
            <p className="text-[#9896A4] text-xs mt-0.5">{formatMonth(month)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#2A2A30] transition-colors">
            <X size={16} className="text-[#9896A4]" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Basic pay */}
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Basic Pay (RM)</label>
            {employmentType === 'part_time' && (
              <p className="text-xs text-[#9896A4] mb-1.5">
                {Number(calcHoursWorked ?? 0).toFixed(2)} hrs × RM {Number(calcHourlyRate ?? 0).toFixed(2)}/hr
              </p>
            )}
            <input
              type="number" step="0.01" min="0"
              value={basicPay}
              onChange={e => setBasicPay(e.target.value)}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          {lineItemSection('Claims (Reimbursements)', claims, addClaim, removeClaim, updateClaim, 'green')}
          {lineItemSection('Deductions', deductions, addDeduction, removeDeduction, updateDeduction, 'red')}

          {/* Notes */}
          <div>
            <label className="text-xs text-[#9896A4] font-medium block mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] resize-none"
            />
          </div>

          {/* Summary */}
          <div className="bg-[#0D0D10] rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between text-[#9896A4]">
              <span>Basic Pay</span><span>RM {Number(basicPay).toFixed(2)}</span>
            </div>
            {claims.map((c, i) => (
              <div key={i} className="flex justify-between text-emerald-400">
                <span>+ {c.label || 'Claim'}</span><span>+RM {Number(c.amount).toFixed(2)}</span>
              </div>
            ))}
            {deductions.map((d, i) => (
              <div key={i} className="flex justify-between text-rose-400">
                <span>– {d.label || 'Deduction'}</span><span>-RM {Number(d.amount).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-[#F0EEF6] font-semibold pt-1 border-t border-[#2A2A30]">
              <span>Net Pay</span><span className="text-[#8B5CF6]">RM {netPay.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-[#2A2A30]">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[#2A2A30] text-[#9896A4] text-sm hover:bg-[#2A2A30] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-[#8B5CF6] text-white text-sm font-medium hover:bg-[#7C3AED] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save as Draft'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PayrollClient({ users, employees, payrollRecords, shifts, selectedMonth, currentMonth }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [records, setRecords] = useState<PayrollRecord[]>(payrollRecords)
  const [empData, setEmpData] = useState<EmployeeRow[]>(employees)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editingRateUserId, setEditingRateUserId] = useState<string | null>(null)
  const [voucherRecord, setVoucherRecord] = useState<{ record: PayrollRecord; userName: string } | null>(null)

  const empMap = new Map(empData.map(e => [e.user_id, e]))
  const recordMap = new Map(records.map(r => [r.user_id, r]))

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(`/settings/payroll?month=${e.target.value}`)
  }

  const handlePublish = async (record: PayrollRecord, userName: string) => {
    if (!confirm(`Publish payroll for ${userName}? This will make it visible to the staff member.`)) return
    setPublishing(record.user_id)
    try {
      const res = await fetch('/api/payroll/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: record.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRecords(rs => rs.map(r => r.id === record.id ? data.record : r))
      toast('Payroll published', 'success')
      setVoucherRecord({ record: data.record, userName })
    } catch (e: any) {
      toast(e.message ?? 'Publish failed', 'error')
    } finally {
      setPublishing(null)
    }
  }

  const editingUser = editingUserId ? users.find(u => u.id === editingUserId) : null
  const editingRateUser = editingRateUserId ? users.find(u => u.id === editingRateUserId) : null

  return (
    <div className="min-h-screen bg-[#0D0D10]">
      <TopBar title="Payroll" subtitle="Manage staff payment vouchers" />

      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <label className="text-sm text-[#9896A4] font-medium">Month</label>
          <input
            type="month"
            value={selectedMonth}
            max={currentMonth}
            onChange={handleMonthChange}
            className="bg-[#141417] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] [color-scheme:dark]"
          />
        </div>

        <div className="space-y-3">
          {users.map(u => {
            const emp = empMap.get(u.id) ?? { employment_type: 'part_time', monthly_salary: null, hourly_rate: 10 }
            const record = recordMap.get(u.id)
            const isPT = emp.employment_type === 'part_time'
            const hoursWorked = isPT ? Math.round(calcHours(shifts, u.id) * 100) / 100 : null
            const rate = emp.hourly_rate ?? 10
            const calcBasic = isPT ? Math.round((hoursWorked ?? 0) * rate * 100) / 100 : (emp.monthly_salary ?? 0)

            return (
              <div key={u.id} className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[#F0EEF6] font-medium">{u.full_name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isPT ? 'bg-blue-500/15 text-blue-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                        {isPT ? 'Part-time' : 'Full-time'}
                      </span>
                      <span className="text-[10px] text-[#5A5865] capitalize">{u.role}</span>
                    </div>
                    <div className="text-xs text-[#9896A4] space-x-2">
                      {isPT ? (
                        <span>{hoursWorked?.toFixed(2) ?? '0.00'} hrs × RM {rate.toFixed(2)}/hr = RM {calcBasic.toFixed(2)}</span>
                      ) : (
                        <span>Monthly salary: RM {Number(emp.monthly_salary ?? 0).toFixed(2)}</span>
                      )}
                    </div>
                    {record && (
                      <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${record.status === 'published' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                          {record.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                        <span className="text-[#9896A4]">Net: RM {Number(record.net_pay).toFixed(2)}</span>
                        {(record.claims_total ?? 0) > 0 && (
                          <span className="text-emerald-400">Claims: +RM {Number(record.claims_total).toFixed(2)}</span>
                        )}
                        {record.deductions_total > 0 && (
                          <span className="text-rose-400">Deductions: -RM {Number(record.deductions_total).toFixed(2)}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Edit rate button — always visible */}
                    <button
                      onClick={() => setEditingRateUserId(u.id)}
                      title="Edit salary / rate"
                      className="p-1.5 rounded-lg border border-[#2A2A30] text-[#5A5865] hover:text-[#9896A4] hover:bg-[#2A2A30] transition-colors"
                    >
                      <Pencil size={13} />
                    </button>

                    {!record && (
                      <button
                        onClick={() => setEditingUserId(u.id)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/20 hover:bg-[#8B5CF6]/25 transition-colors font-medium"
                      >
                        Generate
                      </button>
                    )}
                    {record?.status === 'draft' && (
                      <>
                        <button
                          onClick={() => setEditingUserId(u.id)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:bg-[#2A2A30] transition-colors font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handlePublish(record, u.full_name)}
                          disabled={publishing === u.id}
                          className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600/15 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/25 transition-colors font-medium disabled:opacity-50"
                        >
                          {publishing === u.id ? 'Publishing…' : 'Publish'}
                        </button>
                      </>
                    )}
                    {record?.status === 'published' && (
                      <button
                        onClick={() => setVoucherRecord({ record, userName: u.full_name })}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] transition-colors font-medium"
                      >
                        <Eye size={13} /> View Voucher
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {users.length === 0 && (
            <div className="text-center py-12 text-[#5A5865]">No active staff members found.</div>
          )}
        </div>
      </div>

      {/* Edit payroll modal */}
      {editingUserId && editingUser && (() => {
        const emp = empMap.get(editingUserId) ?? { employment_type: 'part_time', monthly_salary: null, hourly_rate: 10 }
        const isPT = emp.employment_type === 'part_time'
        const hoursWorked = isPT ? Math.round(calcHours(shifts, editingUserId) * 100) / 100 : null
        const rate = emp.hourly_rate ?? 10
        const calcBasic = isPT ? Math.round((hoursWorked ?? 0) * rate * 100) / 100 : (emp.monthly_salary ?? 0)
        return (
          <EditModal
            userId={editingUserId}
            userName={editingUser.full_name}
            month={selectedMonth}
            employmentType={emp.employment_type}
            calcBasicPay={calcBasic}
            calcHoursWorked={hoursWorked}
            calcHourlyRate={isPT ? rate : null}
            existingRecord={recordMap.get(editingUserId) ?? null}
            onClose={() => setEditingUserId(null)}
            onSaved={record => {
              setRecords(rs => {
                const existing = rs.find(r => r.id === record.id)
                return existing ? rs.map(r => r.id === record.id ? record : r) : [...rs, record]
              })
              setEditingUserId(null)
            }}
          />
        )
      })()}

      {/* Edit rate modal */}
      {editingRateUserId && editingRateUser && (() => {
        const emp = empMap.get(editingRateUserId) ?? { employment_type: 'part_time', monthly_salary: null, hourly_rate: 10 }
        return (
          <EditRateModal
            userId={editingRateUserId}
            userName={editingRateUser.full_name}
            currentType={emp.employment_type}
            currentSalary={emp.monthly_salary}
            currentRate={emp.hourly_rate}
            onClose={() => setEditingRateUserId(null)}
            onSaved={(type, salary, rate) => {
              setEmpData(prev => {
                const existing = prev.find(e => e.user_id === editingRateUserId)
                if (existing) return prev.map(e => e.user_id === editingRateUserId ? { ...e, employment_type: type, monthly_salary: salary, hourly_rate: rate } : e)
                return [...prev, { user_id: editingRateUserId, employment_type: type, monthly_salary: salary, hourly_rate: rate }]
              })
              setEditingRateUserId(null)
            }}
          />
        )
      })()}

      {/* Voucher modal */}
      {voucherRecord && (
        <VoucherModal
          record={voucherRecord.record}
          userName={voucherRecord.userName}
          month={selectedMonth}
          onClose={() => setVoucherRecord(null)}
        />
      )}
    </div>
  )
}
