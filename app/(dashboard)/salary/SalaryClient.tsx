'use client'
import { useState, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, formatMonth, calculateHours } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Plus, Clock, CheckCircle2, DollarSign } from 'lucide-react'
import type { Database } from '@/types/database'

type Employee = Database['public']['Tables']['employees']['Row']
type Attendance = Database['public']['Tables']['attendance']['Row']
type SalaryRecord = Database['public']['Tables']['salary_records']['Row']

interface Props {
  employees: Employee[]
  attendance: Attendance[]
  salaryRecords: SalaryRecord[]
  month: number
  year: number
}

const emptyAttendForm = {
  employee_id: '',
  date: new Date().toISOString().split('T')[0],
  clock_in: '18:00',
  clock_out: '02:00',
  is_public_holiday: false,
  notes: '',
}

export function SalaryClient({ employees, attendance: initialAttendance, salaryRecords: initialRecords, month, year }: Props) {
  const [attendance, setAttendance] = useState<Attendance[]>(initialAttendance)
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>(initialRecords)
  const [attendModal, setAttendModal] = useState(false)
  const [attendForm, setAttendForm] = useState(emptyAttendForm)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const employeeSummaries = useMemo(() => {
    return employees.map(emp => {
      const empAttendance = attendance.filter(a => a.employee_id === emp.id)
      const normalHours = empAttendance.filter(a => !a.is_public_holiday).reduce((sum, a) => sum + (a.hours_worked ?? 0), 0)
      const phHours = empAttendance.filter(a => a.is_public_holiday).reduce((sum, a) => sum + (a.hours_worked ?? 0), 0)
      const totalHours = normalHours + phHours

      let baseSalary = 0
      let phBonus = 0
      if (emp.salary_type === 'hourly') {
        const rate = emp.hourly_rate ?? 0
        baseSalary = normalHours * rate
        phBonus = phHours * rate * 1.5
      } else {
        baseSalary = emp.fixed_monthly_salary ?? 0
      }

      const totalSalary = baseSalary + phBonus
      const record = salaryRecords.find(r => r.employee_id === emp.id)

      return { emp, normalHours, phHours, totalHours, baseSalary, phBonus, totalSalary, record, attendanceCount: empAttendance.length }
    })
  }, [employees, attendance, salaryRecords])

  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const clockInDt = `${attendForm.date}T${attendForm.clock_in}:00`
    let clockOutDt = `${attendForm.date}T${attendForm.clock_out}:00`

    // Handle midnight crossover
    if (attendForm.clock_out < attendForm.clock_in) {
      const nextDay = new Date(attendForm.date)
      nextDay.setDate(nextDay.getDate() + 1)
      clockOutDt = `${nextDay.toISOString().split('T')[0]}T${attendForm.clock_out}:00`
    }

    const hours = calculateHours(clockInDt, clockOutDt)

    const { error, data } = await supabase.from('attendance').insert({
      employee_id: attendForm.employee_id,
      date: attendForm.date,
      clock_in: clockInDt,
      clock_out: clockOutDt,
      hours_worked: hours,
      is_public_holiday: attendForm.is_public_holiday,
      ph_multiplier: attendForm.is_public_holiday ? 1.5 : 1.0,
      notes: attendForm.notes || null,
    }).select().single()

    if (error) { toast(error.message, 'error') }
    else {
      toast('Attendance recorded', 'success')
      setAttendance(prev => [...prev, data!])
      setAttendModal(false)
      setAttendForm(emptyAttendForm)
    }
    setLoading(false)
  }

  const handleMarkPaid = async (empId: string, totalSalary: number, baseSalary: number, phBonus: number, totalHours: number, normalHours: number, phHours: number) => {
    const { error, data } = await supabase.from('salary_records').upsert({
      employee_id: empId,
      month, year,
      total_hours: totalHours,
      normal_hours: normalHours,
      ph_hours: phHours,
      base_salary: baseSalary,
      ph_bonus: phBonus,
      deductions: 0,
      total_salary: totalSalary,
      is_paid: true,
      paid_at: new Date().toISOString(),
    }, { onConflict: 'employee_id,month,year' }).select().single()

    if (error) { toast(error.message, 'error') }
    else {
      toast('Salary marked as paid', 'success')
      setSalaryRecords(prev => {
        const exists = prev.find(r => r.id === data!.id)
        return exists ? prev.map(r => r.id === data!.id ? data! : r) : [...prev, data!]
      })
    }
  }

  return (
    <div className="space-y-6">
      <TopBar
        title="Salary"
        subtitle={formatMonth(month, year)}
        actions={
          <button onClick={() => setAttendModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Log Attendance
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="card">
          <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-1">Total Payroll</p>
          <p className="text-[#F0EEF6] font-bold text-xl">
            {formatCurrency(employeeSummaries.reduce((s, e) => s + e.totalSalary, 0))}
          </p>
        </div>
        <div className="card">
          <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-1">Paid</p>
          <p className="text-emerald-400 font-bold text-xl">
            {formatCurrency(employeeSummaries.filter(e => e.record?.is_paid).reduce((s, e) => s + e.totalSalary, 0))}
          </p>
        </div>
        <div className="card">
          <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-1">Outstanding</p>
          <p className="text-amber-400 font-bold text-xl">
            {formatCurrency(employeeSummaries.filter(e => !e.record?.is_paid).reduce((s, e) => s + e.totalSalary, 0))}
          </p>
        </div>
      </div>

      {/* Employee salary cards */}
      <div className="space-y-3">
        {employeeSummaries.map(({ emp, normalHours, phHours, totalHours, baseSalary, phBonus, totalSalary, record }) => (
          <div key={emp.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center text-white font-bold text-sm">
                  {emp.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="text-[#F0EEF6] font-semibold text-sm">{emp.full_name}</p>
                  <p className="text-[#9896A4] text-xs">{emp.position}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[#F0EEF6] font-bold">{formatCurrency(totalSalary)}</p>
                  {record?.is_paid && <span className="badge-green text-[10px]">Paid</span>}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#2A2A30] grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-[#5A5865] text-[10px] uppercase">Total Hours</p>
                <p className="text-[#F0EEF6] text-sm font-medium flex items-center gap-1">
                  <Clock size={12} className="text-[#8B5CF6]" /> {totalHours.toFixed(1)}h
                </p>
              </div>
              {phHours > 0 && (
                <div>
                  <p className="text-[#5A5865] text-[10px] uppercase">PH Hours (1.5x)</p>
                  <p className="text-amber-400 text-sm font-medium">{phHours.toFixed(1)}h</p>
                </div>
              )}
              <div>
                <p className="text-[#5A5865] text-[10px] uppercase">Base Salary</p>
                <p className="text-[#F0EEF6] text-sm font-medium">{formatCurrency(baseSalary)}</p>
              </div>
              {phBonus > 0 && (
                <div>
                  <p className="text-[#5A5865] text-[10px] uppercase">PH Bonus</p>
                  <p className="text-amber-400 text-sm font-medium">+{formatCurrency(phBonus)}</p>
                </div>
              )}
            </div>

            {emp.salary_type === 'hourly' && totalHours === 0 && (
              <p className="text-[#5A5865] text-xs mt-2">No attendance recorded this month</p>
            )}

            {!record?.is_paid && totalSalary > 0 && (
              <button
                onClick={() => handleMarkPaid(emp.id, totalSalary, baseSalary, phBonus, totalHours, normalHours, phHours)}
                className="mt-3 btn-secondary w-full flex items-center justify-center gap-2 text-xs"
              >
                <DollarSign size={12} /> Mark as Paid
              </button>
            )}
            {record?.is_paid && (
              <div className="mt-3 flex items-center gap-1.5 text-emerald-400 text-xs">
                <CheckCircle2 size={12} />
                Paid on {record.paid_at ? formatDate(record.paid_at) : 'N/A'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent attendance log */}
      <div className="card">
        <p className="section-title mb-3">Recent Attendance</p>
        <div className="space-y-2">
          {attendance.slice(0, 10).map(a => {
            const emp = employees.find(e => e.id === a.employee_id)
            return (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-[#1A1A1E] last:border-0">
                <div>
                  <p className="text-[#F0EEF6] text-sm">{emp?.full_name ?? 'Unknown'}</p>
                  <p className="text-[#9896A4] text-xs">{formatDate(a.date)}</p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-[#F0EEF6] text-sm font-medium">{a.hours_worked?.toFixed(1)}h</p>
                    {a.is_public_holiday && <span className="badge-yellow text-[9px]">PH 1.5x</span>}
                  </div>
                </div>
              </div>
            )
          })}
          {attendance.length === 0 && <p className="text-[#5A5865] text-sm">No attendance this month</p>}
        </div>
      </div>

      <Modal isOpen={attendModal} onClose={() => setAttendModal(false)} title="Log Attendance">
        <form onSubmit={handleAddAttendance} className="space-y-4">
          <div>
            <label className="label">Employee</label>
            <select value={attendForm.employee_id} onChange={e => setAttendForm(p => ({ ...p, employee_id: e.target.value }))} className="input" required>
              <option value="">Select employee</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" value={attendForm.date} onChange={e => setAttendForm(p => ({ ...p, date: e.target.value }))} className="input" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Clock In</label>
              <input type="time" value={attendForm.clock_in} onChange={e => setAttendForm(p => ({ ...p, clock_in: e.target.value }))} className="input" required />
            </div>
            <div>
              <label className="label">Clock Out</label>
              <input type="time" value={attendForm.clock_out} onChange={e => setAttendForm(p => ({ ...p, clock_out: e.target.value }))} className="input" required />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="ph"
              checked={attendForm.is_public_holiday}
              onChange={e => setAttendForm(p => ({ ...p, is_public_holiday: e.target.checked }))}
              className="w-4 h-4 rounded border-[#2A2A30] bg-[#1A1A1E] accent-[#8B5CF6]"
            />
            <label htmlFor="ph" className="text-[#F0EEF6] text-sm cursor-pointer">
              Public Holiday <span className="text-amber-400">(1.5x multiplier)</span>
            </label>
          </div>
          <div>
            <label className="label">Notes</label>
            <input type="text" value={attendForm.notes} onChange={e => setAttendForm(p => ({ ...p, notes: e.target.value }))} className="input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setAttendModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving...' : 'Log Attendance'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
