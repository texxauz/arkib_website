import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { shiftId, report } = await req.json()
  if (!shiftId || !report) return NextResponse.json({ error: 'shiftId and report required' }, { status: 400 })

  const { error } = await supabase
    .from('pos_shifts')
    .update({ night_report: report, night_report_saved_at: new Date().toISOString() })
    .eq('id', shiftId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
