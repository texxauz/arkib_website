'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Users, Plus, UserPlus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Database } from '@/types/database'

type UserProfile = Database['public']['Tables']['users']['Row'] & { tab_permissions?: Record<string, string> | null }

const ALL_TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'sales', label: 'Sales' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'bar-inventory', label: 'Bar Stock' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'cocktails', label: 'Cocktails' },
  { key: 'shifts', label: 'Shifts' },
  { key: 'rent', label: 'Rent & Fixed' },
  { key: 'reports', label: 'Reports' },
  { key: 'pnl', label: 'P&L' },
]

const OWNER_FULL: Record<string, string> = Object.fromEntries(ALL_TABS.map(t => [t.key, 'edit']))

const DEFAULT_BARTENDER: Record<string, string> = {
  dashboard: 'view',
  sales: 'edit',
  expenses: 'none',
  receipts: 'none',
  inventory: 'none',
  'bar-inventory': 'edit',
  checklist: 'edit',
  cocktails: 'view',
  suppliers: 'none',
  rent: 'none',
  reports: 'none',
  pnl: 'none',
}

const DEFAULT_INVESTOR: Record<string, string> = Object.fromEntries(
  ALL_TABS.map(t => [t.key, t.key === 'pnl' ? 'view' : 'none'])
)

const PERM_CYCLE: Record<string, string> = { none: 'view', view: 'edit', edit: 'none' }
const PERM_COLOR: Record<string, string> = {
  edit: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  view: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  none: 'bg-[#1A1A1E] text-[#5A5865] border-[#2A2A30]',
}

const emptyInvite = { email: '', full_name: '', password: '', role: 'staff' as string }

