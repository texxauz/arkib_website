import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMembershipAccess } from '@/lib/membership-auth'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role, tab_permissions').eq('id', user.id).single()
  const access = getMembershipAccess(profile?.role, profile?.tab_permissions)
  if (access === 'none') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: rewards, error } = await supabase
    .from('rewards')
    .select('id, name, description, reward_type, reward_value, credits_required')
    .eq('is_active', true)
    .order('credits_required')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rewards: rewards ?? [] })
}
