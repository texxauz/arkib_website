import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PayrollClient } from './PayrollClient'

interface PageProps {
  searchParams: Promise<{ month?: string }>
}

export default async function PayrollPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (currentProfile?.role !== 'owner' && currentProfile?.role !== 'manager') redirect('/settings')

  const resolvedParams = await searchParams
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const selectedMonth = resolvedParams.month ?? currentMonth

  // Fetch all active users with their employee records
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, role, is_active')
    .eq('is_active', true)
    .neq('id', user.id)
    .order('full_name')

  const { data: employees } = await supabase
    .from('employees')
    .select('user_id, employment_type, monthly_salary, hourly_rate')

  // Fetch payroll records for selected month
  const { data: payrollRecords } = await supabase
    .from('payroll_records')
    .select('*')
    .eq('month', selectedMonth)

  // Fetch shifts for the selected month
  const monthStart = `${selectedMonth}-01T00:00:00+00:00`
  const [year, month] = selectedMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${selectedMonth}-${String(lastDay).padStart(2, '0')}T23:59:59+00:00`

  const { data: shifts } = await supabase
    .from('staff_shifts')
    .select('id, user_id, clock_in, clock_out, hourly_rate, is_public_holiday')
    .gte('clock_in', monthStart)
    .lte('clock_in', monthEnd)
    .not('clock_out', 'is', null)

  return (
    <PayrollClient
      users={users ?? []}
      employees={employees ?? []}
      payrollRecords={payrollRecords ?? []}
      shifts={shifts ?? []}
      selectedMonth={selectedMonth}
      currentMonth={currentMonth}
    />
  )
}
