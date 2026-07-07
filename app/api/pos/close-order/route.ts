import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const normName = (n: string) =>
  n.toLowerCase().replace(/\s*[—–-]\s*/g, ' ').replace(/\s*\(.*?\)/g, '').replace(/\s+/g, ' ').trim()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { orderId, payments, discountAmount = 0, discountLabel = '', serviceCharge = 0, taxAmount = 0 } = body

  if (!orderId || !payments?.length) {
    return NextResponse.json({ error: 'orderId and payments required' }, { status: 400 })
  }

  // 1. Load order + items
  const { data: order, error: orderErr } = await supabase
    .from('pos_orders').select('*').eq('id', orderId).single()
  if (orderErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'open') return NextResponse.json({ error: 'Order already closed' }, { status: 400 })

  const { data: items } = await supabase
    .from('pos_order_items')
    .select('*')
    .eq('order_id', orderId)
    .is('voided_at', null)

  if (!items?.length) return NextResponse.json({ error: 'No items on order' }, { status: 400 })

  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price - (i.discount ?? 0)), 0)
  const total = subtotal - discountAmount + serviceCharge + taxAmount
  const now = new Date().toISOString()
  const orderDate = order.opened_at.slice(0, 10)

  // 2. Close the order
  const { error: closeErr } = await supabase
    .from('pos_orders')
    .update({ status: 'closed', closed_at: now, subtotal, discount_amount: discountAmount, discount_label: discountLabel, service_charge: serviceCharge, tax_amount: taxAmount, total })
    .eq('id', orderId)
  if (closeErr) return NextResponse.json({ error: closeErr.message }, { status: 500 })

  // 3. Write payments
  for (const p of payments) {
    await supabase.from('pos_payments').insert({ order_id: orderId, method: p.method, amount: p.amount, captured_by: user.id })
  }

  // 4. Write cocktail_sales rows
  const salesRows = items.map(i => ({
    date: orderDate,
    cocktail_name: i.item_name,
    cocktail_id: i.item_type === 'cocktail' ? i.item_id : null,
    quantity: i.quantity,
    unit_price: i.unit_price,
    unit_cost: i.unit_cost ?? 0,
    category: i.category ?? 'other',
    logged_by: user.id,
  }))
  await supabase.from('cocktail_sales').insert(salesRows)

  // 5. Load bar_premixes + bar_spirits for deduction
  const { data: premixes } = await supabase.from('bar_premixes').select('id, cocktail_name, sold_serves')
  const { data: spirits } = await supabase.from('bar_spirits').select('id, name, full_bottles, used_classics_ml')

  // 6. Deduct premix sold_serves for house_cocktail
  const premixDelta = new Map<string, number>()
  for (const item of items) {
    if (item.category !== 'house_cocktail') continue
    const match = premixes?.find(p => normName(p.cocktail_name ?? '') === normName(item.item_name))
    if (match) premixDelta.set(match.id, (premixDelta.get(match.id) ?? 0) + item.quantity)
  }
  for (const [id, delta] of premixDelta) {
    const pm = premixes?.find(p => p.id === id)
    if (pm) await supabase.from('bar_premixes').update({ sold_serves: pm.sold_serves + delta }).eq('id', id)
  }

  // 7. Deduct bar_spirits for wine/whisky (full bottles)
  const spiritBottleDelta = new Map<string, number>()
  for (const item of items) {
    if (item.category !== 'wine' && item.category !== 'whisky') continue
    const match = spirits?.find(s => normName(s.name) === normName(item.item_name))
    if (match) spiritBottleDelta.set(match.id, (spiritBottleDelta.get(match.id) ?? 0) + item.quantity)
  }
  for (const [id, delta] of spiritBottleDelta) {
    const sp = spirits?.find(s => s.id === id)
    if (sp) await supabase.from('bar_spirits').update({ full_bottles: Math.max(0, sp.full_bottles - delta) }).eq('id', id)
  }

  // 8. Deduct bar_spirits for classic (used_classics_ml via item notes JSON)
  const classicMlDelta = new Map<string, number>()
  for (const item of items) {
    if (item.category !== 'classic') continue
    try {
      const parsed = item.notes ? JSON.parse(item.notes) : null
      if (parsed?.spirits) {
        for (const entry of parsed.spirits) {
          if (!entry.spiritId || !entry.ml) continue
          classicMlDelta.set(entry.spiritId, (classicMlDelta.get(entry.spiritId) ?? 0) + entry.ml * item.quantity)
        }
      }
    } catch {}
  }
  for (const [id, ml] of classicMlDelta) {
    const sp = spirits?.find(s => s.id === id)
    if (sp) await supabase.from('bar_spirits').update({ used_classics_ml: sp.used_classics_ml + ml }).eq('id', id)
  }

  // 9. Upsert daily_sales revenue buckets
  let cocktailsRev = 0, beerRev = 0, wineRev = 0, foodRev = 0, othersRev = 0
  let cashCol = 0, cardCol = 0, qrCol = 0
  for (const item of items) {
    const lineTotal = item.quantity * item.unit_price - (item.discount ?? 0)
    if (item.category === 'house_cocktail' || item.category === 'classic') cocktailsRev += lineTotal
    else if (item.category === 'beer') beerRev += lineTotal
    else if (item.category === 'wine') wineRev += lineTotal
    else if (item.category === 'food') foodRev += lineTotal
    else othersRev += lineTotal
  }
  for (const p of payments) {
    if (p.method === 'cash') cashCol += p.amount
    else if (p.method === 'credit_card' || p.method === 'debit_card') cardCol += p.amount
    else if (p.method === 'qr_payment') qrCol += p.amount
  }

  const { data: existingDS } = await supabase.from('daily_sales').select('id, cocktails_revenue, beer_revenue, wine_revenue, food_revenue, others_revenue, cash_collected, credit_card_collected, qr_collected, transaction_count').eq('date', orderDate).single()
  if (existingDS) {
    await supabase.from('daily_sales').update({
      cocktails_revenue: existingDS.cocktails_revenue + cocktailsRev,
      beer_revenue: existingDS.beer_revenue + beerRev,
      wine_revenue: existingDS.wine_revenue + wineRev,
      food_revenue: existingDS.food_revenue + foodRev,
      others_revenue: existingDS.others_revenue + othersRev,
      cash_collected: existingDS.cash_collected + cashCol,
      credit_card_collected: existingDS.credit_card_collected + cardCol,
      qr_collected: existingDS.qr_collected + qrCol,
      transaction_count: (existingDS.transaction_count ?? 0) + 1,
    }).eq('date', orderDate)
  } else {
    await supabase.from('daily_sales').insert({
      date: orderDate,
      cocktails_revenue: cocktailsRev,
      beer_revenue: beerRev,
      wine_revenue: wineRev,
      food_revenue: foodRev,
      others_revenue: othersRev,
      cash_collected: cashCol,
      credit_card_collected: cardCol,
      qr_collected: qrCol,
      transaction_count: 1,
      entered_by: user.id,
    })
  }

  // 10. Clear table current_order_id
  if (order.table_id) {
    await supabase.from('pos_tables').update({ current_order_id: null }).eq('id', order.table_id)
  }

  // 11. Audit log
  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    event: 'order.closed',
    entity_type: 'pos_orders',
    entity_id: orderId,
    payload: { total, items_count: items.length, payments },
  })

  return NextResponse.json({ success: true, total })
}
