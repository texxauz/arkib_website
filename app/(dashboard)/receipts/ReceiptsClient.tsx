'use client'
import { useState, useRef } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Upload, FileText, Image, ExternalLink, Loader2 } from 'lucide-react'
import type { Database } from '@/types/database'

type Receipt = Database['public']['Tables']['receipts']['Row'] & {
  expenses?: { description: string; amount: number; date: string } | null
}

export function ReceiptsClient({ initialReceipts }: { initialReceipts: Receipt[] }) {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const supabase = createClient()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split('.').pop()
    const fileName = `receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: storageError, data: storageData } = await supabase.storage
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
    }).select('*, expenses(description, amount, date)').single()

    if (error) { toast(error.message, 'error') }
    else {
      toast('Receipt uploaded successfully', 'success')
      setReceipts(prev => [data as Receipt, ...prev])
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const isImage = (type: string) => type.startsWith('image/')

  return (
    <div className="space-y-6">
      <TopBar title="Receipts" subtitle={`${receipts.length} receipts stored`} />

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {receipts.map(receipt => (
            <div key={receipt.id} className="card-hover group">
              <div className="aspect-square rounded-lg overflow-hidden bg-[#1A1A1E] mb-3 flex items-center justify-center">
                {isImage(receipt.file_type) ? (
                  <img src={receipt.file_url} alt={receipt.file_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-[#5A5865]">
                    <FileText size={32} />
                    <p className="text-xs">PDF</p>
                  </div>
                )}
              </div>
              <p className="text-[#F0EEF6] text-xs font-medium truncate">{receipt.file_name}</p>
              <p className="text-[#5A5865] text-[10px] mt-0.5">{formatDate(receipt.created_at)}</p>
              {receipt.expenses && (
                <p className="text-[#9896A4] text-[10px] mt-1 truncate">{receipt.expenses.description}</p>
              )}
              <a href={receipt.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#8B5CF6] text-[10px] mt-1.5 hover:text-[#A78BFA]">
                <ExternalLink size={10} /> View
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
