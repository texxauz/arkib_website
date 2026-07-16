import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessDate } from '@/lib/utils'

const normName = (n: string) =>
  n.toLowerCase().replace(/\s*[—–-]\s*/g, ' ').replace(/\s*\(.*?\)/g, '').replace(/\s+/g, ' ').trim()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { orderId } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const { data: order } = await supabase
    .from('pos_orders')
    .select('id, table_id, opened_at, table_name, total, status, discount_amount, service_charge, tax_amount')
    .eq('id', orderId).single()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Only revert inventory/financials for closed orders (open/voided orders were never counted)
  if (order.status === 'closed') {
    const { data: items } = await supabase
      .from('pos_order_items')
      .select('*')
      .eq('order_id', orderId)
      .is('voided_at', null)

    if (items?.length) {
      // Revert inventory — atomic RPCs (no read-modify-write race)
      const { data: premixes } = await supabase.from('bar_premixes').select('id, cocktail_name')
      const { data: spirits } = await supabase.from('bar_spirits').select('id, name')

      const premixDelta = new Map<string, number>()
      for (const item of items) {
        if (item.category !== 'house_cocktail') continue
        const match = premixes?.find(p => normName(p.cocktail_name ?? '') === normName(item.item_name))
        if (match) premixDelta.set(match.id, (premixDelta.get(match.id) ?? 0) + item.quantity)
      }
      for (const [id, delta] of premixDelta) {
        const { error } = await supabase.rpc('decrement_premix_serves', { p_id: id, p_delta: delta })
        if (error) console.error('decrement_premix_serves failed:', error.message)
      }

      const spiritBottleDelta = new Map<string, number>()
      for (const item of items) {
        if (item.category !== 'wine' && item.category !== 'whisky') continue
        const match = spirits?.find(s => normName(s.name) === normName(item.item_name))
        if (match) spiritBottleDelta.set(match.id, (spiritBottleDelta.get(match.id) ?? 0) + item.quantity)
      }
      for (const [id, delta] of spiritBottleDelta) {
        const { error } = await supabase.rpc('increment_spirit_bottles', { p_id: id, p_delta: delta })
        if (error) console.error('increment_spirit_bottles failed:', error.message)
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
        if (error) console.error('decrement_spirit_ml failed:', error.message)
      }

      // Fix: prorate order-level discount across categories (matches close-order logic)
      const { data: config } = await supabase.from('pos_config').select('key, value').in('key', ['business_day_cutoff_hour'])
      const cutoffHour = parseInt(config?.find(c => c.key === 'business_day_cutoff_hour')?.value ?? '6', 10)
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

      const { data: payments } = await supabase.from('pos_payments').select('method, amount').eq('order_id', orderId)
      let cashCol = 0, cardCol = 0, qrCol = 0, onlineCol = 0
      for (const p of payments ?? []) {
        if (p.method === 'cash') cashCol += p.amount
        else if (p.method === 'credit_card' || p.method === 'debit_card') cardCol += p.amount
        else if (p.method === 'qr_payment') qrCol += p.amount
        else if (p.method === 'online' || p.method === 'bank_transfer' || p.method === 'other') onlineCol += p.amount
      }

      await supabase.rpc('decrement_daily_sales', {
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
        p_transaction_count: 1,
      })
    }
  }

  // Use RPC to cascade-delete with elevated privileges (bypasses RLS on child tables)
  const { error: rpcErr } = await supabase.rpc('admin_delete_order', { p_order_id: orderId })
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })

  // Clear table link
  if (order.table_id) {
    await supabase.from('pos_tables').update({ current_order_id: null }).eq('current_order_id', orderId)
  }

  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    actor_name: profile?.full_name ?? null,
    event: 'order.admin_deleted',
    entity_type: 'pos_orders',
    entity_id: orderId,
    payload: { table_name: order.table_name, total: order.total, opened_at: order.opened_at, inventory_reverted: order.status === 'closed' },
  })

  return NextResponse.json({ success: true })
}
