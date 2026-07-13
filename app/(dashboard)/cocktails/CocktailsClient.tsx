'use client'
import { useState, useRef, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Plus, GlassWater, Trash2, TrendingUp, X, ChevronDown, Search } from 'lucide-react'
import type { Database } from '@/types/database'

type Ingredient = Database['public']['Tables']['ingredients']['Row']
type Cocktail = Database['public']['Tables']['cocktails']['Row'] & {
  cocktail_recipes: (Database['public']['Tables']['cocktail_recipes']['Row'] & { ingredients: Ingredient })[]
}

const emptyForm = {
  name: '',
  description: '',
  selling_price: '',
  garnish_cost: '0',
  ice_cost: '0',
  other_cost: '0',
}

const emptyIngForm = { name: '', unit: 'ml', cost_per_unit: '' }

interface RecipeLine {
  ingredient_id: string
  quantity_ml: string
}

function calcCost(cocktail: Cocktail): { cost: number; profit: number; margin: number } {
  const ingredientCost = cocktail.cocktail_recipes.reduce((sum, r) => {
    const costPerUnit = r.ingredients?.cost_per_unit ?? 0
    return sum + costPerUnit * r.quantity_ml
  }, 0)
  const cost = ingredientCost + (cocktail.garnish_cost ?? 0) + (cocktail.ice_cost ?? 0) + (cocktail.other_cost ?? 0)
  const profit = cocktail.selling_price - cost
  const margin = cocktail.selling_price > 0 ? (profit / cocktail.selling_price) * 100 : 0
  return { cost, profit, margin }
}

