'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Users2, Search, Phone, Star, AlertCircle, RefreshCw, X, ChevronRight } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Member {
  id: string
  name: string | null
  phone_normalized: string
  credits_balance: number
  total_spend: number
  total_visits: number
  last_visit_at: string | null
  status: string
  created_at: string
}

interface Reward {
  id: string
  name: string
  reward_type: string
  reward_value: number
  credits_required: number
  is_active: boolean
}

interface Props {
  initialMembers: Member[]
  initialRewards: Reward[]
  pendingQueueCount: number
  canEdit: boolean
  isAdmin: boolean
}

function formatPhone(normalized: string) {
  // 60123456789 → +60 12-345 6789 (display only)
  const local = normalized.startsWith('60') ? '0' + normalized.slice(2) : normalized
  return local.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2 $3')
}

export function MembersClient({ initialMembers, initialRewards, pendingQueueCount, canEdit, isAdmin }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [queueCount, setQueueCount] = useState(pendingQueueCount)

  // Register modal
  const [showRegister, setShowRegister] = useState(false)
  const [regPhone, setRegPhone] = useState('')
  const [regName, setRegName] = useState('')
  const [registering, setRegistering] = useState(false)

  async function handleSearch(value: string) {
    setSearch(value)
    if (!value.trim()) { setMembers(initialMembers); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/members?search=${encodeURIComponent(value)}`)
      const json = await res.json()
      setMembers(json.members ?? [])
    } finally {
      setSearching(false)
    }
  }

  async function handleProcessQueue() {
    setProcessing(true)
    try {
      const res = await fetch('/api/membership/process-queue', { method: 'POST' })
      const json = await res.json()
      toast(`Processed ${json.processed}, failed ${json.failed}, pending ${json.pending}`, 'success')
      setQueueCount(json.pending ?? 0)
    } catch {
      toast('Failed to process queue', 'error')
    } finally {
      setProcessing(false)
    }
  }

  async function handleRegister() {
    if (!regPhone.trim()) { toast('Phone number required', 'error'); return }
    setRegistering(true)
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: regPhone, name: regName || null }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Failed to register', 'error'); return }
      toast(json.created ? 'Member registered' : 'Member already exists', 'success')
      setShowRegister(false)
      setRegPhone('')
      setRegName('')
      router.refresh()
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0D0D10]">
      <TopBar title="Members" />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Queue alert */}
        {isAdmin && queueCount > 0 && (
          <div className="flex items-center justify-between bg-amber-900/20 border border-amber-500/30 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <AlertCircle size={15} />
              <span>{queueCount} pending credit{queueCount > 1 ? 's' : ''} from failed processing</span>
            </div>
            <button
              onClick={handleProcessQueue}
              disabled={processing}
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 disabled:opacity-50"
            >
              <RefreshCw size={13} className={processing ? 'animate-spin' : ''} />
              Retry Now
            </button>
          </div>
        )}

        {/* Search + Register */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9896A4]" />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by phone or name…"
              className="w-full bg-[#141417] border border-[#2A2A30] rounded-lg pl-9 pr-4 py-2.5 text-sm text-[#F0EEF6] placeholder-[#9896A4] focus:outline-none focus:border-[#8B5CF6]"
            />
            {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />}
          </div>
          {canEdit && (
            <button
              onClick={() => setShowRegister(true)}
              className="px-4 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              + Register
            </button>
          )}
        </div>

        {/* Member list */}
        <div className="space-y-2">
          {members.length === 0 ? (
            <div className="text-center py-12 text-[#9896A4] text-sm">No members found</div>
          ) : members.map(m => (
            <button
              key={m.id}
              onClick={() => router.push(`/members/${m.id}`)}
              className="w-full flex items-center justify-between bg-[#141417] border border-[#2A2A30] rounded-lg px-4 py-3 hover:border-[#8B5CF6]/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center shrink-0">
                  <Users2 size={16} className="text-[#8B5CF6]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[#F0EEF6] text-sm font-medium truncate">{m.name ?? '—'}</p>
                  <p className="text-[#9896A4] text-xs flex items-center gap-1">
                    <Phone size={10} />{formatPhone(m.phone_normalized)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-[#F0EEF6] text-sm font-semibold tabular-nums flex items-center gap-1">
                    <Star size={12} className="text-[#8B5CF6]" />
                    {m.credits_balance.toFixed(0)}
                  </p>
                  <p className="text-[#9896A4] text-xs">{m.total_visits} visit{m.total_visits !== 1 ? 's' : ''}</p>
                </div>
                {m.status === 'inactive' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-900/30 text-red-400">Inactive</span>
                )}
                <ChevronRight size={14} className="text-[#9896A4]" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Register modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/60 flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-sm bg-[#141417] border border-[#2A2A30] rounded-xl p-6 my-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[#F0EEF6] font-semibold">Register New Member</h3>
              <button onClick={() => setShowRegister(false)} className="p-1.5 text-[#9896A4] hover:text-[#F0EEF6]">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#9896A4] mb-1 block">Phone Number *</label>
                <input
                  value={regPhone}
                  onChange={e => setRegPhone(e.target.value)}
                  placeholder="012-345 6789"
                  className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2.5 text-sm text-[#F0EEF6] placeholder-[#9896A4] focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label className="text-xs text-[#9896A4] mb-1 block">Name (optional)</label>
                <input
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="Guest name"
                  className="w-full bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-2.5 text-sm text-[#F0EEF6] placeholder-[#9896A4] focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowRegister(false)} className="flex-1 py-2.5 text-sm text-[#9896A4] border border-[#2A2A30] rounded-lg hover:border-[#8B5CF6]/50">
                Cancel
              </button>
              <button onClick={handleRegister} disabled={registering} className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg disabled:opacity-50">
                {registering ? 'Registering…' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