export function TeamClient({ members, currentUserId }: { members: UserProfile[], currentUserId: string }) {
  const [list, setList] = useState<UserProfile[]>(members)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null)
  const [inviteForm, setInviteForm] = useState(emptyInvite)
  const [editPerms, setEditPerms] = useState<Record<string, string>>({})
  const [editRole, setEditRole] = useState('bartender')
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const openInvite = () => {
    setInviteForm(emptyInvite)
    setEditPerms(DEFAULT_BARTENDER)
    setInviteOpen(true)
  }

  const defaultPermsForRole = (role: string) =>
    ['owner', 'manager'].includes(role) ? OWNER_FULL : role === 'investor' ? DEFAULT_INVESTOR : DEFAULT_BARTENDER

  const openEdit = (m: UserProfile) => {
    setEditTarget(m)
    setEditRole(m.role)
    setEditName(m.full_name)
    setEditPerms(m.tab_permissions ?? defaultPermsForRole(m.role))
  }

  const cyclePerm = (key: string) => setEditPerms(p => ({ ...p, [key]: PERM_CYCLE[p[key] ?? 'none'] ?? 'view' }))
  const inviteCyclePerm = (key: string) => setEditPerms(p => ({ ...p, [key]: PERM_CYCLE[p[key] ?? 'none'] ?? 'view' }))

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...inviteForm, tab_permissions: editPerms }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast(data.error ?? 'Failed to create account', 'error'); return }
    toast(`Account created for ${inviteForm.full_name}`, 'success')
    setInviteOpen(false)
    window.location.reload()
  }

  const handleUpdate = async () => {
    if (!editTarget) return
    setLoading(true)
    const res = await fetch('/api/team/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: editTarget.id, full_name: editName, role: editRole, tab_permissions: editPerms }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast(data.error ?? 'Failed to update', 'error'); return }
    toast('Access updated', 'success')
    setList(prev => prev.map(m => m.id === editTarget.id ? { ...m, full_name: editName, role: editRole as UserProfile['role'], tab_permissions: editPerms } : m))
    setEditTarget(null)
  }

  const handleToggleActive = async (m: UserProfile) => {
    const res = await fetch('/api/team/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: m.id, is_active: !m.is_active }),
    })
    if (!res.ok) { toast('Failed to update', 'error'); return }
    setList(prev => prev.map(x => x.id === m.id ? { ...x, is_active: !x.is_active } : x))
    toast(m.is_active ? 'Access suspended' : 'Access restored', 'success')
  }

  const PermGrid = ({ perms, onCycle }: { perms: Record<string, string>, onCycle: (k: string) => void }) => (
    <div className="grid grid-cols-2 gap-1.5">
      {ALL_TABS.map(tab => {
        const p = perms[tab.key] ?? 'none'
        return (
          <button key={tab.key} type="button" onClick={() => onCycle(tab.key)}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-all ${PERM_COLOR[p]}`}>
            <span>{tab.label}</span>
            <span className="capitalize">{p}</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-6">
      <TopBar
        title="Team Access"
        subtitle={`${list.length} member${list.length !== 1 ? 's' : ''} · Manage who can see and edit each section`}
        actions={
          <button onClick={openInvite} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Add Member
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-3">
        {list.map(m => {
          const isMe = m.id === currentUserId
          const perms = m.tab_permissions ?? defaultPermsForRole(m.role)
          const editCount = Object.values(perms).filter(v => v === 'edit').length
          const viewCount = Object.values(perms).filter(v => v === 'view').length

          return (
            <div key={m.id} className={`card flex flex-col sm:flex-row sm:items-center gap-4 ${!m.is_active ? 'opacity-50' : ''}`}>
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 flex items-center justify-center flex-shrink-0">
                <span className="text-[#A78BFA] font-bold text-sm">{m.full_name.charAt(0).toUpperCase()}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[#F0EEF6] font-semibold">{m.full_name}</p>
                  {isMe && <span className="text-[9px] bg-[#8B5CF6]/20 text-[#A78BFA] px-2 py-0.5 rounded-full border border-[#8B5CF6]/20">YOU</span>}
                  <span className={`text-[9px] px-2 py-0.5 rounded-full border capitalize
                    ${m.role === 'owner' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-[#1A1A1E] text-[#9896A4] border-[#2A2A30]'}`}>
                    {m.role === 'staff' ? 'Bartender' : m.role}
                  </span>
                  {!m.is_active && <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full">Suspended</span>}
                </div>
                <p className="text-[#5A5865] text-xs mt-0.5">{m.email}</p>
                <p className="text-[#5A5865] text-[10px] mt-1">{editCount} edit · {viewCount} view</p>
              </div>

              {/* Perm preview */}
              <div className="flex flex-wrap gap-1">
                {ALL_TABS.map(tab => {
                  const p = perms[tab.key] ?? 'none'
                  if (p === 'none') return null
                  return (
                    <span key={tab.key} className={`text-[9px] px-1.5 py-0.5 rounded border ${PERM_COLOR[p]}`}>{tab.label}</span>
                  )
                })}
              </div>

              {/* Actions */}
              {!isMe && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(m)} className="btn-ghost p-2" title="Edit access">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleToggleActive(m)}
                    className={`p-2 rounded-lg transition-all ${m.is_active ? 'text-[#9896A4] hover:text-rose-400 hover:bg-rose-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                    title={m.is_active ? 'Suspend access' : 'Restore access'}>
                    {m.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Invite Modal */}
      <Modal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} title="Create Team Account" size="lg">
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={inviteForm.full_name} onChange={e => setInviteForm(p => ({ ...p, full_name: e.target.value }))} required placeholder="Ali Hassan" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} required placeholder="ali@email.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={inviteForm.password} onChange={e => setInviteForm(p => ({ ...p, password: e.target.value }))} required placeholder="Min 6 characters" minLength={6} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={inviteForm.role} onChange={e => {
                setInviteForm(p => ({ ...p, role: e.target.value }))
                setEditPerms(defaultPermsForRole(e.target.value))
              }}>
                <option value="staff">Bartender</option>
                <option value="manager">Manager</option>
                <option value="investor">Investor</option>
              </select>
            </div>
          </div>

          <div>
            <p className="label mb-2">Tab Access <span className="text-[#5A5865] font-normal normal-case">(click to cycle: none → view → edit)</span></p>
            <PermGrid perms={editPerms} onCycle={inviteCyclePerm} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setInviteOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
              <UserPlus size={14} /> {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Access Modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit Access — ${editTarget?.full_name}`} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={editRole} onChange={e => {
                setEditRole(e.target.value)
                setEditPerms(defaultPermsForRole(e.target.value))
              }}>
                <option value="staff">Bartender</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
                <option value="investor">Investor</option>
              </select>
            </div>
          </div>

          <div>
            <p className="label mb-2">Tab Access <span className="text-[#5A5865] font-normal normal-case">(click to cycle: none → view → edit)</span></p>
            <PermGrid perms={editPerms} onCycle={cyclePerm} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditTarget(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleUpdate} disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
