'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import {
  FlaskConical, Layers, BarChart3, BookOpen, AlertTriangle,
  Plus, ChevronDown, Wine, Beaker, Package2, ClipboardList,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type Spirit = {
  id: string; name: string; category: string; bottle_size_ml: number
  full_bottles: number; open_ml: number; used_classics_ml: number
}
type Recipe = {
  id: string; premix_name: string; ingredient_name: string
  ingredient_type: 'infusion' | 'spirit'; ml_per_serve: number
}
type Infusion = {
  id: string; name: string; base_spirit: string | null; notes: string | null
  opening_ml: number; produced_ml: number; used_premix_ml: number; wasted_ml: number
  ml_per_serve: number | null
}
type Premix = {
  id: string; name: string; cocktail_name: string | null; category: string | null
  opening_serves: number; produced_serves: number; sold_serves: number
  ml_per_serve: number; storage: string | null
}
type Activity = {
  id: string; logged_at: string; week_number: number | null
  activity_type: string; product: string; qty: number; vol_ml: number | null
  notes: string | null; spirit_1: string | null; vol_1: number | null
  spirit_2: string | null; vol_2: number | null; spirit_3: string | null; vol_3: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const spiritTotalMl = (s: Spirit) => s.full_bottles * s.bottle_size_ml + s.open_ml
const spiritRemainingMl = (s: Spirit) => spiritTotalMl(s) - s.used_classics_ml
const infusionBalance = (i: Infusion) => i.opening_ml + i.produced_ml - i.used_premix_ml - i.wasted_ml
const infusionServes = (i: Infusion) =>
  i.ml_per_serve && i.ml_per_serve > 0 ? Math.floor(infusionBalance(i) / i.ml_per_serve) : null
const premixLeft = (p: Premix) => p.opening_serves + p.produced_serves - p.sold_serves
const weekNumber = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 1)
  return Math.ceil(((date.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
}

const StatusBadge = ({ ok, label }: { ok: boolean; label?: string }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
    {ok ? '✓' : '⚠'} {label ?? (ok ? 'OK' : 'LOW')}
  </span>
)

const TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'spirits', label: 'Spirits', icon: Wine },
  { key: 'infusions', label: 'Infusions', icon: Beaker },
  { key: 'premixes', label: 'Premixes', icon: Package2 },
  { key: 'activity', label: 'Activity', icon: ClipboardList },
] as const
type Tab = typeof TABS[number]['key']

const ACTIVITY_TYPES = ['Sales', 'Infusion Made', 'Premix Made', 'Bottle Sale', 'Classic'] as const

// ── Main Component ────────────────────────────────────────────────────────────

