import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessDate } from '@/lib/utils'

const normName = (n: string) =>
  n.toLowerCase().replace(/\s*[—–-]\s*/g, ' ').replace(/\s*\(.*?\)/g, '').replace(/\s+/g, ' ').trim()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { orderId, payments } = body

  if (!orderId || !Array.isArray(payments) || !payments.length) {
    return NextResponse.json({ error: 'orderId and payments required' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'

  // 1. Load order — read authoritative financial values from the database.
  //    NEVER trust client-supplied discountAmount / serviceCharge / taxAmount.
  const { data: order, error: orderErr } = await supabase
    .from('pos_orders')
    .select('id, status, table_id, server_id, opened_at, discount_amount, discount_label, service_charge, tax_amount')
    .eq('id', orderId)
    .single()
  if (orderErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'open') return NextResponse.json({ error: 'Order already closed' }, { status: 400 })

  if (!isAdmin && order.server_id !== user.id) {
    return NextResponse.json({ error: 'You can only close your own orders' }, { status: 403 })
  }

  // 2. Load non-voided items — the source of truth for all calculations.
  const { data: items } = await supabase
    .from('pos_order_items')
    .select('id, item_name, item_type, item_id, category, quantity, unit_price, unit_cost, discount, notes')
    .eq('order_id', orderId)
    .is('voided_at', null)

  if (!items?.length) return NextResponse.json({ error: 'No items on order' }, { status: 400 })

  // 3. Compute totals server-side from authoritative DB values.
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price - (i.discount ?? 0)), 0)
  const discountAmount = order.discount_amount ?? 0
  const serviceCharge = order.service_charge ?? 0
  const taxAmount = order.tax_amount ?? 0
  const total = subtotal - discountAmount + serviceCharge + taxAmount

  // 4. Validate payment total — must cover the order total (within 1 cent rounding tolerance).
  const paymentTotal = payments.reduce((s: number, p: { method: string; amount: number }) => s + (p.amount ?? 0), 0)
  if (paymentTotal < total - 0.01) {
    return NextResponse.json({
      error: `Payment total (${paymentTotal.toFixed(2)}) is less than order total (${total.toFixed(2)})`,
    }, { status: 400 })
  }

  // 5. Business date (MYT UTC+8 with configurable cutoff hour).
  const { data: config } = await supabase
    .from('pos_config')
    .select('key, value')
    .eq('key', 'business_day_cutoff_hour')
  const cutoffHour = parseInt(config?.find((c: { key: string; value: string }) => c.key === 'business_day_cutoff_hour')?.value ?? '6', 10)
  const orderDate = getBusinessDate(order.opened_at, cutoffHour)

  const now = new Date().toISOString()

  // 6. Close the order atomically (optimistic lock prevents double-close).
  //    Write all computed totals — this is the canonical financial record.
  const { data: closed, error: closeErr } = await supabase
    .from('pos_orders')
    .update({
      status: 'closed',
      closed_at: now,
      subtotal,
      discount_amount: discountAmount,
      discount_label: order.discount_label ?? null,
      service_charge: serviceCharge,
      tax_amount: taxAmount,
      total,
    })
    .eq('id', orderId)
    .eq('status', 'open')
    .select('id')
  if (closeErr) return NextResponse.json({ error: closeErr.message }, { status: 500 })
  if (!closed?.length) return NextResponse.json({ error: 'Order was already closed by another request' }, { status: 409 })

  // 7. Insert payments — if this fails the order is already closed.
  //    We return 500 so the client knows to escalate to a manager (who can reopen).
  const { error: payErr } = await supabase.from('pos_payments').insert(
    payments.map((p: { method: string; amount: number }) => ({
      order_id: orderId,
      method: p.method,
      amount: p.amount,
      captured_by: user.id,
    }))
  )
  if (payErr) return NextResponse.json({ error: `Payment insert failed: ${payErr.message}` }, { status: 500 })

  // 8. Insert cocktail_sales rows (analytics — non-fatal on failure).
  //    order_id is included so reopen-order can cleanly reverse these rows.
  const salesRows = items.map(i => ({
    order_id: orderId,
    date: orderDate,
    cocktail_name: i.item_name,
    cocktail_id: i.item_type === 'cocktail' ? i.item_id : null,
    quantity: i.quantity,
    unit_price: i.unit_price,
    unit_cost: i.unit_cost ?? 0,
    category: i.category ?? 'other',
    logged_by: user.id,
  }))
  const { error: salesErr } = await supabase.from('cocktail_sales').insert(salesRows)
  if (salesErr) {
    // Log to audit table so operations can identify and correct the gap.
    await supabase.from('pos_audit_log').insert({
      actor_id: user.id,
      event: 'inventory.cocktail_sales_failed',
      entity_type: 'pos_orders',
      entity_id: orderId,
      payload: { error: salesErr.message },
    })
  }

  // 9–11. Inventory deductions (atomic RPCs — non-fatal individually but logged).
  const { data: premixes } = await supabase.from('bar_premixes').select('id, cocktail_name')
  const { data: spirits } = await supabase.from('bar_spirits').select('id, name')

  // Premix sold_serves for house_cocktails
  const premixDelta = new Map<string, number>()
  for (const item of items) {
    if (item.category !== 'house_cocktail') continue
    const match = premixes?.find((p: { id: string; cocktail_name: string | null }) =>
      normName(p.cocktail_name ?? '') === normName(item.item_name))
    if (match) premixDelta.set(match.id, (premixDelta.get(match.id) ?? 0) + item.quantity)
  }
  for (const [id, delta] of premixDelta) {
    const { error } = await supabase.rpc('increment_premix_serves', { p_id: id, p_delta: delta })
    if (error) {
      await supabase.from('pos_audit_log').insert({
        actor_id: user.id,
        event: 'inventory.deduction_failed',
        entity_type: 'bar_premixes',
        entity_id: id,
        payload: { order_id: orderId, delta, error: error.message },
      })
    }
  }

  // Spirit bottle deduction for wine/whisky
  const spiritBottleDelta = new Map<string, number>()
  for (const item of items) {
    if (item.category !== 'wine' && item.category !== 'whisky') continue
    const match = spirits?.find((s: { id: string; name: string }) =>
      normName(s.name) === normName(item.item_name))
    if (match) spiritBottleDelta.set(match.id, (spiritBottleDelta.get(match.id) ?? 0) + item.quantity)
  }
  for (const [id, delta] of spiritBottleDelta) {
    const { error } = await supabase.rpc('decrement_spirit_bottles', { p_id: id, p_delta: delta })
    if (error) {
      await supabase.from('pos_audit_log').insert({
        actor_id: user.id,
        event: 'inventory.deduction_failed',
        entity_type: 'bar_spirits',
        entity_id: id,
        payload: { order_id: orderId, delta, error: error.message },
      })
    }
  }

  // Spirit ml deduction for classic cocktails
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
    } catch { /* malformed notes JSON — skip */ }
  }
  for (const [id, ml] of classicMlDelta) {
    const { error } = await supabase.rpc('increment_spirit_ml', { p_id: id, p_ml: ml })
    if (error) {
      await supabase.from('pos_audit_log').insert({
        actor_id: user.id,
        event: 'inventory.deduction_failed',
        entity_type: 'bar_spirits',
        entity_id: id,
        payload: { order_id: orderId, ml, error: error.message },
      })
    }
  }

  // 12. Compute daily_sales revenue buckets.
  //     Prorate order-level discount proportionally across categories.
  //     Tax is captured in others_revenue so total_revenue always equals total_collected.
  let cocktailsGross = 0, beerGross = 0, wineGross = 0, foodGross = 0, othersGross = 0
  for (const item of items) {
    const lineTotal = item.quantity * item.unit_price - (item.discount ?? 0)
    if (item.category === 'house_cocktail' || item.category === 'classic') cocktailsGross += lineTotal
    else if (item.category === 'beer') beerGross += lineTotal
    else if (item.category === 'wine') wineGross += lineTotal
    else if (item.category === 'food') foodGross += lineTotal
    else othersGross += lineTotal
  }
  const grossSubtotal = cocktailsGross + beerGross + wineGross + foodGross + othersGross
  const discountRatio = grossSubtotal > 0 ? discountAmount / grossSubtotal : 0

  // Map ALL payment methods to their daily_sales columns.
  // online + bank_transfer → online_collected; other → others_revenue surcharge.
  let cashCol = 0, cardCol = 0, qrCol = 0, onlineCol = 0
  for (const p of payments as Array<{ method: string; amount: number }>) {
    if (p.method === 'cash') cashCol += p.amount
    else if (p.method === 'credit_card' || p.method === 'debit_card') cardCol += p.amount
    else if (p.method === 'qr_payment') qrCol += p.amount
    else if (p.method === 'online' || p.method === 'bank_transfer' || p.method === 'other') onlineCol += p.amount
  }

  // Service charge + tax both go into others_revenue so revenue totals match collected totals.
  const othersRev = othersGross * (1 - discountRatio) + serviceCharge + taxAmount

  // 13. Clear the table link before the RPC (ensures UI updates even if RPC fails).
  if (order.table_id) {
    await supabase.from('pos_tables').update({ current_order_id: null }).eq('id', order.table_id)
  }

  // 14. Atomically increment daily_sales (RPC handles upsert + concurrency).
  const { error: dsErr } = await supabase.rpc('increment_daily_sales', {
    p_date: orderDate,
    p_entered_by: user.id,
    p_cocktails_revenue: cocktailsGross * (1 - discountRatio),
    p_beer_revenue: beerGross * (1 - discountRatio),
    p_wine_revenue: wineGross * (1 - discountRatio),
    p_food_revenue: foodGross * (1 - discountRatio),
    p_others_revenue: othersRev,
    p_cash_collected: cashCol,
    p_credit_card_collected: cardCol,
    p_qr_collected: qrCol,
    p_online_collected: onlineCol,
    p_transaction_count: 1,
  })
  if (dsErr) {
    await supabase.from('pos_audit_log').insert({
      actor_id: user.id,
      event: 'inventory.daily_sales_failed',
      entity_type: 'pos_orders',
      entity_id: orderId,
      payload: { error: dsErr.message, date: orderDate },
    })
  }

  // 15. Audit log.
  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    event: 'order.closed',
    entity_type: 'pos_orders',
    entity_id: orderId,
    payload: {
      total,
      subtotal,
      discount_amount: discountAmount,
      service_charge: serviceCharge,
      tax_amount: taxAmount,
      items_count: items.length,
      payments,
    },
  })

  return NextResponse.json({ success: true, total, subtotal, discountAmount, serviceCharge, taxAmount })
}