// ── Searchable ingredient combobox ──────────────────────────────
function IngredientCombobox({
  value,
  onChange,
  ingredients,
}: {
  value: string
  onChange: (id: string) => void
  ingredients: Ingredient[]
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = ingredients.find(i => i.id === value)
  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch('') }}
        className="input w-full text-left flex items-center justify-between gap-2"
      >
        <span className={selected ? 'text-[#F0EEF6]' : 'text-[#5A5865]'}>
          {selected ? `${selected.name} (${selected.unit})` : 'Select ingredient…'}
        </span>
        <ChevronDown size={13} className={`text-[#5A5865] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[#1A1A1E] border border-[#3A3A44] rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-[#2A2A30]">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A5865]" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search ingredients…"
                className="w-full bg-[#141417] border border-[#2A2A30] rounded-lg pl-7 pr-3 py-1.5 text-xs text-[#F0EEF6] placeholder:text-[#5A5865] outline-none focus:border-[#7B5EA7]"
              />
            </div>
          </div>
          {/* Options */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[#5A5865] text-center">No match found</div>
            ) : (
              filtered.map(ing => (
                <button
                  key={ing.id}
                  type="button"
                  onClick={() => { onChange(ing.id); setOpen(false); setSearch('') }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-[#2A2A30] transition-colors ${ing.id === value ? 'text-[#A78BFA] bg-[#8B5CF6]/10' : 'text-[#F0EEF6]'}`}
                >
                  <span>{ing.name}</span>
                  <span className="text-[#5A5865] text-xs">{formatCurrency(ing.cost_per_unit ?? 0)}/{ing.unit}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function CocktailsClient({ cocktails: initialCocktails, ingredients: initialIngredients }: { cocktails: Cocktail[], ingredients: Ingredient[] }) {
  const [cocktails, setCocktails] = useState<Cocktail[]>(initialCocktails)
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients)
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<Cocktail | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [recipe, setRecipe] = useState<RecipeLine[]>([{ ingredient_id: '', quantity_ml: '' }])
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // New ingredient sub-modal
  const [ingModal, setIngModal] = useState(false)
  const [ingForm, setIngForm] = useState(emptyIngForm)
  const [ingLoading, setIngLoading] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()

  const openCreate = () => {
    setEditId(null); setForm(emptyForm); setRecipe([{ ingredient_id: '', quantity_ml: '' }]); setModalOpen(true)
  }

  const openEdit = (c: Cocktail) => {
    setEditId(c.id)
    setForm({ name: c.name, description: c.description ?? '', selling_price: String(c.selling_price), garnish_cost: String(c.garnish_cost), ice_cost: String(c.ice_cost), other_cost: String(c.other_cost) })
    setRecipe(c.cocktail_recipes.length > 0 ? c.cocktail_recipes.map(r => ({ ingredient_id: r.ingredient_id, quantity_ml: String(r.quantity_ml) })) : [{ ingredient_id: '', quantity_ml: '' }])
    setSelected(null)
    setModalOpen(true)
  }

  const estimatedCost = () => {
    const ingCost = recipe.reduce((sum, r) => {
      const ing = ingredients.find(i => i.id === r.ingredient_id)
      const qty = parseFloat(r.quantity_ml) || 0
      return sum + (ing?.cost_per_unit ?? 0) * qty
    }, 0)
    return ingCost + (parseFloat(form.garnish_cost) || 0) + (parseFloat(form.ice_cost) || 0) + (parseFloat(form.other_cost) || 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const cost = estimatedCost()
    const price = parseFloat(form.selling_price) || 0
    const payload = {
      name: form.name,
      description: form.description || null,
      selling_price: price,
      garnish_cost: parseFloat(form.garnish_cost) || 0,
      ice_cost: parseFloat(form.ice_cost) || 0,
      other_cost: parseFloat(form.other_cost) || 0,
      total_cost: cost,
      gross_profit: price - cost,
      profit_margin: price > 0 ? ((price - cost) / price) * 100 : 0,
    }

    let cocktailId = editId
    let error

    if (editId) {
      const res = await supabase.from('cocktails').update(payload).eq('id', editId).select().single()
      error = res.error
    } else {
      const res = await supabase.from('cocktails').insert(payload).select().single()
      error = res.error; cocktailId = res.data?.id ?? null
    }

    if (error) { toast(error.message, 'error'); setLoading(false); return }

    if (cocktailId && editId) {
      await supabase.from('cocktail_recipes').delete().eq('cocktail_id', cocktailId)
    }

    const validRecipes = recipe.filter(r => r.ingredient_id && r.quantity_ml)
    if (cocktailId && validRecipes.length > 0) {
      await supabase.from('cocktail_recipes').insert(validRecipes.map(r => ({
        cocktail_id: cocktailId!,
        ingredient_id: r.ingredient_id,
        quantity_ml: parseFloat(r.quantity_ml),
      })))
    }

    toast(editId ? 'Cocktail updated' : 'Cocktail created', 'success')
    const { data: refreshed } = await supabase.from('cocktails').select('*, cocktail_recipes(*, ingredients(*))').is('deleted_at', null).order('name')
    setCocktails(refreshed ?? [])
    setModalOpen(false)
    setLoading(false)
  }

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault()
    setIngLoading(true)
    const { data, error } = await supabase.from('ingredients').insert({
      name: ingForm.name.trim(),
      unit: ingForm.unit.trim() || 'ml',
      cost_per_unit: parseFloat(ingForm.cost_per_unit) || 0,
      is_active: true,
    }).select().single()
    setIngLoading(false)

    if (error) { toast(error.message, 'error'); return }

    const newIng = data as Ingredient
    setIngredients(prev => [...prev, newIng].sort((a, b) => a.name.localeCompare(b.name)))
    // Auto-select the new ingredient in the last empty recipe line
    setRecipe(prev => {
      const lastEmpty = [...prev].reverse().findIndex(r => !r.ingredient_id)
      if (lastEmpty === -1) return [...prev, { ingredient_id: newIng.id, quantity_ml: '' }]
      const idx = prev.length - 1 - lastEmpty
      return prev.map((r, i) => i === idx ? { ...r, ingredient_id: newIng.id } : r)
    })
    toast(`"${newIng.name}" added`, 'success')
    setIngModal(false)
    setIngForm(emptyIngForm)
  }

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const fi = (key: keyof typeof ingForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setIngForm(prev => ({ ...prev, [key]: e.target.value }))

  const previewPrice = parseFloat(form.selling_price) || 0
  const previewCost = estimatedCost()
  const previewMargin = previewPrice > 0 ? ((previewPrice - previewCost) / previewPrice) * 100 : 0

  return (
    <div className="space-y-6">
      <TopBar
        title="Cocktail Costing"
        subtitle={`${cocktails.length} cocktails · Profitability calculator`}
        actions={
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> New Cocktail
          </button>
        }
      />

      {cocktails.length === 0 ? (
        <EmptyState icon={<GlassWater size={40} />} title="No cocktails yet" action={<button onClick={openCreate} className="btn-primary">Add Cocktail</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cocktails.map(c => {
            const { cost, profit, margin } = calcCost(c)
            const marginColor = margin >= 70 ? 'text-emerald-400' : margin >= 50 ? 'text-amber-400' : 'text-rose-400'
            return (
              <div key={c.id} className="card-hover cursor-pointer" onClick={() => setSelected(c)}>
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[#F0EEF6] font-semibold">{c.name}</p>
                  <span className={`text-sm font-bold ${marginColor}`}>{margin.toFixed(0)}%</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#1A1A1E] rounded-lg p-2">
                    <p className="text-[#5A5865] text-[9px] uppercase">Cost</p>
                    <p className="text-[#F0EEF6] text-xs font-medium">{formatCurrency(cost)}</p>
                  </div>
                  <div className="bg-[#1A1A1E] rounded-lg p-2">
                    <p className="text-[#5A5865] text-[9px] uppercase">Price</p>
                    <p className="text-[#F0EEF6] text-xs font-medium">{formatCurrency(c.selling_price)}</p>
                  </div>
                  <div className="bg-[#1A1A1E] rounded-lg p-2">
                    <p className="text-[#5A5865] text-[9px] uppercase">Profit</p>
                    <p className="text-emerald-400 text-xs font-medium">{formatCurrency(profit)}</p>
                  </div>
                </div>
                <div className="mt-2 w-full bg-[#1A1A1E] rounded-full h-1">
                  <div className={`h-1 rounded-full ${margin >= 70 ? 'bg-emerald-400' : margin >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                    style={{ width: `${Math.min(margin, 100)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail view */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSelected(null)} />
          <div className="relative bg-[#141417] border border-[#2A2A30] rounded-2xl w-full max-w-md shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#F0EEF6] font-bold text-lg">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="text-[#9896A4] hover:text-[#F0EEF6]"><X size={18} /></button>
            </div>
            {selected.description && <p className="text-[#9896A4] text-sm mb-4">{selected.description}</p>}
            <div className="space-y-2 mb-4">
              <p className="text-[#5A5865] text-xs uppercase tracking-wider">Recipe</p>
              {selected.cocktail_recipes.map(r => (
                <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-[#1A1A1E]">
                  <span className="text-[#F0EEF6] text-sm">{r.ingredients?.name}</span>
                  <div className="text-right">
                    <span className="text-[#9896A4] text-xs">{r.quantity_ml}ml</span>
                    <span className="text-[#5A5865] text-xs ml-2">= {formatCurrency((r.ingredients?.cost_per_unit ?? 0) * r.quantity_ml)}</span>
                  </div>
                </div>
              ))}
            </div>
            {(() => { const { cost, profit, margin } = calcCost(selected); return (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-[#1A1A1E] rounded-xl p-3 text-center">
                  <p className="text-[#5A5865] text-xs">Total Cost</p>
                  <p className="text-[#F0EEF6] font-bold">{formatCurrency(cost)}</p>
                </div>
                <div className="bg-[#1A1A1E] rounded-xl p-3 text-center">
                  <p className="text-[#5A5865] text-xs">Selling Price</p>
                  <p className="text-[#F0EEF6] font-bold">{formatCurrency(selected.selling_price)}</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <p className="text-[#5A5865] text-xs">Gross Profit</p>
                  <p className="text-emerald-400 font-bold">{formatCurrency(profit)}</p>
                </div>
                <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 rounded-xl p-3 text-center">
                  <p className="text-[#5A5865] text-xs">Margin</p>
                  <p className="text-[#A78BFA] font-bold">{margin.toFixed(1)}%</p>
                </div>
              </div>
            )})()}
            <button onClick={() => openEdit(selected)} className="btn-secondary w-full">Edit Cocktail</button>
          </div>
        </div>
      )}

      {/* Main cocktail modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Cocktail' : 'New Cocktail'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Cocktail Name</label>
              <input type="text" value={form.name} onChange={f('name')} className="input" placeholder="Negroni" required />
            </div>
            <div className="col-span-2">
              <label className="label">Description (optional)</label>
              <input type="text" value={form.description} onChange={f('description')} className="input" />
            </div>
            <div>
              <label className="label">Selling Price (RM)</label>
              <input type="number" step="0.01" min="0" value={form.selling_price} onChange={f('selling_price')} className="input" required />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#9896A4] text-xs uppercase tracking-wider">Recipe Ingredients</p>
              <button
                type="button"
                onClick={() => { setIngForm(emptyIngForm); setIngModal(true) }}
                className="flex items-center gap-1 text-xs text-[#8B5CF6] hover:text-[#A78BFA] transition-colors"
              >
                <Plus size={11} /> New ingredient
              </button>
            </div>
            <div className="space-y-2">
              {recipe.map((line, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <IngredientCombobox
                    value={line.ingredient_id}
                    onChange={id => setRecipe(prev => prev.map((r, j) => j === i ? { ...r, ingredient_id: id } : r))}
                    ingredients={ingredients}
                  />
                  <input
                    type="number" step="0.1" min="0"
                    value={line.quantity_ml}
                    onChange={e => setRecipe(prev => prev.map((r, j) => j === i ? { ...r, quantity_ml: e.target.value } : r))}
                    className="input w-20" placeholder="ml"
                  />
                  <button type="button" onClick={() => setRecipe(prev => prev.filter((_, j) => j !== i))}
                    className="text-[#5A5865] hover:text-rose-400 p-1.5"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setRecipe(prev => [...prev, { ingredient_id: '', quantity_ml: '' }])}
                className="btn-ghost text-xs flex items-center gap-1.5">
                <Plus size={12} /> Add ingredient line
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Garnish Cost (RM)</label>
              <input type="number" step="0.01" min="0" value={form.garnish_cost} onChange={f('garnish_cost')} className="input" />
            </div>
            <div>
              <label className="label">Ice Cost (RM)</label>
              <input type="number" step="0.01" min="0" value={form.ice_cost} onChange={f('ice_cost')} className="input" />
            </div>
            <div>
              <label className="label">Other Cost (RM)</label>
              <input type="number" step="0.01" min="0" value={form.other_cost} onChange={f('other_cost')} className="input" />
            </div>
          </div>

          {/* Live cost preview */}
          <div className="bg-[#1A1A1E] rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[#5A5865] text-xs">Production Cost</p>
              <p className="text-[#F0EEF6] font-bold">{formatCurrency(previewCost)}</p>
            </div>
            <div>
              <p className="text-[#5A5865] text-xs">Gross Profit</p>
              <p className={`font-bold ${previewPrice - previewCost >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(previewPrice - previewCost)}
              </p>
            </div>
            <div>
              <p className="text-[#5A5865] text-xs">Margin</p>
              <p className={`font-bold ${previewMargin >= 70 ? 'text-emerald-400' : previewMargin >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                {previewMargin.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving...' : (editId ? 'Update' : 'Create Cocktail')}
            </button>
          </div>
        </form>
      </Modal>

      {/* New ingredient sub-modal */}
      <Modal isOpen={ingModal} onClose={() => setIngModal(false)} title="New Ingredient" size="sm">
        <form onSubmit={handleAddIngredient} className="space-y-4">
          <p className="text-[#9896A4] text-sm">Add a new ingredient to the costing library. It will be immediately available to select in the recipe above.</p>
          <div>
            <label className="label">Ingredient Name <span className="text-rose-400">*</span></label>
            <input
              type="text"
              value={ingForm.name}
              onChange={fi('name')}
              placeholder="e.g. Cointreau, Fresh Lime Juice"
              className="input"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Unit <span className="text-rose-400">*</span></label>
              <select value={ingForm.unit} onChange={fi('unit')} className="input">
                <option value="ml">ml</option>
                <option value="g">g</option>
                <option value="oz">oz</option>
                <option value="dash">dash</option>
                <option value="pcs">pcs</option>
                <option value="tbsp">tbsp</option>
                <option value="tsp">tsp</option>
              </select>
            </div>
            <div>
              <label className="label">Cost per {ingForm.unit} (RM) <span className="text-rose-400">*</span></label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={ingForm.cost_per_unit}
                onChange={fi('cost_per_unit')}
                placeholder="0.00"
                className="input"
                required
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setIngModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={ingLoading || !ingForm.name.trim()} className="btn-primary flex-1 disabled:opacity-50">
              {ingLoading ? 'Adding…' : 'Add Ingredient'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
