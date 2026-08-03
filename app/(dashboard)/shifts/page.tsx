import { createClient } from '@/lib/supabase/server'
import { ShiftsClient } from './ShiftsClient'
import { redirect } from 'next/navigation'

export default async function ShiftsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'

  const shiftsQuery = supabase
    .from('staff_shifts')
    .select('*, users(full_name, role)')
    .order('clock_in', { ascending: false })
    .limit(500)

  if (!isAdmin) {
    shiftsQuery.eq('user_id', user.id)
  }

  const { data: shifts } = await shiftsQuery

  const { data: staffUsers } = isAdmin
    ? await supabase.from('users').select('id, full_name, role').order('full_name')
    : { data: [] }

  // Fetch employment details from employees table
  const { data: employeeRates } = await supabase
    .from('employees')
    .select('user_id, hourly_rate, employment_type, monthly_salary')
    .not('user_id', 'is', null)

  const rateByUserId: Record<string, number> = {}
  const employmentByUserId: Record<string, { type: 'part_time' | 'full_time'; monthlySalary: number | null }> = {}
  for (const e of employeeRates ?? []) {
    if (e.user_id) {
      rateByUserId[e.user_id] = e.hourly_rate ?? 10
      employmentByUserId[e.user_id] = {
        type: e.employment_type ?? 'part_time',
        monthlySalary: e.monthly_salary ?? null,
      }
    }
  }

  return (
    <ShiftsClient
      shifts={(shifts ?? []) as any[]}
      currentUserId={user.id}
      currentUserName={userProfile?.full_name ?? ''}
      isAdmin={isAdmin ?? false}
      staffUsers={staffUsers ?? []}
      rateByUserId={rateByUserId}
      employmentByUserId={employmentByUserId}
    />
  )
}
