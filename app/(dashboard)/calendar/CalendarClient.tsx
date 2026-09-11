'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { ChevronLeft, ChevronRight, Plus, X, Flag, Calendar } from 'lucide-react'
import { getHolidaysForMonth, getFestivesForDate, getFestivesForMonth } from '@/lib/calendar-data'
import type { Holiday, FestiveSeason } from '@/lib/calendar-data'

interface CalendarEvent {
  id: string
  title: string
  date: string
  notes: string | null
  color: string
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const EVENT_COLORS = [
  { value: 'purple', label: 'Purple', bg: 'bg-[#8B5CF6]', light: 'bg-[#8B5CF6]/20 text-[#A78BFA]' },
  { value: 'pink',   label: 'Pink',   bg: 'bg-pink-500',   light: 'bg-pink-500/20 text-pink-400' },
  { value: 'amber',  label: 'Amber',  bg: 'bg-amber-500',  light: 'bg-amber-500/20 text-amber-400' },
  { value: 'cyan',   label: 'Cyan',   bg: 'bg-cyan-500',   light: 'bg-cyan-500/20 text-cyan-400' },
  { value: 'rose',   label: 'Rose',   bg: 'bg-rose-500',   light: 'bg-rose-500/20 text-rose-400' },
]

function eventColorClass(color: string) {
  return EVENT_COLORS.find(c => c.value === color)?.light ?? 'bg-[#8B5CF6]/20 text-[#A78BFA]'
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
}

function todayStr() {
  const n = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`
}

interface DayModalProps {
  dateStr: string
  holidays: Holiday[]
  festives: FestiveSeason[]
  events: CalendarEvent[]
  onClose: () => void
  onAdd: (title: string, notes: string, color: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function DayModal({ dateStr, holidays, festives, events, onClose, onAdd, onDelete }: DayModalProps) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [color, setColor] = useState('purple')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-MY', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  async function handleAdd() {
    if (!title.trim()) return
    setSaving(true)
    await onAdd(title.trim(), notes.trim(), color)
    setTitle('')
    setNotes('')
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await onDelete(id)
    setDeletingId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#141417] border border-[#2A2A30] rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-[#2A2A30]">
          <div>
            <p className="text-[#F0EEF6] font-semibold">{dateLabel}</p>
            {festives.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {festives.map(f => (
                  <span key={f.name} className={`text-[10px] px-2 py-0.5 rounded-full border ${f.color.replace('bg-', 'border-').replace('/10', '/30').replace('/15', '/30')} ${f.textColor}`}>
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-[#5A5865] hover:text-[#F0EEF6] transition-colors ml-3 mt-0.5">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Public holidays */}
          {holidays.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[#5A5865] text-[10px] uppercase tracking-wider">Public Holidays</p>
              {holidays.map(h => (
                <div key={h.date + h.name} className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <Flag size={12} className="text-rose-400 shrink-0" />
                  <span className="text-rose-300 text-sm">{h.name}</span>
                  <span className="text-[#5A5865] text-[10px] ml-auto">{h.country}</span>
                </div>
              ))}
            </div>
          )}

          {/* Existing events */}
          {events.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[#5A5865] text-[10px] uppercase tracking-wider">Planned Events</p>
              {events.map(ev => (
                <div key={ev.id} className={`flex items-start gap-2 rounded-lg px-3 py-2.5 ${eventColorClass(ev.color)}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{ev.title}</p>
                    {ev.notes && <p className="text-xs opacity-70 mt-0.5 leading-relaxed">{ev.notes}</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(ev.id)}
                    disabled={deletingId === ev.id}
                    className="text-current opacity-50 hover:opacity-100 shrink-0 mt-0.5"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add event form */}
          <div className="space-y-3 pt-1">
            <p className="text-[#5A5865] text-[10px] uppercase tracking-wider">Add Event</p>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Event title (e.g. Halloween Party, CNY Theme Night)"
              className="input w-full text-sm"
            />
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional) — theme, artists, promo ideas..."
              rows={2}
              className="input w-full text-sm resize-none"
            />
            <div className="flex items-center gap-2">
              {EVENT_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-6 h-6 rounded-full ${c.bg} transition-all ${color === c.value ? 'ring-2 ring-offset-2 ring-offset-[#141417] ring-white/50 scale-110' : 'opacity-50'}`}
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

  const holidays = getHolidaysForMonth(year, month)
  const festivesInMonth = getFestivesForMonth(year, month)
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

  useEffect(() => {
    fetchEvents(month, year)
  }, [month, year, fetchEvents])

  const navigate = (dir: -1 | 1) => {
    let m = month + dir
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m)
    setYear(y)
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
    if (res.ok) {
      setEvents(prev => prev.filter(e => e.id !== id))
    }
  }

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7

  const holidayByDate = new Map<string, Holiday[]>()
  for (const h of holidays) {
    const arr = holidayByDate.get(h.date) ?? []
    arr.push(h)
    holidayByDate.set(h.date, arr)
  }

  const eventsByDate = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    const arr = eventsByDate.get(ev.date) ?? []
    arr.push(ev)
    eventsByDate.set(ev.date, arr)
  }

  const selectedDateHolidays = selectedDate ? (holidayByDate.get(selectedDate) ?? []) : []
  const selectedDateFestives = selectedDate ? getFestivesForDate(selectedDate) : []
  const selectedDateEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : []

  const totalEvents = events.length

  return (
    <div className="space-y-5">
      <TopBar
        title="Event Calendar"
        subtitle="Planning & public holidays"
        actions={
          <div className="flex items-center gap-1 bg-[#141417] border border-[#2A2A30] rounded-lg px-1 py-1">
            <button onClick={() => navigate(-1)} className="p-1 rounded hover:bg-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-[#F0EEF6] text-xs font-medium px-2 min-w-[120px] text-center">{monthLabel(year, month)}</span>
            <button onClick={() => navigate(1)} className="p-1 rounded hover:bg-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        }
      />

      {/* Festive season banner strip */}
      {festivesInMonth.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {festivesInMonth.map(f => (
            <div key={f.name} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium
              ${f.color} ${f.textColor} ${f.color.replace('bg-', 'border-').replace('/10', '/25').replace('/15', '/25')}`}>
              <Calendar size={11} />
              {f.name}
              <span className="opacity-60 text-[10px]">
                {new Date(f.start + 'T12:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                {f.start !== f.end && ` – ${new Date(f.end + 'T12:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div className={`card p-0 overflow-hidden transition-opacity duration-150 ${loading ? 'opacity-60' : ''}`}>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[#2A2A30]">
          {DAY_LABELS.map(d => (
            <div key={d} className={`py-2 text-center text-[10px] font-medium uppercase tracking-wider
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

            const dayHolidays = dateStr ? (holidayByDate.get(dateStr) ?? []) : []
            const dayFestives = dateStr ? getFestivesForDate(dateStr) : []
            const dayEvents = dateStr ? (eventsByDate.get(dateStr) ?? []) : []
            const isToday = dateStr === today
            const isWeekend = i % 7 === 0 || i % 7 === 6
            const topFestive = dayFestives[0]
            const isSelected = dateStr === selectedDate

            return (
              <button
                key={i}
                onClick={() => isCurrentMonth && setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                disabled={!isCurrentMonth}
                className={`relative min-h-[80px] sm:min-h-[96px] p-1.5 text-left border-b border-r border-[#1E1E23] transition-colors
                  ${!isCurrentMonth ? 'opacity-20 cursor-default' : 'cursor-pointer hover:bg-[#1A1A1E]'}
                  ${isSelected ? 'bg-[#8B5CF6]/10 ring-1 ring-inset ring-[#8B5CF6]/40' : ''}
                  ${topFestive && !isSelected ? topFestive.color : ''}
                `}
              >
                {/* Day number */}
                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1
                  ${isToday ? 'bg-[#8B5CF6] text-white' : isWeekend ? 'text-[#8B5CF6]' : 'text-[#9896A4]'}`}>
                  {isCurrentMonth ? dayNum : ''}
                </div>

                {/* Holiday badges */}
                {dayHolidays.slice(0, 1).map(h => (
                  <div key={h.name} className="text-[9px] leading-tight bg-rose-500/20 text-rose-300 rounded px-1 py-0.5 mb-0.5 truncate">
                    {h.name}
                  </div>
                ))}
                {dayHolidays.length > 1 && (
                  <div className="text-[9px] text-rose-400 px-1">+{dayHolidays.length - 1} more</div>
                )}

                {/* Planning events */}
                {dayEvents.slice(0, 2).map(ev => (
                  <div key={ev.id} className={`text-[9px] leading-tight rounded px-1 py-0.5 mb-0.5 truncate ${eventColorClass(ev.color)}`}>
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[9px] text-[#5A5865] px-1">+{dayEvents.length - 2}</div>
                )}

                {/* Add indicator */}
                {isCurrentMonth && dayHolidays.length === 0 && dayEvents.length === 0 && (
                  <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-[#2A2A30]">
                    <Plus size={10} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-[#5A5865] px-1">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-rose-500/20" /><span>Public holiday</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#8B5CF6]" /><span>Today</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#8B5CF6]/20" /><span>Your event</span></div>
        {totalEvents > 0 && (
          <span className="ml-auto text-[#9896A4]">{totalEvents} event{totalEvents !== 1 ? 's' : ''} this month</span>
        )}
      </div>

      {/* Day modal */}
      {selectedDate && (
        <DayModal
          dateStr={selectedDate}
          holidays={selectedDateHolidays}
          festives={selectedDateFestives}
          events={selectedDateEvents}
          onClose={() => setSelectedDate(null)}
          onAdd={handleAdd}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
