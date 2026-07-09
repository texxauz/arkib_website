import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { action, id, name, section, capacity, sort_order, is_active } = await req.json()

  if (action === 'create') {
    const { data, error } = await supabase.from('pos_tables').insert({ name, section, capacity: capacity ?? 4, sort_order: sort_order ?? 99, is_active: true }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, table: data })
  }

  if (action === 'update') {
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (section !== undefined) updates.section = section
    if (capacity !== undefined) updates.capacity = capacity
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (is_active !== undefined) updates.is_active = is_active
    const { error } = await supabase.from('pos_tables').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'delete') {
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data: table } = await supabase.from('pos_tables').select('current_order_id').eq('id', id).single()
    if (table?.current_order_id) return NextResponse.json({ error: 'Table has an open order — close it first' }, { status: 400 })
    const { error } = await supabase.from('pos_tables').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
