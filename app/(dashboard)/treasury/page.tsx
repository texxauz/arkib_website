export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { TreasuryClient } from './TreasuryClient'
import { redirect } from 'next/navigation'

export default async function TreasuryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') redirect('/dashboard')

  const [{ data: config }, { data: salesData }, { data: expensesData }] = await Promise.all([
    supabase.from('treasury_config').select('opening_balance, opening_date').order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('daily_sales').select('date, total_revenue').is('deleted_at', null).order('date'),
    supabase.from('expenses').select('date, paid_at, amount, category, description, is_paid').is('deleted_at', null).eq('is_paid', true).order('paid_at'),
  ])

  return (
    <TreasuryClient
      openingBalance={config?.opening_balance ?? 0}
      openingDate={config?.opening_date ?? new Date().toISOString().slice(0, 10)}
      salesData={salesData ?? []}
      expensesData={expensesData ?? []}
    />
  )
}
