'use client'
import { useState, useEffect, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Clock, LogIn, LogOut, Users, Calendar, Download, Plus, Edit2, Trash2, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'

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
type KioskStaff = { id: string; full_name: string; role: string; clocked_in: boolean; clock_in_time: string | null }

type EmploymentInfo = { type: 'part_time' | 'full_time'; monthlySalary: number | null }

interface Props {
  shifts: Shift[]
  currentUserId: string
  currentUserName: string
  isAdmin: boolean
  staffUsers: StaffUser[]
  rateByUserId: Record<string, number>
  employmentByUserId: Record<string, EmploymentInfo>
  kioskStaff: KioskStaff[]
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

export function ShiftsClient({ shifts: initialShifts, currentUserId, currentUserName, isAdmin, staffUsers, rateByUserId, employmentByUserId, kioskStaff: initialKioskStaff }: Props) {
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
  const [kioskStaff, setKioskStaff] = useState<KioskStaff[]>(initialKioskStaff)
  const [kioskActive, setKioskActive] = useState<KioskStaff | null>(null)
  const [kioskPin, setKioskPin] = useState('')
  const [kioskLoading, setKioskLoading] = useState(false)
  const [kioskShake, setKioskShake] = useState(false)
  const [kioskFlash, setKioskFlash] = useState<{ name: string; action: 'clock_in' | 'clock_out' } | null>(null)
  const { toast } = useToast()
  const supabase = createClient()

  function initials(name: string) {
    return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  }

  const refreshKiosk = async () => {
    const res = await fetch('/api/kiosk/staff')
    if (res.ok) setKioskStaff(await res.json())
  }

  const kioskPressNum = (n: string) => { if (kioskPin.length < 4) setKioskPin(p => p + n) }
  const kioskPressBack = () => setKioskPin(p => p.slice(0, -1))

  const kioskConfirm = async () => {
    if (!kioskActive || kioskPin.length < 4 || kioskLoading) return
    setKioskLoading(true)
    const res = await fetch('/api/kiosk/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: kioskActive.id, pin: kioskPin }),
    })
    setKioskLoading(false)
    if (!res.ok) {
      setKioskShake(true); setKioskPin('')
      setTimeout(() => setKioskShake(false), 400)
      toast('Incorrect PIN', 'error')
      return
    }
    const data = await res.json()
    setKioskActive(null); setKioskPin('')
    setKioskFlash({ name: data.name, action: data.action })
    setTimeout(() => setKioskFlash(null), 2500)
    await refreshKiosk()
    // Also refresh shifts list
    const sr = await supabase.from('staff_shifts').select('*, users(full_name, role)').order('clock_in', { ascending: false }).limit(500)
    if (sr.data) setShifts(sr.data as Shift[])
  }

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
    const byUser: Record<string, { name: string; shifts: Shift[]; totalHours: number; totalPay: number; isFullTime: boolean; monthlySalary: number | null }> = {}
    for (const s of monthShifts) {
      const name = s.users?.full_name ?? 'Unknown'
      const emp = employmentByUserId[s.user_id]
      const isFullTime = emp?.type === 'full_time'
      const monthlySalary = emp?.monthlySalary ?? null
      if (!byUser[s.user_id]) byUser[s.user_id] = { name, shifts: [], totalHours: 0, totalPay: 0, isFullTime, monthlySalary }
      const hours = calcHours(s.clock_in, s.clock_out!)
      byUser[s.user_id].shifts.push(s)
      byUser[s.user_id].totalHours += hours
      if (!isFullTime) byUser[s.user_id].totalPay += hours * s.hourly_rate
    }
    // Full-timers: totalPay = fixed monthly salary
    for (const d of Object.values(byUser)) {
      if (d.isFullTime) d.totalPay = d.monthlySalary ?? 0
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
          {/* Live clock */}
          <div className="text-center py-4">
            <p className="text-[#A78BFA] text-4xl font-mono font-bold tracking-wider">
              {now.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </p>
            <p className="text-[#5A5865] text-sm mt-1">
              {now.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {kioskStaff.length === 0 ? (
            <div className="card text-center py-10 space-y-2">
              <p className="text-[#F0EEF6] font-medium">No staff set up yet</p>
              <p className="text-[#5A5865] text-sm">Go to Team Access and set a Kiosk Clock-in PIN for each staff member.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {kioskStaff.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setKioskActive(s); setKioskPin('') }}
                  className={`rounded-2xl border p-5 flex flex-col items-center gap-3 transition-all active:scale-95 ${
                    s.clocked_in
                      ? 'bg-emerald-500/4 border-emerald-500/20 hover:border-emerald-500/30'
                      : 'bg-[#14141C] border-[#22222C] hover:border-[#2E2E3A]'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold relative ${
                    s.clocked_in ? 'bg-emerald-500/10 border-2 border-emerald-500/25 text-emerald-400' : 'bg-[#8B5CF6]/10 border-2 border-[#8B5CF6]/20 text-[#A78BFA]'
                  }`}>
                    {initials(s.full_name)}
                    <span className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-[#14141C] ${s.clocked_in ? 'bg-emerald-400' : 'bg-[#2E2E3A]'}`} />
                  </div>
                  <div className="text-center">
                    <p className="text-[#F0EEF6] text-sm font-semibold leading-tight">{s.full_name}</p>
                    <p className={`text-xs mt-1 font-medium ${s.clocked_in ? 'text-emerald-400' : 'text-[#5A5868]'}`}>
                      {s.clocked_in ? `● On Shift${s.clock_in_time ? ` · ${formatTime(s.clock_in_time)}` : ''}` : '○ Not In'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* PIN modal */}
          {kioskActive && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={e => { if (e.target === e.currentTarget) { setKioskActive(null); setKioskPin('') } }}
            >
              <div
                className="bg-[#0F0F14] border border-[#2E2E3A] rounded-3xl p-8 w-[300px] flex flex-col items-center shadow-2xl"
                style={{ animation: kioskShake ? 'kiosk-shake 0.35s ease' : undefined }}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-3 ${
                  kioskActive.clocked_in ? 'bg-emerald-500/10 border-2 border-emerald-500/25 text-emerald-400' : 'bg-[#8B5CF6]/10 border-2 border-[#8B5CF6]/20 text-[#A78BFA]'
                }`}>
                  {initials(kioskActive.full_name)}
                </div>
                <p className="text-[#F0EEF6] text-lg font-bold mb-1">{kioskActive.full_name}</p>
                <p className="text-[#5A5868] text-sm mb-6">
                  Enter PIN to{' '}
                  <span className={kioskActive.clocked_in ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {kioskActive.clocked_in ? 'clock out' : 'clock in'}
                  </span>
                </p>

                {/* PIN dots */}
                <div className="flex gap-3 mb-6">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${i < kioskPin.length ? 'bg-[#8B5CF6] border-[#8B5CF6]' : 'border-[#2E2E3A]'}`} />
                  ))}
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2.5 w-full mb-4">
                  {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((n, i) => (
                    <button
                      key={i}
                      onClick={() => n === '⌫' ? kioskPressBack() : n ? kioskPressNum(n) : undefined}
                      className={`h-14 rounded-xl text-xl font-medium transition-all active:scale-90 ${
                        n ? 'bg-[#14141C] border border-[#22222C] text-[#F0EEF6] hover:border-[#3A3A45]' : 'pointer-events-none'
                      } ${n === '⌫' ? 'text-base text-[#9896A4]' : ''}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <button
                  onClick={kioskConfirm}
                  disabled={kioskPin.length < 4 || kioskLoading}
                  className={`w-full h-13 py-3.5 rounded-xl font-bold text-base transition-all disabled:opacity-40 disabled:cursor-default ${
                    kioskActive.clocked_in
                      ? 'bg-rose-500 hover:bg-rose-600 text-white'
                      : 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white'
                  }`}
                >
                  {kioskLoading ? 'Please wait…' : kioskActive.clocked_in ? 'Clock Out' : 'Clock In'}
                </button>
                <button onClick={() => { setKioskActive(null); setKioskPin('') }} className="mt-3 text-[#5A5868] text-sm hover:text-[#9896A4] transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Success flash */}
          {kioskFlash && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-emerald-500/8 pointer-events-none">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/25 flex items-center justify-center text-4xl">✓</div>
              <p className="text-emerald-400 text-2xl font-bold">{kioskFlash.action === 'clock_in' ? 'Clocked In!' : 'Clocked Out!'}</p>
              <p className="text-[#9896A4] text-sm">
                {kioskFlash.action === 'clock_in' ? `Welcome, ${kioskFlash.name.split(' ')[0]}!` : `See you, ${kioskFlash.name.split(' ')[0]}!`}
              </p>
            </div>
          )}

          <style>{`
            @keyframes kiosk-shake {
              0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)}
            }
          `}</style>
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const [y, m] = payrollMonth.split('-').map(Number)
                  const d = new Date(y, m - 2, 1)
                  setPayrollMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:bg-[#1A1A1E] transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[#F0EEF6] font-medium text-sm min-w-[120px] text-center">
                {new Date(payrollMonth + '-01').toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => {
                  const [y, m] = payrollMonth.split('-').map(Number)
                  const d = new Date(y, m, 1)
                  setPayrollMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:bg-[#1A1A1E] transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
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
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[#A78BFA] text-xs font-medium">{d.name}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${d.isFullTime ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {d.isFullTime ? 'Full-time' : 'Part-time'}
                      </span>
                    </div>
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
                <div key={d.userId} className="card space-y-0 overflow-hidden">
                  {/* Staff header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[#F0EEF6] font-semibold text-base">{d.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${d.isFullTime ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                          {d.isFullTime ? 'Full-time' : 'Part-time'}
                        </span>
                        <span className="text-[#5A5865] text-xs">{d.shifts.length} shift{d.shifts.length !== 1 ? 's' : ''} · {d.totalHours.toFixed(1)} hrs</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[#9896A4] text-xs mb-0.5">{d.isFullTime ? 'Monthly salary' : 'Total to pay'}</p>
                      <p className="text-[#A78BFA] font-bold text-2xl">{formatCurrency(d.totalPay)}</p>
                    </div>
                  </div>

                  {/* Full-timer fixed salary notice */}
                  {d.isFullTime && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg mb-3">
                      <span className="text-emerald-400 text-xs">Fixed monthly salary — attendance tracked below for reference only</span>
                    </div>
                  )}

                  {/* Column headers */}
                  <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-[#0D0D10] rounded-lg mb-2">
                    <span className="text-[#5A5865] text-[10px] uppercase tracking-wider font-semibold">Date</span>
                    <span className="text-[#5A5865] text-[10px] uppercase tracking-wider font-semibold">Clock In</span>
                    <span className="text-[#5A5865] text-[10px] uppercase tracking-wider font-semibold">Clock Out</span>
                    <span className="text-[#5A5865] text-[10px] uppercase tracking-wider font-semibold text-right">{d.isFullTime ? 'Hours' : 'Pay'}</span>
                  </div>

                  {/* Shift rows */}
                  <div className="space-y-1">
                    {d.shifts.sort((a, b) => a.clock_in.localeCompare(b.clock_in)).map(s => {
                      const h = calcHours(s.clock_in, s.clock_out!)
                      const pay = h * s.hourly_rate
                      return (
                        <div key={s.id} className="grid grid-cols-4 gap-2 px-3 py-2.5 rounded-lg hover:bg-[#1A1A1E] transition-colors">
                          <div>
                            <p className="text-[#F0EEF6] text-sm font-medium">{formatShiftDate(s.clock_in)}</p>
                            {s.is_public_holiday && <span className="text-amber-400 text-[10px] px-1.5 py-0.5 bg-amber-500/10 rounded mt-0.5 inline-block">Public Holiday</span>}
                          </div>
                          <div>
                            <p className="text-[#F0EEF6] text-sm">{formatTime(s.clock_in)}</p>
                          </div>
                          <div>
                            <p className="text-[#F0EEF6] text-sm">{formatTime(s.clock_out!)}</p>
                            {!d.isFullTime && <p className="text-[#5A5865] text-xs">{h.toFixed(1)}h × RM{s.hourly_rate}/hr</p>}
                          </div>
                          <div className="text-right">
                            {d.isFullTime
                              ? <p className="text-[#9896A4] text-sm">{h.toFixed(1)}h</p>
                              : <p className="text-[#F0EEF6] text-sm font-semibold">{formatCurrency(pay)}</p>
                            }
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Footer total */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#2A2A30]">
                    <span className="text-[#9896A4] text-sm">{d.totalHours.toFixed(1)} hours worked</span>
                    <div className="text-right">
                      <p className="text-[#5A5865] text-xs">Amount due</p>
                      <p className="text-[#A78BFA] font-bold text-lg">{formatCurrency(d.totalPay)}</p>
                    </div>
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
