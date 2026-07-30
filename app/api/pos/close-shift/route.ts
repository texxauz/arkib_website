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

  // Gather all data needed for auto night report generation
  const [
    { data: allPayments },
    { data: closedOrders },
    { data: orderItems },
    { data: voidedItems },
    { data: openerProfile },
  ] = await Promise.all([
    supabase.from('pos_payments').select('amount, method, pos_orders!inner(shift_id)').eq('pos_orders.shift_id', shiftId),
    supabase.from('pos_orders').select('id, total, subtotal, discount_amount, covers').eq('shift_id', shiftId).eq('status', 'closed'),
    supabase.from('pos_order_items').select('quantity, pos_orders!inner(shift_id)').eq('pos_orders.shift_id', shiftId).is('voided_at', null),
    supabase.from('pos_order_items').select('quantity, unit_price, pos_orders!inner(shift_id)').eq('pos_orders.shift_id', shiftId).not('voided_at', 'is', null),
    supabase.from('users').select('full_name').eq('id', shift.opened_by).single(),
  ])

  const cashRevenue = (allPayments ?? []).filter(p => p.method === 'cash').reduce((s, p) => s + (p.amount ?? 0), 0)
  const totalRevenue = (allPayments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
  const expectedCash = (shift.opening_float ?? 0) + cashRevenue
  const variance = (closingCash ?? 0) - expectedCash

  // Build auto night report from computed shift data
  const pmts = allPayments ?? []
  const nightReport = {
    date: new Date(shift.opened_at).toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', year: 'numeric' }),
    staff: openerProfile?.full_name ?? 'Unknown',
    partTimeStaff: '',
    salesBeforeDiscount: (closedOrders ?? []).reduce((s, o) => s + (o.subtotal ?? 0), 0),
    salesAfterDiscount: (closedOrders ?? []).reduce((s, o) => s + (o.total ?? 0), 0),
    cash: pmts.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0),
    mastercard: pmts.filter(p => p.method === 'mastercard').reduce((s, p) => s + p.amount, 0),
    visa: pmts.filter(p => p.method === 'visa').reduce((s, p) => s + p.amount, 0),
    debit: pmts.filter(p => p.method === 'debit_card' || p.method === 'credit_card').reduce((s, p) => s + p.amount, 0),
    qr: pmts.filter(p => p.method === 'qr_payment').reduce((s, p) => s + p.amount, 0),
    drinksSold: (orderItems ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0),
    guestsTables: (closedOrders ?? []).length,
    guestsPax: (closedOrders ?? []).reduce((s, o) => s + (o.covers ?? 0), 0),
    discount: (closedOrders ?? []).reduce((s, o) => s + (o.discount_amount ?? 0), 0),
    voidValue: (voidedItems ?? []).reduce((s, i) => s + i.quantity * i.unit_price, 0),
    voidCount: (voidedItems ?? []).reduce((s, i) => s + i.quantity, 0),
    notableGuests: '',
    incidentReport: '',
    breakage: '',
    freeShots: '',
  }

  const now = new Date().toISOString()
  const { data: closedShift, error } = await supabase.from('pos_shifts').update({
    closed_by: user.id,
    closed_at: now,
    closing_cash: closingCash ?? 0,
    expected_cash: expectedCash,
    variance,
    revenue: totalRevenue,
    status: 'closed',
    notes: notes ?? null,
    night_report: nightReport,
    night_report_saved_at: now,
  }).eq('id', shiftId).eq('status', 'open').select('id') // optimistic lock prevents double-close

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!closedShift?.length) return NextResponse.json({ error: 'Shift was already closed by another request' }, { status: 409 })

  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    event: 'shift.closed',
    entity_type: 'pos_shifts',
    entity_id: shiftId,
    payload: { closing_cash: closingCash, expected_cash: expectedCash, variance },
  })

  return NextResponse.json({ success: true, variance })
}
