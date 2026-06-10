'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatDate, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Plus, CheckCircle2, AlertTriangle, Edit2, TrendingUp } from 'lucide-react'
import type { Database } from '@/types/database'

type DailySale = Database['public']['Tables']['daily_sales']['Row']

interface SalesClientProps {
  initialSales: DailySale[]
}

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  cocktails_revenue: '',
  beer_revenue: '',
  wine_revenue: '',
  food_revenue: '',
  others_revenue: '',
  cash_collected: '',
  credit_card_collected: '',
  qr_collected: '',
  online_collected: '',
  transaction_count: '',
  notes: '',
}

export function SalesClient({ initialSales }: SalesClientProps) {
  const [sales, setSales] = useState<DailySale[]>(initialSales)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const totalRevenue = [form.cocktails_revenue, form.beer_revenue, form.wine_revenue, form.food_revenue, form.others_revenue]
    .map(v => parseFloat(v) || 0).reduce((a, b) => a + b, 0)

  const totalCollected = [form.cash_collected, form.credit_card_collected, form.qr_collected, form.online_collected]
    .map(v => parseFloat(v) || 0).reduce((a, b) => a + b, 0)

  const isBalanced = Math.abs(totalRevenue - totalCollected) < 0.01

  const openCreate = () => {
    setEditId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (sale: DailySale) => {
    setEditId(sale.id)
    setForm({
      date: sale.date,
      cocktails_revenue: String(sale.cocktails_revenue),
      beer_revenue: String(sale.beer_revenue),
      wine_revenue: String(sale.wine_revenue),
      food_revenue: String(sale.food_revenue),
      others_revenue: String(sale.others_revenue),
      cash_collected: String(sale.cash_collected),
      credit_card_collected: String(sale.credit_card_collected),
      qr_collected: String(sale.qr_collected),
      online_collected: String(sale.online_collected),
      transaction_count: String(sale.transaction_count),
      notes: sale.notes ?? '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const payload = {
      date: form.date,
      cocktails_revenue: parseFloat(form.cocktails_revenue) || 0,
      beer_revenue: parseFloat(form.beer_revenue) || 0,
      wine_revenue: parseFloat(form.wine_revenue) || 0,
      food_revenue: parseFloat(form.food_revenue) || 0,
      others_revenue: parseFloat(form.others_revenue) || 0,
      cash_collected: parseFloat(form.cash_collected) || 0,
      credit_card_collected: parseFloat(form.credit_card_collected) || 0,
      qr_collected: parseFloat(form.qr_collected) || 0,
      online_collected: parseFloat(form.online_collected) || 0,
      transaction_count: parseInt(form.transaction_count) || 0,
      notes: form.notes || null,
    }

    let error, data

    if (editId) {
      const res = await supabase.from('daily_sales').update(payload).eq('id', editId).select().single()
      error = res.error; data = res.data
    } else {
      const res = await supabase.from('daily_sales').insert(payload).select().single()
      error = res.error; data = res.data
    }

    if (error) {
      toast(error.message, 'error')
    } else {
      toast(editId ? 'Sales entry updated' : 'Sales entry saved', 'success')
      setSales(prev => editId
        ? prev.map(s => s.id === editId ? data! : s)
        : [data!, ...prev]
      )
      setModalOpen(false)
    }
    setLoading(false)
  }

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="space-y-6">
      <TopBar
        title="Daily Sales"
        subtitle="Enter nightly closing figures"
        actions={
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> New Entry
          </button>
        }
      />

      {sales.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={40} />}
          title="No sales entries yet"
          description="Start tracking your daily revenue by adding your first entry"
          action={<button onClick={openCreate} className="btn-primary">Add Today's Sales</button>}
        />
      ) : (
        <div className="space-y-2">
          {sales.map(sale => (
            <div key={sale.id} className="card-hover flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-8 rounded-full flex-shrink-0 ${sale.is_balanced ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[#F0EEF6] font-medium text-sm">{formatDate(sale.date)}</p>
                    {sale.is_balanced
                      ? <span className="badge-green text-[10px]"><CheckCircle2 size={10} className="mr-0.5" />Balanced</span>
                      : <span className="badge-yellow text-[10px]"><AlertTriangle size={10} className="mr-0.5" />Mismatch</span>}
                  </div>
                  <p className="text-[#9896A4] text-xs mt-0.5">
                    {sale.transaction_count} transactions · {[
                      sale.cocktails_revenue > 0 && `Cocktails ${formatCurrency(sale.cocktails_revenue)}`,
                      sale.beer_revenue > 0 && `Beer ${formatCurrency(sale.beer_revenue)}`,
                      sale.food_revenue > 0 && `Food ${formatCurrency(sale.food_revenue)}`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-[#F0EEF6] font-bold">{formatCurrency(sale.total_revenue)}</p>
                  {!sale.is_balanced && (
                    <p className="text-amber-400 text-xs">
                      Diff: {formatCurrency(Math.abs(sale.total_revenue - sale.total_collected))}
                    </p>
                  )}
                </div>
                <button onClick={() => openEdit(sale)} className="btn-ghost p-2">
                  <Edit2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Sales Entry' : 'New Sales Entry'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Date</label>
            <input type="date" value={form.date} onChange={f('date')} className="input" required />
          </div>

          {/* Revenue */}
          <div>
            <p className="text-[#9896A4] text-xs font-medium uppercase tracking-wider mb-3">Revenue by Category</p>
            <div className="grid grid-cols-2 gap-3">
              {(['cocktails_revenue', 'beer_revenue', 'wine_revenue', 'food_revenue', 'others_revenue'] as const).map(key => (
                <div key={key}>
                  <label className="label capitalize">{key.replace('_revenue', '')}</label>
                  <input type="number" step="0.01" min="0" value={form[key]} onChange={f(key)} className="input" placeholder="0.00" />
                </div>
              ))}
              <div className="flex items-end">
                <div className="bg-[#1A1A1E] border border-[#8B5CF6]/30 rounded-lg px-3 py-2 w-full">
                  <p className="text-[#9896A4] text-xs">Total Revenue</p>
                  <p className="text-[#A78BFA] font-bold">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment collection */}
          <div>
            <p className="text-[#9896A4] text-xs font-medium uppercase tracking-wider mb-3">Payment Collection</p>
            <div className="grid grid-cols-2 gap-3">
              {(['cash_collected', 'credit_card_collected', 'qr_collected', 'online_collected'] as const).map(key => (
                <div key={key}>
                  <label className="label">{PAYMENT_METHOD_LABELS[key.replace('_collected', '')] ?? key}</label>
                  <input type="number" step="0.01" min="0" value={form[key]} onChange={f(key)} className="input" placeholder="0.00" />
                </div>
              ))}
            </div>
          </div>

          {/* Balance check */}
          <div className={`rounded-xl p-4 border ${isBalanced ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#9896A4] mb-1">Revenue vs Collection</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-[#F0EEF6]">Revenue: <strong>{formatCurrency(totalRevenue)}</strong></span>
                  <span className="text-[#F0EEF6]">Collected: <strong>{formatCurrency(totalCollected)}</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {isBalanced
                  ? <><CheckCircle2 size={16} className="text-emerald-400" /><span className="text-emerald-400 text-sm font-medium">BALANCED</span></>
                  : <><AlertTriangle size={16} className="text-amber-400" /><span className="text-amber-400 text-sm font-medium">MISMATCH: {formatCurrency(Math.abs(totalRevenue - totalCollected))}</span></>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Transaction Count</label>
              <input type="number" min="0" value={form.transaction_count} onChange={f('transaction_count')} className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input type="text" value={form.notes} onChange={f('notes')} className="input" placeholder="Any notes..." />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving...' : (editId ? 'Update Entry' : 'Save Entry')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
