import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
  }

  const { shiftId, closingCash, notes } = await req.json()
  if (!shiftId) return NextResponse.json({ error: 'shiftId required' }, { status: 400 })

  const { data: shift } = await supabase
    .from('pos_shifts').select('*').eq('id', shiftId).eq('status', 'open').single()
  if (!shift) return NextResponse.json({ error: 'Shift not found or already closed' }, { status: 404 })

  // Calculate expected cash
  const { data: payments } = await supabase
    .from('pos_payments')
    .select('amount, pos_orders!inner(shift_id)')
    .eq('pos_orders.shift_id', shiftId)
    .eq('method', 'cash')

  const cashRevenue = (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
  const expectedCash = (shift.opening_float ?? 0) + cashRevenue
  const variance = (closingCash ?? 0) - expectedCash

  const now = new Date().toISOString()
  const { error } = await supabase.from('pos_shifts').update({
    closed_by: user.id,
    closed_at: now,
    closing_cash: closingCash ?? 0,
    expected_cash: expectedCash,
    variance,
    status: 'closed',
    notes: notes ?? null,
  }).eq('id', shiftId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    event: 'shift.closed',
    entity_type: 'pos_shifts',
    entity_id: shiftId,
    payload: { closing_cash: closingCash, expected_cash: expectedCash, variance },
  })

  return NextResponse.json({ success: true, variance })
}
