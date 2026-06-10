import { createClient } from '@/lib/supabase/server'
import { ReportsClient } from './ReportsClient'
import { getCurrentMonth, getCurrentYear } from '@/lib/utils'

export default async function ReportsPage() {
  const supabase = await createClient()
  const month = getCurrentMonth()
  const year = getCurrentYear()
  const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const lastOfMonth = new Date(year, month, 0).toISOString().split('T')[0]

  const [{ data: monthlySales }, { data: monthlyExpenses }, { data: cocktails }, { data: employees }] = await Promise.all([
    supabase.from('daily_sales').select('*').gte('date', firstOfMonth).lte('date', lastOfMonth).order('date'),
    supabase.from('expenses').select('*').gte('date', firstOfMonth).lte('date', lastOfMonth).is('deleted_at', null),
    supabase.from('cocktails').select('*').eq('is_active', true).order('profit_margin', { ascending: false }),
    supabase.from('employees').select('*').eq('is_active', true),
  ])

  return (
    <ReportsClient
      monthlySales={monthlySales ?? []}
      monthlyExpenses={monthlyExpenses ?? []}
      cocktails={cocktails ?? []}
      employees={employees ?? []}
      month={month}
      year={year}
    />
  )
}
