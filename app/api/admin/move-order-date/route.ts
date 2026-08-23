import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessDate } from '@/lib/utils'

// POST { orderId, toDate: 'YYYY-MM-DD' }
// Moves a single closed order to a different business date.
// Adjusts daily_sales on both the source and target date.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const { orderId, toDate } = await req.json()
  if (!orderId || !toDate) return NextResponse.json({ error: 'orderId and toDate required' }, { status: 400 })

  const { data: config } = await supabase
    .from('pos_config').select('key, value').eq('key', 'business_day_cutoff_hour')
  const cutoffHour = parseInt(config?.find(c => c.key === 'business_day_cutoff_hour')?.value ?? '6', 10)

  const { data: order } = await supabase
    .from('pos_orders')
    .select('id, table_name, opened_at, closed_at, total, discount_amount, service_charge, tax_amount, status')
    .eq('id', orderId).single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'closed') return NextResponse.json({ error: 'Only closed orders can be moved' }, { status: 400 })

  const fromDate = getBusinessDate(order.opened_at, cutoffHour)
  if (fromDate === toDate) return NextResponse.json({ error: 'Order is already on that date' }, { status: 400 })

  // Load items and payments
  const { data: items } = await supabase
    .from('pos_order_items')
    .select('category, quantity, unit_price, discount')
    .eq('order_id', orderId)
    .is('voided_at', null)

  const { data: payments } = await supabase
    .from('pos_payments')
    .select('method, amount')
    .eq('order_id', orderId)

  // Aggregate by category
  let cocktails = 0, beer = 0, wine = 0, food = 0, others = 0
  for (const item of items ?? []) {
    const line = item.quantity * item.unit_price - (item.discount ?? 0)
    if (item.category === 'house_cocktail' || item.category === 'classic') cocktails += line
    else if (item.category === 'beer') beer += line
    else if (item.category === 'wine' || item.category === 'whisky') wine += line
    else if (item.category === 'food') food += line
    else others += line
  }
  const svc = order.service_charge ?? 0
  const tax = order.tax_amount ?? 0
  const othersTotal = others + svc + tax

  let cash = 0, card = 0, qr = 0, online = 0
  for (const p of payments ?? []) {
    if (p.method === 'cash') cash += p.amount
    else if (p.method === 'credit_card' || p.method === 'debit_card') card += p.amount
    else if (p.method === 'qr_payment') qr += p.amount
    else online += p.amount
  }

  // Subtract from fromDate daily_sales
  const { data: fromRow } = await supabase.from('daily_sales').select('*').eq('date', fromDate).maybeSingle()
  if (fromRow) {
    await supabase.from('daily_sales').update({
      cocktails_revenue:     Math.max(0, fromRow.cocktails_revenue - cocktails),
      beer_revenue:          Math.max(0, fromRow.beer_revenue - beer),
      wine_revenue:          Math.max(0, fromRow.wine_revenue - wine),
      food_revenue:          Math.max(0, fromRow.food_revenue - food),
      others_revenue:        Math.max(0, fromRow.others_revenue - othersTotal),
      cash_collected:        Math.max(0, fromRow.cash_collected - cash),
      credit_card_collected: Math.max(0, fromRow.credit_card_collected - card),
      qr_collected:          Math.max(0, fromRow.qr_collected - qr),
      online_collected:      Math.max(0, fromRow.online_collected - online),
      transaction_count:     Math.max(0, (fromRow.transaction_count ?? 0) - 1),
    }).eq('date', fromDate)
  }

  // Add to toDate daily_sales (upsert)
  const { data: toRow } = await supabase.from('daily_sales').select('*').eq('date', toDate).maybeSingle()
  if (toRow) {
    await supabase.from('daily_sales').update({
      cocktails_revenue:     toRow.cocktails_revenue + cocktails,
      beer_revenue:          toRow.beer_revenue + beer,
      wine_revenue:          toRow.wine_revenue + wine,
      food_revenue:          toRow.food_revenue + food,
      others_revenue:        toRow.others_revenue + othersTotal,
      cash_collected:        toRow.cash_collected + cash,
      credit_card_collected: toRow.credit_card_collected + card,
      qr_collected:          toRow.qr_collected + qr,
      online_collected:      toRow.online_collected + online,
      transaction_count:     (toRow.transaction_count ?? 0) + 1,
    }).eq('date', toDate)
  } else {
    await supabase.from('daily_sales').insert({
      date: toDate,
      cocktails_revenue: cocktails,
      beer_revenue: beer,
      wine_revenue: wine,
      food_revenue: food,
      others_revenue: othersTotal,
      cash_collected: cash,
      credit_card_collected: card,
      qr_collected: qr,
      online_collected: online,
      transaction_count: 1,
    })
  }

  // Shift order timestamps by the exact day difference
  const dayDiff = (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (24 * 60 * 60 * 1000)
  const shiftMs = dayDiff * 24 * 60 * 60 * 1000
  const newOpened = new Date(new Date(order.opened_at).getTime() + shiftMs).toISOString()
  const newClosed = new Date(new Date(order.closed_at!).getTime() + shiftMs).toISOString()
  await supabase.from('pos_orders').update({ opened_at: newOpened, closed_at: newClosed }).eq('id', orderId)

  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    actor_name: profile?.full_name ?? null,
    event: 'order.date_moved',
    entity_type: 'pos_orders',
    entity_id: orderId,
    payload: { from_date: fromDate, to_date: toDate, table_name: order.table_name, total: order.total },
  })

  return NextResponse.json({ success: true, fromDate, toDate })
}
