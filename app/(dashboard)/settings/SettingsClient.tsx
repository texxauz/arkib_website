'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatMonth } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Settings, Target, User } from 'lucide-react'
import type { Database } from '@/types/database'

type UserProfile = Database['public']['Tables']['users']['Row']
type MonthlyTarget = Database['public']['Tables']['monthly_targets']['Row']

export function SettingsClient({ profile, target, month, year }: {
  profile: UserProfile | null
  target: MonthlyTarget | null
  month: number
  year: number
}) {
  const [targetRevenue, setTargetRevenue] = useState(String(target?.revenue_target ?? ''))
  const [expenseBudget, setExpenseBudget] = useState(String(target?.expense_budget ?? ''))
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('monthly_targets').upsert({
      month, year,
      revenue_target: parseFloat(targetRevenue) || 0,
      expense_budget: parseFloat(expenseBudget) || null,
    }, { onConflict: 'month,year' })

    if (error) { toast(error.message, 'error') }
    else { toast('Target saved', 'success') }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <TopBar title="Settings" />

      {/* Profile */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <User size={16} className="text-[#8B5CF6]" />
          <p className="section-title">Account</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center text-white font-bold">
            {profile?.full_name?.[0] ?? 'U'}
          </div>
          <div>
            <p className="text-[#F0EEF6] font-semibold">{profile?.full_name}</p>
            <p className="text-[#9896A4] text-sm">{profile?.email}</p>
            <span className="badge-purple text-xs capitalize mt-1">{profile?.role}</span>
          </div>
        </div>
      </div>

      {/* Monthly target */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Target size={16} className="text-[#D4AF37]" />
          <p className="section-title">Monthly Target — {formatMonth(month, year)}</p>
        </div>
        <form onSubmit={handleSaveTarget} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Revenue Target (RM)</label>
              <input
                type="number" step="0.01" min="0"
                value={targetRevenue}
                onChange={e => setTargetRevenue(e.target.value)}
                className="input" placeholder="100000"
              />
            </div>
            <div>
              <label className="label">Expense Budget (RM)</label>
              <input
                type="number" step="0.01" min="0"
                value={expenseBudget}
                onChange={e => setExpenseBudget(e.target.value)}
                className="input" placeholder="50000"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Target'}
          </button>
        </form>
      </div>

      {/* System info */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Settings size={16} className="text-[#9896A4]" />
          <p className="section-title">System</p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-[#1A1A1E]">
            <span className="text-[#9896A4]">Version</span>
            <span className="text-[#F0EEF6]">1.0.0</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#1A1A1E]">
            <span className="text-[#9896A4]">Database</span>
            <span className="text-emerald-400">Connected</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-[#9896A4]">Currency</span>
            <span className="text-[#F0EEF6]">MYR (RM)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
