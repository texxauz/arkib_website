'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Users, Plus, UserPlus, Pencil, ToggleLeft, ToggleRight, KeyRound, ShieldCheck } from 'lucide-react'
import type { Database } from '@/types/database'

type UserProfile = Database['public']['Tables']['users']['Row'] & {
  tab_permissions?: Record<string, string> | null
  pos_permissions?: Record<string, boolean> | null
  manager_pin?: string | null
  clock_pin?: string | null
}

const POS_ACTION_PERMS = [
  { key: 'cancel_order', label: 'Cancel orders', desc: 'Cancel an open order without manager PIN' },
  { key: 'close_any_table', label: 'Close any table', desc: "Close orders they didn't open" },
  { key: 'reopen_order', label: 'Reopen orders', desc: 'Void and reopen closed orders' },
  { key: 'apply_approval_discounts', label: 'Apply manager discounts', desc: 'Use Manager Discount & Complimentary' },
  { key: 'delete_order', label: 'Delete orders', desc: 'Permanently delete orders' },
  { key: 'create_custom_item', label: 'Create custom items', desc: 'Add custom drinks/items with manual price on the spot' },
]

const DEFAULT_POS_PERMS: Record<string, boolean> = {
  cancel_order: false,
  close_any_table: false,
  reopen_order: false,
  apply_approval_discounts: false,
  delete_order: false,
  create_custom_item: false,
}

const MGMT_TABS = [
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
  { key: 'landlord', label: 'Landlord P&L' },
]

const POS_TABS = [
  { key: 'pos', label: 'Floor Plan' },
  { key: 'pos-kds', label: 'Bar Display' },
  { key: 'pos-shifts', label: 'Shifts' },
  { key: 'pos-history', label: 'Sales History' },
  { key: 'pos-reservations', label: 'Reservations' },
  { key: 'pos-production', label: 'Production Queue' },
  { key: 'pos-reports', label: 'POS Reports' },
  { key: 'pos-audit', label: 'Audit Log' },
  { key: 'pos-settings', label: 'POS Settings' },
]

const ALL_TABS = [...MGMT_TABS, ...POS_TABS]

const OWNER_FULL: Record<string, string> = Object.fromEntries(ALL_TABS.map(t => [t.key, 'edit']))

const DEFAULT_BARTENDER: Record<string, string> = {
  dashboard: 'view',
  sales: 'edit',
  expenses: 'none',
  receipts: 'none',
  inventory: 'none',
  'bar-inventory': 'edit',
  checklist: 'edit',
  pos: 'edit',
  'pos-kds': 'edit',
  'pos-shifts': 'none',
  'pos-history': 'none',
  'pos-reservations': 'view',
  'pos-reports': 'none',
  'pos-production': 'edit',
  cocktails: 'view',
  suppliers: 'none',
  rent: 'none',
  reports: 'none',
  pnl: 'none',
  landlord: 'none',
}

const DEFAULT_ACCOUNTANT: Record<string, string> = Object.fromEntries(
  ALL_TABS.map(t => [t.key, ['sales', 'expenses', 'reports', 'pnl'].includes(t.key) ? 'view' : 'none'])
)

