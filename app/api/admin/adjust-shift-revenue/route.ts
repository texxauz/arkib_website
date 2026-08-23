import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST { shiftId, revenue }
// Corrects the stored revenue on a closed shift (owner only).

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const { shiftId, revenue } = await req.json()
  if (!shiftId || revenue == null) return NextResponse.json({ error: 'shiftId and revenue required' }, { status: 400 })
  if (typeof revenue !== 'number' || revenue < 0) return NextResponse.json({ error: 'Invalid revenue' }, { status: 400 })

  const { data: shift } = await supabase.from('pos_shifts').select('id, revenue, status').eq('id', shiftId).single()
  if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  if (shift.status !== 'closed') return NextResponse.json({ error: 'Only closed shifts can be corrected' }, { status: 400 })

  const { error } = await supabase.from('pos_shifts').update({ revenue }).eq('id', shiftId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    actor_name: profile?.full_name ?? null,
    event: 'shift.revenue_corrected',
    entity_type: 'pos_shifts',
    entity_id: shiftId,
    payload: { old_revenue: shift.revenue, new_revenue: revenue },
  })

  return NextResponse.json({ success: true })
}
