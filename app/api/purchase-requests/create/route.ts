import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'manager', 'full_timer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { itemName, brand, quantity, unit, urgency, notes } = await request.json()
  if (!itemName || !quantity || !unit) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase.from('purchase_requests').insert({
    item_name: itemName,
    brand: brand ?? null,
    quantity: Number(quantity),
    unit,
    urgency: urgency ?? 'normal',
    notes: notes ?? null,
    requested_by: user.id,
    status: 'pending',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ request: data })
}
