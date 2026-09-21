'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { ArrowLeft, Users2, Phone, Star, TrendingUp, Calendar, Clock, Edit2, X, Check } from 'lucide-react'
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
  birthday: string | null
  created_at: string
}

interface LedgerEntry {
  id: string
  type: string
  credits_delta: number
  reason: string | null
  order_id: string | null
  created_at: string
}

interface Props {
  member: Member
  ledger: LedgerEntry[]
  canEdit: boolean
  isAdmin: boolean
}

function formatPhone(normalized: string) {
  const local = normalized.startsWith('60') ? '0' + normalized.slice(2) : normalized
  return local.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2 $3')
}

export function MemberDetailClient({ member: initialMember, ledger, canEdit, isAdmin }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [member, setMember] = useState<Member>(initialMember)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(member.name ?? '')
  const [editStatus, setEditStatus] = useState(member.status)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName || null, status: editStatus }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Save failed', 'error'); return }
      setMember(json.member)
      setEditing(false)
      toast('Saved', 'success')
    } finally {
      setSaving(false)
    }
  }

  const typeColor = (type: string) => {
    if (type === 'earn') return 'text-emerald-400'
    if (type === 'redeem') return 'text-red-400'
    return 'text-[#9896A4]'
  }

  const typeLabel = (type: string) => {
    if (type === 'earn') return 'Earned'
    if (type === 'redeem') return 'Redeemed'
    if (type === 'adjustment') return 'Adjusted'
    return type
  }

  return (
    <div className="min-h-screen bg-[#0D0D10]">
      <TopBar title="Member Profile" />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-[#9896A4] hover:text-[#F0EEF6]">
          <ArrowLeft size={14} /> Back
        </button>

        {/* Profile card */}
        <div className="bg-[#141417] border border-[#2A2A30] rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center">
                <Users2 size={20} className="text-[#8B5CF6]" />
              </div>
              <div>
                {editing ? (
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Name"
                    className="bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-1.5 text-sm text-[#F0EEF6] focus:outline-none focus:border-[#8B5CF6]"
                  />
                ) : (
                  <p className="text-[#F0EEF6] font-semibold">{member.name ?? '—'}</p>
                )}
                <p className="text-[#9896A4] text-xs flex items-center gap-1 mt-0.5">
                  <Phone size={10} />{formatPhone(member.phone_normalized)}
                </p>
              </div>
            </div>
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} className="p-2 text-[#9896A4] hover:text-[#F0EEF6]">
                <Edit2 size={14} />
              </button>
            )}
            {editing && (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="p-2 text-[#9896A4]"><X size={14} /></button>
                <button onClick={handleSave} disabled={saving} className="p-2 text-emerald-400 disabled:opacity-50"><Check size={14} /></button>
              </div>
            )}
          </div>

          {editing && isAdmin && (
            <div className="mb-4">
              <label className="text-xs text-[#9896A4] mb-1 block">Status</label>
              <select
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
                className="bg-[#0D0D10] border border-[#2A2A30] rounded-lg px-3 py-1.5 text-sm text-[#F0EEF6] focus:outline-none focus:border-[#8B5CF6]"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0D0D10] rounded-lg p-3 text-center">
              <p className="text-[#8B5CF6] text-lg font-bold tabular-nums flex items-center justify-center gap-1">
                <Star size={14} />{member.credits_balance.toFixed(0)}
              </p>
              <p className="text-[#9896A4] text-xs mt-0.5">Credits</p>
            </div>
            <div className="bg-[#0D0D10] rounded-lg p-3 text-center">
              <p className="text-emerald-400 text-lg font-bold tabular-nums">RM{member.total_spend.toFixed(0)}</p>
              <p className="text-[#9896A4] text-xs mt-0.5">Total Spend</p>
            </div>
            <div className="bg-[#0D0D10] rounded-lg p-3 text-center">
              <p className="text-[#F0EEF6] text-lg font-bold tabular-nums">{member.total_visits}</p>
              <p className="text-[#9896A4] text-xs mt-0.5">Visits</p>
            </div>
          </div>

          {/* Meta */}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#9896A4]">
            {member.last_visit_at && (
              <span className="flex items-center gap-1">
                <Clock size={10} />Last visit: {new Date(member.last_visit_at).toLocaleDateString('en-MY')}
              </span>
            )}
            {member.birthday && (
              <span className="flex items-center gap-1">
                <Calendar size={10} />Birthday: {member.birthday}
              </span>
            )}
            <span className="flex items-center gap-1">
              <TrendingUp size={10} />Member since: {new Date(member.created_at).toLocaleDateString('en-MY')}
            </span>
          </div>
        </div>

        {/* Credit history */}
        <div className="bg-[#141417] border border-[#2A2A30] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2A2A30]">
            <h3 className="text-[#F0EEF6] text-sm font-semibold">Credit History</h3>
          </div>
          {ledger.length === 0 ? (
            <p className="text-center py-8 text-[#9896A4] text-sm">No transactions yet</p>
          ) : (
            <div className="divide-y divide-[#2A2A30]">
              {ledger.map(entry => (
                <div key={entry.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[#F0EEF6] text-sm">{entry.reason ?? typeLabel(entry.type)}</p>
                    <p className="text-[#9896A4] text-xs">{new Date(entry.created_at).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${typeColor(entry.type)}`}>
                    {entry.credits_delta > 0 ? '+' : ''}{entry.credits_delta.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
