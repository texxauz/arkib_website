'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays, Users, Phone, Clock, CheckCircle, XCircle,
  Pencil, Plus, MapPin,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

type Reservation = {
  id: string
  guest_name: string
  guest_phone: string | null
  date: string
  time: string
  covers: number
  section: string | null
  table_id: string | null
  status: string
  occasion: string | null
  notes: string | null
  order_id: string | null
  created_at: string
}

type TableOption = { id: string; name: string; section: string; capacity: number }

interface Props {
  initialReservations: Reservation[]
  tables: TableOption[]
  userId: string
  userName: string
  isAdmin: boolean
  today: string
}

const OCCASIONS = ['Birthday', 'Anniversary', 'Date Night', 'Business', 'Other', 'None']

const statusConfig: Record<string, { label: string; badge: string }> = {
  confirmed: { label: 'Confirmed', badge: 'bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/30' },
  seated:    { label: 'Seated',    badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  completed: { label: 'Completed', badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  cancelled: { label: 'Cancelled', badge: 'bg-[#2A2A30] text-[#5A5865] border border-[#2A2A30]' },
  noshow:    { label: 'No-show',   badge: 'bg-[#2A2A30] text-[#5A5865] border border-[#2A2A30]' },
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDatePill(dateStr: string, today: string): { dayName: string; dayNum: string; label: string } {
  const d = new Date(dateStr + 'T00:00:00')
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
  const dayNum = String(d.getDate())
  const label = dateStr === today ? 'Today' : dayName
  return { dayName, dayNum, label }
}

const emptyForm = {
  guest_name: '',
  guest_phone: '',
  date: '',
  time: '',
  covers: '2',
  section: '',
  table_id: '',
  occasion: '',
  notes: '',
}

export function ReservationClient({
  initialReservations,
  tables,
  userId,
  userName,
  isAdmin,
  today,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [selectedDate, setSelectedDate] = useState(today)
  const [addModal, setAddModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Reservation | null>(null)
  const [seatModal, setSeatModal] = useState<{ open: boolean; reservation: Reservation | null }>({ open: false, reservation: null })
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ ...emptyForm, date: today })

  // Computed
  const dateReservations = reservations
    .filter(r => r.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time))

  // Build 14-day date pills
  const datePills: string[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  const uniqueSections = [...new Set(tables.map(t => t.section))]

  const filteredTables = form.section
    ? tables.filter(t => t.section === form.section)
    : tables

  const editFilteredTables = editTarget
    ? (editTarget.section ? tables.filter(t => t.section === editTarget.section) : tables)
    : tables

  function countForDate(date: string): number {
    return reservations.filter(r => r.date === date && r.status !== 'cancelled' && r.status !== 'noshow').length
  }

  function openAddModal() {
    setForm({ ...emptyForm, date: selectedDate })
    setAddModal(true)
  }

  async function handleAdd() {
    if (!form.guest_name || !form.date || !form.time) {
      toast('Guest name, date and time are required', 'error')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const payload = {
        guest_name: form.guest_name.trim(),
        guest_phone: form.guest_phone.trim() || null,
        date: form.date,
        time: form.time,
        covers: parseInt(form.covers) || 2,
        section: form.section || null,
        table_id: form.table_id || null,
        occasion: (form.occasion && form.occasion !== 'None') ? form.occasion : null,
        notes: form.notes.trim() || null,
        status: 'confirmed',
      }
      const { data, error } = await supabase.from('pos_reservations').insert(payload).select().single()
      if (error) throw error
      setReservations(prev => [...prev, data as Reservation])
      setAddModal(false)
      setForm({ ...emptyForm, date: selectedDate })
      toast('Reservation added', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to add reservation', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleEdit() {
    if (!editTarget) return
    setLoading(true)
    try {
      const supabase = createClient()
      const payload = {
        guest_name: editTarget.guest_name.trim(),
        guest_phone: editTarget.guest_phone?.trim() || null,
        date: editTarget.date,
        time: editTarget.time,
        covers: editTarget.covers,
        section: editTarget.section || null,
        table_id: editTarget.table_id || null,
        occasion: (editTarget.occasion && editTarget.occasion !== 'None') ? editTarget.occasion : null,
        notes: editTarget.notes?.trim() || null,
      }
      const { data, error } = await supabase
        .from('pos_reservations').update(payload).eq('id', editTarget.id).select().single()
      if (error) throw error
      setReservations(prev => prev.map(r => r.id === editTarget.id ? (data as Reservation) : r))
      setEditTarget(null)
      toast('Reservation updated', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update reservation', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('pos_reservations').update({ status }).eq('id', id).select().single()
      if (error) throw error
      setReservations(prev => prev.map(r => r.id === id ? (data as Reservation) : r))
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update status', 'error')
    }
  }

  async function handleSeat(reservation: Reservation) {
    setLoading(true)
    try {
      const res = await fetch('/api/pos/seat-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: reservation.id, tableId: reservation.table_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to seat reservation')
      setSeatModal({ open: false, reservation: null })
      router.push(`/pos/order/${data.orderId}`)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to seat reservation', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] p-4 sm:p-6">
      <TopBar
        title="Reservations"
        actions={
          <button
            onClick={openAddModal}
            className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
          >
            <Plus size={15} />
            New Reservation
          </button>
        }
      />

      {/* Date Selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {datePills.map(date => {
          const { dayName, dayNum, label } = formatDatePill(date, today)
          const count = countForDate(date)
          const isActive = date === selectedDate
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`flex flex-col items-center px-3 py-2 rounded-xl border min-w-[60px] transition-all ${
                isActive
                  ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/50 text-[#A78BFA]'
                  : 'bg-[#141417] border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:border-[#3A3A42]'
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
              <span className={`text-base font-bold leading-tight ${isActive ? 'text-[#F0EEF6]' : 'text-[#F0EEF6]'}`}>{dayNum}</span>
              {count > 0 ? (
                <span className={`text-[10px] font-semibold mt-0.5 ${isActive ? 'text-[#A78BFA]' : 'text-[#5A5865]'}`}>{count}</span>
              ) : (
                <span className="text-[10px] mt-0.5 opacity-0">0</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Reservation List */}
      {dateReservations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#5A5865]">
          <CalendarDays size={36} className="mb-3 opacity-40" />
          <p className="text-sm">No reservations for this date</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {dateReservations.map(res => {
            const sc = statusConfig[res.status] ?? statusConfig.confirmed
            const tableInfo = res.table_id ? tables.find(t => t.id === res.table_id) : null
            return (
              <div
                key={res.id}
                className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                {/* Left: time + guest */}
                <div className="flex-shrink-0 w-20 text-center hidden sm:block">
                  <p className="text-[#F0EEF6] font-bold text-xl leading-tight">{formatTime(res.time)}</p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="sm:hidden text-[#9896A4] text-xs font-medium">{formatTime(res.time)}</span>
                    <h3 className="text-[#F0EEF6] font-semibold text-base">{res.guest_name}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.badge}`}>{sc.label}</span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                    <div className="flex items-center gap-1 text-[#9896A4] text-xs">
                      <Users size={12} />
                      <span>{res.covers} covers</span>
                    </div>
                    {res.occasion && (
                      <div className="flex items-center gap-1 text-[#9896A4] text-xs">
                        <span className="text-[#5A5865]">·</span>
                        <span>{res.occasion}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <div className="flex items-center gap-1 text-[#9896A4] text-xs">
                      <MapPin size={12} />
                      {tableInfo
                        ? <span>{tableInfo.section} — {tableInfo.name}</span>
                        : <span className="text-[#5A5865]">No table assigned</span>
                      }
                    </div>
                    {res.guest_phone && (
                      <div className="flex items-center gap-1 text-[#9896A4] text-xs">
                        <Phone size={12} />
                        <span>{res.guest_phone}</span>
                      </div>
                    )}
                  </div>

                  {res.notes && (
                    <p className="mt-1.5 text-xs text-[#5A5865] italic">{res.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-shrink-0">
                  {res.status === 'confirmed' && (
                    <button
                      onClick={() => setSeatModal({ open: true, reservation: res })}
                      className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
                    >
                      <CheckCircle size={13} />
                      Seat
                    </button>
                  )}
                  {res.status === 'seated' && (
                    <button
                      onClick={() => handleStatusChange(res.id, 'completed')}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                    >
                      <CheckCircle size={13} />
                      Complete
                    </button>
                  )}
                  {(res.status === 'confirmed') && (
                    <button
                      onClick={() => handleStatusChange(res.id, 'cancelled')}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] hover:text-red-400 hover:border-red-500/30 transition-colors"
                      title="Cancel"
                    >
                      <XCircle size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => setEditTarget(res)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:border-[#3A3A42] transition-colors"
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Reservation Modal */}
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="New Reservation" size="lg">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Guest Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.guest_name}
                onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))}
                placeholder="Full name"
                className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm placeholder-[#5A5865] focus:outline-none focus:border-[#8B5CF6] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Phone</label>
              <input
                type="tel"
                value={form.guest_phone}
                onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))}
                placeholder="+1 555 000 0000"
                className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm placeholder-[#5A5865] focus:outline-none focus:border-[#8B5CF6] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Covers <span className="text-red-400">*</span></label>
              <input
                type="number"
                min={1}
                value={form.covers}
                onChange={e => setForm(f => ({ ...f, covers: e.target.value }))}
                className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Date <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Time <span className="text-red-400">*</span></label>
              <input
                type="time"
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Section</label>
              <select
                value={form.section}
                onChange={e => setForm(f => ({ ...f, section: e.target.value, table_id: '' }))}
                className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
              >
                <option value="">Any section</option>
                {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Table</label>
              <select
                value={form.table_id}
                onChange={e => setForm(f => ({ ...f, table_id: e.target.value }))}
                className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
              >
                <option value="">No table</option>
                {filteredTables.map(t => (
                  <option key={t.id} value={t.id}>{t.name} (cap. {t.capacity})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Occasion</label>
              <select
                value={form.occasion}
                onChange={e => setForm(f => ({ ...f, occasion: e.target.value }))}
                className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
              >
                <option value="">None</option>
                {OCCASIONS.filter(o => o !== 'None').map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Allergies, special requests..."
                className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm placeholder-[#5A5865] focus:outline-none focus:border-[#8B5CF6] transition-colors resize-none"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setAddModal(false)}
              className="flex-1 px-4 py-2 rounded-lg bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] text-sm hover:text-[#F0EEF6] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={loading}
              className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm py-2 disabled:opacity-60"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Plus size={15} />
              }
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Reservation Modal */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Reservation"
        size="lg"
      >
        {editTarget && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Guest Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={editTarget.guest_name}
                  onChange={e => setEditTarget(t => t ? { ...t, guest_name: e.target.value } : null)}
                  className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={editTarget.guest_phone ?? ''}
                  onChange={e => setEditTarget(t => t ? { ...t, guest_phone: e.target.value } : null)}
                  className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Covers</label>
                <input
                  type="number"
                  min={1}
                  value={editTarget.covers}
                  onChange={e => setEditTarget(t => t ? { ...t, covers: parseInt(e.target.value) || 1 } : null)}
                  className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Date</label>
                <input
                  type="date"
                  value={editTarget.date}
                  onChange={e => setEditTarget(t => t ? { ...t, date: e.target.value } : null)}
                  className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Time</label>
                <input
                  type="time"
                  value={editTarget.time}
                  onChange={e => setEditTarget(t => t ? { ...t, time: e.target.value } : null)}
                  className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Section</label>
                <select
                  value={editTarget.section ?? ''}
                  onChange={e => setEditTarget(t => t ? { ...t, section: e.target.value || null, table_id: null } : null)}
                  className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
                >
                  <option value="">Any section</option>
                  {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Table</label>
                <select
                  value={editTarget.table_id ?? ''}
                  onChange={e => setEditTarget(t => t ? { ...t, table_id: e.target.value || null } : null)}
                  className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
                >
                  <option value="">No table</option>
                  {editFilteredTables.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (cap. {t.capacity})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Occasion</label>
                <select
                  value={editTarget.occasion ?? ''}
                  onChange={e => setEditTarget(t => t ? { ...t, occasion: e.target.value || null } : null)}
                  className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
                >
                  <option value="">None</option>
                  {OCCASIONS.filter(o => o !== 'None').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#9896A4] mb-1.5">Notes</label>
                <textarea
                  rows={2}
                  value={editTarget.notes ?? ''}
                  onChange={e => setEditTarget(t => t ? { ...t, notes: e.target.value } : null)}
                  className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm placeholder-[#5A5865] focus:outline-none focus:border-[#8B5CF6] transition-colors resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] text-sm hover:text-[#F0EEF6] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEdit}
                disabled={loading}
                className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm py-2 disabled:opacity-60"
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Pencil size={15} />
                }
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Seat Confirmation Modal */}
      <Modal
        isOpen={seatModal.open}
        onClose={() => setSeatModal({ open: false, reservation: null })}
        title="Seat Reservation"
        size="sm"
      >
        {seatModal.reservation && (
          <div className="flex flex-col gap-5">
            <div className="bg-[#1A1A1E] border border-[#2A2A30] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-[#9896A4]" />
                <span className="text-[#F0EEF6] font-semibold">{seatModal.reservation.guest_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#9896A4]">
                <Clock size={13} />
                <span>{formatTime(seatModal.reservation.time)}</span>
                <span className="mx-1 text-[#3A3A42]">·</span>
                <Users size={13} />
                <span>{seatModal.reservation.covers} covers</span>
              </div>
              {seatModal.reservation.table_id && (() => {
                const t = tables.find(x => x.id === seatModal.reservation!.table_id)
                return t ? (
                  <div className="flex items-center gap-2 text-sm text-[#9896A4]">
                    <MapPin size={13} />
                    <span>{t.section} — {t.name}</span>
                  </div>
                ) : null
              })()}
              {!seatModal.reservation.table_id && (
                <p className="text-xs text-amber-400">No table assigned — guest will be seated without a table link.</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSeatModal({ open: false, reservation: null })}
                className="flex-1 px-4 py-2 rounded-lg bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] text-sm hover:text-[#F0EEF6] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSeat(seatModal.reservation!)}
                disabled={loading}
                className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm py-2 disabled:opacity-60"
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <CheckCircle size={15} />
                }
                Confirm & Seat
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
