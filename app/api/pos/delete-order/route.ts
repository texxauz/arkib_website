import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { orderId } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const { data: order } = await supabase.from('pos_orders').select('id, table_id, opened_at, table_name, total').eq('id', orderId).single()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

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
    payload: { table_name: order.table_name, total: order.total, opened_at: order.opened_at },
  })

  return NextResponse.json({ success: true })
}
