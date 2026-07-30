import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessDate } from '@/lib/utils'
import { retrySupabase } from '@/lib/retry'

const normName = (n: string) =>
  n.toLowerCase().replace(/\s*[—–-]\s*/g, ' ').replace(/\s*\(.*?\)/g, '').replace(/\s+/g, ' ').trim()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, full_name, pos_permissions').eq('id', user.id).single()
  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'
  const posPerm = (profile?.pos_permissions ?? {}) as Record<string, boolean>
  if (!isAdmin && !posPerm.reopen_order) {
    return NextResponse.json({ error: 'Manager or owner access required' }, { status: 403 })
  }

  const { orderId } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const { data: order } = await supabase
    .from('pos_orders')
    .select('id, table_id, table_name, opened_at, closed_at, discount_amount, service_charge, tax_amount, status')
    .eq('id', orderId).single()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'closed') return NextResponse.json({ error: 'Only closed orders can be reopened' }, { status: 400 })

  const { data: items } = await supabase
    .from('pos_order_items').select('*').eq('order_id', orderId).is('voided_at', null)

  const { data: payments } = await supabase
    .from('pos_payments').select('method, amount').eq('order_id', orderId)

  // Reverse daily_sales — same proration logic as close-order
  if (items?.length) {
    const { data: config } = await supabase.from('pos_config').select('key, value').eq('key', 'business_day_cutoff_hour')
    const cutoffHour = parseInt(config?.find((c: { key: string; value: string }) => c.key === 'business_day_cutoff_hour')?.value ?? '6', 10)
    const orderDate = getBusinessDate(order.opened_at, cutoffHour)

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
    const discountRatio = grossSubtotal > 0 ? (order.discount_amount ?? 0) / grossSubtotal : 0

    let cashCol = 0, cardCol = 0, qrCol = 0, onlineCol = 0
    for (const p of payments ?? []) {
      if (p.method === 'cash') cashCol += p.amount
      else if (p.method === 'credit_card' || p.method === 'debit_card' || p.method === 'visa' || p.method === 'mastercard') cardCol += p.amount
      else if (p.method === 'qr_payment') qrCol += p.amount
      else if (p.method === 'online' || p.method === 'bank_transfer' || p.method === 'other') onlineCol += p.amount
    }

    try {
      await retrySupabase(() => supabase.rpc('decrement_daily_sales', {
        p_date: orderDate,
        p_cocktails_revenue: cocktailsGross * (1 - discountRatio),
        p_beer_revenue: beerGross * (1 - discountRatio),
        p_wine_revenue: wineGross * (1 - discountRatio),
        p_food_revenue: foodGross * (1 - discountRatio),
        p_others_revenue: othersGross * (1 - discountRatio) + (order.service_charge ?? 0) + (order.tax_amount ?? 0),
        p_cash_collected: cashCol,
        p_credit_card_collected: cardCol,
        p_qr_collected: qrCol,
        p_online_collected: onlineCol,
      }))
    } catch (err: any) {
      return NextResponse.json({ error: `Failed to reverse daily sales after retries: ${err.message}` }, { status: 500 })
    }

    // Revert inventory — atomic RPCs
    const { data: premixes } = await supabase.from('bar_premixes').select('id, cocktail_name')
    const { data: spirits } = await supabase.from('bar_spirits').select('id, name')

    const premixDelta = new Map<string, number>()
    for (const item of items) {
      if (item.category !== 'house_cocktail') continue
      const match = premixes?.find((p: { id: string; cocktail_name: string | null }) => normName(p.cocktail_name ?? '') === normName(item.item_name))
      if (match) premixDelta.set(match.id, (premixDelta.get(match.id) ?? 0) + item.quantity)
    }
    for (const [id, delta] of premixDelta) {
      const { error } = await supabase.rpc('decrement_premix_serves', { p_id: id, p_delta: delta })
      if (error) await supabase.from('pos_audit_log').insert({
        actor_id: user.id, event: 'inventory.revert_failed', entity_type: 'bar_premixes', entity_id: id,
        payload: { order_id: orderId, delta, error: error.message },
      })
    }

    const spiritBottleDelta = new Map<string, number>()
    for (const item of items) {
      if (item.category !== 'wine' && item.category !== 'whisky') continue
      const match = spirits?.find((s: { id: string; name: string }) => normName(s.name) === normName(item.item_name))
      if (match) spiritBottleDelta.set(match.id, (spiritBottleDelta.get(match.id) ?? 0) + item.quantity)
    }
    for (const [id, delta] of spiritBottleDelta) {
      const { error } = await supabase.rpc('increment_spirit_bottles', { p_id: id, p_delta: delta })
      if (error) await supabase.from('pos_audit_log').insert({
        actor_id: user.id, event: 'inventory.revert_failed', entity_type: 'bar_spirits', entity_id: id,
        payload: { order_id: orderId, delta, error: error.message },
      })
    }

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
      const { error } = await supabase.rpc('decrement_spirit_ml', { p_id: id, p_ml: ml })
      if (error) await supabase.from('pos_audit_log').insert({
        actor_id: user.id, event: 'inventory.revert_failed', entity_type: 'bar_spirits', entity_id: id,
        payload: { order_id: orderId, ml, error: error.message },
      })
    }
  }

  // Reverse cocktail_sales rows so re-closing doesn't double-count
  try {
    await retrySupabase(() => supabase.from('cocktail_sales').delete().eq('order_id', orderId))
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to reverse cocktail sales after retries: ${err.message}` }, { status: 500 })
  }

  // Delete payments (they'll be re-entered when the order is closed again)
  try {
    await retrySupabase(() => supabase.from('pos_payments').delete().eq('order_id', orderId))
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to delete payments after retries: ${err.message}` }, { status: 500 })
  }

  // Reopen the order — optimistic lock prevents double-reopen and associated double inventory revert
  const { data: reopened, error } = await supabase.from('pos_orders').update({
    status: 'open',
    closed_at: null,
    subtotal: 0,
    discount_amount: 0,
    discount_label: null,
    service_charge: 0,
    tax_amount: 0,
    total: 0,
  }).eq('id', orderId).eq('status', 'closed').select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!reopened?.length) return NextResponse.json({ error: 'Order was already reopened or not in a closed state' }, { status: 409 })

  // Relink the table if it exists
  if (order.table_id) {
    await supabase.from('pos_tables').update({ current_order_id: orderId }).eq('id', order.table_id)
  }

  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    actor_name: profile?.full_name ?? null,
    event: 'order.reopened',
    entity_type: 'pos_orders',
    entity_id: orderId,
    payload: {
      table_name: order.table_name,
      payments_reversed: (payments ?? []).length,
      inventory_reverted: true,
    },
  })

  return NextResponse.json({ success: true })
}
