import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { reservationId, tableId } = await req.json()
  if (!reservationId) return NextResponse.json({ error: 'reservationId required' }, { status: 400 })

  const { data: reservation } = await supabase
    .from('pos_reservations').select('*').eq('id', reservationId).single()
  if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  if (reservation.status === 'seated') return NextResponse.json({ error: 'Already seated' }, { status: 400 })

  const { data: profile } = await supabase.from('users').select('full_name').eq('id', user.id).single()

  // Create the order
  const { data: order, error: orderErr } = await supabase
    .from('pos_orders')
    .insert({
      table_id: tableId ?? reservation.table_id ?? null,
      table_name: reservation.guest_name,
      section: reservation.section ?? null,
      server_id: user.id,
      server_name: profile?.full_name ?? 'Staff',
      covers: reservation.covers,
      status: 'open',
      notes: reservation.notes ?? null,
    })
    .select().single()

  if (orderErr || !order) return NextResponse.json({ error: orderErr?.message ?? 'Failed to create order' }, { status: 500 })

  // Update table current_order_id — verify table is free first to avoid orphaning an active order.
  const tableToUse = tableId ?? reservation.table_id
  if (tableToUse) {
    const { data: table } = await supabase
      .from('pos_tables')
      .select('current_order_id')
      .eq('id', tableToUse)
      .single()
    if (table?.current_order_id) {
      // Roll back the order we just created
      await supabase.from('pos_orders').delete().eq('id', order.id)
      return NextResponse.json({ error: 'Table already has an active order — cannot seat reservation here' }, { status: 409 })
    }
    await supabase.from('pos_tables').update({ current_order_id: order.id }).eq('id', tableToUse)
  }

  // Mark reservation as seated with order link
  await supabase.from('pos_reservations').update({
    status: 'seated',
    order_id: order.id,
    table_id: tableToUse ?? reservation.table_id,
  }).eq('id', reservationId)

  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    event: 'reservation.seated',
    entity_type: 'pos_reservations',
    entity_id: reservationId,
    payload: { guest_name: reservation.guest_name, covers: reservation.covers, order_id: order.id },
  })

  return NextResponse.json({ orderId: order.id })
}
