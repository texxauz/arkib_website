'use client'

import { useState, useMemo } from 'react'
import {
  Settings, Plus, Pencil, Trash2, Eye, EyeOff,
  Percent, DollarSign, Tag,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

type PosTable = {
  id: string; name: string; section: string; capacity: number
  pos_x: number; pos_y: number; shape: string; is_active: boolean; sort_order: number
  current_order_id: string | null
}

type Discount = {
  id: string; name: string; type: string; value: number
  is_active: boolean; requires_approval: boolean
}

interface Props {
  initialTables: PosTable[]
  config: Record<string, string>
  initialDiscounts: Discount[]
}

type Tab = 'floor' | 'charges' | 'discounts'

const TABS: { id: Tab; label: string }[] = [
  { id: 'floor', label: 'Floor Plan' },
  { id: 'charges', label: 'Charges' },
  { id: 'discounts', label: 'Discounts' },
]

const defaultTableForm = { name: '', section: '', capacity: '2', shape: 'rect' }
const defaultDiscountForm = { name: '', type: 'percent', value: '0', requires_approval: false }

export function POSSettingsClient({ initialTables, config: initialConfig, initialDiscounts }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<Tab>('floor')
  const [tables, setTables] = useState<PosTable[]>(initialTables)
  const [discounts, setDiscounts] = useState<Discount[]>(initialDiscounts)
  const [config, setConfig] = useState<Record<string, string>>(initialConfig)
  const [saving, setSaving] = useState(false)

  // Table modal
  const [tableModal, setTableModal] = useState<{ open: boolean; target: PosTable | null }>({ open: false, target: null })
  const [tableForm, setTableForm] = useState(defaultTableForm)

  // Discount modal
  const [discountModal, setDiscountModal] = useState<{ open: boolean; target: Discount | null }>({ open: false, target: null })
  const [discountForm, setDiscountForm] = useState(defaultDiscountForm)

  // ── helpers ────────────────────────────────────────────────────────────────

  const sections = [...new Set(tables.map(t => t.section))].filter(Boolean)

  function openAddTable() {
    setTableForm(defaultTableForm)
    setTableModal({ open: true, target: null })
  }

  function openEditTable(t: PosTable) {
    setTableForm({ name: t.name, section: t.section, capacity: String(t.capacity), shape: t.shape })
    setTableModal({ open: true, target: t })
  }

  function openAddDiscount() {
    setDiscountForm(defaultDiscountForm)
    setDiscountModal({ open: true, target: null })
  }

  function openEditDiscount(d: Discount) {
    setDiscountForm({ name: d.name, type: d.type, value: String(d.value), requires_approval: d.requires_approval })
    setDiscountModal({ open: true, target: d })
  }

  // ── Table CRUD ─────────────────────────────────────────────────────────────

  async function saveTable() {
    if (!tableForm.name.trim()) { toast('Table name is required', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        name: tableForm.name.trim(),
        section: tableForm.section.trim() || 'Main',
        capacity: Number(tableForm.capacity) || 2,
        shape: tableForm.shape,
      }

      if (tableModal.target) {
        const { data, error } = await supabase
          .from('pos_tables').update(payload).eq('id', tableModal.target.id).select().single()
        if (error) throw error
        setTables(prev => prev.map(t => t.id === data.id ? data : t))
        toast('Table updated', 'success')
      } else {
        const { data, error } = await supabase
          .from('pos_tables').insert({ ...payload, pos_x: 0, pos_y: 0, sort_order: tables.length, is_active: true }).select().single()
        if (error) throw error
        setTables(prev => [...prev, data])
        toast('Table added', 'success')
      }
      setTableModal({ open: false, target: null })
    } catch (e: any) {
      toast(e.message ?? 'Failed to save table', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTableActive(t: PosTable) {
    const { data, error } = await supabase
      .from('pos_tables').update({ is_active: !t.is_active }).eq('id', t.id).select().single()
    if (error) { toast('Failed to update table', 'error'); return }
    setTables(prev => prev.map(x => x.id === data.id ? data : x))
  }

  async function deleteTable(t: PosTable) {
    if (t.current_order_id) { toast('Cannot delete a table with an open order', 'error'); return }
    const { error } = await supabase.from('pos_tables').delete().eq('id', t.id)
    if (error) { toast('Failed to delete table', 'error'); return }
    setTables(prev => prev.filter(x => x.id !== t.id))
    toast('Table deleted', 'success')
  }

  // ── Charges ────────────────────────────────────────────────────────────────

  async function saveCharges() {
    setSaving(true)
    try {
      const pairs = [
        { key: 'service_charge_enabled', value: config['service_charge_enabled'] ?? 'false' },
        { key: 'service_charge_pct', value: config['service_charge_pct'] ?? '0' },
        { key: 'tax_enabled', value: config['tax_enabled'] ?? 'false' },
        { key: 'tax_pct', value: config['tax_pct'] ?? '0' },
        { key: 'receipt_footer_note', value: config['receipt_footer_note'] ?? '' },
      ]
      const { error } = await supabase.from('pos_config').upsert(pairs, { onConflict: 'key' })
      if (error) throw error
      toast('Charges saved', 'success')
    } catch (e: any) {
      toast(e.message ?? 'Failed to save charges', 'error')
    } finally {
      setSaving(false)
    }
  }

  function setConfigKey(key: string, value: string) {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  // ── Discount CRUD ──────────────────────────────────────────────────────────

  async function saveDiscount() {
    if (!discountForm.name.trim()) { toast('Discount name is required', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        name: discountForm.name.trim(),
        type: discountForm.type,
        value: Number(discountForm.value) || 0,
        requires_approval: discountForm.requires_approval,
      }

      if (discountModal.target) {
        const { data, error } = await supabase
          .from('pos_discounts').update(payload).eq('id', discountModal.target.id).select().single()
        if (error) throw error
        setDiscounts(prev => prev.map(d => d.id === data.id ? data : d))
        toast('Discount updated', 'success')
      } else {
        const { data, error } = await supabase
          .from('pos_discounts').insert({ ...payload, is_active: true }).select().single()
        if (error) throw error
        setDiscounts(prev => [...prev, data])
        toast('Discount added', 'success')
      }
      setDiscountModal({ open: false, target: null })
    } catch (e: any) {
      toast(e.message ?? 'Failed to save discount', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleDiscountActive(d: Discount) {
    const { data, error } = await supabase
      .from('pos_discounts').update({ is_active: !d.is_active }).eq('id', d.id).select().single()
    if (error) { toast('Failed to update discount', 'error'); return }
    setDiscounts(prev => prev.map(x => x.id === data.id ? data : x))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const tablesBySection = sections.length
    ? sections.map(s => ({ section: s, items: tables.filter(t => t.section === s) }))
    : [{ section: 'Main', items: tables }]

  return (
    <div className="min-h-screen bg-[#0C0C0F] text-[#F0EEF6]">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <TopBar
          title="POS Settings"
          subtitle="Configure floor plan, charges and discounts"
          actions={
            <div className="flex items-center gap-1.5 text-[#9896A4] bg-[#141417] border border-[#2A2A30] px-3 py-1.5 rounded-lg text-xs">
              <Settings size={12} />
              Settings
            </div>
          }
        />

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#141417] border border-[#2A2A30] rounded-xl mb-6 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[#8B5CF6] text-white shadow'
                  : 'text-[#9896A4] hover:text-[#F0EEF6] hover:bg-[#1A1A1E]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB 1: Floor Plan ── */}
        {activeTab === 'floor' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#9896A4] text-sm">{tables.length} tables across {sections.length || 1} section(s)</p>
              <button
                onClick={openAddTable}
                className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={14} /> Add Table
              </button>
            </div>

            <div className="space-y-6">
              {tablesBySection.map(({ section, items }) => (
                <div key={section}>
                  <h3 className="text-[#9896A4] text-xs font-semibold uppercase tracking-wider mb-3 px-1">
                    {section}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {items.map(t => (
                      <div
                        key={t.id}
                        className={`relative bg-[#141417] border rounded-xl p-4 transition-all ${
                          t.is_active ? 'border-[#2A2A30]' : 'border-[#1E1E24] opacity-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div
                            className={`w-8 h-8 flex items-center justify-center text-xs font-bold text-white ${
                              t.shape === 'round' ? 'rounded-full' : 'rounded-md'
                            } bg-[#8B5CF6]/20 border border-[#8B5CF6]/30`}
                          >
                            {t.name.charAt(0)}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleTableActive(t)}
                              className="p-1 rounded text-[#5A5865] hover:text-[#9896A4] transition-colors"
                              title={t.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {t.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
                            </button>
                            <button
                              onClick={() => openEditTable(t)}
                              className="p-1 rounded text-[#5A5865] hover:text-[#9896A4] transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            {!t.current_order_id && (
                              <button
                                onClick={() => deleteTable(t)}
                                className="p-1 rounded text-[#5A5865] hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[#F0EEF6] text-sm font-semibold">{t.name}</p>
                        <p className="text-[#5A5865] text-xs mt-0.5">
                          {t.capacity} seats · {t.shape}
                        </p>
                        {t.current_order_id && (
                          <span className="inline-block mt-2 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                            Occupied
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 2: Charges ── */}
        {activeTab === 'charges' && (
          <div className="max-w-lg space-y-5">
            {/* Service charge */}
            <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[#F0EEF6] text-sm font-medium">Service Charge</p>
                  <p className="text-[#5A5865] text-xs mt-0.5">Applied to subtotal</p>
                </div>
                <button
                  onClick={() => setConfigKey('service_charge_enabled', config['service_charge_enabled'] === 'true' ? 'false' : 'true')}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    config['service_charge_enabled'] === 'true' ? 'bg-[#8B5CF6]' : 'bg-[#2A2A30]'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    config['service_charge_enabled'] === 'true' ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              {config['service_charge_enabled'] === 'true' && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={config['service_charge_pct'] ?? '10'}
                      onChange={e => setConfigKey('service_charge_pct', e.target.value)}
                      className="w-full bg-[#0C0C0F] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm pr-8 focus:outline-none focus:border-[#8B5CF6]"
                    />
                    <Percent size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
                  </div>
                  <span className="text-[#5A5865] text-xs">0 – 30%</span>
                </div>
              )}
            </div>

            {/* Tax */}
            <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[#F0EEF6] text-sm font-medium">Tax (SST / GST)</p>
                  <p className="text-[#5A5865] text-xs mt-0.5">Applied to subtotal</p>
                </div>
                <button
                  onClick={() => setConfigKey('tax_enabled', config['tax_enabled'] === 'true' ? 'false' : 'true')}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    config['tax_enabled'] === 'true' ? 'bg-[#8B5CF6]' : 'bg-[#2A2A30]'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    config['tax_enabled'] === 'true' ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              {config['tax_enabled'] === 'true' && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={config['tax_pct'] ?? '6'}
                      onChange={e => setConfigKey('tax_pct', e.target.value)}
                      className="w-full bg-[#0C0C0F] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm pr-8 focus:outline-none focus:border-[#8B5CF6]"
                    />
                    <Percent size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
                  </div>
                  <span className="text-[#5A5865] text-xs">0 – 30%</span>
                </div>
              )}
            </div>

            {/* Currency (read-only) */}
            <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-5">
              <p className="text-[#F0EEF6] text-sm font-medium mb-1">Currency</p>
              <div className="flex items-center gap-2 mt-2">
                <DollarSign size={14} className="text-[#5A5865]" />
                <span className="text-[#9896A4] text-sm">MYR — Malaysian Ringgit</span>
              </div>
            </div>

            {/* Receipt footer */}
            <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-5">
              <p className="text-[#F0EEF6] text-sm font-medium mb-1">Receipt Footer Note</p>
              <p className="text-[#5A5865] text-xs mb-3">Printed at the bottom of every receipt</p>
              <input
                type="text"
                value={config['receipt_footer_note'] ?? ''}
                onChange={e => setConfigKey('receipt_footer_note', e.target.value)}
                placeholder="Thank you for dining with us!"
                className="w-full bg-[#0C0C0F] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] placeholder-[#3A3840]"
              />
            </div>

            <button
              onClick={saveCharges}
              disabled={saving}
              className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
            >
              {saving ? 'Saving…' : 'Save Charges'}
            </button>
          </div>
        )}

        {/* ── TAB 3: Discounts ── */}
        {activeTab === 'discounts' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#9896A4] text-sm">{discounts.length} discount(s) configured</p>
              <button
                onClick={openAddDiscount}
                className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={14} /> Add Discount
              </button>
            </div>

            <div className="space-y-2">
              {discounts.map(d => (
                <div
                  key={d.id}
                  className={`flex items-center gap-4 bg-[#141417] border rounded-xl px-4 py-3 transition-all ${
                    d.is_active ? 'border-[#2A2A30]' : 'border-[#1E1E24] opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex-shrink-0">
                    <Tag size={14} className="text-[#A78BFA]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#F0EEF6] text-sm font-medium truncate">{d.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        d.type === 'percent'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {d.type === 'percent' ? <Percent size={9} /> : <DollarSign size={9} />}
                        {d.type === 'percent' ? `${d.value}%` : `RM ${d.value}`}
                      </span>
                      {d.requires_approval && (
                        <span className="inline-block text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                          Approval required
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleDiscountActive(d)}
                      className="p-1.5 rounded-lg text-[#5A5865] hover:text-[#9896A4] transition-colors"
                      title={d.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {d.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      onClick={() => openEditDiscount(d)}
                      className="p-1.5 rounded-lg text-[#5A5865] hover:text-[#9896A4] transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {discounts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Tag size={32} className="text-[#2A2A30] mb-3" />
                  <p className="text-[#5A5865] text-sm">No discounts yet</p>
                  <p className="text-[#3A3840] text-xs mt-1">Add your first discount to get started</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table Modal */}
      <Modal
        isOpen={tableModal.open}
        onClose={() => setTableModal({ open: false, target: null })}
        title={tableModal.target ? 'Edit Table' : 'Add Table'}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Name</label>
            <input
              type="text"
              value={tableForm.name}
              onChange={e => setTableForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. T1, Window Seat"
              className="w-full bg-[#0C0C0F] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] placeholder-[#3A3840]"
            />
          </div>

          <div>
            <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Section</label>
            <input
              type="text"
              value={tableForm.section}
              onChange={e => setTableForm(f => ({ ...f, section: e.target.value }))}
              placeholder="e.g. Main, Patio, VIP"
              list="section-list"
              className="w-full bg-[#0C0C0F] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] placeholder-[#3A3840]"
            />
            <datalist id="section-list">
              {sections.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Capacity</label>
            <input
              type="number"
              min={1}
              max={20}
              value={tableForm.capacity}
              onChange={e => setTableForm(f => ({ ...f, capacity: e.target.value }))}
              className="w-full bg-[#0C0C0F] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div>
            <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Shape</label>
            <select
              value={tableForm.shape}
              onChange={e => setTableForm(f => ({ ...f, shape: e.target.value }))}
              className="w-full bg-[#0C0C0F] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
            >
              <option value="rect">Rectangle</option>
              <option value="round">Round</option>
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setTableModal({ open: false, target: null })}
              className="flex-1 bg-[#1A1A1E] hover:bg-[#2A2A30] text-[#9896A4] text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveTable}
              disabled={saving}
              className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              {saving ? 'Saving…' : tableModal.target ? 'Save Changes' : 'Add Table'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Discount Modal */}
      <Modal
        isOpen={discountModal.open}
        onClose={() => setDiscountModal({ open: false, target: null })}
        title={discountModal.target ? 'Edit Discount' : 'Add Discount'}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Name</label>
            <input
              type="text"
              value={discountForm.name}
              onChange={e => setDiscountForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Staff Discount, Happy Hour"
              className="w-full bg-[#0C0C0F] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6] placeholder-[#3A3840]"
            />
          </div>

          <div>
            <label className="block text-[#9896A4] text-xs font-medium mb-1.5">Type</label>
            <select
              value={discountForm.type}
              onChange={e => setDiscountForm(f => ({ ...f, type: e.target.value }))}
              className="w-full bg-[#0C0C0F] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
            >
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Fixed Amount (RM)</option>
            </select>
          </div>

          <div>
            <label className="block text-[#9896A4] text-xs font-medium mb-1.5">
              Value {discountForm.type === 'percent' ? '(%)' : '(RM)'}
            </label>
            <input
              type="number"
              min={0}
              value={discountForm.value}
              onChange={e => setDiscountForm(f => ({ ...f, value: e.target.value }))}
              className="w-full bg-[#0C0C0F] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={discountForm.requires_approval}
              onChange={e => setDiscountForm(f => ({ ...f, requires_approval: e.target.checked }))}
              className="w-4 h-4 rounded border-[#2A2A30] accent-[#8B5CF6]"
            />
            <span className="text-[#9896A4] text-sm">Requires manager approval</span>
          </label>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setDiscountModal({ open: false, target: null })}
              className="flex-1 bg-[#1A1A1E] hover:bg-[#2A2A30] text-[#9896A4] text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveDiscount}
              disabled={saving}
              className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              {saving ? 'Saving…' : discountModal.target ? 'Save Changes' : 'Add Discount'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
