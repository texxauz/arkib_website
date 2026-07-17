import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { shiftId, closingCash, notes } = await req.json()
  if (!shiftId) return NextResponse.json({ error: 'shiftId required' }, { status: 400 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'

  const { data: shift } = await supabase
    .from('pos_shifts').select('*').eq('id', shiftId).eq('status', 'open').single()
  if (!shift) return NextResponse.json({ error: 'Shift not found or already closed' }, { status: 404 })

  // Authorization: only the shift opener or an admin can close a shift.
  if (shift.opened_by !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'You can only close your own shift' }, { status: 403 })
  }

  // Block close if any orders under THIS shift are still open (shift-scoped, not global).
  const { data: openOrders } = await supabase
    .from('pos_orders')
    .select('id, table_name')
    .eq('shift_id', shiftId)
    .eq('status', 'open')
    .limit(10)
  if (openOrders && openOrders.length > 0) {
    const names = openOrders.map(o => o.table_name ?? 'Walk-in').join(', ')
    return NextResponse.json({
      error: `Cannot close shift — ${openOrders.length} table${openOrders.length > 1 ? 's' : ''} still open: ${names}`,
    }, { status: 400 })
  }

  // Calculate revenue from all payments under this shift's orders.
  const { data: allPayments } = await supabase
    .from('pos_payments')
    .select('amount, method, pos_orders!inner(shift_id)')
    .eq('pos_orders.shift_id', shiftId)

  const cashRevenue = (allPayments ?? []).filter(p => p.method === 'cash').reduce((s, p) => s + (p.amount ?? 0), 0)
  const totalRevenue = (allPayments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
  const expectedCash = (shift.opening_float ?? 0) + cashRevenue
  const variance = (closingCash ?? 0) - expectedCash

  const now = new Date().toISOString()
  const { error } = await supabase.from('pos_shifts').update({
    closed_by: user.id,
    closed_at: now,
    closing_cash: closingCash ?? 0,
    expected_cash: expectedCash,
    variance,
    revenue: totalRevenue,
    status: 'closed',
    notes: notes ?? null,
  }).eq('id', shiftId).eq('status', 'open') // optimistic lock prevents double-close

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
