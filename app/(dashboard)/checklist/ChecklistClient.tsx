'use client'
import { useState, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { CheckSquare, Square, Plus, Trash2, ClipboardList, Sun, Moon, History, ChevronDown, ChevronUp } from 'lucide-react'

type ChecklistItem = {
  id: string
  type: 'opening' | 'closing'
  text: string
  sort_order: number
  is_active: boolean
  created_at: string
}

type ChecklistLog = {
  id: string
  date: string
  type: 'opening' | 'closing'
  user_id: string
  user_name: string
  submitted_at: string
  notes: string | null
  items_checked: string[]
  total_items: number
}

type Props = {
  initialItems: ChecklistItem[]
  initialLogs: ChecklistLog[]
  userId: string
  userName: string
  isAdmin: boolean
}

export function ChecklistClient({ initialItems, initialLogs, userId, userName, isAdmin }: Props) {
  const supabase = createClient()
  const { toast } = useToast()

  const [items, setItems] = useState<ChecklistItem[]>(initialItems)
  const [logs, setLogs] = useState<ChecklistLog[]>(initialLogs)
  const [tab, setTab] = useState<'opening' | 'closing'>('opening')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Admin: add/remove items
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newItemText, setNewItemText] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const tabItems = useMemo(() => items.filter(i => i.type === tab), [items, tab])
  const tabLogs = useMemo(() => logs.filter(l => l.type === tab), [logs, tab])

  const allChecked = tabItems.length > 0 && tabItems.every(i => checked.has(i.id))
  const checkedCount = tabItems.filter(i => checked.has(i.id)).length

  // Today's submission for this type
  const today = new Date().toISOString().split('T')[0]
  const todayLog = tabLogs.find(l => l.date === today)

  const toggleItem = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!allChecked) return
    setSubmitting(true)
    try {
      const itemsChecked = tabItems.map(i => i.text)
      const { data, error } = await supabase.from('checklist_logs').insert({
        date: today,
        type: tab,
        user_id: userId,
        user_name: userName,
        submitted_at: new Date().toISOString(),
        notes: notes.trim() || null,
        items_checked: itemsChecked,
        total_items: tabItems.length,
      }).select().single()
      if (error) throw error
      setLogs(prev => [data as ChecklistLog, ...prev])
      setChecked(new Set())
      setNotes('')
      toast(`${tab === 'opening' ? 'Opening' : 'Closing'} checklist submitted!`, 'success')
    } catch (err: any) {
      toast(err.message ?? 'Failed to submit', 'error')
    }
    setSubmitting(false)
  }

  const handleAddItem = async () => {
    if (!newItemText.trim()) return
    setAddingItem(true)
    try {
      const { data, error } = await supabase.from('checklist_items').insert({
        type: tab,
        text: newItemText.trim(),
        sort_order: tabItems.length,
        is_active: true,
      }).select().single()
      if (error) throw error
      setItems(prev => [...prev, data as ChecklistItem])
      setNewItemText('')
      setAddModalOpen(false)
      toast('Item added', 'success')
    } catch (err: any) {
      toast(err.message ?? 'Failed to add item', 'error')
    }
    setAddingItem(false)
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Remove this checklist item?')) return
    setDeletingId(id)
    const { error } = await supabase.from('checklist_items').update({ is_active: false }).eq('id', id)
    if (error) { toast(error.message, 'error'); setDeletingId(null); return }
    setItems(prev => prev.filter(i => i.id !== id))
    setChecked(prev => { const n = new Set(prev); n.delete(id); return n })
    toast('Item removed', 'success')
    setDeletingId(null)
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-5">
      <TopBar
        title="Checklist"
        subtitle="Daily opening & closing procedures"
        actions={
          isAdmin ? (
            <button onClick={() => setAddModalOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Add Item
            </button>
          ) : undefined
        }
      />

      {/* Tab switcher */}
      <div className="flex gap-2">
        {([
          { key: 'opening', label: 'Opening', icon: Sun },
          { key: 'closing', label: 'Closing', icon: Moon },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setChecked(new Set()); setNotes('') }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all border ${
              tab === key
                ? key === 'opening'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30 text-[#A78BFA]'
                : 'border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Today's status banner */}
      {todayLog && (
        <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3">
          <CheckSquare size={18} className="text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-emerald-400 text-sm font-medium">
              {tab === 'opening' ? 'Opening' : 'Closing'} checklist completed today
            </p>
            <p className="text-[#9896A4] text-xs mt-0.5">
              Submitted by {todayLog.user_name} at {formatTime(todayLog.submitted_at)}
              {todayLog.notes && ` · "${todayLog.notes}"`}
            </p>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      {!todayLog && tabItems.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-[#1A1A1E] rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${tab === 'opening' ? 'bg-amber-400' : 'bg-[#8B5CF6]'}`}
              style={{ width: `${tabItems.length > 0 ? (checkedCount / tabItems.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-[#9896A4] text-xs shrink-0">{checkedCount}/{tabItems.length}</span>
        </div>
      )}

      {/* Checklist items */}
      <div className="space-y-2">
        {tabItems.length === 0 ? (
          <div className="card text-center py-10">
            <ClipboardList size={32} className="text-[#5A5865] mx-auto mb-3" />
            <p className="text-[#5A5865] text-sm">No items yet</p>
            {isAdmin && (
              <button onClick={() => setAddModalOpen(true)} className="btn-primary mt-4 text-xs">
                Add First Item
              </button>
            )}
          </div>
        ) : tabItems.map((item, idx) => {
          const isChecked = checked.has(item.id)
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                isChecked
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-[#0D0D0F] border-[#2A2A30] hover:border-[#3A3A40]'
              }`}
              onClick={() => !todayLog && toggleItem(item.id)}
            >
              <div className="shrink-0 mt-0.5">
                {isChecked
                  ? <CheckSquare size={20} className="text-emerald-400" />
                  : <Square size={20} className="text-[#5A5865]" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm leading-relaxed ${isChecked ? 'text-[#9896A4] line-through' : 'text-[#F0EEF6]'}`}>
                  <span className="text-[#5A5865] text-xs mr-2">{idx + 1}.</span>
                  {item.text}
                </span>
              </div>
              {isAdmin && (
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteItem(item.id) }}
                  disabled={deletingId === item.id}
                  className="shrink-0 text-[#3A3A40] hover:text-red-400 transition-colors p-1 disabled:opacity-40"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Notes + Submit */}
      {!todayLog && tabItems.length > 0 && (
        <div className="card space-y-3">
          <div>
            <label className="label">Notes / Anything to flag (optional)</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="e.g. Ice machine making noise, low stock on garnish..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!allChecked || submitting}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
              allChecked
                ? tab === 'opening'
                  ? 'bg-amber-500 hover:bg-amber-400 text-black'
                  : 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white'
                : 'bg-[#1A1A1E] text-[#5A5865] cursor-not-allowed'
            }`}
          >
            {submitting ? 'Submitting...' : allChecked ? `Submit ${tab === 'opening' ? 'Opening' : 'Closing'} Checklist` : `Tick all ${tabItems.length} items to submit`}
          </button>
        </div>
      )}

      {/* History */}
      {tabLogs.length > 0 && (
        <div className="card">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <History size={14} className="text-[#9896A4]" />
              <p className="text-[#F0EEF6] text-sm font-medium">
                {tab === 'opening' ? 'Opening' : 'Closing'} History
              </p>
              <span className="text-[#5A5865] text-xs">({tabLogs.length} entries)</span>
            </div>
            {showHistory ? <ChevronUp size={14} className="text-[#9896A4]" /> : <ChevronDown size={14} className="text-[#9896A4]" />}
          </button>

          {showHistory && (
            <div className="mt-4 space-y-3">
              {tabLogs.map(log => (
                <div key={log.id} className="bg-[#0D0D0F] rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[#F0EEF6] text-sm font-medium">{formatTime(log.submitted_at)}</p>
                      <p className="text-[#9896A4] text-xs mt-0.5">
                        {log.user_name} · {log.total_items} items completed
                      </p>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                      ✓ Done
                    </span>
                  </div>
                  {log.notes && (
                    <p className="text-[#9896A4] text-xs bg-[#1A1A1E] rounded-lg px-3 py-2">
                      📝 {log.notes}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {log.items_checked.map((text, i) => (
                      <span key={i} className="text-[10px] text-[#5A5865] bg-[#1A1A1E] px-2 py-0.5 rounded-full">
                        ✓ {text.length > 40 ? text.slice(0, 40) + '…' : text}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Item Modal */}
      <Modal isOpen={addModalOpen} onClose={() => { setAddModalOpen(false); setNewItemText('') }} title={`Add ${tab === 'opening' ? 'Opening' : 'Closing'} Item`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Checklist Item</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder={tab === 'opening' ? 'e.g. Check ice levels and fill ice bins' : 'e.g. Dispose of cut garnishes'}
              value={newItemText}
              onChange={e => setNewItemText(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setAddModalOpen(false); setNewItemText('') }} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleAddItem} disabled={addingItem || !newItemText.trim()} className="btn-primary flex-1 disabled:opacity-50">
              {addingItem ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