export function BarInventoryClient({
  initialSpirits, initialInfusions, initialPremixes, initialActivities, recipes,
}: {
  initialSpirits: Spirit[]
  initialInfusions: Infusion[]
  initialPremixes: Premix[]
  initialActivities: Activity[]
  recipes: Recipe[]
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('overview')
  const [spirits, setSpirits] = useState(initialSpirits)
  const [infusions, setInfusions] = useState(initialInfusions)
  const [premixes, setPremixes] = useState(initialPremixes)
  const [activities, setActivities] = useState(initialActivities)
  const [logOpen, setLogOpen] = useState(false)
  const [editSpirit, setEditSpirit] = useState<Spirit | null>(null)
  const [editInfusion, setEditInfusion] = useState<Infusion | null>(null)
  const [editPremix, setEditPremix] = useState<Premix | null>(null)
  const [loading, setLoading] = useState(false)
  const [spiritFilter, setSpiritFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')

  // Log activity form
  const [logForm, setLogForm] = useState({
    activity_type: 'Sales' as typeof ACTIVITY_TYPES[number],
    product: '',
    qty: '1',
    vol_ml: '',
    notes: '',
    spirit_1: '', vol_1: '', spirit_2: '', vol_2: '', spirit_3: '', vol_3: '',
    logged_at: new Date().toISOString().slice(0, 16),
  })

  // ── Computed stats ──────────────────────────────────────────────────────────

  const lowSpirits = spirits.filter(s => spiritRemainingMl(s) < 300)
  const lowInfusions = infusions.filter(i => {
    const bal = infusionBalance(i)
    return bal < 100
  })
  const lowPremixes = premixes.filter(p => premixLeft(p) <= 3)
  const totalLow = lowSpirits.length + lowInfusions.length + lowPremixes.length

  const currentWeek = weekNumber(new Date())
  const thisWeekActivities = activities.filter(a => a.week_number === currentWeek)
  const thisWeekSales = thisWeekActivities.filter(a => a.activity_type === 'Sales' || a.activity_type === 'Classic')
  const totalSolvedThisWeek = thisWeekSales.reduce((sum, a) => sum + a.qty, 0)

  const allCategories = ['All', ...Array.from(new Set(spirits.map(s => s.category))).sort()]
  const filteredSpirits = spirits.filter(s => {
    const matchCat = categoryFilter === 'All' || s.category === categoryFilter
    const matchSearch = s.name.toLowerCase().includes(spiritFilter.toLowerCase())
    return matchCat && matchSearch
  })

  // ── Product options per activity type ──────────────────────────────────────
  const productOptions = () => {
    switch (logForm.activity_type) {
      case 'Sales': return premixes.map(p => p.cocktail_name ?? p.name)
      case 'Infusion Made': return infusions.map(i => i.name)
      case 'Premix Made': return premixes.map(p => p.name)
      case 'Bottle Sale': return spirits.filter(s => s.category === 'Wine').map(s => s.name)
      case 'Classic': return ['Negroni', 'Old Fashioned', 'Margarita', 'Gin & Tonic', 'Whisky Sour', 'Other']
      default: return []
    }
  }

  // ── Log Activity ────────────────────────────────────────────────────────────
  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const loggedAt = new Date(logForm.logged_at)
      const wk = weekNumber(loggedAt)
      const qty = parseInt(logForm.qty) || 1
      const volMl = parseInt(logForm.vol_ml) || null

      const { data: newActivity, error: insertError } = await supabase
        .from('bar_activity_log')
        .insert({
          logged_at: loggedAt.toISOString(),
          week_number: wk,
          activity_type: logForm.activity_type,
          product: logForm.product,
          qty,
          vol_ml: volMl,
          notes: logForm.notes || null,
          spirit_1: logForm.spirit_1 || null,
          vol_1: parseInt(logForm.vol_1) || null,
          spirit_2: logForm.spirit_2 || null,
          vol_2: parseInt(logForm.vol_2) || null,
          spirit_3: logForm.spirit_3 || null,
          vol_3: parseInt(logForm.vol_3) || null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Update inventory based on activity type
      if (logForm.activity_type === 'Sales') {
        const premix = premixes.find(p =>
          p.cocktail_name?.toLowerCase() === logForm.product.toLowerCase() ||
          p.name.toLowerCase().includes(logForm.product.toLowerCase())
        )
        if (premix) {
          await supabase.from('bar_premixes')
            .update({ sold_serves: premix.sold_serves + qty })
            .eq('id', premix.id)
          setPremixes(prev => prev.map(p => p.id === premix.id ? { ...p, sold_serves: p.sold_serves + qty } : p))
        }
      } else if (logForm.activity_type === 'Infusion Made' && volMl) {
        const infusion = infusions.find(i => i.name.toLowerCase() === logForm.product.toLowerCase())
        if (infusion) {
          await supabase.from('bar_infusions')
            .update({ produced_ml: infusion.produced_ml + volMl })
            .eq('id', infusion.id)
          setInfusions(prev => prev.map(i => i.id === infusion.id ? { ...i, produced_ml: i.produced_ml + volMl } : i))
        }
      } else if (logForm.activity_type === 'Premix Made') {
        const premix = premixes.find(p => p.name.toLowerCase() === logForm.product.toLowerCase())
        if (premix) {
          await supabase.from('bar_premixes')
            .update({ produced_serves: premix.produced_serves + qty })
            .eq('id', premix.id)
          setPremixes(prev => prev.map(p => p.id === premix.id ? { ...p, produced_serves: p.produced_serves + qty } : p))
        }

        // Auto-deduct ingredients based on recipe
        const premixRecipes = recipes.filter(r => r.premix_name.toLowerCase() === logForm.product.toLowerCase())
        const deductionSummary: string[] = []
        for (const r of premixRecipes) {
          const totalMl = r.ml_per_serve * qty
          if (r.ingredient_type === 'infusion') {
            const infusion = infusions.find(i => i.name.toLowerCase() === r.ingredient_name.toLowerCase())
            if (infusion) {
              await supabase.from('bar_infusions')
                .update({ used_premix_ml: infusion.used_premix_ml + totalMl })
                .eq('id', infusion.id)
              setInfusions(prev => prev.map(i => i.id === infusion.id ? { ...i, used_premix_ml: i.used_premix_ml + totalMl } : i))
              deductionSummary.push(`${r.ingredient_name} −${totalMl}ml`)
            }
          } else if (r.ingredient_type === 'spirit') {
            const spirit = spirits.find(s => s.name.toLowerCase() === r.ingredient_name.toLowerCase())
            if (spirit) {
              await supabase.from('bar_spirits')
                .update({ used_classics_ml: spirit.used_classics_ml + totalMl })
                .eq('id', spirit.id)
              setSpirits(prev => prev.map(s => s.id === spirit.id ? { ...s, used_classics_ml: s.used_classics_ml + totalMl } : s))
              deductionSummary.push(`${r.ingredient_name} −${totalMl}ml`)
            }
          }
        }
        if (deductionSummary.length > 0) {
          toast(`Deducted: ${deductionSummary.slice(0, 3).join(', ')}${deductionSummary.length > 3 ? ` +${deductionSummary.length - 3} more` : ''}`, 'info')
        }
      } else if (logForm.activity_type === 'Classic') {
        // Update used_classics_ml for each spirit
        const updates: { name: string; vol: number }[] = []
        if (logForm.spirit_1 && logForm.vol_1) updates.push({ name: logForm.spirit_1, vol: parseInt(logForm.vol_1) * qty })
        if (logForm.spirit_2 && logForm.vol_2) updates.push({ name: logForm.spirit_2, vol: parseInt(logForm.vol_2) * qty })
        if (logForm.spirit_3 && logForm.vol_3) updates.push({ name: logForm.spirit_3, vol: parseInt(logForm.vol_3) * qty })

        for (const u of updates) {
          const spirit = spirits.find(s => s.name.toLowerCase() === u.name.toLowerCase())
          if (spirit) {
            await supabase.from('bar_spirits')
              .update({ used_classics_ml: spirit.used_classics_ml + u.vol })
              .eq('id', spirit.id)
            setSpirits(prev => prev.map(s => s.id === spirit.id ? { ...s, used_classics_ml: s.used_classics_ml + u.vol } : s))
          }
        }
      }

      setActivities(prev => [newActivity as Activity, ...prev])
      toast('Activity logged', 'success')
      setLogOpen(false)
      setLogForm(f => ({ ...f, product: '', qty: '1', vol_ml: '', notes: '', spirit_1: '', vol_1: '', spirit_2: '', vol_2: '', spirit_3: '', vol_3: '' }))
    } catch (err: any) {
      toast(err.message ?? 'Failed to log activity', 'error')
    }
    setLoading(false)
  }

  // ── Edit Spirit ─────────────────────────────────────────────────────────────
  const saveSpirit = async (s: Spirit) => {
    setLoading(true)
    const { error } = await supabase.from('bar_spirits').update({
      full_bottles: s.full_bottles, open_ml: s.open_ml, used_classics_ml: s.used_classics_ml,
    }).eq('id', s.id)
    if (error) toast(error.message, 'error')
    else {
      setSpirits(prev => prev.map(x => x.id === s.id ? s : x))
      toast('Spirit updated', 'success')
      setEditSpirit(null)
    }
    setLoading(false)
  }

  // ── Edit Infusion ───────────────────────────────────────────────────────────
  const saveInfusion = async (i: Infusion) => {
    setLoading(true)
    const { error } = await supabase.from('bar_infusions').update({
      opening_ml: i.opening_ml, produced_ml: i.produced_ml,
      used_premix_ml: i.used_premix_ml, wasted_ml: i.wasted_ml,
    }).eq('id', i.id)
    if (error) toast(error.message, 'error')
    else {
      setInfusions(prev => prev.map(x => x.id === i.id ? i : x))
      toast('Infusion updated', 'success')
      setEditInfusion(null)
    }
    setLoading(false)
  }

  // ── Edit Premix ─────────────────────────────────────────────────────────────
  const savePremix = async (p: Premix) => {
    setLoading(true)
    const { error } = await supabase.from('bar_premixes').update({
      opening_serves: p.opening_serves, produced_serves: p.produced_serves, sold_serves: p.sold_serves,
    }).eq('id', p.id)
    if (error) toast(error.message, 'error')
    else {
      setPremixes(prev => prev.map(x => x.id === p.id ? p : x))
      toast('Premix updated', 'success')
      setEditPremix(null)
    }
    setLoading(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <TopBar
        title="Bar Inventory"
        subtitle={`Week ${currentWeek} · ${totalLow > 0 ? `${totalLow} items low` : 'All stocked'}`}
        actions={
          <button onClick={() => setLogOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Log Activity
          </button>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === key ? 'bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/20' : 'text-[#9896A4] hover:text-[#F0EEF6] border border-transparent'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Cocktails sold this week', value: totalSolvedThisWeek, sub: `Week ${currentWeek}` },
              { label: 'Premixes on menu', value: premixes.filter(p => premixLeft(p) > 3).length, sub: `of ${premixes.length}` },
              { label: 'Infusions available', value: infusions.filter(i => infusionBalance(i) > 0).length, sub: `of ${infusions.length}` },
              { label: 'Low stock alerts', value: totalLow, sub: 'spirits + infusions + premixes', warn: totalLow > 0 },
            ].map(({ label, value, sub, warn }) => (
              <div key={label} className={`card-hover ${warn && value > 0 ? 'border-amber-500/30' : ''}`}>
                <p className="text-[#9896A4] text-xs mb-1">{label}</p>
                <p className={`text-2xl font-bold ${warn && value > 0 ? 'text-amber-400' : 'text-[#F0EEF6]'}`}>{value}</p>
                <p className="text-[#5A5865] text-[10px] mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Low stock alerts */}
          {totalLow > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400" />
                <p className="text-amber-400 text-sm font-medium">Low stock items</p>
              </div>
              {lowPremixes.length > 0 && (
                <div>
                  <p className="text-[#9896A4] text-xs mb-1.5">Premixes ≤ 3 serves</p>
                  <div className="flex flex-wrap gap-2">
                    {lowPremixes.map(p => (
                      <span key={p.id} className="badge-yellow text-xs">{p.cocktail_name ?? p.name}: {premixLeft(p)} serves</span>
                    ))}
                  </div>
                </div>
              )}
              {lowInfusions.length > 0 && (
                <div>
                  <p className="text-[#9896A4] text-xs mb-1.5">Infusions &lt; 100ml</p>
                  <div className="flex flex-wrap gap-2">
                    {lowInfusions.map(i => (
                      <span key={i.id} className="badge-yellow text-xs">{i.name}: {infusionBalance(i)}ml</span>
                    ))}
                  </div>
                </div>
              )}
              {lowSpirits.length > 0 && (
                <div>
                  <p className="text-[#9896A4] text-xs mb-1.5">Spirits &lt; 300ml remaining</p>
                  <div className="flex flex-wrap gap-2">
                    {lowSpirits.map(s => (
                      <span key={s.id} className="badge-yellow text-xs">{s.name}: {spiritRemainingMl(s)}ml</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cocktail sales this week */}
          {thisWeekSales.length > 0 && (
            <div className="card-hover">
              <p className="text-[#F0EEF6] text-sm font-medium mb-3">Cocktail Sales — Week {currentWeek}</p>
              <div className="space-y-1.5">
                {Object.entries(
                  thisWeekSales.reduce<Record<string, number>>((acc, a) => {
                    acc[a.product] = (acc[a.product] ?? 0) + a.qty
                    return acc
                  }, {})
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, qty]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-[#9896A4] text-sm">{name}</span>
                      <span className="text-[#F0EEF6] font-semibold text-sm">{qty} sold</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Premix status grid */}
          <div>
            <p className="text-[#9896A4] text-xs mb-2">Premix Status</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {premixes.map(p => {
                const left = premixLeft(p)
                const ok = left > 3
                return (
                  <div key={p.id} className={`rounded-lg border p-3 ${ok ? 'border-[#2A2A30] bg-[#0D0D0F]' : 'border-amber-500/30 bg-amber-500/5'}`}>
                    <p className="text-[#F0EEF6] text-xs font-medium truncate">{p.cocktail_name ?? p.name}</p>
                    <p className={`text-lg font-bold mt-1 ${ok ? 'text-[#F0EEF6]' : 'text-amber-400'}`}>{left}</p>
                    <p className="text-[#5A5865] text-[10px]">serves · {p.category}</p>
                    {p.storage && <p className="text-[#5A5865] text-[10px]">{p.storage}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── SPIRITS ── */}
      {tab === 'spirits' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              value={spiritFilter}
              onChange={e => setSpiritFilter(e.target.value)}
              placeholder="Search spirits..."
              className="input text-sm py-1.5 w-48"
            />
            <div className="flex gap-1.5 flex-wrap">
              {allCategories.map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${categoryFilter === cat ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#A78BFA]' : 'border-[#2A2A30] text-[#9896A4]'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#2A2A30]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A30] bg-[#0D0D0F]">
                  {['Name', 'Category', 'Full Btl', 'Open ml', 'Total ml', 'Used (Classics)', 'Remaining', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-[#5A5865] text-xs font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSpirits.map(s => {
                  const total = spiritTotalMl(s)
                  const remaining = spiritRemainingMl(s)
                  const isLow = remaining < 300
                  return (
                    <tr key={s.id} className="border-b border-[#1A1A1E] hover:bg-[#0D0D0F] transition-colors">
                      <td className="px-3 py-2.5 text-[#F0EEF6] font-medium whitespace-nowrap">{s.name}</td>
                      <td className="px-3 py-2.5 text-[#9896A4] text-xs whitespace-nowrap">{s.category}</td>
                      <td className="px-3 py-2.5 text-[#9896A4]">{s.full_bottles}</td>
                      <td className="px-3 py-2.5 text-[#9896A4]">{s.open_ml}</td>
                      <td className="px-3 py-2.5 text-[#9896A4]">{total}</td>
                      <td className="px-3 py-2.5 text-[#9896A4]">{s.used_classics_ml}</td>
                      <td className={`px-3 py-2.5 font-semibold ${isLow ? 'text-amber-400' : 'text-[#F0EEF6]'}`}>{remaining}ml</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setEditSpirit({ ...s })} className="text-[#5A5865] hover:text-[#A78BFA] text-xs">Edit</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── INFUSIONS ── */}
      {tab === 'infusions' && (
        <div className="overflow-x-auto rounded-xl border border-[#2A2A30]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2A30] bg-[#0D0D0F]">
                {['Infusion', 'Base Spirit', 'Opening', 'Produced', 'Used', 'Wasted', 'Balance', 'Serves', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[#5A5865] text-xs font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {infusions.map(i => {
                const bal = infusionBalance(i)
                const serves = infusionServes(i)
                const isLow = bal < 100
                return (
                  <tr key={i.id} className="border-b border-[#1A1A1E] hover:bg-[#0D0D0F] transition-colors">
                    <td className="px-3 py-2.5 text-[#F0EEF6] font-medium whitespace-nowrap">{i.name}</td>
                    <td className="px-3 py-2.5 text-[#9896A4] text-xs whitespace-nowrap">{i.base_spirit ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[#9896A4]">{i.opening_ml}</td>
                    <td className="px-3 py-2.5 text-[#9896A4]">{i.produced_ml}</td>
                    <td className="px-3 py-2.5 text-[#9896A4]">{i.used_premix_ml}</td>
                    <td className="px-3 py-2.5 text-[#9896A4]">{i.wasted_ml}</td>
                    <td className={`px-3 py-2.5 font-semibold ${isLow ? 'text-amber-400' : 'text-[#F0EEF6]'}`}>{bal}ml</td>
                    <td className="px-3 py-2.5 text-[#9896A4]">{serves !== null ? serves : '—'}</td>
                    <td className="px-3 py-2.5"><StatusBadge ok={!isLow} /></td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setEditInfusion({ ...i })} className="text-[#5A5865] hover:text-[#A78BFA] text-xs">Edit</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PREMIXES ── */}
      {tab === 'premixes' && (
        <div className="overflow-x-auto rounded-xl border border-[#2A2A30]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2A30] bg-[#0D0D0F]">
                {['Cocktail', 'Category', 'Opening', 'Produced', 'Sold', 'Left', 'ml/serve', 'Storage', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[#5A5865] text-xs font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {premixes.map(p => {
                const left = premixLeft(p)
                const ok = left > 3
                return (
                  <tr key={p.id} className="border-b border-[#1A1A1E] hover:bg-[#0D0D0F] transition-colors">
                    <td className="px-3 py-2.5 text-[#F0EEF6] font-medium whitespace-nowrap">{p.cocktail_name ?? p.name}</td>
                    <td className="px-3 py-2.5 text-[#9896A4] text-xs">{p.category ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[#9896A4]">{p.opening_serves}</td>
                    <td className="px-3 py-2.5 text-[#9896A4]">{p.produced_serves}</td>
                    <td className="px-3 py-2.5 text-[#9896A4]">{p.sold_serves}</td>
                    <td className={`px-3 py-2.5 font-bold text-base ${ok ? 'text-[#F0EEF6]' : 'text-amber-400'}`}>{left}</td>
                    <td className="px-3 py-2.5 text-[#9896A4]">{p.ml_per_serve}</td>
                    <td className="px-3 py-2.5 text-[#9896A4] text-xs">{p.storage ?? '—'}</td>
                    <td className="px-3 py-2.5"><StatusBadge ok={ok} label={ok ? 'ON MENU' : 'LOW'} /></td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setEditPremix({ ...p })} className="text-[#5A5865] hover:text-[#A78BFA] text-xs">Edit</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ACTIVITY LOG ── */}
      {tab === 'activity' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-[#2A2A30]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A30] bg-[#0D0D0F]">
                  {['Date & Time', 'Week', 'Type', 'Product', 'Qty', 'Vol (ml)', 'Notes', 'Spirits Used'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-[#5A5865] text-xs font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activities.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-[#5A5865] text-sm">No activities logged yet</td></tr>
                ) : activities.map(a => (
                  <tr key={a.id} className="border-b border-[#1A1A1E] hover:bg-[#0D0D0F] transition-colors">
                    <td className="px-3 py-2.5 text-[#9896A4] text-xs whitespace-nowrap">
                      {new Date(a.logged_at).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2.5 text-[#9896A4] text-xs">{a.week_number ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        a.activity_type === 'Sales' ? 'bg-emerald-500/10 text-emerald-400' :
                        a.activity_type === 'Infusion Made' ? 'bg-blue-500/10 text-blue-400' :
                        a.activity_type === 'Premix Made' ? 'bg-purple-500/10 text-purple-400' :
                        a.activity_type === 'Classic' ? 'bg-orange-500/10 text-orange-400' :
                        'bg-[#2A2A30] text-[#9896A4]'
                      }`}>{a.activity_type}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[#F0EEF6] whitespace-nowrap">{a.product}</td>
                    <td className="px-3 py-2.5 text-[#9896A4]">{a.qty}</td>
                    <td className="px-3 py-2.5 text-[#9896A4]">{a.vol_ml ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[#9896A4] text-xs">{a.notes ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[#9896A4] text-xs whitespace-nowrap">
                      {[a.spirit_1 && `${a.spirit_1} ${a.vol_1}ml`, a.spirit_2 && `${a.spirit_2} ${a.vol_2}ml`, a.spirit_3 && `${a.spirit_3} ${a.vol_3}ml`].filter(Boolean).join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── LOG ACTIVITY MODAL ── */}
      <Modal isOpen={logOpen} onClose={() => setLogOpen(false)} title="Log Activity" size="md">
        <form onSubmit={handleLogActivity} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date & Time</label>
              <input type="datetime-local" value={logForm.logged_at}
                onChange={e => setLogForm(f => ({ ...f, logged_at: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Activity Type</label>
              <select value={logForm.activity_type}
                onChange={e => setLogForm(f => ({ ...f, activity_type: e.target.value as any, product: '' }))} className="input">
                {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Product</label>
              <select value={logForm.product}
                onChange={e => setLogForm(f => ({ ...f, product: e.target.value }))} className="input" required>
                <option value="">Select product</option>
                {productOptions().filter((v, i, a) => a.indexOf(v) === i).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Qty {logForm.activity_type === 'Premix Made' ? '(serves)' : logForm.activity_type === 'Infusion Made' ? '(batches)' : '(serves)'}</label>
              <input type="number" min="1" value={logForm.qty}
                onChange={e => setLogForm(f => ({ ...f, qty: e.target.value }))} className="input" required />
            </div>
            {(logForm.activity_type === 'Infusion Made' || logForm.activity_type === 'Premix Made') && (
              <div>
                <label className="label">Volume (ml)</label>
                <input type="number" min="0" value={logForm.vol_ml}
                  onChange={e => setLogForm(f => ({ ...f, vol_ml: e.target.value }))} className="input" placeholder="500" />
              </div>
            )}
          </div>

          {logForm.activity_type === 'Classic' && (
            <div className="space-y-2 border border-[#2A2A30] rounded-lg p-3">
              <p className="text-[#9896A4] text-xs font-medium">Spirits Used</p>
              {([1, 2, 3] as const).map(n => (
                <div key={n} className="grid grid-cols-2 gap-2">
                  <select
                    value={logForm[`spirit_${n}` as 'spirit_1']}
                    onChange={e => setLogForm(f => ({ ...f, [`spirit_${n}`]: e.target.value }))}
                    className="input text-xs py-1.5">
                    <option value="">Spirit {n}</option>
                    {spirits.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    {infusions.map(i => <option key={i.id} value={i.name}>{i.name} (infusion)</option>)}
                  </select>
                  <input type="number" min="0" placeholder="ml"
                    value={logForm[`vol_${n}` as 'vol_1']}
                    onChange={e => setLogForm(f => ({ ...f, [`vol_${n}`]: e.target.value }))}
                    className="input text-xs py-1.5" />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="label">Notes</label>
            <input type="text" value={logForm.notes}
              onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} className="input" placeholder="Optional" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setLogOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading || !logForm.product} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving...' : 'Log Activity'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── EDIT SPIRIT MODAL ── */}
      {editSpirit && (
        <Modal isOpen onClose={() => setEditSpirit(null)} title={`Edit: ${editSpirit.name}`} size="sm">
          <div className="space-y-3">
            {[
              { label: 'Full Bottles', key: 'full_bottles' },
              { label: 'Open ml', key: 'open_ml' },
              { label: 'Used in Classics (ml)', key: 'used_classics_ml' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type="number" min="0" value={editSpirit[key as keyof Spirit] as number}
                  onChange={e => setEditSpirit(s => s ? { ...s, [key]: parseInt(e.target.value) || 0 } : s)}
                  className="input" />
              </div>
            ))}
            <div className="bg-[#0D0D0F] rounded-lg p-3 text-xs text-[#9896A4]">
              Total: {spiritTotalMl(editSpirit)}ml · Remaining: {spiritRemainingMl(editSpirit)}ml
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditSpirit(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => saveSpirit(editSpirit)} disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── EDIT INFUSION MODAL ── */}
      {editInfusion && (
        <Modal isOpen onClose={() => setEditInfusion(null)} title={`Edit: ${editInfusion.name}`} size="sm">
          <div className="space-y-3">
            {[
              { label: 'Opening ml', key: 'opening_ml' },
              { label: 'Produced ml', key: 'produced_ml' },
              { label: 'Used in Premix ml', key: 'used_premix_ml' },
              { label: 'Wasted ml', key: 'wasted_ml' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type="number" min="0" value={editInfusion[key as keyof Infusion] as number}
                  onChange={e => setEditInfusion(i => i ? { ...i, [key]: parseInt(e.target.value) || 0 } : i)}
                  className="input" />
              </div>
            ))}
            <div className="bg-[#0D0D0F] rounded-lg p-3 text-xs text-[#9896A4]">
              Balance: {infusionBalance(editInfusion)}ml
              {editInfusion.ml_per_serve ? ` · ${infusionServes(editInfusion)} serves` : ''}
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditInfusion(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => saveInfusion(editInfusion)} disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── EDIT PREMIX MODAL ── */}
      {editPremix && (
        <Modal isOpen onClose={() => setEditPremix(null)} title={`Edit: ${editPremix.cocktail_name ?? editPremix.name}`} size="sm">
          <div className="space-y-3">
            {[
              { label: 'Opening Serves', key: 'opening_serves' },
              { label: 'Produced Serves', key: 'produced_serves' },
              { label: 'Sold Serves', key: 'sold_serves' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type="number" min="0" value={editPremix[key as keyof Premix] as number}
                  onChange={e => setEditPremix(p => p ? { ...p, [key]: parseInt(e.target.value) || 0 } : p)}
                  className="input" />
              </div>
            ))}
            <div className="bg-[#0D0D0F] rounded-lg p-3 text-xs text-[#9896A4]">
              Serves Left: {premixLeft(editPremix)}
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditPremix(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => savePremix(editPremix)} disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
