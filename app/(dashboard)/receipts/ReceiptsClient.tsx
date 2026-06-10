'use client'
import { useState, useRef } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Upload, FileText, ExternalLink, Loader2, User, Clock, Link2, X, Calendar } from 'lucide-react'
import type { Database } from '@/types/database'

type Receipt = Database['public']['Tables']['receipts']['Row'] & {
  expenses?: { description: string; amount: number; date: string; category: string } | null
  users?: { full_name: string } | null
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
  const [linking, setLinking] = useState(false)
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
    }).select('*, expenses(description, amount, date, category), users(full_name)').single()

    if (error) { toast(error.message, 'error') }
    else {
      toast('Receipt uploaded', 'success')
      setReceipts(prev => [data as Receipt, ...prev])
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleLinkExpense = async () => {
    if (!selected || !linkExpenseId) return
    setLinking(true)

    const { error, data } = await supabase
      .from('receipts')
      .update({ expense_id: linkExpenseId })
      .eq('id', selected.id)
      .select('*, expenses(description, amount, date, category), users(full_name)')
      .single()

    if (error) { toast(error.message, 'error') }
    else {
      toast('Receipt linked to expense', 'success')
      const updated = data as Receipt
      setReceipts(prev => prev.map(r => r.id === updated.id ? updated : r))
      setSelected(updated)
    }
    setLinking(false)
  }

  const isImage = (type: string) => type.startsWith('image/')

  const unlinked = receipts.filter(r => !r.expense_id)
  const linked = receipts.filter(r => r.expense_id)

  return (
    <div className="space-y-6">
      <TopBar
        title="Receipts"
        subtitle={`${receipts.length} total · ${linked.length} linked · ${unlinked.length} unlinked`}
      />

      {/* Upload area */}
      <div
        className="border-2 border-dashed border-[#2A2A30] rounded-xl p-8 text-center cursor-pointer hover:border-[#8B5CF6] transition-all"
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-[#8B5CF6] animate-spin" />
            <p className="text-[#9896A4] text-sm">Uploading receipt...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload size={32} className="text-[#3A3A42]" />
            <div>
              <p className="text-[#F0EEF6] font-medium text-sm">Upload Receipt</p>
              <p className="text-[#5A5865] text-xs mt-1">Click to upload · JPG, PNG, PDF supported</p>
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleUpload} className="hidden" />
      </div>

      {receipts.length === 0 ? (
        <EmptyState icon={<FileText size={40} />} title="No receipts uploaded" description="Upload your first receipt above" />
      ) : (
        <div className="space-y-6">
          {/* Unlinked receipts */}
          {unlinked.length > 0 && (
            <div>
              <p className="text-[#5A5865] text-xs font-medium uppercase tracking-wider mb-3">
                Unlinked ({unlinked.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {unlinked.map(receipt => (
                  <ReceiptCard key={receipt.id} receipt={receipt} isImage={isImage} onClick={() => { setSelected(receipt); setLinkExpenseId('') }} />
                ))}
              </div>
            </div>
          )}

          {/* Linked receipts */}
          {linked.length > 0 && (
            <div>
              <p className="text-[#5A5865] text-xs font-medium uppercase tracking-wider mb-3">
                Linked to Expenses ({linked.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {linked.map(receipt => (
                  <ReceiptCard key={receipt.id} receipt={receipt} isImage={isImage} onClick={() => { setSelected(receipt); setLinkExpenseId(receipt.expense_id ?? '') }} />
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
            {/* Preview */}
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

            {/* Metadata */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <FileText size={14} className="text-[#5A5865] flex-shrink-0" />
                <p className="text-[#F0EEF6] text-sm font-medium truncate">{selected.file_name}</p>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock size={14} className="text-[#5A5865] flex-shrink-0" />
                <div>
                  <p className="text-[#9896A4] text-xs">Uploaded</p>
                  <p className="text-[#F0EEF6] text-sm">{formatDateTime(selected.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <User size={14} className="text-[#5A5865] flex-shrink-0" />
                <div>
                  <p className="text-[#9896A4] text-xs">Uploaded by</p>
                  <p className="text-[#F0EEF6] text-sm">{selected.users?.full_name ?? 'Unknown'}</p>
                </div>
              </div>
              {selected.file_size && (
                <div className="flex items-center gap-2.5">
                  <Calendar size={14} className="text-[#5A5865] flex-shrink-0" />
                  <p className="text-[#9896A4] text-sm">{(selected.file_size / 1024).toFixed(1)} KB</p>
                </div>
              )}
            </div>

            {/* Linked expense */}
            {selected.expenses && (
              <div className="bg-[#1A1A1E] rounded-xl p-3 border border-[#2A2A30]">
                <p className="text-[#5A5865] text-xs uppercase tracking-wider mb-2">Linked Expense</p>
                <p className="text-[#F0EEF6] font-medium text-sm">{selected.expenses.description}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="badge-purple text-xs">{EXPENSE_CATEGORY_LABELS[selected.expenses.category] ?? selected.expenses.category}</span>
                  <span className="text-emerald-400 text-sm font-bold">{formatCurrency(selected.expenses.amount)}</span>
                  <span className="text-[#5A5865] text-xs">{new Date(selected.expenses.date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            )}

            {/* Link to expense */}
            <div>
              <p className="label">Link to Expense</p>
              <div className="flex gap-2">
                <select
                  value={linkExpenseId}
                  onChange={e => setLinkExpenseId(e.target.value)}
                  className="input flex-1"
                >
                  <option value="">Select expense to link</option>
                  {expenses.map(exp => (
                    <option key={exp.id} value={exp.id}>
                      {new Date(exp.date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })} — {exp.description} ({formatCurrency(exp.amount)})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleLinkExpense}
                  disabled={!linkExpenseId || linking}
                  className="btn-primary flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                >
                  <Link2 size={13} /> {linking ? 'Linking...' : 'Link'}
                </button>
              </div>
            </div>

            <a
              href={selected.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
            >
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
    <div className="card-hover group cursor-pointer" onClick={onClick}>
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
      <div className="flex items-center gap-1 mt-0.5">
        <User size={9} className="text-[#5A5865]" />
        <p className="text-[#9896A4] text-[10px] truncate">{receipt.users?.full_name ?? 'Unknown'}</p>
      </div>
      {receipt.expenses && (
        <p className="text-emerald-400 text-[10px] mt-1 truncate">{receipt.expenses.description}</p>
      )}
    </div>
  )
}
