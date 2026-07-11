import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { tableId, tableName, section, covers = 1 } = await req.json()

  if (covers < 1) return NextResponse.json({ error: 'Covers must be at least 1' }, { status: 400 })

  let resolvedTableName = tableName ?? 'Walk-in'
  let resolvedSection = section ?? null

  if (tableId) {
    const { data: table } = await supabase.from('pos_tables').select('current_order_id, is_active, name, section').eq('id', tableId).single()
    if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    if (!table.is_active) return NextResponse.json({ error: 'Table is not active' }, { status: 400 })
    if (table.current_order_id) return NextResponse.json({ error: 'Table already has an open order' }, { status: 409 })
    resolvedTableName = table.name
    resolvedSection = table.section
  }

  const { data: profile } = await supabase.from('users').select('full_name').eq('id', user.id).single()

  const { data: order, error } = await supabase
    .from('pos_orders')
    .insert({
      table_id: tableId ?? null,
      table_name: resolvedTableName,
      section: resolvedSection,
      server_id: user.id,
      server_name: profile?.full_name ?? 'Staff',
      covers,
      status: 'open',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (tableId) {
    await supabase.from('pos_tables').update({ current_order_id: order.id }).eq('id', tableId)
  }

  await supabase.from('pos_audit_log').insert({
    actor_id: user.id,
    event: 'order.created',
    entity_type: 'pos_orders',
    entity_id: order.id,
    payload: { tableId, tableName, covers },
  })

  return NextResponse.json({ orderId: order.id })
}
