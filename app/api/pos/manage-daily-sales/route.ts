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

  const { action, date, updates } = await req.json()

  if (action === 'update') {
    if (!date || !updates) return NextResponse.json({ error: 'date and updates required' }, { status: 400 })
    const { error } = await supabase.from('daily_sales').update(updates).eq('date', date)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'delete') {
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })
    await supabase.from('cocktail_sales').delete().eq('date', date)
    const { error } = await supabase.from('daily_sales').delete().eq('date', date)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
