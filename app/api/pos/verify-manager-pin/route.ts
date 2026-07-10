import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { pin } = await req.json()
  if (!pin || String(pin).trim().length < 4) {
    return NextResponse.json({ error: 'PIN required' }, { status: 400 })
  }

  const { data: manager } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('manager_pin', String(pin).trim())
    .in('role', ['owner', 'manager'])
    .maybeSingle()

  if (!manager) {
    return NextResponse.json({ error: 'Invalid manager PIN' }, { status: 403 })
  }

  return NextResponse.json({ success: true, approvedBy: manager.full_name })
}
