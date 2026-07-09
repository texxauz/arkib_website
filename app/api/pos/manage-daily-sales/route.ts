import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
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

    // Backup before deleting
    const { data: row } = await supabase.from('daily_sales').select('*').eq('date', date).single()
    if (row) {
      await supabase.from('daily_sales_backup').insert({
        original_date: date,
        deleted_by: user.id,
        deleted_by_name: profile?.full_name ?? null,
        data: row,
      })
    }

    await supabase.from('cocktail_sales').delete().eq('date', date)
    const { error } = await supabase.from('daily_sales').delete().eq('date', date)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'restore') {
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

    // Get latest backup for this date
    const { data: backup } = await supabase
      .from('daily_sales_backup')
      .select('*')
      .eq('original_date', date)
      .order('deleted_at', { ascending: false })
      .limit(1)
      .single()
    if (!backup) return NextResponse.json({ error: 'No backup found for this date' }, { status: 404 })

    const { id: _id, total_revenue: _tr, total_collected: _tc, ...restorable } = backup.data as Record<string, unknown>

    // Check if a record already exists for this date
    const { data: existing } = await supabase.from('daily_sales').select('date').eq('date', date).maybeSingle()
    if (existing) return NextResponse.json({ error: 'A record for this date already exists — delete it first' }, { status: 409 })

    const { error } = await supabase.from('daily_sales').insert(restorable)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Remove the backup entry so it doesn't clutter the list
    await supabase.from('daily_sales_backup').delete().eq('id', backup.id)

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
