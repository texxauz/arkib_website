import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    .select('id, table_id, opened_at, table_name, total, status')
    .eq('id', orderId).single()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Only revert inventory for closed orders (open/voided orders were never deducted)
  if (order.status === 'closed') {
    const { data: items } = await supabase
      .from('pos_order_items')
      .select('*')
      .eq('order_id', orderId)
      .is('voided_at', null)

    if (items?.length) {
      const { data: premixes } = await supabase.from('bar_premixes').select('id, cocktail_name, sold_serves')
      const { data: spirits } = await supabase.from('bar_spirits').select('id, name, full_bottles, used_classics_ml')

      // Revert premix sold_serves for house cocktails
      const premixDelta = new Map<string, number>()
      for (const item of items) {
        if (item.category !== 'house_cocktail') continue
        const match = premixes?.find(p => normName(p.cocktail_name ?? '') === normName(item.item_name))
        if (match) premixDelta.set(match.id, (premixDelta.get(match.id) ?? 0) + item.quantity)
      }
      for (const [id, delta] of premixDelta) {
        const pm = premixes?.find(p => p.id === id)
        if (pm) await supabase.from('bar_premixes').update({ sold_serves: Math.max(0, pm.sold_serves - delta) }).eq('id', id)
      }

      // Revert bar_spirits full_bottles for wine/whisky
      const spiritBottleDelta = new Map<string, number>()
      for (const item of items) {
        if (item.category !== 'wine' && item.category !== 'whisky') continue
        const match = spirits?.find(s => normName(s.name) === normName(item.item_name))
        if (match) spiritBottleDelta.set(match.id, (spiritBottleDelta.get(match.id) ?? 0) + item.quantity)
      }
      for (const [id, delta] of spiritBottleDelta) {
        const sp = spirits?.find(s => s.id === id)
        if (sp) await supabase.from('bar_spirits').update({ full_bottles: sp.full_bottles + delta }).eq('id', id)
      }

      // Revert bar_spirits used_classics_ml for classics
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
        if (sp) await supabase.from('bar_spirits').update({ used_classics_ml: Math.max(0, sp.used_classics_ml - ml) }).eq('id', id)
      }

      // Revert daily_sales for the order date
      const orderDate = new Date(new Date(order.opened_at).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
      let cocktailsRev = 0, beerRev = 0, wineRev = 0, foodRev = 0, othersRev = 0
      for (const item of items) {
        const lineTotal = item.quantity * item.unit_price - (item.discount ?? 0)
        if (item.category === 'house_cocktail' || item.category === 'classic') cocktailsRev += lineTotal
        else if (item.category === 'beer') beerRev += lineTotal
        else if (item.category === 'wine') wineRev += lineTotal
        else if (item.category === 'food') foodRev += lineTotal
        else othersRev += lineTotal
      }
      // Fetch payments to revert collection totals
      const { data: payments } = await supabase.from('pos_payments').select('method, amount').eq('order_id', orderId)
      let cashCol = 0, cardCol = 0, qrCol = 0
      for (const p of payments ?? []) {
        if (p.method === 'cash') cashCol += p.amount
        else if (p.method === 'credit_card' || p.method === 'debit_card') cardCol += p.amount
        else if (p.method === 'qr_payment') qrCol += p.amount
      }
      await supabase.rpc('decrement_daily_sales', {
        p_date: orderDate,
        p_cocktails_revenue: cocktailsRev,
        p_beer_revenue: beerRev,
        p_wine_revenue: wineRev,
        p_food_revenue: foodRev,
        p_others_revenue: othersRev,
        p_cash_collected: cashCol,
        p_credit_card_collected: cardCol,
        p_qr_collected: qrCol,
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

  // Log the admin deletion (audit log is preserved — this adds a record, not replaces)
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
