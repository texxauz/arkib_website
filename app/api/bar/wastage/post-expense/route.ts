import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { wastage_id } = await req.json()
  if (!wastage_id) return NextResponse.json({ error: 'wastage_id required' }, { status: 400 })

  const { data: entry, error: fetchErr } = await supabase
    .from('bar_wastage')
    .select('*')
    .eq('id', wastage_id)
    .single()

  if (fetchErr || !entry) return NextResponse.json({ error: 'Wastage entry not found' }, { status: 404 })
  if (entry.total_cost <= 0) return NextResponse.json({ error: 'No cost to post' }, { status: 400 })

  const categoryMap: Record<string, string> = {
    spoilage: 'food',
    rnd: 'alcohol',
    breakage: 'equipment',
    restock: 'equipment',
  }

  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      date: entry.date,
      category: categoryMap[entry.type] ?? 'others',
      description: `[${entry.type.toUpperCase()}] ${entry.item_name} × ${entry.quantity} ${entry.unit}`,
      amount: entry.total_cost,
      payment_method: 'cash',
      notes: entry.notes ?? `Wastage ref: ${entry.id}`,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense })
}
