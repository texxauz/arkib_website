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

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const limit = 50

  let query = supabase
    .from('members')
    .select('id, name, phone_normalized, credits_balance, total_spend, total_visits, last_visit_at, status, created_at')
    .order('created_at', { ascending: false })
    .range(page * limit, page * limit + limit - 1)

  if (search) {
    const normalized = normalizePhone(search)
    if (normalized) {
      query = query.eq('phone_normalized', normalized)
    } else {
      query = query.ilike('name', `%${search}%`)
    }
  }

  const { data: members, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ members: members ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role, tab_permissions').eq('id', user.id).single()
  const access = getMembershipAccess(profile?.role, profile?.tab_permissions)
  if (access !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { phone, name, birthday } = body

  if (!phone) return NextResponse.json({ error: 'phone is required' }, { status: 400 })
  const normalized = normalizePhone(phone)
  if (!normalized) return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })

  // Upsert — return existing member if phone already registered
  const { data: existing } = await supabase
    .from('members').select('*').eq('phone_normalized', normalized).maybeSingle()
  if (existing) return NextResponse.json({ member: existing, created: false })

  const { data: member, error } = await supabase
    .from('members')
    .insert({ phone_normalized: normalized, name: name ?? null, birthday: birthday ?? null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ member, created: true }, { status: 201 })
}
