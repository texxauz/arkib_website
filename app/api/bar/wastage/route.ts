import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)
  const type = searchParams.get('type') // spoilage | rnd | breakage | restock | null (all)

  let q = supabase
    .from('bar_wastage')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (type) q = q.eq('type', type)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()

  // Use admin client for inventory RPCs so non-admin staff can log wastage
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const body = await req.json()
  const { type, item_name, item_id, item_table, quantity, unit, unit_cost, notes, date } = body

  if (!type || !item_name || !quantity || !unit) {
    return NextResponse.json({ error: 'type, item_name, quantity, unit required' }, { status: 400 })
  }

  const total_cost = (unit_cost ?? 0) * quantity

  // ── Decrement / increment inventory in real time ──────────────────
  if (item_id && item_table) {
    if (type === 'spoilage') {
      if (item_table === 'bar_premixes') {
        const { error } = await admin.rpc('decrement_premix_serves', { p_id: item_id, p_delta: quantity })
        if (error) return NextResponse.json({ error: `Inventory update failed: ${error.message}` }, { status: 500 })
      } else if (item_table === 'menu_items') {
        const { data: item } = await admin.from('menu_items').select('stock_qty').eq('id', item_id).single()
        if (item?.stock_qty != null) {
          const { error } = await admin.from('menu_items').update({ stock_qty: Math.max(0, item.stock_qty - quantity) }).eq('id', item_id)
          if (error) return NextResponse.json({ error: `Stock update failed: ${error.message}` }, { status: 500 })
        }
      }
    } else if (type === 'rnd') {
      if (item_table === 'bar_spirits' && unit === 'ml') {
        const { error } = await admin.rpc('decrement_spirit_ml', { p_id: item_id, p_ml: quantity })
        if (error) return NextResponse.json({ error: `Inventory update failed: ${error.message}` }, { status: 500 })
      } else if (item_table === 'bar_premixes') {
        const { error } = await admin.rpc('decrement_premix_serves', { p_id: item_id, p_delta: quantity })
        if (error) return NextResponse.json({ error: `Inventory update failed: ${error.message}` }, { status: 500 })
      }
    } else if (type === 'breakage' && item_table === 'bar_glassware') {
      const { data: glass } = await admin.from('bar_glassware').select('quantity').eq('id', item_id).single()
      if (glass) {
        const { error } = await admin.from('bar_glassware')
          .update({ quantity: Math.max(0, glass.quantity - quantity), updated_at: new Date().toISOString() })
          .eq('id', item_id)
        if (error) return NextResponse.json({ error: `Glassware update failed: ${error.message}` }, { status: 500 })
      }
    } else if (type === 'restock' && item_table === 'bar_glassware') {
      const { data: glass } = await admin.from('bar_glassware').select('quantity').eq('id', item_id).single()
      if (glass) {
        const { error } = await admin.from('bar_glassware')
          .update({ quantity: glass.quantity + quantity, updated_at: new Date().toISOString() })
          .eq('id', item_id)
        if (error) return NextResponse.json({ error: `Glassware update failed: ${error.message}` }, { status: 500 })
      }
    }
  }

  // ── Insert wastage log entry ──────────────────────────────────────
  const { data, error } = await supabase
    .from('bar_wastage')
    .insert({
      date: date ?? new Date().toISOString().slice(0, 10),
      type,
      item_name,
      item_id: item_id ?? null,
      item_table: item_table ?? null,
      quantity,
      unit,
      unit_cost: unit_cost ?? 0,
      total_cost,
      notes: notes ?? null,
      recorded_by: user.id,
      recorded_by_name: profile?.full_name ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('bar_wastage').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
