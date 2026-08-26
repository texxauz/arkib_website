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

  const { action, id, name, category, price, cost_price, is_active, sort_order, stock_qty } = await req.json()

  if (action === 'create') {
    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return NextResponse.json({ error: 'Price must be a non-negative number' }, { status: 400 })
    }
    const { data, error } = await supabase.from('menu_items').insert({ name, category, price, cost_price: cost_price ?? 0, is_active: true, sort_order: sort_order ?? 99, stock_qty: stock_qty ?? null }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, item: data })
  }

  if (action === 'update') {
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return NextResponse.json({ error: 'Price must be a non-negative number' }, { status: 400 })
    }
    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (category !== undefined) updates.category = category
    if (price !== undefined) updates.price = price
    if (cost_price !== undefined) updates.cost_price = cost_price
    if (is_active !== undefined) updates.is_active = is_active
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (stock_qty !== undefined) updates.stock_qty = stock_qty ?? null
    const { error } = await supabase.from('menu_items').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'delete') {
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await supabase.from('menu_items').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
