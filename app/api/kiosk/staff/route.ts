import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch all active staff with a clock_pin set
  const { data: staff, error } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('is_active', true)
    .not('clock_pin', 'is', null)
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch who is currently clocked in (no clock_out)
  const { data: activeShifts } = await supabase
    .from('staff_shifts')
    .select('user_id, clock_in')
    .is('clock_out', null)

  const clockedInMap: Record<string, string> = {}
  for (const s of activeShifts ?? []) {
    clockedInMap[s.user_id] = s.clock_in
  }

  const result = (staff ?? []).map(u => ({
    id: u.id,
    full_name: u.full_name,
    role: u.role,
    clocked_in: !!clockedInMap[u.id],
    clock_in_time: clockedInMap[u.id] ?? null,
  }))

  return NextResponse.json(result)
}
