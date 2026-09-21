import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/phone'
import { getMembershipAccess } from '@/lib/membership-auth'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role, tab_permissions').eq('id', user.id).single()
  const access = getMembershipAccess(profile?.role, profile?.tab_permissions)
  if (access === 'none') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const phone = new URL(req.url).searchParams.get('phone') ?? ''
  const normalized = normalizePhone(phone)
  if (!normalized) return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })

  const { data: member } = await supabase
    .from('members')
    .select('id, name, phone_normalized, credits_balance, total_spend, total_visits, last_visit_at, status')
    .eq('phone_normalized', normalized)
    .maybeSingle()

  return NextResponse.json({ member: member ?? null, normalized })
}
