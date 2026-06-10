'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatMonth } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Plus, PieChart, DollarSign, CheckCircle2 } from 'lucide-react'
import type { Database } from '@/types/database'

type Partner = Database['public']['Tables']['partners']['Row']
type Distribution = Database['public']['Tables']['profit_distribution']['Row']

const emptyForm = { name: '', ownership_percentage: '', email: '', phone: '', join_date: '' }

export function PartnersClient({ partners: initial, distributions: initialDist, totalRevenue, totalExpenses, month, year }: {
  partners: Partner[]
  distributions: Distribution[]
  totalRevenue: number
  totalExpenses: number
  month: number
  year: number
}) {
  const [partners, setPartners] = useState<Partner[]>(initial)
  const [distributions, setDistributions] = useState<Distribution[]>(initialDist)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const netProfit = totalRevenue - totalExpenses
  const totalOwnership = partners.reduce((s, p) => s + p.ownership_percentage, 0)

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error, data } = await supabase.from('partners').insert({
      name: form.name,
      ownership_percentage: parseFloat(form.ownership_percentage),
      email: form.email || null,
      phone: form.phone || null,
      join_date: form.join_date || null,
    }).select().single()

    if (error) { toast(error.message, 'error') }
    else { toast('Partner added', 'success'); setPartners(prev => [...prev, data!]); setModalOpen(false) }
    setLoading(false)
  }

  const handleDistribute = async (partner: Partner, status: 'retained' | 'paid_out') => {
    const share = (netProfit * partner.ownership_percentage) / 100
    const existing = distributions.find(d => d.partner_id === partner.id)

    if (existing) {
      const { error, data } = await supabase.from('profit_distribution').update({
        status, paid_date: status === 'paid_out' ? new Date().toISOString().split('T')[0] : null
      }).eq('id', existing.id).select().single()
      if (!error) setDistributions(prev => prev.map(d => d.id === existing.id ? data! : d))
    } else {
      const { error, data } = await supabase.from('profit_distribution').insert({
        partner_id: partner.id, month, year,
        total_revenue: totalRevenue, total_expenses: totalExpenses,
        net_profit: netProfit, ownership_percentage: partner.ownership_percentage,
        partner_share: share, status,
        paid_date: status === 'paid_out' ? new Date().toISOString().split('T')[0] : null,
      }).select().single()
      if (!error) setDistributions(prev => [...prev, data!])
    }
    toast(`Profit ${status === 'paid_out' ? 'marked as paid out' : 'retained'}`, 'success')
  }

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="space-y-6">
      <TopBar
        title="Partners"
        subtitle={formatMonth(month, year)}
        actions={
          <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Add Partner
          </button>
        }
      />

      {/* Monthly P&L summary */}
      <div className="card bg-gradient-to-r from-[#141417] to-[#1A1A20]">
        <p className="text-[#9896A4] text-xs uppercase tracking-wider mb-3">{formatMonth(month, year)} P&L Summary</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[#5A5865] text-xs">Revenue</p>
            <p className="text-[#F0EEF6] font-bold text-lg">{formatCurrency(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-[#5A5865] text-xs">Expenses</p>
            <p className="text-rose-400 font-bold text-lg">{formatCurrency(totalExpenses)}</p>
          </div>
          <div>
            <p className="text-[#5A5865] text-xs">Net Profit</p>
            <p className={`font-bold text-lg ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(netProfit)}
            </p>
          </div>
        </div>
        {totalOwnership < 100 && (
          <div className="mt-3 pt-3 border-t border-[#2A2A30] text-xs text-[#5A5865]">
            Total partner ownership: {totalOwnership}% · Unallocated: {100 - totalOwnership}%
          </div>
        )}
      </div>

      {/* Partner cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {partners.map(partner => {
          const share = (netProfit * partner.ownership_percentage) / 100
          const dist = distributions.find(d => d.partner_id === partner.id)
          const isPaidOut = dist?.status === 'paid_out'

          return (
            <div key={partner.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F59E0B] flex items-center justify-center font-bold text-sm text-[#0A0A0B]">
                    {partner.name[0]}
                  </div>
                  <div>
                    <p className="text-[#F0EEF6] font-semibold">{partner.name}</p>
                    <p className="text-[#9896A4] text-xs">{partner.ownership_percentage}% ownership</p>
                  </div>
                </div>
                <span className={dist ? (isPaidOut ? 'badge-green' : 'badge-yellow') : 'badge text-[#5A5865] bg-[#1A1A1E]'}>
                  {dist ? (isPaidOut ? 'Paid Out' : 'Retained') : 'Pending'}
                </span>
              </div>

              <div className="bg-[#1A1A1E] rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#5A5865] text-xs">Profit Share ({partner.ownership_percentage}%)</p>
                    <p className={`font-bold text-xl mt-0.5 ${share >= 0 ? 'text-[#F0EEF6]' : 'text-rose-400'}`}>
                      {formatCurrency(share)}
                    </p>
                  </div>
                  <DollarSign size={20} className="text-[#D4AF37]" />
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => handleDistribute(partner, 'retained')} className="btn-secondary flex-1 text-xs">
                  Retain
                </button>
                <button onClick={() => handleDistribute(partner, 'paid_out')} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={12} /> Pay Out
                </button>
              </div>
            </div>
          )
        })}

        {partners.length === 0 && (
          <div className="col-span-2 text-center py-12 text-[#5A5865]">
            <PieChart size={40} className="mx-auto mb-3 opacity-30" />
            <p>No partners added yet</p>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Partner">
        <form onSubmit={handleAddPartner} className="space-y-4">
          <div>
            <label className="label">Partner Name</label>
            <input type="text" value={form.name} onChange={f('name')} className="input" required />
          </div>
          <div>
            <label className="label">Ownership Percentage (%)</label>
            <input type="number" step="0.01" min="0.01" max="100" value={form.ownership_percentage} onChange={f('ownership_percentage')} className="input" placeholder="30" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email (optional)</label>
              <input type="email" value={form.email} onChange={f('email')} className="input" />
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input type="tel" value={form.phone} onChange={f('phone')} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Join Date</label>
            <input type="date" value={form.join_date} onChange={f('join_date')} className="input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Adding...' : 'Add Partner'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
