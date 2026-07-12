import { createClient } from '@/lib/supabase/server'
import { ReportsClient } from './ReportsClient'

export default async function ReportsPage() {
  const supabase = await createClient()
  // Use Malaysia time (UTC+8)
  const nowMYT = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const month = nowMYT.getUTCMonth() + 1
  const year = nowMYT.getUTCFullYear()
  const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)

  const [{ data: monthlySales }, { data: monthlyExpenses }, { data: cocktails }, { data: employees }] = await Promise.all([
    supabase.from('daily_sales').select('*').gte('date', firstOfMonth).lte('date', lastDay).is('deleted_at', null).order('date'),
    supabase.from('expenses').select('*').gte('date', firstOfMonth).lte('date', lastDay).is('deleted_at', null),
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
