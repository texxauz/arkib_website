import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessDate } from '@/lib/utils'

// One-time admin endpoint: move orders closed on a given date before a cutoff hour
// to the previous business day. Fixes daily_sales and order timestamps.
// POST { fromDate: '2026-08-23', beforeHour: 14, dryRun?: true }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const { fromDate, beforeHour = 14, dryRun = false } = await req.json()
  if (!fromDate) return NextResponse.json({ error: 'fromDate required' }, { status: 400 })

  const { data: config } = await supabase
    .from('pos_config').select('key, value').in('key', ['business_day_cutoff_hour'])
  const cutoffHour = parseInt(config?.find(c => c.key === 'business_day_cutoff_hour')?.value ?? '6', 10)

  // Find closed orders on fromDate before beforeHour (local time MYT = UTC+8)
  const dayStart = `${fromDate}T00:00:00+08:00`
  const cutoffTime = `${fromDate}T${String(beforeHour).padStart(2, '0')}:00:00+08:00`

  const { data: orders, error: ordersErr } = await supabase
    .from('pos_orders')
    .select('id, table_name, opened_at, closed_at, total, discount_amount, service_charge, tax_amount, status')
    .eq('status', 'closed')
    .gte('closed_at', dayStart)
    .lt('closed_at', cutoffTime)

  if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 })
  if (!orders?.length) return NextResponse.json({ message: 'No orders found to move', orders: [] })

  const orderIds = orders.map(o => o.id)

  // Load items for those orders
  const { data: items } = await supabase
    .from('pos_order_items')
    .select('order_id, category, quantity, unit_price, discount')
    .in('order_id', orderIds)
    .is('voided_at', null)

  // Load payments
  const { data: payments } = await supabase
    .from('pos_payments')
    .select('order_id, method, amount')
    .in('order_id', orderIds)

  // Aggregate revenue & payment totals across all affected orders
  let cocktails = 0, beer = 0, wine = 0, food = 0, others = 0
  let cash = 0, card = 0, qr = 0, online = 0
  let svc = 0, tax = 0

  for (const item of items ?? []) {
    const line = item.quantity * item.unit_price - (item.discount ?? 0)
    if (item.category === 'house_cocktail' || item.category === 'classic') cocktails += line
    else if (item.category === 'beer') beer += line
    else if (item.category === 'wine' || item.category === 'whisky') wine += line
    else if (item.category === 'food') food += line
    else others += line
  }

  const orderMap = Object.fromEntries(orders.map(o => [o.id, o]))
  const seen = new Set<string>()
  for (const o of orders) {
    if (!seen.has(o.id)) { svc += o.service_charge ?? 0; tax += o.tax_amount ?? 0; seen.add(o.id) }
  }

  for (const p of payments ?? []) {
    if (p.method === 'cash') cash += p.amount
    else if (p.method === 'credit_card' || p.method === 'debit_card') card += p.amount
    else if (p.method === 'qr_payment') qr += p.amount
    else online += p.amount
  }

  // Calculate the gross subtotal for discount proration (matches close-order logic)
  // We already have category totals; discount_amount is order-level
  const grossSubtotal = cocktails + beer + wine + food + others
  // distribute order-level discounts proportionally (already reflected in item discounts above)

  const fromDateStr = fromDate  // e.g. '2026-08-23'
  // Previous business day: the sample orders are early morning so business date = fromDate
  // Target is previous calendar day
  const prevDate = new Date(fromDate)
  prevDate.setDate(prevDate.getDate() - 1)
  const toDateStr = prevDate.toISOString().slice(0, 10) // '2026-08-22'

  const txnCount = orders.length

  const preview = {
    ordersToMove: orders.map(o => ({ id: o.id, table: o.table_name, closed_at: o.closed_at, total: o.total })),
    fromDate: fromDateStr,
    toDate: toDateStr,
    revenueShift: { cocktails, beer, wine, food, others: others + svc + tax },
    paymentsShift: { cash, card, qr, online },
    txnCount,
    dryRun,
  }

  if (dryRun) return NextResponse.json(preview)

  // 1. Subtract from fromDate daily_sales
  const { data: fromRow } = await supabase.from('daily_sales').select('*').eq('date', fromDateStr).maybeSingle()
  if (fromRow) {
    await supabase.from('daily_sales').update({
      cocktails_revenue:     Math.max(0, fromRow.cocktails_revenue - cocktails),
      beer_revenue:          Math.max(0, fromRow.beer_revenue - beer),
      wine_revenue:          Math.max(0, fromRow.wine_revenue - wine),
      food_revenue:          Math.max(0, fromRow.food_revenue - food),
      others_revenue:        Math.max(0, fromRow.others_revenue - (others + svc + tax)),
      cash_collected:        Math.max(0, fromRow.cash_collected - cash),
      credit_card_collected: Math.max(0, fromRow.credit_card_collected - card),
      qr_collected:          Math.max(0, fromRow.qr_collected - qr),
      online_collected:      Math.max(0, fromRow.online_collected - online),
      transaction_count:     Math.max(0, (fromRow.transaction_count ?? 0) - txnCount),
    }).eq('date', fromDateStr)
  }

  // 2. Add to toDate daily_sales (upsert)
  const { data: toRow } = await supabase.from('daily_sales').select('*').eq('date', toDateStr).maybeSingle()
  if (toRow) {
    await supabase.from('daily_sales').update({
      cocktails_revenue:     toRow.cocktails_revenue + cocktails,
      beer_revenue:          toRow.beer_revenue + beer,
      wine_revenue:          toRow.wine_revenue + wine,
      food_revenue:          toRow.food_revenue + food,
      others_revenue:        toRow.others_revenue + (others + svc + tax),
      cash_collected:        toRow.cash_collected + cash,
      credit_card_collected: toRow.credit_card_collected + card,
      qr_collected:          toRow.qr_collected + qr,
      online_collected:      toRow.online_collected + online,
      transaction_count:     (toRow.transaction_count ?? 0) + txnCount,
    }).eq('date', toDateStr)
  } else {
    await supabase.from('daily_sales').insert({
      date: toDateStr,
      cocktails_revenue: cocktails,
      beer_revenue: beer,
      wine_revenue: wine,
      food_revenue: food,
      others_revenue: others + svc + tax,
      cash_collected: cash,
      credit_card_collected: card,
      qr_collected: qr,
      online_collected: online,
      transaction_count: txnCount,
    })
  }

  // 3. Backdate the orders (shift back exactly 24 hours)
  for (const orderId of orderIds) {
    const o = orderMap[orderId]
    const newOpened = new Date(new Date(o.opened_at).getTime() - 24 * 60 * 60 * 1000).toISOString()
    const newClosed = new Date(new Date(o.closed_at).getTime() - 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('pos_orders').update({ opened_at: newOpened, closed_at: newClosed }).eq('id', orderId)
  }

  return NextResponse.json({ ...preview, dryRun: false, success: true })
}
