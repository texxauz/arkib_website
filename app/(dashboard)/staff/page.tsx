import { createClient } from '@/lib/supabase/server'
import { StaffClient } from './StaffClient'

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .is('deleted_at', null)
    .order('full_name')

  return <StaffClient initialEmployees={employees ?? []} />
}
