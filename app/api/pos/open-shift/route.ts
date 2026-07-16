import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Check no shift already open
  const { data: existing } = await supabase
    .from('pos_shifts').select('id').eq('status', 'open').limit(1).maybeSingle()
  if (existing) return NextResponse.json({ error: 'A shift is already open' }, { status: 400 })

  const { openingFloat = 0 } = await req.json()

  const { data: shift, error } = await supabase
    .from('pos_shifts')
    .insert({ opened_by: user.id, opening_float: openingFloat, status: 'open' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    event: 'shift.opened',
    entity_type: 'pos_shifts',
    entity_id: shift.id,
    payload: { opening_float: openingFloat },
  })

  return NextResponse.json({ shiftId: shift.id })
}
