'use client'

import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Calendar, TrendingUp, TrendingDown, DollarSign, X, ChevronDown, ChevronUp } from 'lucide-react'

type Event = {
  id: string
  name: string
  event_date: string
  revenue: number
  cost: number
  notes: string | null
  created_at: string
}

type FormState = {
  name: string
  event_date: string
  revenue: string
  cost: string
  notes: string
}

const EMPTY_FORM: FormState = { name: '', event_date: '', revenue: '', cost: '', notes: '' }

function fmt(n: number) {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

function MarginBadge({ revenue, cost }: { revenue: number; cost: number }) {
  if (revenue === 0) return null
  const margin = ((revenue - cost) / revenue) * 100
  const color = margin >= 60 ? 'text-emerald-400 bg-emerald-400/10' : margin >= 30 ? 'text-amber-400 bg-amber-400/10' : 'text-red-400 bg-red-400/10'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {margin.toFixed(0)}% margin
    </span>
  )
}

export function EventsClient({ initialEvents, isAdmin }: { initialEvents: Event[]; isAdmin: boolean }) {
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [error, setError] = useState('')

  const years = useMemo(() => {
    const s = new Set(events.map(e => e.event_date.slice(0, 4)))
    return Array.from(s).sort((a, b) => Number(b) - Number(a))
  }, [events])

  const filtered = useMemo(() => {
    if (yearFilter === 'all') return events
    return events.filter(e => e.event_date.startsWith(yearFilter))
  }, [events, yearFilter])

  const totals = useMemo(() => {
    const revenue = filtered.reduce((s, e) => s + e.revenue, 0)
    const cost = filtered.reduce((s, e) => s + e.cost, 0)
    return { revenue, cost, profit: revenue - cost }
  }, [filtered])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  function openEdit(ev: Event) {
    setEditing(ev)
    setForm({
      name: ev.name,
      event_date: ev.event_date,
      revenue: String(ev.revenue),
      cost: String(ev.cost),
      notes: ev.notes ?? '',
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.event_date) { setError('Name and date are required'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        id: editing?.id,
        name: form.name.trim(),
        event_date: form.event_date,
        revenue: parseFloat(form.revenue) || 0,
        cost: parseFloat(form.cost) || 0,
        notes: form.notes.trim() || null,
      }
      const res = await fetch('/api/events', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to save'); return }
      if (editing) {
        setEvents(prev => prev.map(e => e.id === editing.id ? { ...e, ...json.data } : e))
      } else {
        setEvents(prev => [json.data, ...prev])
      }
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/events?id=${id}`, { method: 'DELETE' })
    if (res.ok) setEvents(prev => prev.filter(e => e.id !== id))
    setDeleteId(null)
  }

  return (
    <div className="min-h-screen bg-[#0D0D10] text-[#F0EEF6] p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Events</h1>
          <p className="text-sm text-[#8B8A9A] mt-0.5">Track private events, packages & one-off bookings</p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Log Event
          </button>
        )}
      </div>

      {/* Year filter */}
      {years.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setYearFilter('all')}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${yearFilter === 'all' ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white' : 'border-[#2A2A30] text-[#8B8A9A] hover:border-[#8B5CF6]'}`}
          >All</button>
          {years.map(y => (
            <button
              key={y}
              onClick={() => setYearFilter(y)}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${yearFilter === y ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white' : 'border-[#2A2A30] text-[#8B8A9A] hover:border-[#8B5CF6]'}`}
            >{y}</button>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#8B8A9A] text-xs mb-1"><TrendingUp size={14} /> Revenue</div>
          <div className="text-lg font-semibold text-emerald-400">{fmt(totals.revenue)}</div>
        </div>
        <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#8B8A9A] text-xs mb-1"><TrendingDown size={14} /> Cost</div>
          <div className="text-lg font-semibold text-red-400">{fmt(totals.cost)}</div>
        </div>
        <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#8B8A9A] text-xs mb-1"><DollarSign size={14} /> Profit</div>
          <div className={`text-lg font-semibold ${totals.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(totals.profit)}</div>
        </div>
      </div>

      {/* Events list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[#8B8A9A]">
          <Calendar size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No events logged yet</p>
          {isAdmin && <p className="text-xs mt-1">Click "Log Event" to add your first event</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ev => {
            const profit = ev.revenue - ev.cost
            const isExpanded = expanded === ev.id
            return (
              <div key={ev.id} className="bg-[#141417] border border-[#2A2A30] rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-4 py-4 flex items-center gap-3"
                  onClick={() => setExpanded(isExpanded ? null : ev.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{ev.name}</span>
                      <MarginBadge revenue={ev.revenue} cost={ev.cost} />
                    </div>
                    <div className="text-xs text-[#8B8A9A] mt-0.5 flex items-center gap-1">
                      <Calendar size={11} /> {fmtDate(ev.event_date)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-emerald-400">{fmt(ev.revenue)}</div>
                    <div className={`text-xs ${profit >= 0 ? 'text-[#8B8A9A]' : 'text-red-400'}`}>
                      profit {fmt(profit)}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-[#8B8A9A] shrink-0" /> : <ChevronDown size={16} className="text-[#8B8A9A] shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[#2A2A30] pt-3 space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-[#8B8A9A] text-xs mb-0.5">Revenue</div>
                        <div className="font-medium text-emerald-400">{fmt(ev.revenue)}</div>
                      </div>
                      <div>
                        <div className="text-[#8B8A9A] text-xs mb-0.5">Cost</div>
                        <div className="font-medium text-red-400">{fmt(ev.cost)}</div>
                      </div>
                      <div>
                        <div className="text-[#8B8A9A] text-xs mb-0.5">Profit</div>
                        <div className={`font-medium ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(profit)}</div>
                      </div>
                    </div>
                    {ev.notes && (
                      <div className="text-xs text-[#8B8A9A] bg-[#0D0D10] rounded-lg px-3 py-2">{ev.notes}</div>
                    )}
                    {isAdmin && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => openEdit(ev)}
                          className="flex items-center gap-1.5 text-xs text-[#8B8A9A] hover:text-[#F0EEF6] border border-[#2A2A30] px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(ev.id)}
                          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-[#2A2A30] hover:border-red-400/40 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#141417] border border-[#2A2A30] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A30]">
              <h2 className="font-semibold">{editing ? 'Edit Event' : 'Log Event'}</h2>
              <button onClick={() => setShowModal(false)} className="text-[#8B8A9A] hover:text-[#F0EEF6]"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-[#8B8A9A] mb-1 block">Event Name *</label>
                <input
                  className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]"
                  placeholder="e.g. Private Birthday Party, Corporate Booking"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-[#8B8A9A] mb-1 block">Event Date *</label>
                <input
                  type="date"
                  className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]"
                  value={form.event_date}
                  onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#8B8A9A] mb-1 block">Revenue (RM)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]"
                    placeholder="0.00"
                    value={form.revenue}
                    onChange={e => setForm(f => ({ ...f, revenue: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#8B8A9A] mb-1 block">Cost (RM)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]"
                    placeholder="0.00"
                    value={form.cost}
                    onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                  />
                </div>
              </div>
              {/* Live profit preview */}
              {(form.revenue || form.cost) && (
                <div className="bg-[#0D0D10] rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                  <span className="text-[#8B8A9A]">Profit</span>
                  <span className={`font-semibold ${(parseFloat(form.revenue) || 0) - (parseFloat(form.cost) || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmt((parseFloat(form.revenue) || 0) - (parseFloat(form.cost) || 0))}
                  </span>
                </div>
              )}
              <div>
                <label className="text-xs text-[#8B8A9A] mb-1 block">Notes</label>
                <textarea
                  className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6] resize-none"
                  rows={2}
                  placeholder="Inclusions, client name, special notes…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-[#2A2A30] text-[#8B8A9A] hover:text-[#F0EEF6] py-2 rounded-lg text-sm transition-colors"
              >Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >{saving ? 'Saving…' : editing ? 'Save Changes' : 'Log Event'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#141417] border border-[#2A2A30] rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h2 className="font-semibold mb-2">Delete Event?</h2>
            <p className="text-sm text-[#8B8A9A] mb-5">This will permanently remove the event record.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-[#2A2A30] text-[#8B8A9A] py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
