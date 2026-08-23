import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shiftId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shiftId } = await params

  // Load the shift
  const { data: shift, error: shiftErr } = await supabase
    .from('pos_shifts')
    .select('id, opened_at, closed_at, opening_float, closing_cash, expected_cash, variance, opened_by, closed_by, status')
    .eq('id', shiftId)
    .single()
  if (shiftErr || !shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

  // Resolve staff names
  const userIds = [...new Set([shift.opened_by, shift.closed_by].filter(Boolean))]
  const { data: userRows } = userIds.length
    ? await supabase.from('users').select('id, full_name').in('id', userIds)
    : { data: [] }
  const nameMap = Object.fromEntries((userRows ?? []).map(u => [u.id, u.full_name]))

  // Closed orders for this shift — include null-shift orders closed during the shift window
  const [{ data: shiftLinked }, { data: nullShift }] = await Promise.all([
    supabase.from('pos_orders')
      .select('id, total, subtotal, discount_amount, covers, service_charge, tax_amount, status')
      .eq('shift_id', shiftId).eq('status', 'closed'),
    supabase.from('pos_orders')
      .select('id, total, subtotal, discount_amount, covers, service_charge, tax_amount, status')
      .is('shift_id', null).eq('status', 'closed')
      .gte('closed_at', shift.opened_at)
      .lte('closed_at', shift.closed_at ?? new Date().toISOString()),
  ])
  const orders = [...(shiftLinked ?? []), ...(nullShift ?? [])]
  const orderIds = orders.map(o => o.id)

  if (!orderIds.length) {
    return NextResponse.json({
      shift,
      openedBy: nameMap[shift.opened_by] ?? 'Unknown',
      closedBy: nameMap[shift.closed_by] ?? null,
      revenue: { gross: 0, discount: 0, serviceCharge: 0, taxAmount: 0, voidValue: 0, voidCount: 0, net: 0 },
      payments: { cash: 0, credit_card: 0, qr_payment: 0, online: 0 },
      floor: { orders: 0, covers: 0, drinksSold: 0, discountedOrders: 0 },
      categories: { cocktails: 0, beer: 0, wine: 0, food: 0, others: 0 },
    })
  }

  // Payments, non-voided items, voided items — in parallel
  const [{ data: payments }, { data: items }, { data: voids }] = await Promise.all([
    supabase.from('pos_payments').select('method, amount').in('order_id', orderIds),
    supabase.from('pos_order_items')
      .select('quantity, unit_price, category, discount')
      .in('order_id', orderIds)
      .is('voided_at', null),
    supabase.from('pos_order_items')
      .select('quantity, unit_price')
      .in('order_id', orderIds)
      .not('voided_at', 'is', null),
  ])

  // Revenue
  const gross = (orders ?? []).reduce((s, o) => s + (o.subtotal ?? 0), 0)
  const discount = (orders ?? []).reduce((s, o) => s + (o.discount_amount ?? 0), 0)
  const serviceCharge = (orders ?? []).reduce((s, o) => s + (o.service_charge ?? 0), 0)
  const taxAmount = (orders ?? []).reduce((s, o) => s + (o.tax_amount ?? 0), 0)
  const net = (orders ?? []).reduce((s, o) => s + (o.total ?? 0), 0)
  const voidValue = (voids ?? []).reduce((s, v) => s + v.quantity * v.unit_price, 0)
  const voidCount = (voids ?? []).reduce((s, v) => s + v.quantity, 0)

  // Payments breakdown
  const payMap: Record<string, number> = { cash: 0, credit_card: 0, qr_payment: 0, online: 0 }
  for (const p of payments ?? []) {
    if (p.method === 'cash') payMap.cash += p.amount
    else if (p.method === 'credit_card' || p.method === 'debit_card' || p.method === 'visa' || p.method === 'mastercard') payMap.credit_card += p.amount
    else if (p.method === 'qr_payment') payMap.qr_payment += p.amount
    else payMap.online += p.amount
  }

  // Floor stats
  const covers = (orders ?? []).reduce((s, o) => s + (o.covers ?? 0), 0)
  const drinksSold = (items ?? []).reduce((s, i) => s + i.quantity, 0)
  const discountedOrders = (orders ?? []).filter(o => (o.discount_amount ?? 0) > 0).length

  // Category mix (from non-voided items, gross line totals before order-level discount)
  const cats = { cocktails: 0, beer: 0, wine: 0, food: 0, others: 0 }
  for (const item of items ?? []) {
    const line = item.quantity * item.unit_price - (item.discount ?? 0)
    if (item.category === 'house_cocktail' || item.category === 'classic') cats.cocktails += line
    else if (item.category === 'beer') cats.beer += line
    else if (item.category === 'wine' || item.category === 'whisky') cats.wine += line
    else if (item.category === 'food') cats.food += line
    else cats.others += line
  }

  return NextResponse.json({
    shift,
    openedBy: nameMap[shift.opened_by] ?? 'Unknown',
    closedBy: shift.closed_by ? (nameMap[shift.closed_by] ?? 'Unknown') : null,
    revenue: { gross, discount, serviceCharge, taxAmount, voidValue, voidCount, net },
    payments: payMap,
    floor: { orders: orderIds.length, covers, drinksSold, discountedOrders },
    categories: cats,
  })
}