const DEFAULT_INVESTOR: Record<string, string> = Object.fromEntries(
  ALL_TABS.map(t => [t.key, ['pnl', 'landlord'].includes(t.key) ? 'view' : 'none'])
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
  const [editPosPerms, setEditPosPerms] = useState<Record<string, boolean>>(DEFAULT_POS_PERMS)
  const [editRole, setEditRole] = useState('bartender')
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(false)
  const [editManagerPin, setEditManagerPin] = useState<string | null>(null)
  const [pinEnabled, setPinEnabled] = useState(false)
  const [editClockPin, setEditClockPin] = useState('')
  const [resetPasswordTarget, setResetPasswordTarget] = useState<UserProfile | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const { toast } = useToast()

  const openInvite = () => {
    setInviteForm(emptyInvite)
    setEditPerms(DEFAULT_BARTENDER)
    setInviteOpen(true)
  }

  const defaultPermsForRole = (role: string) =>
    ['owner', 'manager'].includes(role) ? OWNER_FULL :
    role === 'investor' ? DEFAULT_INVESTOR :
    role === 'accountant' ? DEFAULT_ACCOUNTANT :
    DEFAULT_BARTENDER

  const openEdit = (m: UserProfile) => {
    setEditTarget(m)
    setEditRole(m.role)
    setEditName(m.full_name)
    setEditPerms(m.tab_permissions ?? defaultPermsForRole(m.role))
    setEditPosPerms({ ...DEFAULT_POS_PERMS, ...(m.pos_permissions ?? {}) })
    const hasPinSet = !!m.manager_pin
    setPinEnabled(hasPinSet)
    setEditManagerPin(hasPinSet ? m.manager_pin! : '')
    setEditClockPin(m.clock_pin ?? '')
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

  const handleResetPassword = async () => {
    if (!resetPasswordTarget || !newPassword) return
    setPwLoading(true)
    const res = await fetch('/api/team/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resetPasswordTarget.id, password: newPassword }),
    })
    const data = await res.json()
    setPwLoading(false)
    if (!res.ok) { toast(data.error ?? 'Failed to reset password', 'error'); return }
    toast(`Password reset for ${resetPasswordTarget.full_name}`, 'success')
    setResetPasswordTarget(null)
    setNewPassword('')
  }

  const handleUpdate = async () => {
    if (!editTarget) return
    if (pinEnabled && (!editManagerPin || editManagerPin.length < 4)) {
      toast('PIN must be at least 4 digits', 'error'); return
    }
    setLoading(true)
    const manager_pin = pinEnabled ? editManagerPin : null
    const res = await fetch('/api/team/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: editTarget.id, full_name: editName, role: editRole, tab_permissions: editPerms, pos_permissions: editPosPerms, manager_pin, clock_pin: editClockPin || null }),
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
    <div className="space-y-3">
      <div>
        <p className="text-[#5A5865] text-[10px] font-semibold uppercase tracking-widest mb-1.5">Management</p>
        <div className="grid grid-cols-2 gap-1.5">
          {MGMT_TABS.map(tab => {
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
      </div>
      <div>
        <p className="text-[#5A5865] text-[10px] font-semibold uppercase tracking-widest mb-1.5">POS System</p>
        <div className="grid grid-cols-2 gap-1.5">
          {POS_TABS.map(tab => {
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
      </div>
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
                    {m.role === 'staff' ? 'Bartender' : m.role === 'full_timer' ? 'Full Timer' : m.role === 'part_timer' ? 'Part Timer' : m.role === 'accountant' ? 'Accountant' : m.role}
                  </span>
                  {m.clock_pin && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"><KeyRound size={9} /> Kiosk</span>}
                  {m.manager_pin && <span className="text-[9px] bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/20 px-2 py-0.5 rounded-full flex items-center gap-1"><ShieldCheck size={9} /> PIN</span>}
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
                <option value="full_timer">Full Timer</option>
                <option value="part_timer">Part Timer</option>
                <option value="manager">Manager</option>
                <option value="investor">Investor</option>
                <option value="accountant">Accountant</option>
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
                <option value="full_timer">Full Timer</option>
                <option value="part_timer">Part Timer</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
                <option value="investor">Investor</option>
                <option value="accountant">Accountant</option>
              </select>
            </div>
          </div>

          <div>
            <p className="label mb-2">Tab Access <span className="text-[#5A5865] font-normal normal-case">(click to cycle: none → view → edit)</span></p>
            <PermGrid perms={editPerms} onCycle={cyclePerm} />
          </div>

          {!['owner', 'manager'].includes(editRole) && (
            <div>
              <p className="label mb-2">POS Permissions <span className="text-[#5A5865] font-normal normal-case">— extra actions beyond their role</span></p>
              <div className="space-y-2">
                {POS_ACTION_PERMS.map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[#2A2A30] bg-[#1A1A1E]">
                    <div>
                      <p className="text-[#F0EEF6] text-sm font-medium">{label}</p>
                      <p className="text-[#5A5865] text-xs">{desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditPosPerms(p => ({ ...p, [key]: !p[key] }))}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${editPosPerms[key] ? 'bg-[#8B5CF6]' : 'bg-[#2A2A30]'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${editPosPerms[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clock-in PIN */}
          <div className="rounded-xl border border-[#2A2A30] bg-[#0D0D10] p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound size={14} className="text-[#A78BFA]" />
              <p className="text-[#F0EEF6] text-sm font-medium">Kiosk Clock-in PIN</p>
            </div>
            <p className="text-[#5A5865] text-xs">Used on the kiosk screen at <span className="text-[#9896A4]">/kiosk</span> to clock in and out. Leave blank to hide from kiosk.</p>
            <input
              className="input mt-1"
              type="text"
              inputMode="numeric"
              maxLength={8}
              placeholder="4-digit PIN e.g. 1234"
              value={editClockPin}
              onChange={e => setEditClockPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>

          {/* Manager PIN */}
          {editRole !== 'owner' && (
            <div className="rounded-xl border border-[#2A2A30] bg-[#0D0D10] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-[#A78BFA]" />
                    <p className="text-[#F0EEF6] text-sm font-medium">Discount Approval PIN</p>
                  </div>
                  <p className="text-[#5A5865] text-xs mt-0.5">Lets this staff approve manager-level discounts using their own PIN</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setPinEnabled(p => !p); setEditManagerPin('') }}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${pinEnabled ? 'bg-[#8B5CF6]' : 'bg-[#2A2A30]'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${pinEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {pinEnabled && (
                <div>
                  <label className="label">PIN (4+ digits)</label>
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="e.g. 1234"
                    value={editManagerPin ?? ''}
                    onChange={e => setEditManagerPin(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setResetPasswordTarget(editTarget); setNewPassword('') }}
              className="btn-secondary flex items-center gap-2 px-3">
              <KeyRound size={14} /> Reset Password
            </button>
            <button type="button" onClick={() => setEditTarget(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleUpdate} disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={!!resetPasswordTarget} onClose={() => { setResetPasswordTarget(null); setNewPassword('') }} title={`Reset Password — ${resetPasswordTarget?.full_name}`} size="sm">
        <div className="space-y-4">
          <p className="text-[#9896A4] text-sm">Set a new password for this account. They will need to use the new password next time they log in.</p>
          <div>
            <label className="label">New Password</label>
            <input
              className="input"
              type="password"
              placeholder="Min 6 characters"
              minLength={6}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => { setResetPasswordTarget(null); setNewPassword('') }} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleResetPassword} disabled={pwLoading || newPassword.length < 6} className="btn-primary flex-1 disabled:opacity-50">
              {pwLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
