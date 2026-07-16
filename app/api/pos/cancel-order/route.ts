import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { orderId, reason, managerPin } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  // Load actor profile
  const { data: profile } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'

  // Non-admins must supply a manager PIN
  let approvedByName: string | null = null
  if (!isAdmin) {
    if (!managerPin) return NextResponse.json({ error: 'Manager PIN required to cancel an order' }, { status: 403 })
    const pinStr = String(managerPin).trim()
    const { data: managers } = await supabase
      .from('users')
      .select('id, full_name, manager_pin, manager_pin_hash')
      .in('role', ['owner', 'manager'])
      .eq('is_active', true)
    let matched: { full_name: string | null } | null = null
    for (const mgr of managers ?? []) {
      if (mgr.manager_pin_hash) {
        if (await bcrypt.compare(pinStr, mgr.manager_pin_hash)) { matched = mgr; break }
      } else if (mgr.manager_pin && mgr.manager_pin === pinStr) {
        matched = mgr; break
      }
    }
    if (!matched) return NextResponse.json({ error: 'Invalid manager PIN' }, { status: 403 })
    approvedByName = matched.full_name ?? null
  }

  // Load order
  const { data: order } = await supabase.from('pos_orders').select('*').eq('id', orderId).single()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'open') return NextResponse.json({ error: 'Order already closed or cancelled' }, { status: 400 })

  // Load all items (including already-voided ones for the audit trail)
  const { data: items } = await supabase.from('pos_order_items').select('*').eq('order_id', orderId)
  const activeItems = (items ?? []).filter((i: any) => !i.voided_at)

  const now = new Date().toISOString()

  // Mark all active items as voided
  if (activeItems.length > 0) {
    const { error: voidErr } = await supabase.from('pos_order_items')
      .update({ voided_at: now, voided_by: user.id, void_reason: reason || 'Order cancelled', status: 'voided' })
      .in('id', activeItems.map((i: any) => i.id))
    if (voidErr) return NextResponse.json({ error: `Failed to void items: ${voidErr.message}` }, { status: 500 })
  }

  // Mark order as voided
  const { error: orderErr } = await supabase.from('pos_orders')
    .update({ status: 'voided', closed_at: now })
    .eq('id', orderId)
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })

  // Free the table
  if (order.table_id) {
    await supabase.from('pos_tables').update({ current_order_id: null }).eq('current_order_id', orderId)
  }

  // Write audit log — this is the tamper-evident record
  const itemSummary = activeItems.map((i: any) => ({
    item_name: i.item_name,
    quantity: i.quantity,
    unit_price: i.unit_price,
    category: i.category,
  }))
  const cancelledValue = activeItems.reduce((s: number, i: any) => s + i.quantity * i.unit_price - (i.discount ?? 0), 0)

  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    actor_name: profile?.full_name ?? null,
    event: 'order.cancelled',
    entity_type: 'pos_orders',
    entity_id: orderId,
    payload: {
      table_name: order.table_name,
      section: order.section,
      covers: order.covers,
      server_name: order.server_name,
      opened_at: order.opened_at,
      cancelled_at: now,
      reason: reason || null,
      approved_by: approvedByName,
      cancelled_value: cancelledValue,
      items: itemSummary,
    },
  })

  return NextResponse.json({ success: true })
}
