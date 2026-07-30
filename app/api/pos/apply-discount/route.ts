import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { orderId, discountId } = await req.json()
  if (!orderId || !discountId) return NextResponse.json({ error: 'orderId and discountId required' }, { status: 400 })

  const [{ data: order }, { data: discount }, { data: profile }, { data: items }] = await Promise.all([
    supabase.from('pos_orders').select('id, status').eq('id', orderId).single(),
    supabase.from('pos_discounts').select('*').eq('id', discountId).eq('is_active', true).single(),
    supabase.from('users').select('role, full_name').eq('id', user.id).single(),
    supabase.from('pos_order_items').select('quantity, unit_price, discount').eq('order_id', orderId).is('voided_at', null),
  ])

  if (!order || order.status !== 'open') return NextResponse.json({ error: 'Order not found or closed' }, { status: 404 })
  if (!discount) return NextResponse.json({ error: 'Discount not found' }, { status: 404 })

  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'
  if (discount.requires_approval && !isAdmin) {
    return NextResponse.json({ error: 'Manager approval required for this discount' }, { status: 403 })
  }

  // Calculate discount amount from live items (not stale order.subtotal)
  const subtotal = (items ?? []).reduce((s, i) => s + (i.quantity * i.unit_price - (i.discount ?? 0)), 0)
  const discountAmount = discount.type === 'percent'
    ? subtotal * discount.value / 100
    : Math.min(discount.value, subtotal)

  const { error } = await supabase.from('pos_orders').update({
    discount_amount: discountAmount,
    discount_label: discount.name,
  }).eq('id', orderId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    actor_name: profile?.full_name ?? null,
    event: 'discount.applied',
    entity_type: 'pos_orders',
    entity_id: orderId,
    payload: { discount_name: discount.name, discount_type: discount.type, discount_value: discount.value, discount_amount: discountAmount },
  })

  return NextResponse.json({ success: true, discountAmount, discountLabel: discount.name })
}
