import { createClient } from '@/lib/supabase/server'
import { SalaryClient } from './SalaryClient'
import { getCurrentMonth, getCurrentYear } from '@/lib/utils'

export default async function SalaryPage() {
  const supabase = await createClient()
  const month = getCurrentMonth()
  const year = getCurrentYear()

  const [{ data: employees }, { data: attendance }, { data: salaryRecords }] = await Promise.all([
    supabase.from('employees').select('*').eq('is_active', true).is('deleted_at', null),
    supabase.from('attendance').select('*').gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lte('date', new Date(year, month, 0).toISOString().split('T')[0]),
    supabase.from('salary_records').select('*').eq('month', month).eq('year', year),
  ])

  return (
    <SalaryClient
      employees={employees ?? []}
      attendance={attendance ?? []}
      salaryRecords={salaryRecords ?? []}
      month={month}
      year={year}
    />
  )
}
