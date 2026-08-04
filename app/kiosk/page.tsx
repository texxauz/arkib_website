import { createClient } from '@/lib/supabase/server'
import { KioskClient } from './KioskClient'

// No auth wall — this is a public kiosk page
export const revalidate = 0

export default async function KioskPage() {
  const supabase = await createClient()

  // Fetch active staff with clock_pin set
  const { data: staff } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('is_active', true)
    .not('clock_pin', 'is', null)
    .order('full_name')

  // Fetch who is currently clocked in
  const { data: activeShifts } = await supabase
    .from('staff_shifts')
    .select('user_id, clock_in')
    .is('clock_out', null)

  const clockedInMap: Record<string, string> = {}
  for (const s of activeShifts ?? []) {
    clockedInMap[s.user_id] = s.clock_in
  }

  const initialStaff = (staff ?? []).map(u => ({
    id: u.id,
    full_name: u.full_name,
    role: u.role,
    clocked_in: !!clockedInMap[u.id],
    clock_in_time: clockedInMap[u.id] ?? null,
  }))

  return <KioskClient initialStaff={initialStaff} />
}
