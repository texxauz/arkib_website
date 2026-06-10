import { createClient } from '@/lib/supabase/server'
import { PartnersClient } from './PartnersClient'
import { getCurrentMonth, getCurrentYear } from '@/lib/utils'

export default async function PartnersPage() {
  const supabase = await createClient()
  const month = getCurrentMonth()
  const year = getCurrentYear()
  const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const lastOfMonth = new Date(year, month, 0).toISOString().split('T')[0]

  const [{ data: partners }, { data: distributions }, { data: monthlySales }, { data: monthlyExpenses }] = await Promise.all([
    supabase.from('partners').select('*').is('deleted_at', null).eq('is_active', true),
    supabase.from('profit_distribution').select('*').eq('month', month).eq('year', year),
    supabase.from('daily_sales').select('total_revenue').gte('date', firstOfMonth).lte('date', lastOfMonth),
    supabase.from('expenses').select('amount').gte('date', firstOfMonth).lte('date', lastOfMonth).is('deleted_at', null),
  ])

  const totalRevenue = monthlySales?.reduce((s, r) => s + r.total_revenue, 0) ?? 0
  const totalExpenses = monthlyExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0

  return (
    <PartnersClient
      partners={partners ?? []}
      distributions={distributions ?? []}
      totalRevenue={totalRevenue}
      totalExpenses={totalExpenses}
      month={month}
      year={year}
    />
  )
}
