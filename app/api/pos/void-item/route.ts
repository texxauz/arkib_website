import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { itemId, reason } = await req.json()
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  const { data: item } = await supabase
    .from('pos_order_items').select('*, pos_orders(server_id, status)').eq('id', itemId).single()
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  if (item.voided_at) return NextResponse.json({ error: 'Item already voided' }, { status: 400 })

  const parentOrder = item.pos_orders as { server_id: string; status: string } | null
  if (parentOrder?.status !== 'open') {
    return NextResponse.json({ error: 'Cannot void items on a closed or cancelled order' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'

  if (!isAdmin && parentOrder?.server_id !== user.id) {
    return NextResponse.json({ error: 'You can only void items from your own orders' }, { status: 403 })
  }

  // Non-admin can only void pending items without a reason; sent items need manager approval
  if (!isAdmin && item.status !== 'pending' && !reason?.trim()) {
    return NextResponse.json({ error: 'Manager approval required to void sent items' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const { data: voided, error } = await supabase.from('pos_order_items').update({
    voided_at: now,
    voided_by: user.id,
    void_reason: reason ?? null,
    status: 'voided',
  }).eq('id', itemId).is('voided_at', null).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!voided?.length) return NextResponse.json({ error: 'Item was already voided' }, { status: 409 })

  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    actor_name: profile?.full_name ?? null,
    event: 'item.voided',
    entity_type: 'pos_order_items',
    entity_id: itemId,
    payload: { item_name: item.item_name, quantity: item.quantity, unit_price: item.unit_price, reason: reason ?? null, order_id: item.order_id },
  })

  return NextResponse.json({ success: true })
}
