import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Atomically adjusts menu_item stock_qty by `delta` (negative = decrement, positive = increment).
// Called in real-time when items are added/removed from an open order so the POS menu
// reflects live stock without waiting for order close.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { item_id, delta } = await req.json()
  if (!item_id || typeof delta !== 'number' || delta === 0) {
    return NextResponse.json({ error: 'item_id and non-zero delta required' }, { status: 400 })
  }

  const { data: item } = await supabase
    .from('menu_items')
    .select('id, stock_qty')
    .eq('id', item_id)
    .single()

  if (!item) return NextResponse.json({ ok: true }) // item not found — silent skip
  if (item.stock_qty === null) return NextResponse.json({ ok: true }) // unlimited stock — skip

  const newQty = Math.max(0, item.stock_qty + delta)
  await supabase.from('menu_items').update({ stock_qty: newQty }).eq('id', item_id)

  return NextResponse.json({ ok: true, stock_qty: newQty })
}
