'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Plus, Package, AlertTriangle, TrendingDown, TrendingUp, Edit2 } from 'lucide-react'
import type { Database } from '@/types/database'

type Ingredient = Database['public']['Tables']['ingredients']['Row'] & { suppliers?: { name: string } | null }

const emptyForm = {
  name: '',
  category: 'spirits',
  supplier_id: '',
  unit: 'ml',
  bottle_size_ml: '',
  cost_per_bottle: '',
  current_stock: '',
  min_stock_level: '5',
  notes: '',
}

const emptyMovement = {
  ingredient_id: '',
  movement_type: 'added' as 'added' | 'used' | 'wasted' | 'adjusted',
  quantity: '',
  notes: '',
}

const CATEGORIES = ['spirits', 'liqueur', 'beer', 'wine', 'fresh', 'garnish', 'syrup', 'juice', 'other']

export function InventoryClient({ ingredients: initial, suppliers }: { ingredients: Ingredient[], suppliers: { id: string; name: string }[] }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [movementModal, setMovementModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [movement, setMovement] = useState(emptyMovement)
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'low'>('all')
  const { toast } = useToast()
  const supabase = createClient()

  const lowStock = ingredients.filter(i => i.current_stock <= i.min_stock_level)
  const filtered = filter === 'low' ? lowStock : ingredients

  const costPerUnit = () => {
    const bottle = parseFloat(form.bottle_size_ml) || 0
    const cost = parseFloat(form.cost_per_bottle) || 0
    return bottle > 0 ? cost / bottle : 0
  }

  const openCreate = () => { setEditId(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (i: Ingredient) => {
    setEditId(i.id)
    setForm({
      name: i.name, category: i.category, supplier_id: i.supplier_id ?? '',
      unit: i.unit, bottle_size_ml: String(i.bottle_size_ml ?? ''), cost_per_bottle: String(i.cost_per_bottle ?? ''),
      current_stock: String(i.current_stock), min_stock_level: String(i.min_stock_level), notes: i.notes ?? '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const payload = {
      name: form.name, category: form.category, supplier_id: form.supplier_id || null,
      unit: form.unit, bottle_size_ml: parseFloat(form.bottle_size_ml) || null,
      cost_per_bottle: parseFloat(form.cost_per_bottle) || null,
      current_stock: parseFloat(form.current_stock) || 0,
      min_stock_level: parseFloat(form.min_stock_level) || 5,
      notes: form.notes || null,
    }

    const { error, data } = editId
      ? await supabase.from('ingredients').update(payload).eq('id', editId).select('*, suppliers(name)').single()
      : await supabase.from('ingredients').insert(payload).select('*, suppliers(name)').single()

    if (error) { toast(error.message, 'error') }
    else {
      toast(editId ? 'Ingredient updated' : 'Ingredient added', 'success')
      setIngredients(prev => editId ? prev.map(i => i.id === editId ? data as Ingredient : i) : [...prev, data as Ingredient])
      setModalOpen(false)
    }
    setLoading(false)
  }

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const qty = parseFloat(movement.quantity) || 0
    const ing = ingredients.find(i => i.id === movement.ingredient_id)
    if (!ing) { setLoading(false); return }

    const delta = movement.movement_type === 'added' ? qty :
                  movement.movement_type === 'adjusted' ? qty - ing.current_stock : -qty

    const { error } = await supabase.from('inventory').insert({
      ingredient_id: movement.ingredient_id,
      movement_type: movement.movement_type,
      quantity: qty,
      notes: movement.notes || null,
    })

    if (!error) {
      await supabase.from('ingredients').update({ current_stock: Math.max(0, ing.current_stock + delta) }).eq('id', ing.id)
      setIngredients(prev => prev.map(i => i.id === ing.id ? { ...i, current_stock: Math.max(0, i.current_stock + delta) } : i))
      toast('Stock updated', 'success')
      setMovementModal(false)
      setMovement(emptyMovement)
    } else { toast(error.message, 'error') }
    setLoading(false)
  }

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="space-y-6">
      <TopBar
        title="Inventory"
        subtitle={`${ingredients.length} items · ${lowStock.length} low stock`}
        actions={
          <div className="flex gap-2">
            <button onClick={() => setMovementModal(true)} className="btn-secondary flex items-center gap-1.5 text-xs">
              <TrendingDown size={12} /> Update Stock
            </button>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Add Item
            </button>
          </div>
        }
      />

      {lowStock.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <p className="text-amber-400 text-sm font-medium">{lowStock.length} items low on stock</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(i => (
              <span key={i.id} className="badge-yellow text-xs">{i.name}: {i.current_stock} left</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(['all', 'low'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${filter === f ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#A78BFA]' : 'border-[#2A2A30] text-[#9896A4]'}`}>
            {f === 'all' ? `All (${ingredients.length})` : `Low Stock (${lowStock.length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Package size={40} />} title="No inventory items" action={<button onClick={openCreate} className="btn-primary">Add First Item</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(ing => {
            const isLow = ing.current_stock <= ing.min_stock_level
            return (
              <div key={ing.id} className={`card-hover ${isLow ? 'border-amber-500/30' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[#F0EEF6] font-medium text-sm">{ing.name}</p>
                    <p className="text-[#5A5865] text-xs capitalize">{ing.category}</p>
                  </div>
                  <button onClick={() => openEdit(ing)} className="btn-ghost p-1.5"><Edit2 size={12} /></button>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <p className="text-[#9896A4] text-[10px]">In Stock</p>
                    <p className={`font-bold text-base ${isLow ? 'text-amber-400' : 'text-[#F0EEF6]'}`}>
                      {ing.current_stock} {ing.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#9896A4] text-[10px]">Cost/unit</p>
                    <p className="text-[#F0EEF6] text-sm">{formatCurrency(ing.cost_per_unit ?? 0)}</p>
                  </div>
                </div>
                {isLow && (
                  <div className="mt-2 flex items-center gap-1.5 text-amber-400 text-xs">
                    <AlertTriangle size={11} /> Below min ({ing.min_stock_level} {ing.unit})
                  </div>
                )}
                {ing.suppliers && <p className="text-[#5A5865] text-[10px] mt-1">{(ing.suppliers as any).name}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit ingredient modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Ingredient' : 'Add Ingredient'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Name</label>
              <input type="text" value={form.name} onChange={f('name')} className="input" placeholder="Tanqueray Gin" required />
            </div>
            <div>
              <label className="label">Category</label>
              <select value={form.category} onChange={f('category')} className="input">
                {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unit</label>
              <select value={form.unit} onChange={f('unit')} className="input">
                {['ml', 'g', 'kg', 'piece', 'bottle', 'liter'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bottle Size ({form.unit})</label>
              <input type="number" step="0.01" min="0" value={form.bottle_size_ml} onChange={f('bottle_size_ml')} className="input" placeholder="700" />
            </div>
            <div>
              <label className="label">Cost per Bottle (RM)</label>
              <input type="number" step="0.01" min="0" value={form.cost_per_bottle} onChange={f('cost_per_bottle')} className="input" placeholder="150.00" />
            </div>
          </div>
          {costPerUnit() > 0 && (
            <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 rounded-lg p-3 text-sm">
              <span className="text-[#9896A4]">Cost per {form.unit}: </span>
              <span className="text-[#A78BFA] font-bold">{formatCurrency(costPerUnit())}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Current Stock ({form.unit})</label>
              <input type="number" step="0.01" min="0" value={form.current_stock} onChange={f('current_stock')} className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Min Stock Alert</label>
              <input type="number" step="0.01" min="0" value={form.min_stock_level} onChange={f('min_stock_level')} className="input" placeholder="5" />
            </div>
          </div>
          <div>
            <label className="label">Supplier</label>
            <select value={form.supplier_id} onChange={f('supplier_id')} className="input">
              <option value="">No supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving...' : (editId ? 'Update' : 'Add Item')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock movement modal */}
      <Modal isOpen={movementModal} onClose={() => setMovementModal(false)} title="Update Stock">
        <form onSubmit={handleMovement} className="space-y-4">
          <div>
            <label className="label">Ingredient</label>
            <select value={movement.ingredient_id} onChange={e => setMovement(p => ({ ...p, ingredient_id: e.target.value }))} className="input" required>
              <option value="">Select ingredient</option>
              {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} (Current: {i.current_stock} {i.unit})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Movement Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['added', 'used', 'wasted', 'adjusted'] as const).map(type => (
                <button key={type} type="button"
                  onClick={() => setMovement(p => ({ ...p, movement_type: type }))}
                  className={`p-2.5 rounded-lg border text-sm font-medium transition-all capitalize ${movement.movement_type === type ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#A78BFA]' : 'border-[#2A2A30] text-[#9896A4]'}`}>
                  {type === 'added' ? '➕' : type === 'used' ? '📉' : type === 'wasted' ? '🗑️' : '⚖️'} {type}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">
              {movement.movement_type === 'adjusted' ? 'New Total Quantity' : 'Quantity'}
            </label>
            <input type="number" step="0.01" min="0" value={movement.quantity}
              onChange={e => setMovement(p => ({ ...p, quantity: e.target.value }))} className="input" required />
          </div>
          <div>
            <label className="label">Notes</label>
            <input type="text" value={movement.notes} onChange={e => setMovement(p => ({ ...p, notes: e.target.value }))} className="input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setMovementModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving...' : 'Update Stock'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
