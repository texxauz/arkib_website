'use client'
import { useState, useRef, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, FileText, ExternalLink, Loader2, User, Clock,
  Link2, Calendar, Search, Filter, X, Trash2, Sparkles,
  AlertTriangle, LayoutGrid, List
} from 'lucide-react'
import type { Database } from '@/types/database'

type Receipt = Database['public']['Tables']['receipts']['Row'] & {
  expenses?: { description: string; amount: number; date: string; category: string } | null
  users?: { full_name: string } | null
  claimed_by?: string | null
  ocr_amount?: number | null
  ocr_extracted?: boolean
}

type Expense = { id: string; description: string; amount: number; date: string; category: string }

interface ExtractedData {
  items: { description: string; amount: number }[]
  subtotal: number | null
  tax: number | null
  service_charge: number | null
  total: number | null
  currency: string | null
  date: string | null
  vendor: string | null
}

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

async function extractFromImage(imageUrl: string, fileType: string): Promise<ExtractedData | null> {
  try {
    const res = await fetch('/api/receipts/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, fileType }),
    })
    const json = await res.json()
    return json.success ? json.data : null
  } catch {
    return null
  }
}

export function ReceiptsClient({ initialReceipts, expenses, currentUserId }: Props) {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts)
  const [uploading, setUploading] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Receipt | null>(null)
  const [linkExpenseId, setLinkExpenseId] = useState('')
  const [claimedByInput, setClaimedByInput] = useState('')
  const [linking, setLinking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

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

    if (error) {
      toast(error.message, 'error')
      setUploading(false)
      return
    }

    const newReceipt = data as Receipt
    setReceipts(prev => [newReceipt, ...prev])
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''

    // Auto-extract if image
    if (file.type.startsWith('image/')) {
      setUploadingId(newReceipt.id)
      toast('Extracting amounts with AI...', 'info')
      const extracted = await extractFromImage(publicUrl, file.type)

      if (extracted?.total != null) {
        const { data: updated } = await supabase
          .from('receipts')
          .update({
            ocr_amount: extracted.total,
            ocr_extracted: true,
            ocr_supplier_name: extracted.vendor ?? null,
            ocr_date: extracted.date ?? null,
            ocr_raw_text: JSON.stringify(extracted),
          } as any)
          .eq('id', newReceipt.id)
          .select('*, expenses(description, amount, date, category), users(full_name)')
          .single()

        if (updated) {
          setReceipts(prev => prev.map(r => r.id === newReceipt.id ? updated as Receipt : r))
          toast(`Extracted: RM ${extracted.total!.toFixed(2)}`, 'success')
        }
      } else {
        toast('Receipt uploaded (could not extract amount)', 'info')
      }
      setUploadingId(null)
    } else {
      toast('Receipt uploaded', 'success')
    }
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
      toast('Receipt saved', 'success')
      setReceipts(prev => prev.map(r => r.id === (data as Receipt).id ? data as Receipt : r))
      setSelected(null)
    }
    setLinking(false)
  }

  const handleDelete = async () => {
    if (!selected) return
    setDeleting(true)

    const url = selected.file_url
    const pathMatch = url.match(/receipts\/(.+)$/)
    if (pathMatch) {
      await supabase.storage.from('receipts').remove([`receipts/${pathMatch[1]}`])
    }

    const { error } = await supabase.from('receipts').delete().eq('id', selected.id)
    if (error) { toast(error.message, 'error') }
    else {
      toast('Receipt deleted', 'success')
      setReceipts(prev => prev.filter(r => r.id !== selected.id))
      setSelected(null)
      setConfirmDelete(false)
    }
    setDeleting(false)
  }

  const isImage = (type: string) => type.startsWith('image/')

  const knownNames = useMemo(() => {
    const names = new Set(receipts.map(r => r.claimed_by).filter(Boolean) as string[])
    return Array.from(names)
  }, [receipts])

  const filtered = useMemo(() => {
    return receipts.filter(r => {
      if (searchName) {
        const name = (r.claimed_by ?? r.users?.full_name ?? '').toLowerCase()
        if (!name.includes(searchName.toLowerCase())) return false
      }
      if (filterDateFrom && r.created_at.split('T')[0] < filterDateFrom) return false
      if (filterDateTo && r.created_at.split('T')[0] > filterDateTo) return false
      return true
    })
  }, [receipts, searchName, filterDateFrom, filterDateTo])

  const hasFilters = searchName || filterDateFrom || filterDateTo
  const totalExtracted = filtered.reduce((sum, r) => sum + (r.ocr_amount ? Number(r.ocr_amount) : 0), 0)

  return (
    <div className="space-y-5">
      <TopBar
        title="Receipts"
        subtitle={`${receipts.length} total · ${receipts.filter(r => r.ocr_extracted).length} AI-extracted`}
        actions={
          <div className="flex items-center gap-1 bg-[#141417] border border-[#2A2A30] rounded-lg p-1">
            <button onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-[#8B5CF6] text-white' : 'text-[#5A5865] hover:text-[#F0EEF6]'}`}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-[#8B5CF6] text-white' : 'text-[#5A5865] hover:text-[#F0EEF6]'}`}>
              <List size={14} />
            </button>
          </div>
        }
      />

      {/* Upload area */}
      <div
        className="border-2 border-dashed border-[#2A2A30] rounded-xl p-6 text-center cursor-pointer hover:border-[#8B5CF6] transition-all"
        onClick={() => !uploading && fileRef.current?.click()}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={28} className="text-[#8B5CF6] animate-spin" />
            <p className="text-[#9896A4] text-sm">Uploading & extracting amounts...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={28} className="text-[#3A3A42]" />
            <p className="text-[#F0EEF6] font-medium text-sm">Upload Receipt</p>
            <p className="text-[#5A5865] text-xs">JPG, PNG, PDF · amounts auto-extracted with AI</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleUpload} className="hidden" />
      </div>

      {/* Filters */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2 text-[#9896A4] text-xs font-medium">
          <Filter size={12} /> Filters
          {hasFilters && (
            <button onClick={() => { setSearchName(''); setFilterDateFrom(''); setFilterDateTo('') }}
              className="ml-auto flex items-center gap-1 text-[#8B5CF6] hover:text-[#A78BFA] text-xs">
              <X size={11} /> Clear
            </button>
          )}
          {totalExtracted > 0 && (
            <span className="ml-auto text-emerald-400 font-bold text-xs">
              Total: {formatCurrency(totalExtracted)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
            <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)}
              placeholder="Filter by name..." className="input pl-8" list="known-names" />
            <datalist id="known-names">
              {knownNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="input pl-8" />
          </div>
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="input pl-8" />
          </div>
        </div>
        {hasFilters && <p className="text-[#9896A4] text-xs">{filtered.length} of {receipts.length} receipts shown</p>}
      </div>

      {receipts.length === 0 ? (
        <EmptyState icon={<FileText size={40} />} title="No receipts uploaded" description="Upload your first receipt above" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search size={40} />} title="No receipts match your filters"
          action={<button onClick={() => { setSearchName(''); setFilterDateFrom(''); setFilterDateTo('') }} className="btn-secondary">Clear Filters</button>} />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(r => (
            <GridCard key={r.id} receipt={r} isImage={isImage} extracting={uploadingId === r.id}
              onClick={() => { setSelected(r); setLinkExpenseId(r.expense_id ?? ''); setClaimedByInput(r.claimed_by ?? ''); setConfirmDelete(false) }} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <ListRow key={r.id} receipt={r} isImage={isImage} extracting={uploadingId === r.id}
              onClick={() => { setSelected(r); setLinkExpenseId(r.expense_id ?? ''); setClaimedByInput(r.claimed_by ?? ''); setConfirmDelete(false) }} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <Modal isOpen={!!selected} onClose={() => { setSelected(null); setConfirmDelete(false) }} title="Receipt Details" size="md">
          <div className="space-y-4">
            <div className="aspect-video rounded-xl overflow-hidden bg-[#1A1A1E] flex items-center justify-center">
              {isImage(selected.file_type) ? (
                <img src={selected.file_url} alt={selected.file_name} className="w-full h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-[#5A5865]">
                  <FileText size={48} /><p className="text-sm">PDF Document</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1A1A1E] rounded-lg p-3">
                <p className="text-[#5A5865] text-xs mb-1 flex items-center gap-1"><Clock size={10} /> Uploaded</p>
                <p className="text-[#F0EEF6] text-xs">{formatDateTime(selected.created_at)}</p>
              </div>
              <div className="bg-[#1A1A1E] rounded-lg p-3">
                <p className="text-[#5A5865] text-xs mb-1 flex items-center gap-1"><User size={10} /> Uploaded by</p>
                <p className="text-[#F0EEF6] text-xs font-medium">{selected.users?.full_name ?? 'Unknown'}</p>
              </div>
            </div>

            {/* AI extracted amount */}
            {selected.ocr_amount != null && (
              <div className="bg-[#0D0D0F] border border-[#8B5CF6]/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={13} className="text-[#8B5CF6]" />
                  <p className="text-[#A78BFA] text-xs font-medium uppercase tracking-wider">AI Extracted Amount</p>
                </div>
                <p className="text-emerald-400 font-bold text-2xl">RM {Number(selected.ocr_amount).toFixed(2)}</p>
                {(selected as any).ocr_supplier_name && (
                  <p className="text-[#5A5865] text-xs mt-1">{(selected as any).ocr_supplier_name}</p>
                )}
                {(selected as any).ocr_raw_text && (() => {
                  try {
                    const d: ExtractedData = JSON.parse((selected as any).ocr_raw_text)
                    return d.items?.length > 0 ? (
                      <div className="mt-3 space-y-1 max-h-36 overflow-y-auto">
                        {d.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs py-0.5 border-b border-[#1A1A1E] last:border-0">
                            <span className="text-[#9896A4] truncate flex-1 mr-2">{item.description}</span>
                            <span className="text-[#F0EEF6] whitespace-nowrap">RM {item.amount?.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null
                  } catch { return null }
                })()}
              </div>
            )}

            <div>
              <label className="label">Belongs to (claimant)</label>
              <input type="text" value={claimedByInput} onChange={e => setClaimedByInput(e.target.value)}
                className="input" placeholder="e.g. Rajiv, Ahmad, Partner name..." list="modal-names" />
              <datalist id="modal-names">
                {knownNames.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>

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

            <div className="flex gap-3">
              <button onClick={() => { setSelected(null); setConfirmDelete(false) }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSaveDetails} disabled={linking} className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2">
                <Link2 size={13} /> {linking ? 'Saving...' : 'Save'}
              </button>
            </div>

            <a href={selected.file_url} target="_blank" rel="noopener noreferrer"
              className="btn-secondary w-full flex items-center justify-center gap-2 text-sm">
              <ExternalLink size={14} /> Open Full Size
            </a>

            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center justify-center gap-2 text-rose-400 hover:text-rose-300 text-xs py-2 hover:bg-rose-500/10 rounded-lg transition-all">
                <Trash2 size={13} /> Delete Receipt
              </button>
            ) : (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-rose-400" />
                  <p className="text-rose-400 text-sm font-medium">Delete this receipt?</p>
                </div>
                <p className="text-[#9896A4] text-xs mb-3">This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1 text-xs">Cancel</button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium py-2 px-4 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <Trash2 size={12} /> {deleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function GridCard({ receipt, isImage, onClick, extracting }: { receipt: Receipt; isImage: (t: string) => boolean; onClick: () => void; extracting: boolean }) {
  return (
    <div className="card-hover cursor-pointer" onClick={onClick}>
      <div className="aspect-square rounded-lg overflow-hidden bg-[#1A1A1E] mb-3 flex items-center justify-center relative">
        {isImage(receipt.file_type)
          ? <img src={receipt.file_url} alt={receipt.file_name} className="w-full h-full object-cover" />
          : <div className="flex flex-col items-center gap-2 text-[#5A5865]"><FileText size={32} /><p className="text-xs">PDF</p></div>}
        {extracting && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1">
              <Sparkles size={18} className="text-[#8B5CF6] animate-pulse" />
              <p className="text-[10px] text-[#A78BFA]">Extracting...</p>
            </div>
          </div>
        )}
        {receipt.expense_id && !extracting && (
          <div className="absolute top-1.5 right-1.5 bg-emerald-500/80 rounded-full p-0.5">
            <Link2 size={10} className="text-white" />
          </div>
        )}
        {receipt.ocr_extracted && !extracting && (
          <div className="absolute top-1.5 left-1.5 bg-[#8B5CF6]/80 rounded-full p-0.5">
            <Sparkles size={10} className="text-white" />
          </div>
        )}
      </div>
      <p className="text-[#F0EEF6] text-xs font-medium truncate">{receipt.file_name}</p>
      <div className="flex items-center gap-1 mt-1">
        <Clock size={9} className="text-[#5A5865]" />
        <p className="text-[#5A5865] text-[10px]">{formatDateTime(receipt.created_at)}</p>
      </div>
      {receipt.claimed_by
        ? <div className="flex items-center gap-1 mt-0.5"><User size={9} className="text-[#8B5CF6]" /><p className="text-[#A78BFA] text-[10px] font-medium truncate">{receipt.claimed_by}</p></div>
        : <div className="flex items-center gap-1 mt-0.5"><User size={9} className="text-[#5A5865]" /><p className="text-[#5A5865] text-[10px] truncate">{receipt.users?.full_name ?? 'Unknown'}</p></div>}
      {receipt.ocr_amount != null && (
        <p className="text-emerald-400 text-xs font-bold mt-1">RM {Number(receipt.ocr_amount).toFixed(2)}</p>
      )}
    </div>
  )
}

function ListRow({ receipt, isImage, onClick, extracting }: { receipt: Receipt; isImage: (t: string) => boolean; onClick: () => void; extracting: boolean }) {
  return (
    <div className="card-hover cursor-pointer flex items-center gap-4" onClick={onClick}>
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#1A1A1E] flex-shrink-0 flex items-center justify-center relative">
        {isImage(receipt.file_type)
          ? <img src={receipt.file_url} alt={receipt.file_name} className="w-full h-full object-cover" />
          : <FileText size={20} className="text-[#5A5865]" />}
        {extracting && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Sparkles size={12} className="text-[#8B5CF6] animate-pulse" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[#F0EEF6] text-sm font-medium truncate">{receipt.file_name}</p>
          {receipt.ocr_extracted && <Sparkles size={11} className="text-[#8B5CF6] flex-shrink-0" />}
          {receipt.expense_id && <Link2 size={11} className="text-emerald-400 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <div className="flex items-center gap-1">
            <Clock size={9} className="text-[#5A5865]" />
            <p className="text-[#5A5865] text-xs">{formatDateTime(receipt.created_at)}</p>
          </div>
          <div className="flex items-center gap-1">
            <User size={9} className={receipt.claimed_by ? 'text-[#8B5CF6]' : 'text-[#5A5865]'} />
            <p className={`text-xs ${receipt.claimed_by ? 'text-[#A78BFA] font-medium' : 'text-[#5A5865]'}`}>
              {receipt.claimed_by ?? receipt.users?.full_name ?? 'Unknown'}
            </p>
          </div>
          {receipt.expenses && (
            <p className="text-[#9896A4] text-xs truncate">{receipt.expenses.description}</p>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        {receipt.ocr_amount != null
          ? <p className="text-emerald-400 font-bold text-sm">RM {Number(receipt.ocr_amount).toFixed(2)}</p>
          : <p className="text-[#5A5865] text-xs">No amount</p>}
      </div>
    </div>
  )
}
