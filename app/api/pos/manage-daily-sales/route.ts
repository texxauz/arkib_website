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
    const ALLOWED_FIELDS = ['cocktails_revenue','beer_revenue','wine_revenue','food_revenue','others_revenue','cash_collected','credit_card_collected','qr_collected','online_collected','transaction_count','notes','attachment_url']
    const safeUpdates: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in updates) safeUpdates[key] = updates[key]
    }
    if (Object.keys(safeUpdates).length === 0) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    const { error } = await supabase.from('daily_sales').update(safeUpdates).eq('date', date)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('pos_audit_log').insert({
      actor_id: user.id,
      actor_name: profile?.full_name ?? null,
      event: 'daily_sales.manual_update',
      entity_type: 'daily_sales',
      entity_id: date,
      payload: { date, fields_changed: Object.keys(safeUpdates), updates: safeUpdates },
    })

    return NextResponse.json({ success: true })
  }

  if (action === 'delete') {
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

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

    await supabase.from('pos_audit_log').insert({
      actor_id: user.id,
      actor_name: profile?.full_name ?? null,
      event: 'daily_sales.deleted',
      entity_type: 'daily_sales',
      entity_id: date,
      payload: { date, snapshot: row ?? null },
    })

    return NextResponse.json({ success: true })
  }

  if (action === 'restore') {
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

    const { data: backup } = await supabase
      .from('daily_sales_backup')
      .select('*')
      .eq('original_date', date)
      .order('deleted_at', { ascending: false })
      .limit(1)
      .single()
    if (!backup) return NextResponse.json({ error: 'No backup found for this date' }, { status: 404 })

    const { id: _id, total_revenue: _tr, total_collected: _tc, ...restorable } = backup.data as Record<string, unknown>

    const { data: existing } = await supabase.from('daily_sales').select('date').eq('date', date).maybeSingle()
    if (existing) return NextResponse.json({ error: 'A record for this date already exists — delete it first' }, { status: 409 })

    const { error } = await supabase.from('daily_sales').insert(restorable)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('daily_sales_backup').delete().eq('id', backup.id)

    await supabase.from('pos_audit_log').insert({
      actor_id: user.id,
      actor_name: profile?.full_name ?? null,
      event: 'daily_sales.restored',
      entity_type: 'daily_sales',
      entity_id: date,
      payload: { date },
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
