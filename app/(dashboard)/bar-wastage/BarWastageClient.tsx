'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { useToast } from '@/components/ui/Toast'
import { Trash2, Plus, AlertTriangle, FlaskConical, GlassWater, RefreshCw, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Spirit { id: string; name: string; bottle_size_ml: number; full_bottles: number; open_ml: number; used_classics_ml: number }
interface Premix { id: string; name: string; opening_serves: number; produced_serves: number; sold_serves: number }
interface MenuItem { id: string; name: string; stock_qty: number }
interface Glassware { id: string; name: string; quantity: number; cost_per_unit: number; par_level: number; updated_at: string }

interface WastageEntry {
  id: string; date: string; type: string; item_name: string; quantity: number; unit: string
  unit_cost: number; total_cost: number; notes: string | null; recorded_by_name: string | null
}

interface Ingredient { name: string; cost_per_unit: number | null; unit: string }

interface Props {
  isAdmin: boolean
  spirits: Spirit[]
  premixes: Premix[]
  menuItems: MenuItem[]
  glassware: Glassware[]
  ingredients: Ingredient[]
}

const TYPE_LABELS: Record<string, string> = {
  spoilage: 'Spoilage',
  rnd: 'R&D Usage',
  breakage: 'Breakage',
  restock: 'Restock',
}

const TYPE_COLOR: Record<string, string> = {
  spoilage: 'text-rose-400',
  rnd: 'text-violet-400',
  breakage: 'text-amber-400',
  restock: 'text-emerald-400',
}

export function BarWastageClient({ isAdmin, spirits, premixes, menuItems, glassware: initialGlassware, ingredients }: Props) {
  const [tab, setTab] = useState<'spoilage' | 'rnd' | 'glassware'>('spoilage')
  const [entries, setEntries] = useState<WastageEntry[]>([])
  const [glassware, setGlassware] = useState<Glassware[]>(initialGlassware)
  const [summary, setSummary] = useState<{ spoilage: number; rnd: number; breakage: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showGlassForm, setShowGlassForm] = useState(false)
  const [postingId, setPostingId] = useState<string | null>(null)
  const { toast } = useToast()

  // ── Spoilage / R&D form state ────────────────────────────────────
  const [form, setForm] = useState({
    type: 'spoilage' as 'spoilage' | 'rnd' | 'breakage' | 'restock',
    item_name: '', item_id: '', item_table: '',
    quantity: '', unit: '', unit_cost: '', notes: '', date: new Date().toISOString().slice(0, 10),
  })

  // ── Glassware form state ─────────────────────────────────────────
  const [glassForm, setGlassForm] = useState({
    id: '', name: '', quantity: '', cost_per_unit: '', par_level: '', mode: 'add' as 'add' | 'edit',
  })

  // ── Breakage / restock inline form ───────────────────────────────
  const [glassAction, setGlassAction] = useState<{ id: string; type: 'breakage' | 'restock' } | null>(null)
  const [glassQty, setGlassQty] = useState('')
  const [glassNote, setGlassNote] = useState('')

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const typeParam = tab === 'glassware' ? 'breakage' : tab
    const res = await fetch(`/api/bar/wastage?limit=100&type=${typeParam === 'rnd' ? 'rnd' : typeParam}`)
    if (tab === 'glassware') {
      // fetch both breakage and restock
      const [b, r] = await Promise.all([
        fetch('/api/bar/wastage?limit=50&type=breakage').then(x => x.json()),
        fetch('/api/bar/wastage?limit=50&type=restock').then(x => x.json()),
      ])
      setEntries([...(b.entries ?? []), ...(r.entries ?? [])].sort((a, b) => b.date.localeCompare(a.date)))
    } else {
      const data = await res.json()
      setEntries(data.entries ?? [])
    }
    setLoading(false)
  }, [tab])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const fetchSummary = useCallback(async () => {
    const month = new Date().toISOString().slice(0, 7) // YYYY-MM
    const [s, r, b] = await Promise.all([
      fetch(`/api/bar/wastage?limit=500&type=spoilage`).then(x => x.json()),
      fetch(`/api/bar/wastage?limit=500&type=rnd`).then(x => x.json()),
      fetch(`/api/bar/wastage?limit=500&type=breakage`).then(x => x.json()),
    ])
    const sum = (arr: WastageEntry[]) =>
      arr.filter(e => e.date.startsWith(month)).reduce((t, e) => t + e.total_cost, 0)
    setSummary({
      spoilage: sum(s.entries ?? []),
      rnd: sum(r.entries ?? []),
      breakage: sum(b.entries ?? []),
    })
  }, [])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const refreshGlassware = async () => {
    const res = await fetch('/api/bar/glassware')
    const data = await res.json()
    if (data.glassware) setGlassware(data.glassware)
  }

  // ── Item selection helper ────────────────────────────────────────
  const spiritRemainingMl = (s: Spirit) => s.full_bottles * s.bottle_size_ml + s.open_ml - s.used_classics_ml
  const premixLeft = (p: Premix) => p.opening_serves + p.produced_serves - p.sold_serves

  const spoilageItems = [
    ...premixes.map(p => ({ id: p.id, table: 'bar_premixes', label: `[Premix] ${p.name} — ${premixLeft(p)} serves left`, unit: 'serves' })),
    ...menuItems.map(m => ({ id: m.id, table: 'menu_items', label: `[Menu] ${m.name}${m.stock_qty != null ? ` — ${m.stock_qty} pcs` : ''}`, unit: 'pcs' })),
  ]
  const rndItems = [
    ...spirits.map(s => ({ id: s.id, table: 'bar_spirits', label: `[Spirit] ${s.name} — ${spiritRemainingMl(s).toFixed(0)} ml left`, unit: 'ml' })),
    ...premixes.map(p => ({ id: p.id, table: 'bar_premixes', label: `[Premix] ${p.name} — ${premixLeft(p)} serves left`, unit: 'serves' })),
  ]
  const currentItems = tab === 'spoilage' ? spoilageItems : rndItems

  function handleItemSelect(val: string) {
    if (!val) { setForm(f => ({ ...f, item_name: '', item_id: '', item_table: '', unit: '', unit_cost: '' })); return }
    const item = currentItems.find(i => i.id === val)
    if (!item) return
    const cleanName = item.label.replace(/^\[.*?\] /, '').replace(/ — .*$/, '')
    // Look up cost from ingredients table (case-insensitive name match)
    const ing = ingredients.find(i => i.name.toLowerCase() === cleanName.toLowerCase())
    const autoCost = ing?.cost_per_unit ? String(ing.cost_per_unit) : ''
    setForm(f => ({ ...f, item_id: item.id, item_table: item.table, item_name: cleanName, unit: item.unit, unit_cost: autoCost }))
  }

  // ── Submit wastage entry ─────────────────────────────────────────
  async function submitEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!form.item_name || !form.quantity || !form.unit) { toast('Fill all required fields', 'error'); return }
    const res = await fetch('/api/bar/wastage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: tab,
        item_name: form.item_name,
        item_id: form.item_id || null,
        item_table: form.item_table || null,
        quantity: parseFloat(form.quantity),
        unit: form.unit,
        unit_cost: parseFloat(form.unit_cost) || 0,
        notes: form.notes || null,
        date: form.date,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast(data.error ?? 'Failed', 'error'); return }
    toast('Entry recorded', 'success')
    setShowForm(false)
    setForm(f => ({ ...f, item_name: '', item_id: '', item_table: '', quantity: '', unit_cost: '', notes: '' }))
    fetchEntries(); fetchSummary()
  }

  // ── Glassware breakage / restock ─────────────────────────────────
  async function submitGlassAction() {
    if (!glassAction || !glassQty) return
    const glass = glassware.find(g => g.id === glassAction.id)
    if (!glass) return
    const res = await fetch('/api/bar/wastage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: glassAction.type,
        item_name: glass.name,
        item_id: glass.id,
        item_table: 'bar_glassware',
        quantity: parseFloat(glassQty),
        unit: 'pcs',
        unit_cost: glass.cost_per_unit,
        notes: glassNote || null,
        date: new Date().toISOString().slice(0, 10),
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast(data.error ?? 'Failed', 'error'); return }
    toast(glassAction.type === 'breakage' ? 'Breakage recorded' : 'Restock recorded', 'success')
    setGlassAction(null); setGlassQty(''); setGlassNote('')
    refreshGlassware(); fetchEntries(); fetchSummary()
  }

  // ── Glassware CRUD ───────────────────────────────────────────────
  async function submitGlassType(e: React.FormEvent) {
    e.preventDefault()
    const isEdit = glassForm.mode === 'edit'
    const body = {
      id: glassForm.id || undefined,
      name: glassForm.name,
      quantity: parseFloat(glassForm.quantity) || 0,
      cost_per_unit: parseFloat(glassForm.cost_per_unit) || 0,
      par_level: parseFloat(glassForm.par_level) || 0,
    }
    const res = await fetch('/api/bar/glassware', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { toast(data.error ?? 'Failed', 'error'); return }
    toast(isEdit ? 'Updated' : 'Added', 'success')
    setShowGlassForm(false)
    refreshGlassware()
  }

  async function deleteGlassType(id: string, name: string) {
    if (!confirm(`Delete glass type "${name}"? This won't affect wastage history.`)) return
    const res = await fetch('/api/bar/glassware', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!res.ok) { toast('Failed to delete', 'error'); return }
    toast('Deleted', 'success'); refreshGlassware()
  }

  // ── Post to Expenses ─────────────────────────────────────────────
  async function postToExpenses(entry: WastageEntry) {
    if (!confirm(`Post "${entry.item_name}" (${formatCurrency(entry.total_cost)}) to Expenses?`)) return
    setPostingId(entry.id)
    const res = await fetch('/api/bar/wastage/post-expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wastage_id: entry.id }),
    })
    const data = await res.json()
    setPostingId(null)
    if (!res.ok) { toast(data.error ?? 'Failed', 'error'); return }
    toast('Posted to Expenses', 'success')
  }

  // ── Delete entry ─────────────────────────────────────────────────
  async function deleteEntry(id: string) {
    if (!isAdmin) return
    if (!confirm('Delete this entry?')) return
    const res = await fetch('/api/bar/wastage', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!res.ok) { toast('Failed', 'error'); return }
    toast('Deleted', 'success'); fetchEntries(); fetchSummary()
  }

  // ── Tabs ─────────────────────────────────────────────────────────
  const tabs = [
    { key: 'spoilage' as const, label: 'Spoilage', icon: AlertTriangle },
    { key: 'rnd' as const, label: 'R&D Usage', icon: FlaskConical },
    { key: 'glassware' as const, label: 'Glassware', icon: GlassWater },
  ]

  return (
    <div className="min-h-screen bg-[#0D0D10] text-[#F0EEF6]">
      <TopBar title="Bar Wastage" />

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

        {/* ── Monthly summary ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total This Month', value: summary ? summary.spoilage + summary.rnd + summary.breakage : null, color: 'text-[#F0EEF6]', bg: 'bg-[#1A1A1F]' },
            { label: 'Spoilage', value: summary?.spoilage ?? null, color: 'text-rose-400', bg: 'bg-rose-500/5' },
            { label: 'R&D Usage', value: summary?.rnd ?? null, color: 'text-violet-400', bg: 'bg-violet-500/5' },
            { label: 'Breakage', value: summary?.breakage ?? null, color: 'text-amber-400', bg: 'bg-amber-500/5' },
          ].map(card => (
            <div key={card.label} className={`${card.bg} border border-[#2A2A30] rounded-xl p-4`}>
              <p className="text-xs text-[#9997A3] mb-1">{card.label}</p>
              <p className={`text-xl font-bold tabular-nums ${card.color}`}>
                {card.value === null ? <span className="text-[#9997A3] text-sm">—</span> : formatCurrency(card.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Glassware below-par alert */}
        {glassware.filter(g => g.par_level > 0 && g.quantity < g.par_level).length > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400 cursor-pointer"
            onClick={() => setTab('glassware')}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>{glassware.filter(g => g.par_level > 0 && g.quantity < g.par_level).length}</strong> glass {glassware.filter(g => g.par_level > 0 && g.quantity < g.par_level).length === 1 ? 'type' : 'types'} below par level —&nbsp;
              {glassware.filter(g => g.par_level > 0 && g.quantity < g.par_level).map(g => g.name).join(', ')}
            </span>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 bg-[#141417] rounded-xl p-1 border border-[#2A2A30]">
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setShowForm(false) }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-[#8B5CF6] text-white' : 'text-[#9997A3] hover:text-[#F0EEF6]'}`}>
                <Icon className="w-4 h-4" />{t.label}
              </button>
            )
          })}
        </div>

        {/* ── GLASSWARE TAB ──────────────────────────────────────────── */}
        {tab === 'glassware' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Glassware Inventory</h2>
              <button onClick={() => { setGlassForm({ id: '', name: '', quantity: '', cost_per_unit: '', par_level: '', mode: 'add' }); setShowGlassForm(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7B5EA7] rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> Add Type
              </button>
            </div>

            {/* Inventory cards */}
            {glassware.length === 0 ? (
              <div className="bg-[#141417] border border-[#2A2A30] rounded-xl px-4 py-10 text-center text-[#9997A3] text-sm">No glass types yet. Add one above.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {glassware.map(g => {
                  const below = g.par_level > 0 && g.quantity < g.par_level
                  const fillPct = g.par_level > 0 ? Math.min(100, Math.round((g.quantity / g.par_level) * 100)) : 100
                  return (
                    <div key={g.id} className={`bg-[#141417] border rounded-xl p-4 space-y-3 ${below ? 'border-amber-500/40' : 'border-[#2A2A30]'}`}>
                      {/* Name + status */}
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{g.name}</span>
                        {below
                          ? <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Below Par</span>
                          : <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">OK</span>}
                      </div>

                      {/* Big qty display */}
                      <div className="flex items-end gap-3">
                        <span className={`text-4xl font-bold tabular-nums ${below ? 'text-amber-400' : 'text-emerald-400'}`}>{g.quantity}</span>
                        <span className="text-[#9997A3] text-sm mb-1.5">pcs in stock</span>
                      </div>

                      {/* Fill bar */}
                      {g.par_level > 0 && (
                        <div>
                          <div className="flex justify-between text-xs text-[#9997A3] mb-1">
                            <span>Par level: {g.par_level}</span>
                            <span>{fillPct}%</span>
                          </div>
                          <div className="h-2 bg-[#0D0D10] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${below ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${fillPct}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Cost + actions */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-[#9997A3]">{g.cost_per_unit > 0 ? `${formatCurrency(g.cost_per_unit)}/pc` : 'No cost set'}</span>
                        <div className="flex gap-1">
                          <button onClick={() => { setGlassAction({ id: g.id, type: 'breakage' }); setGlassQty('') }}
                            className="px-2.5 py-1 text-xs rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-medium">Breakage</button>
                          <button onClick={() => { setGlassAction({ id: g.id, type: 'restock' }); setGlassQty('') }}
                            className="px-2.5 py-1 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-medium">
                            <RefreshCw className="w-3 h-3 inline mr-1" />Restock
                          </button>
                          {isAdmin && (
                            <>
                              <button onClick={() => { setGlassForm({ id: g.id, name: g.name, quantity: String(g.quantity), cost_per_unit: String(g.cost_per_unit), par_level: String(g.par_level), mode: 'edit' }); setShowGlassForm(true) }}
                                className="px-2.5 py-1 text-xs rounded-lg bg-[#2A2A30] hover:bg-[#333340]">Edit</button>
                              <button onClick={() => deleteGlassType(g.id, g.name)}
                                className="px-2.5 py-1 text-xs rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Inline breakage/restock form */}
            {glassAction && (() => {
              const glass = glassware.find(g => g.id === glassAction.id)
              return glass ? (
                <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4 space-y-3">
                  <h3 className={`font-semibold ${glassAction.type === 'breakage' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {glassAction.type === 'breakage' ? 'Record Breakage' : 'Record Restock'} — {glass.name}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#9997A3] mb-1">Quantity (pcs)</label>
                      <input type="number" min="1" value={glassQty} onChange={e => setGlassQty(e.target.value)}
                        className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]" />
                    </div>
                    {glassAction.type === 'breakage' && glass.cost_per_unit > 0 && (
                      <div className="flex items-end">
                        <p className="text-sm text-[#9997A3]">Est. cost: <span className="text-rose-400 font-semibold">{formatCurrency((parseFloat(glassQty) || 0) * glass.cost_per_unit)}</span></p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-[#9997A3] mb-1">Notes (optional)</label>
                    <input type="text" value={glassNote} onChange={e => setGlassNote(e.target.value)}
                      className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={submitGlassAction} disabled={!glassQty}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-[#8B5CF6] hover:bg-[#7B5EA7] disabled:opacity-40">Confirm</button>
                    <button onClick={() => { setGlassAction(null); setGlassQty(''); setGlassNote('') }}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-[#2A2A30] hover:bg-[#333340]">Cancel</button>
                  </div>
                </div>
              ) : null
            })()}

            {/* Add / edit glass type form */}
            {showGlassForm && (
              <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
                <h3 className="font-semibold mb-3">{glassForm.mode === 'edit' ? 'Edit Glass Type' : 'Add Glass Type'}</h3>
                <form onSubmit={submitGlassType} className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-[#9997A3] mb-1">Name *</label>
                    <input required value={glassForm.name} onChange={e => setGlassForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9997A3] mb-1">Current Qty</label>
                    <input type="number" min="0" value={glassForm.quantity} onChange={e => setGlassForm(f => ({ ...f, quantity: e.target.value }))}
                      className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9997A3] mb-1">Par Level</label>
                    <input type="number" min="0" value={glassForm.par_level} onChange={e => setGlassForm(f => ({ ...f, par_level: e.target.value }))}
                      className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9997A3] mb-1">Cost per piece (RM)</label>
                    <input type="number" min="0" step="0.01" value={glassForm.cost_per_unit} onChange={e => setGlassForm(f => ({ ...f, cost_per_unit: e.target.value }))}
                      className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]" />
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-[#8B5CF6] hover:bg-[#7B5EA7]">
                      {glassForm.mode === 'edit' ? 'Save Changes' : 'Add'}
                    </button>
                    <button type="button" onClick={() => setShowGlassForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#2A2A30] hover:bg-[#333340]">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* Breakage + Restock logs side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlassLog title="Breakage History" type="breakage" entries={entries} loading={loading} isAdmin={isAdmin} onDelete={deleteEntry} onPost={postToExpenses} postingId={postingId} />
              <GlassLog title="Restock History" type="restock" entries={entries} loading={loading} isAdmin={isAdmin} onDelete={deleteEntry} onPost={postToExpenses} postingId={postingId} />
            </div>
          </div>
        )}

        {/* ── SPOILAGE / R&D TAB ─────────────────────────────────────── */}
        {(tab === 'spoilage' || tab === 'rnd') && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowForm(f => !f)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#8B5CF6] hover:bg-[#7B5EA7] rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> Log Entry
              </button>
            </div>

            {showForm && (
              <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-4">
                <h3 className="font-semibold mb-3">{tab === 'spoilage' ? 'Log Spoilage' : 'Log R&D Usage'}</h3>
                <form onSubmit={submitEntry} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-[#9997A3] mb-1">Item *</label>
                      <select onChange={e => handleItemSelect(e.target.value)} defaultValue=""
                        className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]">
                        <option value="">Select item…</option>
                        {currentItems.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
                        <option value="__manual__">— Enter manually —</option>
                      </select>
                    </div>
                    {(form.item_id === '__manual__' || !form.item_id) && (
                      <div className="col-span-2">
                        <label className="block text-xs text-[#9997A3] mb-1">Item name (manual)</label>
                        <input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value, item_id: '', item_table: '' }))}
                          className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]" />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-[#9997A3] mb-1">Quantity *</label>
                      <input required type="number" min="0" step="any" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                        className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#9997A3] mb-1">Unit *</label>
                      <input required value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                        placeholder="ml / serves / pcs"
                        className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#9997A3] mb-1">Unit Cost (RM)</label>
                      <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))}
                        className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#9997A3] mb-1">Date</label>
                      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-[#9997A3] mb-1">Notes</label>
                      <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B5CF6]" />
                    </div>
                  </div>
                  {form.quantity && form.unit_cost && (
                    <p className="text-xs text-[#9997A3]">Total cost: <span className="text-rose-400 font-semibold">{formatCurrency(parseFloat(form.quantity) * parseFloat(form.unit_cost))}</span></p>
                  )}
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-[#8B5CF6] hover:bg-[#7B5EA7]">Save</button>
                    <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#2A2A30] hover:bg-[#333340]">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <WastageLog entries={entries} loading={loading} isAdmin={isAdmin} onDelete={deleteEntry} onPost={postToExpenses} postingId={postingId} />
          </div>
        )}
      </div>
    </div>
  )
}

function GlassLog({ title, type, entries, loading, isAdmin, onDelete, onPost, postingId }: {
  title: string; type: 'breakage' | 'restock'
  entries: WastageEntry[]; loading: boolean; isAdmin: boolean
  onDelete: (id: string) => void; onPost: (entry: WastageEntry) => void; postingId: string | null
}) {
  const filtered = entries.filter(e => e.type === type)
  const totalQty = filtered.reduce((s, e) => s + e.quantity, 0)
  const totalCost = filtered.reduce((s, e) => s + e.total_cost, 0)
  const isBreakage = type === 'breakage'

  return (
    <div className="bg-[#141417] border border-[#2A2A30] rounded-xl overflow-hidden">
      <div className={`p-4 border-b border-[#2A2A30] flex items-center justify-between ${isBreakage ? 'bg-rose-500/5' : 'bg-emerald-500/5'}`}>
        <h3 className={`font-semibold ${isBreakage ? 'text-rose-400' : 'text-emerald-400'}`}>{title}</h3>
        <div className="text-right">
          <p className="text-xs text-[#9997A3]">{filtered.length} entries · {totalQty} pcs</p>
          {totalCost > 0 && <p className={`text-sm font-semibold tabular-nums ${isBreakage ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(totalCost)}</p>}
        </div>
      </div>
      {loading ? (
        <div className="py-8 text-center text-[#9997A3] text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-[#9997A3] text-sm">No entries yet.</div>
      ) : (
        <div className="divide-y divide-[#1E1E24]">
          {filtered.map(e => (
            <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{e.item_name}</p>
                <p className="text-xs text-[#9997A3]">{e.date} · {e.quantity} pcs{e.recorded_by_name ? ` · ${e.recorded_by_name}` : ''}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {e.total_cost > 0 && (
                  <span className={`text-sm tabular-nums font-semibold ${isBreakage ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(e.total_cost)}</span>
                )}
                {e.total_cost > 0 && (
                  <button onClick={() => onPost(e)} disabled={postingId === e.id}
                    className="px-1.5 py-1 text-xs rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40">
                    <DollarSign className="w-3 h-3" />
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => onDelete(e.id)} className="px-1.5 py-1 text-xs rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WastageLog({ entries, loading, isAdmin, onDelete, onPost, postingId }: {
  entries: WastageEntry[]
  loading: boolean
  isAdmin: boolean
  onDelete: (id: string) => void
  onPost: (entry: WastageEntry) => void
  postingId: string | null
}) {
  if (loading) return <div className="text-center py-12 text-[#9997A3] text-sm">Loading…</div>
  if (entries.length === 0) return <div className="text-center py-12 text-[#9997A3] text-sm">No entries yet.</div>

  return (
    <div className="bg-[#141417] border border-[#2A2A30] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[#2A2A30]">
        <h2 className="font-semibold">Log</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2A30] text-[#9997A3]">
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Item</th>
              <th className="text-right px-4 py-2">Qty</th>
              <th className="text-right px-4 py-2">Cost</th>
              <th className="text-left px-4 py-2">By</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b border-[#1E1E24] hover:bg-[#1A1A1F]">
                <td className="px-4 py-3 text-[#9997A3]">{e.date}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${TYPE_COLOR[e.type] ?? 'text-[#9997A3]'}`}>{TYPE_LABELS[e.type] ?? e.type}</span>
                </td>
                <td className="px-4 py-3 font-medium max-w-[160px] truncate">{e.item_name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{e.quantity} {e.unit}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {e.total_cost > 0 ? <span className="text-rose-400">{formatCurrency(e.total_cost)}</span> : <span className="text-[#9997A3]">—</span>}
                </td>
                <td className="px-4 py-3 text-[#9997A3] text-xs">{e.recorded_by_name ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {e.total_cost > 0 && (
                      <button onClick={() => onPost(e)} disabled={postingId === e.id}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40">
                        <DollarSign className="w-3 h-3" />{postingId === e.id ? '…' : 'Post'}
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => onDelete(e.id)} className="px-2 py-1 text-xs rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
