'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatDate, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Plus, CheckCircle2, AlertTriangle, Edit2, TrendingUp, Moon, Trash2 } from 'lucide-react'
import type { Database } from '@/types/database'

type DailySale = Database['public']['Tables']['daily_sales']['Row']

interface SalesClientProps {
  initialSales: DailySale[]
  initialEonSales: any[]
}

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  cocktails_revenue: '',
  beer_revenue: '',
  wine_revenue: '',
  food_revenue: '',
  others_revenue: '',
  discount_amount: '',
  discount_notes: '',
  cash_collected: '',
  credit_card_collected: '',
  qr_collected: '',
  online_collected: '',
  transaction_count: '',
  notes: '',
}

export function SalesClient({ initialSales, initialEonSales }: SalesClientProps) {
  const [sales, setSales] = useState<DailySale[]>(initialSales)
  const [eonSales, setEonSales] = useState<any[]>(initialEonSales)
  const [activeTab, setActiveTab] = useState<'daily' | 'eon'>('daily')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteConfirmDate, setDeleteConfirmDate] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  // Group EON sales by date
  const eonByDate = eonSales.reduce<Record<string, any[]>>((acc, row) => {
    acc[row.date] = acc[row.date] ?? []
    acc[row.date].push(row)
    return acc
  }, {})
  const eonDates = Object.keys(eonByDate).sort((a, b) => b.localeCompare(a))

  const handleDeleteEON = async (date: string) => {
    setDeleteLoading(true)
    const rows = eonByDate[date]
    const totalCocktailRevenue = rows.reduce((s: number, r: any) => s + (r.total_revenue ?? 0), 0)

    // Delete cocktail_sales rows for this date
    const { error: delErr } = await supabase.from('cocktail_sales').delete().eq('date', date)
    if (delErr) {
      toast(delErr.message, 'error')
      setDeleteLoading(false)
      return
    }

    // Find the matching daily_sales row
    const dsRow = sales.find(s => s.date === date)
    if (dsRow) {
      const newCocktails = (dsRow.cocktails_revenue ?? 0) - totalCocktailRevenue
      const newTotal = (dsRow.total_revenue ?? 0) - totalCocktailRevenue
      const newCollected = (dsRow.total_collected ?? 0) - totalCocktailRevenue

      if (newTotal <= 0.005) {
        // Row was EON-only — delete it entirely
        await supabase.from('daily_sales').delete().eq('id', dsRow.id)
        setSales(prev => prev.filter(s => s.id !== dsRow.id))
      } else {
        // Subtract EON contribution
        const { data: updated } = await supabase
          .from('daily_sales')
          .update({
            cocktails_revenue: Math.max(0, newCocktails),
            total_revenue: Math.max(0, newTotal),
            total_collected: Math.max(0, newCollected),
          })
          .eq('id', dsRow.id)
          .select()
          .single()
        if (updated) setSales(prev => prev.map(s => s.id === dsRow.id ? updated : s))
      }
    }

    setEonSales(prev => prev.filter(r => r.date !== date))
    setDeleteConfirmDate(null)
    toast(`EON for ${formatDate(date)} deleted`, 'success')
    setDeleteLoading(false)
  }

  const grossRevenue = [form.cocktails_revenue, form.beer_revenue, form.wine_revenue, form.food_revenue, form.others_revenue]
    .map(v => parseFloat(v) || 0).reduce((a, b) => a + b, 0)

  const discountAmount = parseFloat(form.discount_amount) || 0
  const totalRevenue = Math.max(0, grossRevenue - discountAmount)

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
      discount_amount: String((sale as any).discount_amount ?? ''),
      discount_notes: (sale as any).discount_notes ?? '',
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
      discount_amount: discountAmount,
      discount_notes: form.discount_notes || null,
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
        title="Sales"
        subtitle="Daily revenue and End of Night submissions"
        actions={
          activeTab === 'daily' && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> New Entry
            </button>
          )
        }
      />

      {/* Tab switcher */}
      <div className="flex gap-1 bg-[#0D0D0F] border border-[#2A2A30] rounded-xl p-1 w-fit">
        {([
          { key: 'daily', label: 'Daily Sales', icon: TrendingUp },
          { key: 'eon', label: 'EON History', icon: Moon },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/30'
                : 'text-[#9896A4] hover:text-[#F0EEF6]'
            }`}
          >
            <Icon size={14} />
            {label}
            {key === 'eon' && eonDates.length > 0 && (
              <span className="bg-[#8B5CF6]/30 text-[#A78BFA] text-[10px] px-1.5 py-0.5 rounded-full">
                {eonDates.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'daily' && (
        <>
          {sales.length === 0 ? (
            <EmptyState
              icon={<TrendingUp size={40} />}
              title="No sales entries yet"
              description="Start tracking your daily revenue by adding your first entry"
              action={<button onClick={openCreate} className="btn-primary">Add Today's Sales</button>}
            />
          ) : (
            <div className="space-y-2">
              {sales.map(sale => {
                const saleDiscount = (sale as any).discount_amount ?? 0
                const saleNet = sale.total_revenue - saleDiscount
                const saleBalanced = Math.abs(saleNet - sale.total_collected) < 0.01
                return (
                <div key={sale.id} className="card-hover flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-8 rounded-full flex-shrink-0 ${saleBalanced ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[#F0EEF6] font-medium text-sm">{formatDate(sale.date)}</p>
                        {saleBalanced
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
                      <p className="text-[#F0EEF6] font-bold">{formatCurrency(saleNet)}</p>
                      {saleDiscount > 0 && (
                        <p className="text-[#9896A4] text-xs">Disc: -{formatCurrency(saleDiscount)}</p>
                      )}
                      {!saleBalanced && (
                        <p className="text-amber-400 text-xs">
                          Diff: {formatCurrency(Math.abs(saleNet - sale.total_collected))}
                        </p>
                      )}
                    </div>
                    <button onClick={() => openEdit(sale)} className="btn-ghost p-2">
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
                )}
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'eon' && (
        <>
          {eonDates.length === 0 ? (
            <EmptyState
              icon={<Moon size={40} />}
              title="No EON submissions yet"
              description="End of Night cocktail sales submissions will appear here"
            />
          ) : (
            <div className="space-y-3">
              {eonDates.map(date => {
                const rows = eonByDate[date]
                const total = rows.reduce((s: number, r: any) => s + (r.total_revenue ?? 0), 0)
                return (
                  <div key={date} className="bg-[#111113] border border-[#2A2A30] rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Moon size={14} className="text-[#8B5CF6]" />
                          <p className="text-[#F0EEF6] font-medium text-sm">{formatDate(date)}</p>
                          <span className="text-[#5A5865] text-xs">· {rows.length} cocktail{rows.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {rows.map((r: any) => (
                            <span key={r.id} className="bg-[#1A1A1E] border border-[#2A2A30] rounded-lg px-2 py-1 text-xs text-[#9896A4]">
                              {r.cocktail_name} <span className="text-[#F0EEF6] font-medium">×{r.quantity_sold}</span>
                              {r.total_revenue > 0 && <span className="text-[#8B5CF6] ml-1">{formatCurrency(r.total_revenue)}</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-[#F0EEF6] font-bold">{formatCurrency(total)}</p>
                          <p className="text-[#5A5865] text-xs">EON total</p>
                        </div>
                        <button
                          onClick={() => setDeleteConfirmDate(date)}
                          className="btn-ghost p-2 text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Delete confirm modal */}
      <Modal isOpen={!!deleteConfirmDate} onClose={() => setDeleteConfirmDate(null)} title="Delete EON Submission" size="sm">
        <div className="space-y-4">
          <p className="text-[#9896A4] text-sm">
            This will permanently delete the End of Night submission for{' '}
            <span className="text-[#F0EEF6] font-medium">{deleteConfirmDate ? formatDate(deleteConfirmDate) : ''}</span>{' '}
            and reverse its contribution to that day's sales total.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteConfirmDate(null)} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => deleteConfirmDate && handleDeleteEON(deleteConfirmDate)}
              disabled={deleteLoading}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 disabled:opacity-50 transition-all"
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Sales Entry' : 'New Sales Entry'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Date</label>
            <input type="date" value={form.date} onChange={f('date')} className="input" required />
          </div>

          {/* Revenue */}
          <div>
            <p className="text-[#9896A4] text-xs font-medium uppercase tracking-wider mb-3">Revenue by Category</p>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
              {(['cocktails_revenue', 'beer_revenue', 'wine_revenue', 'food_revenue', 'others_revenue'] as const).map(key => (
                <div key={key}>
                  <label className="label capitalize">{key.replace('_revenue', '')}</label>
                  <input type="number" step="0.01" min="0" value={form[key]} onChange={f(key)} className="input" placeholder="0.00" />
                </div>
              ))}
              <div className="flex items-end">
                <div className="bg-[#1A1A1E] border border-[#8B5CF6]/30 rounded-lg px-3 py-2 w-full">
                  <p className="text-[#9896A4] text-xs">Gross Revenue</p>
                  <p className="text-[#A78BFA] font-bold">{formatCurrency(grossRevenue)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Discount */}
          <div>
            <p className="text-[#9896A4] text-xs font-medium uppercase tracking-wider mb-3">Discount (optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Discount Amount</label>
                <input type="number" step="0.01" min="0" value={form.discount_amount} onChange={f('discount_amount')} className="input" placeholder="0.00" />
              </div>
              <div>
                <label className="label">Discount Reason</label>
                <input type="text" value={form.discount_notes} onChange={f('discount_notes')} className="input" placeholder="e.g. Staff comp, VIP promo" />
              </div>
            </div>
            {discountAmount > 0 && (
              <div className="mt-2 flex items-center justify-between bg-[#1A1A1E] rounded-lg px-3 py-2">
                <span className="text-[#9896A4] text-xs">{formatCurrency(grossRevenue)} − {formatCurrency(discountAmount)} discount</span>
                <span className="text-[#F0EEF6] font-semibold text-sm">Net: {formatCurrency(totalRevenue)}</span>
              </div>
            )}
          </div>

          {/* Payment collection */}
          <div>
            <p className="text-[#9896A4] text-xs font-medium uppercase tracking-wider mb-3">Payment Collection</p>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
              {(['cash_collected', 'credit_card_collected', 'qr_collected', 'online_collected'] as const).map(key => (
                <div key={key}>
                  <label className="label">{PAYMENT_METHOD_LABELS[key.replace('_collected', '').replace('qr', 'qr_payment')] ?? key}</label>
                  <input type="number" step="0.01" min="0" value={form[key]} onChange={f(key)} className="input" placeholder="0.00" />
                </div>
              ))}
            </div>
          </div>

          {/* Balance check */}
          <div className={`rounded-xl p-4 border ${isBalanced ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#9896A4] mb-1">Net Revenue vs Collection</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-[#F0EEF6]">Net: <strong>{formatCurrency(totalRevenue)}</strong></span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
