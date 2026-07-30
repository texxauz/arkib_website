import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { shiftId, report } = await req.json()
  if (!shiftId || !report) return NextResponse.json({ error: 'shiftId and report required' }, { status: 400 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'

  // Verify shift belongs to this user (unless admin)
  const { data: shift } = await supabase.from('pos_shifts').select('id, opened_by').eq('id', shiftId).single()
  if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  if (!isAdmin && shift.opened_by !== user.id) {
    return NextResponse.json({ error: 'You can only save the night report for your own shift' }, { status: 403 })
  }

  const { error } = await supabase
    .from('pos_shifts')
    .update({ night_report: report, night_report_saved_at: new Date().toISOString() })
    .eq('id', shiftId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
