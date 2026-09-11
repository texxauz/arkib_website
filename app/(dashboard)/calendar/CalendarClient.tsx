'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { ChevronLeft, ChevronRight, Plus, X, Flag } from 'lucide-react'
import { getMarkedDaysForMonth, getMarkedDaysForDate, COUNTRY_LABEL, COUNTRY_BADGE } from '@/lib/calendar-data'
import type { MarkedDay } from '@/lib/calendar-data'

interface CalendarEvent {
  id: string
  title: string
  date: string
  notes: string | null
  color: string
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const EVENT_COLORS = [
  { value: 'purple', bg: 'bg-[#8B5CF6]',  pill: 'bg-[#8B5CF6]/20 text-[#A78BFA] border-[#8B5CF6]/30' },
  { value: 'pink',   bg: 'bg-pink-500',    pill: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  { value: 'amber',  bg: 'bg-amber-500',   pill: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'cyan',   bg: 'bg-cyan-500',    pill: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { value: 'rose',   bg: 'bg-rose-500',    pill: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
]

function eventPill(color: string) {
  return EVENT_COLORS.find(c => c.value === color)?.pill ?? 'bg-[#8B5CF6]/20 text-[#A78BFA] border-[#8B5CF6]/30'
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
}

function todayStr() {
  const n = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`
}

// ─── Day modal ────────────────────────────────────────────────────────────────
interface DayModalProps {
  dateStr: string
  markedDays: MarkedDay[]
  events: CalendarEvent[]
  onClose: () => void
  onAdd: (title: string, notes: string, color: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function DayModal({ dateStr, markedDays, events, onClose, onAdd, onDelete }: DayModalProps) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [color, setColor] = useState('purple')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-MY', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const holidays = markedDays.filter(d => d.type === 'public_holiday')
  const festives = markedDays.filter(d => d.type === 'festive')

  async function handleAdd() {
    if (!title.trim()) return
    setSaving(true)
    await onAdd(title.trim(), notes.trim(), color)
    setTitle('')
    setNotes('')
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#141417] border border-[#2A2A30] rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-[#2A2A30]">
          <p className="text-[#F0EEF6] font-semibold">{dateLabel}</p>
          <button onClick={onClose} className="text-[#5A5865] hover:text-[#F0EEF6] transition-colors ml-3 mt-0.5">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Public holidays */}
          {holidays.length > 0 && (
            <div className="space-y-2">
              <p className="text-[#5A5865] text-[10px] uppercase tracking-wider">Public Holidays</p>
              {holidays.map(h => (
                <div key={h.date + h.name} className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Flag size={12} className="text-rose-400 shrink-0" />
                    <span className="text-rose-300 text-sm font-medium">{h.name}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-rose-400 ml-3 shrink-0 bg-rose-500/10 rounded px-1.5 py-0.5">
                    {COUNTRY_BADGE[h.country]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Festive days */}
          {festives.length > 0 && (
            <div className="space-y-2">
              <p className="text-[#5A5865] text-[10px] uppercase tracking-wider">Festive Day</p>
              {festives.map(f => (
                <div key={f.date + f.name} className="flex items-center justify-between bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-3 py-2.5">
                  <span className={`text-sm font-medium ${f.color}`}>{f.name}</span>
                  <span className="text-[10px] text-[#5A5865] ml-3">Event opportunity</span>
                </div>
              ))}
            </div>
          )}

          {/* Existing planning events */}
          {events.length > 0 && (
            <div className="space-y-2">
              <p className="text-[#5A5865] text-[10px] uppercase tracking-wider">Your Planned Events</p>
              {events.map(ev => (
                <div key={ev.id} className={`flex items-start gap-2 rounded-lg px-3 py-2.5 border ${eventPill(ev.color)}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{ev.title}</p>
                    {ev.notes && <p className="text-xs opacity-70 mt-0.5 leading-relaxed">{ev.notes}</p>}
                  </div>
                  <button
                    onClick={async () => { setDeletingId(ev.id); await onDelete(ev.id); setDeletingId(null) }}
                    disabled={deletingId === ev.id}
                    className="text-current opacity-40 hover:opacity-100 shrink-0 mt-0.5"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add event form */}
          <div className="space-y-3 pt-1">
            <p className="text-[#5A5865] text-[10px] uppercase tracking-wider">Add Planning Event</p>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. Halloween Party, CNY Theme Night"
              className="input w-full text-sm"
            />
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes — theme, artists, promo ideas... (optional)"
              rows={2}
              className="input w-full text-sm resize-none"
            />
            <div className="flex items-center gap-2">
              {EVENT_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-6 h-6 rounded-full ${c.bg} transition-all ${color === c.value ? 'ring-2 ring-offset-2 ring-offset-[#141417] ring-white/40 scale-110' : 'opacity-40 hover:opacity-70'}`}
                />
              ))}
            </div>
            <button
              onClick={handleAdd}
              disabled={!title.trim() || saving}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <Plus size={14} />
              {saving ? 'Saving...' : 'Add Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main calendar ────────────────────────────────────────────────────────────
interface Props {
  initialMonth: number
  initialYear: number
}

export function CalendarClient({ initialMonth, initialYear }: Props) {
  const [month, setMonth] = useState(initialMonth)
  const [year, setYear] = useState(initialYear)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const markedDaysInMonth = getMarkedDaysForMonth(year, month)
  const today = todayStr()

  const fetchEvents = useCallback(async (m: number, y: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calendar/events?year=${y}&month=${m}`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvents(month, year) }, [month, year, fetchEvents])

  const navigate = (dir: -1 | 1) => {
    let m = month + dir, y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m); setYear(y)
  }

  const handleAdd = async (title: string, notes: string, color: string) => {
    if (!selectedDate) return
    const res = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date: selectedDate, notes, color }),
    })
    if (res.ok) {
      const data = await res.json()
      setEvents(prev => [...prev, data.event])
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch('/api/calendar/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setEvents(prev => prev.filter(e => e.id !== id))
  }

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7

  const markedByDate = new Map<string, MarkedDay[]>()
  for (const d of markedDaysInMonth) {
    const arr = markedByDate.get(d.date) ?? []
    arr.push(d)
    markedByDate.set(d.date, arr)
  }

  const eventsByDate = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    const arr = eventsByDate.get(ev.date) ?? []
    arr.push(ev)
    eventsByDate.set(ev.date, arr)
  }

  const selectedMarked = selectedDate ? (markedByDate.get(selectedDate) ?? []) : []
  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : []

  // Month-level legend: unique countries appearing this month
  const monthHolidays = markedDaysInMonth.filter(d => d.type === 'public_holiday')
  const hasMY = monthHolidays.some(d => d.country === 'MY' || d.country === 'BOTH')
  const hasSG = monthHolidays.some(d => d.country === 'SG' || d.country === 'BOTH')

  return (
    <div className="space-y-5">
      <TopBar
        title="Event Calendar"
        subtitle="Public holidays & planning"
        actions={
          <div className="flex items-center gap-1 bg-[#141417] border border-[#2A2A30] rounded-lg px-1 py-1">
            <button onClick={() => navigate(-1)} className="p-1 rounded hover:bg-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-[#F0EEF6] text-xs font-medium px-2 min-w-[120px] text-center">
              {monthLabel(year, month)}
            </span>
            <button onClick={() => navigate(1)} className="p-1 rounded hover:bg-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        }
      />

      {/* Country coverage note for this month */}
      {(hasMY || hasSG) && (
        <div className="flex items-center gap-3 text-xs text-[#9896A4]">
          <span className="text-[#5A5865]">Holidays this month:</span>
          {hasMY && <span className="bg-[#1A1A1E] border border-[#2A2A30] rounded px-2 py-1">🇲🇾 Malaysia</span>}
          {hasSG && <span className="bg-[#1A1A1E] border border-[#2A2A30] rounded px-2 py-1">🇸🇬 Singapore</span>}
        </div>
      )}

      {/* Calendar grid */}
      <div className={`card p-0 overflow-hidden transition-opacity duration-150 ${loading ? 'opacity-60' : ''}`}>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[#2A2A30]">
          {DAY_LABELS.map(d => (
            <div key={d} className={`py-2.5 text-center text-[10px] font-medium uppercase tracking-wider
              ${d === 'Sun' || d === 'Sat' ? 'text-[#8B5CF6]' : 'text-[#5A5865]'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }, (_, i) => {
            const dayNum = i - firstDayOfMonth + 1
            const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth
            const dateStr = isCurrentMonth
              ? `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
              : ''

            const dayMarked = dateStr ? (markedByDate.get(dateStr) ?? []) : []
            const dayEvents = dateStr ? (eventsByDate.get(dateStr) ?? []) : []
            const isToday = dateStr === today
            const isWeekend = i % 7 === 0 || i % 7 === 6
            const isSelected = dateStr === selectedDate
            const hasHoliday = dayMarked.some(d => d.type === 'public_holiday')
            const hasFestive = dayMarked.some(d => d.type === 'festive')

            return (
              <button
                key={i}
                onClick={() => isCurrentMonth && setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                disabled={!isCurrentMonth}
                className={`relative min-h-[80px] sm:min-h-[90px] p-1.5 text-left border-b border-r border-[#1E1E23] transition-colors
                  ${!isCurrentMonth ? 'opacity-15 cursor-default' : 'cursor-pointer hover:bg-[#1A1A1E]'}
                  ${isSelected ? 'bg-[#8B5CF6]/10 ring-1 ring-inset ring-[#8B5CF6]/40' : ''}
                  ${hasHoliday && !isSelected ? 'bg-rose-500/5' : ''}
                `}
              >
                {/* Day number */}
                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1
                  ${isToday ? 'bg-[#8B5CF6] text-white' : isWeekend ? 'text-[#8B5CF6]' : 'text-[#9896A4]'}`}>
                  {isCurrentMonth ? dayNum : ''}
                </div>

                {/* Holiday badges */}
                {dayMarked.filter(d => d.type === 'public_holiday').slice(0, 2).map(h => (
                  <div key={h.name} className="flex items-center justify-between gap-0.5 mb-0.5">
                    <span className="text-[9px] leading-tight text-rose-300 truncate flex-1">{h.name}</span>
                    <span className="text-[8px] text-rose-400 shrink-0 ml-0.5">
                      {h.country === 'MY' ? '🇲🇾' : h.country === 'SG' ? '🇸🇬' : '🇲🇾🇸🇬'}
                    </span>
                  </div>
                ))}

                {/* Festive dot */}
                {hasFestive && !hasHoliday && (
                  <div className="flex items-center gap-0.5 mb-0.5">
                    {dayMarked.filter(d => d.type === 'festive').map(f => (
                      <span key={f.name} className={`text-[9px] leading-tight truncate ${f.color}`}>{f.name}</span>
                    ))}
                  </div>
                )}
                {hasFestive && hasHoliday && (
                  <div className="flex items-center gap-0.5 mb-0.5">
                    {dayMarked.filter(d => d.type === 'festive').map(f => (
                      <span key={f.name} className={`text-[8px] leading-tight truncate ${f.color}`}>{f.name}</span>
                    ))}
                  </div>
                )}

                {/* Planning event pills */}
                {dayEvents.slice(0, 2).map(ev => (
                  <div key={ev.id} className={`text-[9px] leading-tight rounded px-1 py-0.5 mb-0.5 border truncate ${eventPill(ev.color)}`}>
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[9px] text-[#5A5865] px-0.5">+{dayEvents.length - 2} more</div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-[#5A5865] px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-rose-500/20" />
          <span>Public holiday</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 flex items-center justify-center rounded-full bg-[#8B5CF6] text-[9px] text-white font-bold">8</div>
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#8B5CF6]/20 border border-[#8B5CF6]/30" />
          <span>Your event</span>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span>🇲🇾 = Malaysia only</span>
          <span>🇸🇬 = Singapore only</span>
          <span>🇲🇾🇸🇬 = Both</span>
        </div>
        {events.length > 0 && (
          <span className="ml-auto text-[#9896A4]">{events.length} event{events.length !== 1 ? 's' : ''} this month</span>
        )}
      </div>

      {/* Day modal */}
      {selectedDate && (
        <DayModal
          dateStr={selectedDate}
          markedDays={selectedMarked}
          events={selectedEvents}
          onClose={() => setSelectedDate(null)}
          onAdd={handleAdd}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
