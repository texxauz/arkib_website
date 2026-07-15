'use client'
import { useState, useEffect, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Clock, LogIn, LogOut, Users, Calendar, Download, Plus, Edit2, Trash2, CheckCircle2 } from 'lucide-react'

type Shift = {
  id: string
  user_id: string
  clock_in: string
  clock_out: string | null
  hourly_rate: number
  is_public_holiday: boolean
  notes: string | null
  created_at: string
  users?: { full_name: string; role: string } | null
}

type StaffUser = { id: string; full_name: string; role: string }

interface Props {
  shifts: Shift[]
  currentUserId: string
  currentUserName: string
  isAdmin: boolean
  staffUsers: StaffUser[]
  rateByUserId: Record<string, number>
}

function calcHours(start: string, end: string) {
  return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60)
}

function formatDuration(start: string, end: string | null) {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatShiftDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-MY', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

const CURRENT_MONTH = new Date().toISOString().slice(0, 7)

export function ShiftsClient({ shifts: initialShifts, currentUserId, currentUserName, isAdmin, staffUsers, rateByUserId }: Props) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts)
  const [activeTab, setActiveTab] = useState<'clock' | 'history' | 'payroll'>('clock')
  const [now, setNow] = useState(new Date())
  const [clockLoading, setClockLoading] = useState(false)
  const [payrollMonth, setPayrollMonth] = useState(CURRENT_MONTH)
  const [modalOpen, setModalOpen] = useState(false)
  const [editShift, setEditShift] = useState<Shift | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [filterStaff, setFilterStaff] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [form, setForm] = useState({
    user_id: currentUserId,
    clock_in_date: new Date().toISOString().split('T')[0],
    clock_in_time: '20:00',
    clock_out_date: new Date().toISOString().split('T')[0],
    clock_out_time: '23:00',
    hourly_rate: '10',
    is_public_holiday: false,
    notes: '',
  })
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const myActiveShift = shifts.find(s => s.user_id === currentUserId && !s.clock_out)
  const activeShifts = shifts.filter(s => !s.clock_out)
  const myShifts = shifts.filter(s => s.user_id === currentUserId && s.clock_out).slice(0, 10)

  const handleClockIn = async () => {
    setClockLoading(true)
    const rate = rateByUserId[currentUserId] ?? 10
    const { data, error } = await supabase
      .from('staff_shifts')
      .insert({ user_id: currentUserId, clock_in: new Date().toISOString(), hourly_rate: rate, is_public_holiday: false })
      .select('*, users(full_name, role)')
      .single()
    if (error) toast(error.message, 'error')
    else { setShifts(prev => [data as Shift, ...prev]); toast('Clocked in!', 'success') }
    setClockLoading(false)
  }

  const handleClockOut = async () => {
    if (!myActiveShift) return
    setClockLoading(true)
    const { data, error } = await supabase
      .from('staff_shifts')
      .update({ clock_out: new Date().toISOString() })
      .eq('id', myActiveShift.id)
      .select('*, users(full_name, role)')
      .single()
    if (error) toast(error.message, 'error')
    else { setShifts(prev => prev.map(s => s.id === myActiveShift.id ? data as Shift : s)); toast('Clocked out!', 'success') }
    setClockLoading(false)
  }

  const filteredHistory = useMemo(() => shifts.filter(s => {
    if (!s.clock_out) return false
    if (filterStaff && s.user_id !== filterStaff) return false
    if (filterMonth && !s.clock_in.startsWith(filterMonth)) return false
    return true
  }), [shifts, filterStaff, filterMonth])

  const payrollData = useMemo(() => {
    const monthShifts = shifts.filter(s => s.clock_out && s.clock_in.startsWith(payrollMonth))
    const byUser: Record<string, { name: string; shifts: Shift[]; totalHours: number; totalPay: number }> = {}
    for (const s of monthShifts) {
      const name = s.users?.full_name ?? 'Unknown'
      if (!byUser[s.user_id]) byUser[s.user_id] = { name, shifts: [], totalHours: 0, totalPay: 0 }
      const hours = calcHours(s.clock_in, s.clock_out!)
      byUser[s.user_id].shifts.push(s)
      byUser[s.user_id].totalHours += hours
      byUser[s.user_id].totalPay += hours * s.hourly_rate
    }
    return Object.entries(byUser).map(([userId, d]) => ({ userId, ...d }))
  }, [shifts, payrollMonth])

  const openAddModal = () => {
    setEditShift(null)
    const rate = rateByUserId[currentUserId] ?? 10
    setForm({ user_id: currentUserId, clock_in_date: new Date().toISOString().split('T')[0], clock_in_time: '20:00', clock_out_date: new Date().toISOString().split('T')[0], clock_out_time: '23:00', hourly_rate: String(rate), is_public_holiday: false, notes: '' })
    setModalOpen(true)
  }

  const openEditModal = (shift: Shift) => {
    setEditShift(shift)
    const ci = new Date(shift.clock_in)
    const co = shift.clock_out ? new Date(shift.clock_out) : new Date()
    setForm({
      user_id: shift.user_id,
      clock_in_date: ci.toISOString().split('T')[0],
      clock_in_time: ci.toTimeString().slice(0, 5),
      clock_out_date: co.toISOString().split('T')[0],
      clock_out_time: co.toTimeString().slice(0, 5),
      hourly_rate: String(shift.hourly_rate),
      is_public_holiday: shift.is_public_holiday,
      notes: shift.notes ?? '',
    })
    setModalOpen(true)
  }

  const handleSaveShift = async () => {
    const clock_in = new Date(`${form.clock_in_date}T${form.clock_in_time}`).toISOString()
    const clock_out = new Date(`${form.clock_out_date}T${form.clock_out_time}`).toISOString()
    const payload = { user_id: form.user_id, clock_in, clock_out, hourly_rate: parseFloat(form.hourly_rate) || 10, is_public_holiday: form.is_public_holiday, notes: form.notes || null }
    if (editShift) {
      const { data, error } = await supabase.from('staff_shifts').update(payload).eq('id', editShift.id).select('*, users(full_name, role)').single()
      if (error) toast(error.message, 'error')
      else { setShifts(prev => prev.map(s => s.id === editShift.id ? data as Shift : s)); toast('Shift updated', 'success'); setModalOpen(false) }
    } else {
      const { data, error } = await supabase.from('staff_shifts').insert(payload).select('*, users(full_name, role)').single()
      if (error) toast(error.message, 'error')
      else { setShifts(prev => [data as Shift, ...prev]); toast('Shift added', 'success'); setModalOpen(false) }
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteLoading(true)
    const { error } = await supabase.from('staff_shifts').delete().eq('id', deleteId)
    if (error) toast(error.message, 'error')
    else { setShifts(prev => prev.filter(s => s.id !== deleteId)); setDeleteId(null); toast('Shift deleted', 'success') }
    setDeleteLoading(false)
  }

  const exportPayroll = () => {
    const rows = [
      ['Staff', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Rate', 'Pay', 'Public Holiday'],
      ...payrollData.flatMap(d => d.shifts.sort((a, b) => a.clock_in.localeCompare(b.clock_in)).map(s => {
        const h = calcHours(s.clock_in, s.clock_out!)
        return [d.name, formatShiftDate(s.clock_in), formatTime(s.clock_in), formatTime(s.clock_out!), h.toFixed(2), s.hourly_rate, (h * s.hourly_rate).toFixed(2), s.is_public_holiday ? 'Yes' : 'No']
      })),
      [],
      ['SUMMARY'],
      ['Staff', 'Total Hours', 'Total Pay'],
      ...payrollData.map(d => [d.name, d.totalHours.toFixed(2), d.totalPay.toFixed(2)]),
      ['TOTAL', payrollData.reduce((s, d) => s + d.totalHours, 0).toFixed(2), payrollData.reduce((s, d) => s + d.totalPay, 0).toFixed(2)],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `ARKIB_Payroll_${payrollMonth}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const previewHours = (() => {
    const h = (new Date(`${form.clock_out_date}T${form.clock_out_time}`).getTime() - new Date(`${form.clock_in_date}T${form.clock_in_time}`).getTime()) / 3600000
    return h > 0 ? { hours: h, pay: h * (parseFloat(form.hourly_rate) || 0) } : null
  })()

  return (
    <div className="space-y-6">
      <TopBar
        title="Shifts"
        subtitle="Staff clock in/out and payroll"
        actions={
          isAdmin && activeTab !== 'clock' ? (
            <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Add Shift
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0D0D0F] border border-[#2A2A30] rounded-xl p-1 w-fit">
        {([
          { key: 'clock', label: 'Clock In/Out', icon: Clock },
          ...(isAdmin ? [{ key: 'history', label: 'History', icon: Calendar }] : []),
          ...(isAdmin ? [{ key: 'payroll', label: 'Payroll', icon: Users }] : []),
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === key ? 'bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/30' : 'text-[#9896A4] hover:text-[#F0EEF6]'}`}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── CLOCK TAB ── */}
      {activeTab === 'clock' && (
        <div className="space-y-6">
          {isAdmin && activeShifts.length > 0 && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
              <p className="text-emerald-400 text-xs font-medium uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle2 size={12} /> Currently Clocked In
              </p>
              <div className="space-y-2">
                {activeShifts.map(s => (
                  <div key={s.id} className="flex items-center justify-between">
                    <p className="text-[#F0EEF6] text-sm font-medium">{s.users?.full_name ?? 'Unknown'}</p>
                    <p className="text-[#9896A4] text-xs">Since {formatTime(s.clock_in)} · {formatDuration(s.clock_in, null)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#111113] border border-[#2A2A30] rounded-2xl p-8 text-center space-y-6">
            <div>
              <p className="text-[#5A5865] text-xs uppercase tracking-wider mb-1">Welcome</p>
              <p className="text-[#F0EEF6] text-xl font-bold">{currentUserName}</p>
            </div>
            <div>
              <p className="text-[#A78BFA] text-4xl font-mono font-bold tracking-wider">
                {now.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </p>
              <p className="text-[#5A5865] text-sm mt-1">
                {now.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {myActiveShift ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-emerald-400 text-sm font-medium">Shift in progress</p>
                  <p className="text-[#F0EEF6] text-2xl font-bold mt-1">{formatDuration(myActiveShift.clock_in, null)}</p>
                  <p className="text-[#9896A4] text-xs mt-1">Since {formatTime(myActiveShift.clock_in)}</p>
                </div>
                <button
                  onClick={handleClockOut}
                  disabled={clockLoading}
                  className="w-full py-4 rounded-xl text-base font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                >
                  <LogOut size={20} />{clockLoading ? 'Clocking Out...' : 'Clock Out'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleClockIn}
                disabled={clockLoading}
                className="w-full py-4 rounded-xl text-base font-bold bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/30 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
              >
                <LogIn size={20} />{clockLoading ? 'Clocking In...' : 'Clock In'}
              </button>
            )}
          </div>

          {myShifts.length > 0 && (
            <div className="space-y-2">
              <p className="text-[#9896A4] text-xs uppercase tracking-wider font-medium">My Recent Shifts</p>
              {myShifts.map(s => {
                const h = calcHours(s.clock_in, s.clock_out!)
                return (
                  <div key={s.id} className="card flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[#F0EEF6] text-sm font-medium">{formatShiftDate(s.clock_in)}</p>
                      <p className="text-[#9896A4] text-xs">{formatTime(s.clock_in)} → {formatTime(s.clock_out!)} · {formatDuration(s.clock_in, s.clock_out)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[#F0EEF6] font-bold text-sm">{formatCurrency(h * s.hourly_rate)}</p>
                      <p className="text-[#5A5865] text-xs">{h.toFixed(1)}h × RM{s.hourly_rate}/hr</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && isAdmin && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            {isAdmin && (
              <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} className="input w-48 text-sm">
                <option value="">All staff</option>
                {staffUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            )}
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="input w-40 text-sm" />
            {(filterStaff || filterMonth) && (
              <button onClick={() => { setFilterStaff(''); setFilterMonth('') }} className="btn-secondary text-xs">Clear</button>
            )}
          </div>

          {filteredHistory.length === 0 ? (
            <EmptyState icon={<Calendar size={40} />} title="No shifts found" description="Shifts will appear here after staff clock in and out" />
          ) : (
            <div className="space-y-2">
              {filteredHistory.map(s => {
                const h = calcHours(s.clock_in, s.clock_out!)
                return (
                  <div key={s.id} className="card flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {isAdmin && <p className="text-[#A78BFA] text-xs font-medium mb-0.5">{s.users?.full_name ?? 'Unknown'}</p>}
                      <p className="text-[#F0EEF6] text-sm font-medium">{formatShiftDate(s.clock_in)}</p>
                      <p className="text-[#9896A4] text-xs">
                        {formatTime(s.clock_in)} → {formatTime(s.clock_out!)} · {formatDuration(s.clock_in, s.clock_out)}
                        {s.is_public_holiday && <span className="ml-2 text-amber-400">Public Holiday</span>}
                      </p>
                      {s.notes && <p className="text-[#5A5865] text-xs mt-0.5">{s.notes}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[#F0EEF6] font-bold">{formatCurrency(h * s.hourly_rate)}</p>
                      <p className="text-[#5A5865] text-xs">{h.toFixed(1)}h × RM{s.hourly_rate}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEditModal(s)} className="btn-ghost p-2"><Edit2 size={13} /></button>
                        <button onClick={() => setDeleteId(s.id)} className="btn-ghost p-2 text-rose-400"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PAYROLL TAB ── */}
      {activeTab === 'payroll' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)} className="input w-40 text-sm" />
            {payrollData.length > 0 && (
              <button onClick={exportPayroll} className="btn-secondary flex items-center gap-2 text-xs">
                <Download size={13} /> Export CSV
              </button>
            )}
          </div>

          {payrollData.length === 0 ? (
            <EmptyState icon={<Users size={40} />} title="No shifts this month" description="Shifts will appear here once staff have clocked in and out" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {payrollData.map(d => (
                  <div key={d.userId} className="card">
                    <p className="text-[#A78BFA] text-xs font-medium mb-1">{d.name}</p>
                    <p className="text-[#F0EEF6] font-bold text-xl">{formatCurrency(d.totalPay)}</p>
                    <p className="text-[#5A5865] text-xs mt-1">{d.totalHours.toFixed(1)} hrs · {d.shifts.length} shift{d.shifts.length !== 1 ? 's' : ''}</p>
                  </div>
                ))}
                <div className="card border-[#8B5CF6]/30">
                  <p className="text-[#9896A4] text-xs mb-1">Total Payroll</p>
                  <p className="text-[#A78BFA] font-bold text-xl">{formatCurrency(payrollData.reduce((s, d) => s + d.totalPay, 0))}</p>
                  <p className="text-[#5A5865] text-xs mt-1">{payrollData.reduce((s, d) => s + d.shifts.length, 0)} shifts total</p>
                </div>
              </div>

              {payrollData.map(d => (
                <div key={d.userId} className="card space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[#F0EEF6] font-medium text-sm">{d.name}</p>
                    <p className="text-[#A78BFA] font-bold">{formatCurrency(d.totalPay)}</p>
                  </div>
                  {d.shifts.sort((a, b) => a.clock_in.localeCompare(b.clock_in)).map(s => {
                    const h = calcHours(s.clock_in, s.clock_out!)
                    return (
                      <div key={s.id} className="flex items-center justify-between text-xs py-1.5 border-t border-[#1A1A1E]">
                        <span className="text-[#9896A4]">{formatShiftDate(s.clock_in)} · {formatTime(s.clock_in)}–{formatTime(s.clock_out!)}</span>
                        <div className="flex items-center gap-3">
                          {s.is_public_holiday && <span className="text-amber-400 text-[10px] px-1.5 py-0.5 bg-amber-500/10 rounded">PH</span>}
                          <span className="text-[#5A5865]">{h.toFixed(1)}h × RM{s.hourly_rate}</span>
                          <span className="text-[#F0EEF6] font-medium">{formatCurrency(h * s.hourly_rate)}</span>
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex justify-between pt-1 border-t border-[#2A2A30]">
                    <span className="text-[#5A5865] text-xs">{d.totalHours.toFixed(1)} total hours</span>
                    <span className="text-[#A78BFA] text-xs font-bold">{formatCurrency(d.totalPay)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADD/EDIT MODAL ── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editShift ? 'Edit Shift' : 'Add Shift'} size="md">
        <div className="space-y-4">
          {isAdmin && (
            <div>
              <label className="label">Staff Member</label>
              <select value={form.user_id} onChange={e => {
                const uid = e.target.value
                const rate = rateByUserId[uid] ?? 10
                setForm(p => ({ ...p, user_id: uid, hourly_rate: p.is_public_holiday ? String(rate * 1.5) : String(rate) }))
              }} className="input">
                {staffUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Clock In Date</label>
              <input type="date" value={form.clock_in_date} onChange={e => setForm(p => ({ ...p, clock_in_date: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Clock In Time</label>
              <input type="time" value={form.clock_in_time} onChange={e => setForm(p => ({ ...p, clock_in_time: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Clock Out Date</label>
              <input type="date" value={form.clock_out_date} onChange={e => setForm(p => ({ ...p, clock_out_date: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Clock Out Time</label>
              <input type="time" value={form.clock_out_time} onChange={e => setForm(p => ({ ...p, clock_out_time: e.target.value }))} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Hourly Rate (RM)</label>
              <input type="number" step="0.50" min="0" value={form.hourly_rate} onChange={e => setForm(p => ({ ...p, hourly_rate: e.target.value }))} className="input" />
            </div>
            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_public_holiday}
                  onChange={e => {
                    const baseRate = rateByUserId[form.user_id] ?? parseFloat(form.hourly_rate) ?? 10
                    setForm(p => ({ ...p, is_public_holiday: e.target.checked, hourly_rate: e.target.checked ? String(baseRate * 1.5) : String(baseRate) }))
                  }}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-[#9896A4]">Public Holiday (×1.5 rate)</span>
              </label>
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="input" placeholder="Any notes..." />
          </div>
          {previewHours && (
            <div className="bg-[#1A1A1E] rounded-lg p-3 text-sm">
              <span className="text-[#9896A4]">Duration: {previewHours.hours.toFixed(1)}h → </span>
              <span className="text-[#A78BFA] font-bold">{formatCurrency(previewHours.pay)}</span>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSaveShift} className="btn-primary flex-1">{editShift ? 'Update Shift' : 'Add Shift'}</button>
          </div>
        </div>
      </Modal>

      {/* ── DELETE CONFIRM ── */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Shift" size="sm">
        <div className="space-y-4">
          <p className="text-[#9896A4] text-sm">Are you sure you want to delete this shift? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 disabled:opacity-50 transition-all">
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
