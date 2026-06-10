'use client'
import { useState, useRef, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Upload, FileText, ExternalLink, Loader2, User, Clock, Link2, Calendar, Search, Filter, X } from 'lucide-react'
import type { Database } from '@/types/database'

type Receipt = Database['public']['Tables']['receipts']['Row'] & {
  expenses?: { description: string; amount: number; date: string; category: string } | null
  users?: { full_name: string } | null
  claimed_by?: string | null
}

type Expense = { id: string; description: string; amount: number; date: string; category: string }

interface Props {
  initialReceipts: Receipt[]
  expenses: Expense[]
  currentUserId: string
}

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString('en-MY', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export function ReceiptsClient({ initialReceipts, expenses, currentUserId }: Props) {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<Receipt | null>(null)
  const [linkExpenseId, setLinkExpenseId] = useState('')
  const [claimedByInput, setClaimedByInput] = useState('')
  const [linking, setLinking] = useState(false)

  // Filters
  const [searchName, setSearchName] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const supabase = createClient()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split('.').pop()
    const fileName = `receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: storageError } = await supabase.storage
      .from('receipts')
      .upload(fileName, file, { upsert: false })

    if (storageError) {
      toast(`Upload failed: ${storageError.message}`, 'error')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)

    const { error, data } = await supabase.from('receipts').insert({
      file_url: publicUrl,
      file_type: file.type,
      file_name: file.name,
      file_size: file.size,
      ocr_extracted: false,
      uploaded_by: currentUserId || null,
    } as any).select('*, expenses(description, amount, date, category), users(full_name)').single()

    if (error) { toast(error.message, 'error') }
    else {
      toast('Receipt uploaded', 'success')
      setReceipts(prev => [data as Receipt, ...prev])
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSaveDetails = async () => {
    if (!selected) return
    setLinking(true)

    const updates: any = {}
    if (linkExpenseId) updates.expense_id = linkExpenseId
    updates.claimed_by = claimedByInput || null

    const { error, data } = await supabase
      .from('receipts')
      .update(updates)
      .eq('id', selected.id)
      .select('*, expenses(description, amount, date, category), users(full_name)')
      .single()

    if (error) { toast(error.message, 'error') }
    else {
      toast('Receipt updated', 'success')
      const updated = data as Receipt
      setReceipts(prev => prev.map(r => r.id === updated.id ? updated : r))
      setSelected(updated)
    }
    setLinking(false)
  }

  const isImage = (type: string) => type.startsWith('image/')

  // All unique claimed_by names for suggestions
  const knownNames = useMemo(() => {
    const names = new Set(receipts.map(r => r.claimed_by).filter(Boolean) as string[])
    return Array.from(names)
  }, [receipts])

  // Filtered receipts
  const filtered = useMemo(() => {
    return receipts.filter(r => {
      if (searchName) {
        const name = (r.claimed_by ?? r.users?.full_name ?? '').toLowerCase()
        if (!name.includes(searchName.toLowerCase())) return false
      }
      if (filterDateFrom) {
        const uploaded = r.created_at.split('T')[0]
        if (uploaded < filterDateFrom) return false
      }
      if (filterDateTo) {
        const uploaded = r.created_at.split('T')[0]
        if (uploaded > filterDateTo) return false
      }
      return true
    })
  }, [receipts, searchName, filterDateFrom, filterDateTo])

  const hasFilters = searchName || filterDateFrom || filterDateTo
  const unlinked = filtered.filter(r => !r.expense_id)
  const linked = filtered.filter(r => r.expense_id)

  return (
    <div className="space-y-5">
      <TopBar
        title="Receipts"
        subtitle={`${receipts.length} total · ${receipts.filter(r => r.expense_id).length} linked`}
      />

      {/* Upload area */}
      <div
        className="border-2 border-dashed border-[#2A2A30] rounded-xl p-6 text-center cursor-pointer hover:border-[#8B5CF6] transition-all"
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="text-[#8B5CF6] animate-spin" />
            <p className="text-[#9896A4] text-sm">Uploading receipt...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={28} className="text-[#3A3A42]" />
            <p className="text-[#F0EEF6] font-medium text-sm">Upload Receipt</p>
            <p className="text-[#5A5865] text-xs">JPG, PNG, PDF supported</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleUpload} className="hidden" />
      </div>

      {/* Filters */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2 text-[#9896A4] text-xs font-medium">
          <Filter size={12} /> Filters
          {hasFilters && (
            <button
              onClick={() => { setSearchName(''); setFilterDateFrom(''); setFilterDateTo('') }}
              className="ml-auto flex items-center gap-1 text-[#8B5CF6] hover:text-[#A78BFA]"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Name filter */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
            <input
              type="text"
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              placeholder="Filter by name..."
              className="input pl-8"
              list="known-names"
            />
            <datalist id="known-names">
              {knownNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
          {/* Date from */}
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="input pl-8"
            />
          </div>
          {/* Date to */}
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="input pl-8"
            />
          </div>
        </div>
        {hasFilters && (
          <p className="text-[#9896A4] text-xs">{filtered.length} of {receipts.length} receipts shown</p>
        )}
      </div>

      {receipts.length === 0 ? (
        <EmptyState icon={<FileText size={40} />} title="No receipts uploaded" description="Upload your first receipt above" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search size={40} />} title="No receipts match your filters" action={<button onClick={() => { setSearchName(''); setFilterDateFrom(''); setFilterDateTo('') }} className="btn-secondary">Clear Filters</button>} />
      ) : (
        <div className="space-y-6">
          {unlinked.length > 0 && (
            <div>
              <p className="text-[#5A5865] text-xs font-medium uppercase tracking-wider mb-3">Unlinked ({unlinked.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {unlinked.map(receipt => (
                  <ReceiptCard key={receipt.id} receipt={receipt} isImage={isImage}
                    onClick={() => { setSelected(receipt); setLinkExpenseId(receipt.expense_id ?? ''); setClaimedByInput(receipt.claimed_by ?? '') }} />
                ))}
              </div>
            </div>
          )}
          {linked.length > 0 && (
            <div>
              <p className="text-[#5A5865] text-xs font-medium uppercase tracking-wider mb-3">Linked to Expenses ({linked.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {linked.map(receipt => (
                  <ReceiptCard key={receipt.id} receipt={receipt} isImage={isImage}
                    onClick={() => { setSelected(receipt); setLinkExpenseId(receipt.expense_id ?? ''); setClaimedByInput(receipt.claimed_by ?? '') }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Receipt Details" size="md">
          <div className="space-y-4">
            <div className="aspect-video rounded-xl overflow-hidden bg-[#1A1A1E] flex items-center justify-center">
              {isImage(selected.file_type) ? (
                <img src={selected.file_url} alt={selected.file_name} className="w-full h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-[#5A5865]">
                  <FileText size={48} />
                  <p className="text-sm">PDF Document</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-[#1A1A1E] rounded-lg p-3">
                <p className="text-[#5A5865] text-xs mb-1 flex items-center gap-1"><Clock size={10} /> Uploaded</p>
                <p className="text-[#F0EEF6] text-xs">{formatDateTime(selected.created_at)}</p>
              </div>
              <div className="bg-[#1A1A1E] rounded-lg p-3">
                <p className="text-[#5A5865] text-xs mb-1 flex items-center gap-1"><User size={10} /> Uploaded by</p>
                <p className="text-[#F0EEF6] text-xs font-medium">{selected.users?.full_name ?? 'Unknown'}</p>
              </div>
            </div>

            {/* Belongs to */}
            <div>
              <label className="label">Belongs to (claimant)</label>
              <input
                type="text"
                value={claimedByInput}
                onChange={e => setClaimedByInput(e.target.value)}
                className="input"
                placeholder="e.g. Rajiv, Ahmad, Partner name..."
                list="modal-known-names"
              />
              <datalist id="modal-known-names">
                {knownNames.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>

            {/* Linked expense info */}
            {selected.expenses && (
              <div className="bg-[#1A1A1E] rounded-xl p-3 border border-[#2A2A30]">
                <p className="text-[#5A5865] text-xs uppercase tracking-wider mb-2">Linked Expense</p>
                <p className="text-[#F0EEF6] font-medium text-sm">{selected.expenses.description}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="badge-purple text-xs">{EXPENSE_CATEGORY_LABELS[selected.expenses.category] ?? selected.expenses.category}</span>
                  <span className="text-emerald-400 text-sm font-bold">{formatCurrency(selected.expenses.amount)}</span>
                </div>
              </div>
            )}

            {/* Link to expense */}
            <div>
              <label className="label">Link to Expense</label>
              <select value={linkExpenseId} onChange={e => setLinkExpenseId(e.target.value)} className="input">
                <option value="">Select expense (optional)</option>
                {expenses.map(exp => (
                  <option key={exp.id} value={exp.id}>
                    {new Date(exp.date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })} — {exp.description} ({formatCurrency(exp.amount)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setSelected(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSaveDetails} disabled={linking} className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2">
                <Link2 size={13} /> {linking ? 'Saving...' : 'Save'}
              </button>
            </div>

            <a href={selected.file_url} target="_blank" rel="noopener noreferrer"
              className="btn-secondary w-full flex items-center justify-center gap-2 text-sm">
              <ExternalLink size={14} /> Open Full Size
            </a>
          </div>
        </Modal>
      )}
    </div>
  )
}

function ReceiptCard({ receipt, isImage, onClick }: { receipt: Receipt; isImage: (t: string) => boolean; onClick: () => void }) {
  return (
    <div className="card-hover cursor-pointer" onClick={onClick}>
      <div className="aspect-square rounded-lg overflow-hidden bg-[#1A1A1E] mb-3 flex items-center justify-center relative">
        {isImage(receipt.file_type) ? (
          <img src={receipt.file_url} alt={receipt.file_name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#5A5865]">
            <FileText size={32} />
            <p className="text-xs">PDF</p>
          </div>
        )}
        {receipt.expense_id && (
          <div className="absolute top-1.5 right-1.5 bg-emerald-500/80 rounded-full p-0.5">
            <Link2 size={10} className="text-white" />
          </div>
        )}
      </div>
      <p className="text-[#F0EEF6] text-xs font-medium truncate">{receipt.file_name}</p>
      <div className="flex items-center gap-1 mt-1">
        <Clock size={9} className="text-[#5A5865]" />
        <p className="text-[#5A5865] text-[10px]">{formatDateTime(receipt.created_at)}</p>
      </div>
      {receipt.claimed_by ? (
        <div className="flex items-center gap-1 mt-0.5">
          <User size={9} className="text-[#8B5CF6]" />
          <p className="text-[#A78BFA] text-[10px] font-medium truncate">{receipt.claimed_by}</p>
        </div>
      ) : (
        <div className="flex items-center gap-1 mt-0.5">
          <User size={9} className="text-[#5A5865]" />
          <p className="text-[#5A5865] text-[10px] truncate">{receipt.users?.full_name ?? 'Unknown'}</p>
        </div>
      )}
      {receipt.expenses && (
        <p className="text-emerald-400 text-[10px] mt-1 truncate">{receipt.expenses.description}</p>
      )}
    </div>
  )
}
