import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pin } = await request.json()
  if (!pin) return NextResponse.json({ error: 'PIN required' }, { status: 400 })

  const { data: profile } = await supabase
    .from('users')
    .select('payslip_pin')
    .eq('id', user.id)
    .single()

  if (!profile?.payslip_pin) {
    return NextResponse.json({ error: 'No payslip PIN set' }, { status: 403 })
  }

  if (profile.payslip_pin !== pin) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
  }

  return NextResponse.json({ success: true })
}
