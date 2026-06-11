'use client'
import { useState, useRef, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, FileText, ExternalLink, Loader2, User, Clock,
  Link2, Calendar, Search, Filter, X, Trash2, Sparkles,
  AlertTriangle, LayoutGrid, List, BookOpen, Plus, Download,
  CheckCircle2, Tag,
} from 'lucide-react'
import type { Database } from '@/types/database'

type Receipt = Database['public']['Tables']['receipts']['Row'] & {
  expenses?: { description: string; amount: number; date: string; category: string } | null
  users?: { full_name: string } | null
  claimed_by?: string | null
  ocr_amount?: number | null
  ocr_extracted?: boolean
}

type Expense = {
  id: string
  description: string
  amount: number
  date: string
  category: string
  payment_method: string
}

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

const CURRENT_YEAR = new Date().getFullYear()
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function ReceiptsClient({ initialReceipts, expenses: initialExpenses, currentUserId }: Props) {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts)
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [activeTab, setActiveTab] = useState<'receipts' | 'accounting'>('receipts')
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
  const [filterCategory, setFilterCategory] = useState('')
  const [expenseSearch, setExpenseSearch] = useState('')

  // Create expense form state
  const [showCreateExpense, setShowCreateExpense] = useState(false)
  const [newExpDesc, setNewExpDesc] = useState('')
  const [newExpAmount, setNewExpAmount] = useState('')
  const [newExpDate, setNewExpDate] = useState('')
  const [newExpCategory, setNewExpCategory] = useState('alcohol')
  const [newExpPayment, setNewExpPayment] = useState('bank_transfer')
  const [creatingExp, setCreatingExp] = useState(false)

  // Accounting tab
  const [accountingYear, setAccountingYear] = useState(CURRENT_YEAR)

  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const supabase = createClient()

  // ─── Upload ───────────────────────────────────────────────────────────────

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

  // ─── Link existing expense ────────────────────────────────────────────────

  const handleSaveDetails = async () => {
    if (!selected) return
    setLinking(true)

    const updates: any = {}
    if (linkExpenseId) updates.expense_id = linkExpenseId
    else updates.expense_id = null
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

  // ─── Create & link new expense ────────────────────────────────────────────

  const openCreateExpense = () => {
    if (!selected) return
    const ocr = (selected as any)
    setNewExpDesc(ocr.ocr_supplier_name ?? selected.file_name ?? '')
    setNewExpAmount(ocr.ocr_amount != null ? String(Number(ocr.ocr_amount).toFixed(2)) : '')
    setNewExpDate(ocr.ocr_date ?? new Date().toISOString().split('T')[0])
    setNewExpCategory('alcohol')
    setNewExpPayment('bank_transfer')
    setShowCreateExpense(true)
  }

  const handleCreateExpense = async () => {
    if (!selected || !newExpDesc || !newExpAmount || !newExpDate) return
    setCreatingExp(true)

    const { data: exp, error: expErr } = await supabase
      .from('expenses')
      .insert({
        description: newExpDesc,
        amount: parseFloat(newExpAmount),
        date: newExpDate,
        category: newExpCategory as any,
        payment_method: newExpPayment as any,
        deleted_at: null,
      } as any)
      .select('id, description, amount, date, category, payment_method')
      .single()

    if (expErr || !exp) {
      toast(expErr?.message ?? 'Failed to create expense', 'error')
      setCreatingExp(false)
      return
    }

    const { data: updatedReceipt, error: linkErr } = await supabase
      .from('receipts')
      .update({ expense_id: exp.id, claimed_by: claimedByInput || null } as any)
      .eq('id', selected.id)
      .select('*, expenses(description, amount, date, category), users(full_name)')
      .single()

    if (linkErr) {
      toast(linkErr.message, 'error')
    } else {
      toast('Expense created & receipt linked', 'success')
      setExpenses(prev => [exp as Expense, ...prev])
      setReceipts(prev => prev.map(r => r.id === selected.id ? updatedReceipt as Receipt : r))
      setSelected(null)
      setShowCreateExpense(false)
    }
    setCreatingExp(false)
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

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

  // ─── Filters ──────────────────────────────────────────────────────────────

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
      if (filterCategory) {
        if (r.expenses?.category !== filterCategory) return false
      }
      return true
    })
  }, [receipts, searchName, filterDateFrom, filterDateTo, filterCategory])

  const hasFilters = searchName || filterDateFrom || filterDateTo || filterCategory
  const totalExtracted = filtered.reduce((sum, r) => sum + (r.ocr_amount ? Number(r.ocr_amount) : 0), 0)

  // ─── Accounting data ──────────────────────────────────────────────────────

  const accountingData = useMemo(() => computeAccountingData(expenses, accountingYear), [expenses, accountingYear])

  const exportCSV = () => {
    const { categories, monthlyData, monthlyTotals, categoryTotals, grandTotal } = accountingData
    const header = ['Month', ...categories.map(c => EXPENSE_CATEGORY_LABELS[c] ?? c), 'Total']
    const rows = MONTHS.map((label, i) => {
      const m = i + 1
      return [label, ...categories.map(c => (monthlyData[m][c] ?? 0).toFixed(2)), (monthlyTotals[m] ?? 0).toFixed(2)]
    })
    const totalsRow = ['TOTAL', ...categories.map(c => (categoryTotals[c] ?? 0).toFixed(2)), grandTotal.toFixed(2)]

    const csv = [header, ...rows, totalsRow].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ARKIB_Expenses_${accountingYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <TopBar
        title="Receipts & Accounting"
        subtitle={`${receipts.length} receipts · ${receipts.filter(r => r.ocr_extracted).length} AI-extracted`}
        actions={
          activeTab === 'receipts' ? (
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
          ) : undefined
        }
      />

      {/* Tab switcher */}
      <div className="flex gap-1 bg-[#141417] border border-[#2A2A30] rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab('receipts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'receipts' ? 'bg-[#8B5CF6] text-white' : 'text-[#9896A4] hover:text-[#F0EEF6]'}`}>
          <FileText size={14} /> Receipts
        </button>
        <button onClick={() => setActiveTab('accounting')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'accounting' ? 'bg-[#8B5CF6] text-white' : 'text-[#9896A4] hover:text-[#F0EEF6]'}`}>
          <BookOpen size={14} /> Accounting
        </button>
      </div>

      {/* ── RECEIPTS TAB ── */}
      {activeTab === 'receipts' && (
        <>
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
                <button onClick={() => { setSearchName(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterCategory('') }}
                  className="ml-auto flex items-center gap-1 text-[#8B5CF6] hover:text-[#A78BFA] text-xs">
                  <X size={11} /> Clear
                </button>
              )}
              {totalExtracted > 0 && (
                <span className={`${hasFilters ? '' : 'ml-auto'} text-emerald-400 font-bold text-xs`}>
                  Total: {formatCurrency(totalExtracted)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
              <div className="relative">
                <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="input pl-8">
                  <option value="">All categories</option>
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            {hasFilters && <p className="text-[#9896A4] text-xs">{filtered.length} of {receipts.length} receipts shown</p>}
          </div>

          {receipts.length === 0 ? (
            <EmptyState icon={<FileText size={40} />} title="No receipts uploaded" description="Upload your first receipt above" />
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Search size={40} />} title="No receipts match your filters"
              action={<button onClick={() => { setSearchName(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterCategory('') }} className="btn-secondary">Clear Filters</button>} />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(r => (
                <GridCard key={r.id} receipt={r} isImage={isImage} extracting={uploadingId === r.id}
                  onClick={() => { setSelected(r); setLinkExpenseId(r.expense_id ?? ''); setClaimedByInput(r.claimed_by ?? ''); setConfirmDelete(false); setShowCreateExpense(false); setExpenseSearch('') }} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(r => (
                <ListRow key={r.id} receipt={r} isImage={isImage} extracting={uploadingId === r.id}
                  onClick={() => { setSelected(r); setLinkExpenseId(r.expense_id ?? ''); setClaimedByInput(r.claimed_by ?? ''); setConfirmDelete(false); setShowCreateExpense(false); setExpenseSearch('') }} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── ACCOUNTING TAB ── */}
      {activeTab === 'accounting' && (
        <AccountingTab
          expenses={expenses}
          accountingYear={accountingYear}
          setAccountingYear={setAccountingYear}
          accountingData={accountingData}
          exportCSV={exportCSV}
        />
      )}

      {/* ── DETAIL MODAL ── */}
      {selected && (
        <Modal isOpen={!!selected} onClose={() => { setSelected(null); setConfirmDelete(false); setShowCreateExpense(false) }} title="Receipt Details" size="md">
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

            {/* AI extracted */}
            {(selected as any).ocr_amount != null && (
              <div className="bg-[#0D0D0F] border border-[#8B5CF6]/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={13} className="text-[#8B5CF6]" />
                  <p className="text-[#A78BFA] text-xs font-medium uppercase tracking-wider">AI Extracted</p>
                </div>
                <p className="text-emerald-400 font-bold text-2xl">RM {Number((selected as any).ocr_amount).toFixed(2)}</p>
                {(selected as any).ocr_supplier_name && (
                  <p className="text-[#5A5865] text-xs mt-1">{(selected as any).ocr_supplier_name}</p>
                )}
                {(selected as any).ocr_date && (
                  <p className="text-[#5A5865] text-xs">{new Date((selected as any).ocr_date + 'T00:00:00').toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
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

            {/* Linked expense display */}
            {selected.expenses && (
              <div className="bg-[#1A1A1E] rounded-xl p-3 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <p className="text-[#5A5865] text-xs uppercase tracking-wider">Linked Expense</p>
                </div>
                <p className="text-[#F0EEF6] font-medium text-sm">{selected.expenses.description}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="badge-purple text-xs">{EXPENSE_CATEGORY_LABELS[selected.expenses.category] ?? selected.expenses.category}</span>
                  <span className="text-emerald-400 text-sm font-bold">{formatCurrency(selected.expenses.amount)}</span>
                </div>
              </div>
            )}

            <div>
              <label className="label">Belongs to (claimant)</label>
              <input type="text" value={claimedByInput} onChange={e => setClaimedByInput(e.target.value)}
                className="input" placeholder="e.g. Rajiv, Ahmad..." list="modal-names" />
              <datalist id="modal-names">
                {knownNames.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>

            {/* Create & Link Expense */}
            {!selected.expenses && !showCreateExpense && (
              <button onClick={openCreateExpense}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl py-3 text-sm font-medium transition-all">
                <Plus size={15} /> Create & Link Expense
              </button>
            )}

            {showCreateExpense && (
              <div className="bg-[#1A1A1E] rounded-xl p-4 border border-[#2A2A30] space-y-3">
                <p className="text-[#F0EEF6] text-sm font-medium flex items-center gap-2"><Plus size={13} className="text-emerald-400" /> New Expense</p>
                <div>
                  <label className="label">Description / Supplier</label>
                  <input type="text" value={newExpDesc} onChange={e => setNewExpDesc(e.target.value)}
                    className="input" placeholder="e.g. TWE — Rum & Whisky restock" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Amount (RM)</label>
                    <input type="number" step="0.01" value={newExpAmount} onChange={e => setNewExpAmount(e.target.value)}
                      className="input" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="label">Date</label>
                    <input type="date" value={newExpDate} onChange={e => setNewExpDate(e.target.value)} className="input" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Category</label>
                    <select value={newExpCategory} onChange={e => setNewExpCategory(e.target.value)} className="input">
                      {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Payment Method</label>
                    <select value={newExpPayment} onChange={e => setNewExpPayment(e.target.value)} className="input">
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowCreateExpense(false)} className="btn-secondary flex-1 text-xs">Cancel</button>
                  <button onClick={handleCreateExpense} disabled={creatingExp || !newExpDesc || !newExpAmount || !newExpDate}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={13} /> {creatingExp ? 'Creating...' : 'Create & Link'}
                  </button>
                </div>
              </div>
            )}

            {/* Link existing expense */}
            {!showCreateExpense && (
              <div className="space-y-2">
                <label className="label">Or link existing expense</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
                  <input
                    type="text"
                    value={expenseSearch}
                    onChange={e => setExpenseSearch(e.target.value)}
                    placeholder="Search by description, category..."
                    className="input pl-8 text-sm"
                  />
                  {expenseSearch && (
                    <button onClick={() => setExpenseSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5865] hover:text-[#F0EEF6]">
                      <X size={12} />
                    </button>
                  )}
                </div>
                {(() => {
                  const q = expenseSearch.toLowerCase()
                  const filtered = expenses.filter(e =>
                    !q ||
                    e.description.toLowerCase().includes(q) ||
                    (EXPENSE_CATEGORY_LABELS[e.category] ?? e.category).toLowerCase().includes(q) ||
                    e.date.includes(q)
                  ).slice(0, 30)
                  const selected_exp = linkExpenseId ? expenses.find(e => e.id === linkExpenseId) : null
                  return (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-[#2A2A30] bg-[#0D0D0F] divide-y divide-[#1A1A1E]">
                      <button
                        onClick={() => setLinkExpenseId('')}
                        className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${!linkExpenseId ? 'bg-[#8B5CF6]/10 text-[#A78BFA]' : 'text-[#5A5865] hover:bg-[#1A1A1E]'}`}>
                        None
                      </button>
                      {filtered.length === 0 ? (
                        <p className="px-3 py-3 text-[#5A5865] text-xs text-center">No expenses match</p>
                      ) : filtered.map(exp => (
                        <button
                          key={exp.id}
                          onClick={() => setLinkExpenseId(exp.id)}
                          className={`w-full text-left px-3 py-2.5 transition-colors ${linkExpenseId === exp.id ? 'bg-[#8B5CF6]/10' : 'hover:bg-[#1A1A1E]'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`text-xs font-medium truncate ${linkExpenseId === exp.id ? 'text-[#A78BFA]' : 'text-[#F0EEF6]'}`}>{exp.description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[#5A5865] text-[10px]">{new Date(exp.date + 'T00:00:00').toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2A2A30] text-[#9896A4]">{EXPENSE_CATEGORY_LABELS[exp.category] ?? exp.category}</span>
                              </div>
                            </div>
                            <span className={`text-xs font-bold flex-shrink-0 ${linkExpenseId === exp.id ? 'text-emerald-400' : 'text-[#F0EEF6]'}`}>{formatCurrency(exp.amount)}</span>
                          </div>
                        </button>
                      ))}
                      {!expenseSearch && expenses.length > 30 && (
                        <p className="px-3 py-2 text-[#5A5865] text-[10px] text-center">Showing 30 most recent · search to find more</p>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {!showCreateExpense && (
              <div className="flex gap-3">
                <button onClick={() => { setSelected(null); setConfirmDelete(false) }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleSaveDetails} disabled={linking} className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Link2 size={13} /> {linking ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}

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

// ─── Accounting Tab ───────────────────────────────────────────────────────────

function AccountingTab({
  expenses,
  accountingYear,
  setAccountingYear,
  accountingData,
  exportCSV,
}: {
  expenses: Expense[]
  accountingYear: number
  setAccountingYear: (y: number) => void
  accountingData: { categories: string[]; monthlyData: Record<number, Record<string, number>>; monthlyTotals: Record<string, number>; categoryTotals: Record<string, number>; grandTotal: number }
  exportCSV: () => void
}) {
  const { categories, monthlyData, monthlyTotals, categoryTotals, grandTotal } = accountingData
  const years = useMemo(() => {
    const ys = new Set(expenses.map(e => parseInt(e.date.split('-')[0])).filter(Boolean))
    ys.add(CURRENT_YEAR)
    return Array.from(ys).sort((a, b) => b - a)
  }, [expenses])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select value={accountingYear} onChange={e => setAccountingYear(parseInt(e.target.value))} className="input w-28 text-sm">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="text-[#9896A4] text-sm">
            Total expenses: <span className="text-[#F0EEF6] font-semibold">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
        <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-xs">
          <Download size={13} /> Export CSV
        </button>
      </div>

      {grandTotal === 0 ? (
        <div className="card text-center py-12">
          <BookOpen size={40} className="text-[#3A3A42] mx-auto mb-3" />
          <p className="text-[#9896A4] text-sm">No expenses recorded for {accountingYear}</p>
        </div>
      ) : (
        <>
          {/* Category summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map(cat => (
              <div key={cat} className="card">
                <p className="text-[#9896A4] text-xs mb-1">{EXPENSE_CATEGORY_LABELS[cat] ?? cat}</p>
                <p className="text-[#F0EEF6] font-bold text-lg">{formatCurrency(categoryTotals[cat] ?? 0)}</p>
                <p className="text-[#5A5865] text-xs mt-1">
                  {grandTotal > 0 ? ((categoryTotals[cat] ?? 0) / grandTotal * 100).toFixed(1) : '0.0'}% of total
                </p>
              </div>
            ))}
          </div>

          {/* Monthly breakdown table */}
          <div className="card overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-[#2A2A30]">
                  <th className="text-left py-2 pr-4 text-[#9896A4] font-medium w-16">Month</th>
                  {categories.map(c => (
                    <th key={c} className="text-right py-2 px-2 text-[#9896A4] font-medium whitespace-nowrap">
                      {EXPENSE_CATEGORY_LABELS[c] ?? c}
                    </th>
                  ))}
                  <th className="text-right py-2 pl-4 text-[#F0EEF6] font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map((label, i) => {
                  const m = i + 1
                  const rowTotal = monthlyTotals[m] ?? 0
                  const hasData = rowTotal > 0
                  return (
                    <tr key={m} className={`border-b border-[#1A1A1E] last:border-0 ${hasData ? '' : 'opacity-40'}`}>
                      <td className="py-2 pr-4 text-[#9896A4] font-medium">{label}</td>
                      {categories.map(c => (
                        <td key={c} className="text-right py-2 px-2 text-[#F0EEF6]">
                          {monthlyData[m][c] ? formatCurrency(monthlyData[m][c]) : '—'}
                        </td>
                      ))}
                      <td className={`text-right py-2 pl-4 font-semibold ${hasData ? 'text-emerald-400' : 'text-[#5A5865]'}`}>
                        {hasData ? formatCurrency(rowTotal) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#2A2A30]">
                  <td className="py-3 pr-4 text-[#F0EEF6] font-semibold">TOTAL</td>
                  {categories.map(c => (
                    <td key={c} className="text-right py-3 px-2 text-[#A78BFA] font-semibold">
                      {formatCurrency(categoryTotals[c] ?? 0)}
                    </td>
                  ))}
                  <td className="text-right py-3 pl-4 text-emerald-400 font-bold text-sm">
                    {formatCurrency(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function computeAccountingData(expenses: Expense[], year: number) {
  const yearExpenses = expenses.filter(e => e.date.startsWith(String(year)))
  const categories = [...new Set(yearExpenses.map(e => e.category))].sort()
  const monthlyData: Record<number, Record<string, number>> = {}
  for (let m = 1; m <= 12; m++) monthlyData[m] = {}
  for (const e of yearExpenses) {
    const m = parseInt(e.date.split('-')[1])
    monthlyData[m][e.category] = (monthlyData[m][e.category] ?? 0) + e.amount
  }
  const monthlyTotals = Object.fromEntries(
    Object.entries(monthlyData).map(([m, cats]) => [m, Object.values(cats).reduce((s, v) => s + v, 0)])
  )
  const categoryTotals = Object.fromEntries(
    categories.map(cat => [cat, yearExpenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)])
  )
  const grandTotal = yearExpenses.reduce((s, e) => s + e.amount, 0)
  return { categories, monthlyData, monthlyTotals, categoryTotals, grandTotal }
}

// ─── Grid / List cards ────────────────────────────────────────────────────────

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
      {receipt.expenses && (
        <div className="mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {EXPENSE_CATEGORY_LABELS[receipt.expenses.category] ?? receipt.expenses.category}
          </span>
        </div>
      )}
      {(receipt as any).ocr_amount != null && (
        <p className="text-emerald-400 text-xs font-bold mt-1">RM {Number((receipt as any).ocr_amount).toFixed(2)}</p>
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
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
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
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {EXPENSE_CATEGORY_LABELS[receipt.expenses.category] ?? receipt.expenses.category}
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        {(receipt as any).ocr_amount != null
          ? <p className="text-emerald-400 font-bold text-sm">RM {Number((receipt as any).ocr_amount).toFixed(2)}</p>
          : <p className="text-[#5A5865] text-xs">No amount</p>}
      </div>
    </div>
  )
}
