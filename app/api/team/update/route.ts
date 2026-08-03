import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`team-update:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, full_name, role, tab_permissions, pos_permissions, is_active, manager_pin } = await request.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  // Fix: prevent privilege escalation — managers cannot grant owner role
  if (profile.role === 'manager' && role === 'owner') {
    return NextResponse.json({ error: 'Managers cannot assign the owner role' }, { status: 403 })
  }

  // Owners cannot be demoted by managers (extra guard)
  if (profile.role === 'manager') {
    const { data: target } = await supabase.from('users').select('role').eq('id', userId).single()
    if (target?.role === 'owner') {
      return NextResponse.json({ error: 'Managers cannot modify an owner account' }, { status: 403 })
    }
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const updatePayload: Record<string, unknown> = { full_name, role, tab_permissions, pos_permissions, is_active }
  // manager_pin: null clears it, a string sets it, undefined means no change
  if (manager_pin !== undefined) updatePayload.manager_pin = manager_pin || null

  const { error } = await adminClient.from('users').update(updatePayload).eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
