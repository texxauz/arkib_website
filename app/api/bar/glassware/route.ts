import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await supabase
    .from('bar_glassware')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ glassware: data ?? [] })
}

async function canEditGlassware(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('users').select('role, tab_permissions').eq('id', user.id).single()
  if (!profile) return false
  if (profile.role === 'owner' || profile.role === 'manager') return true
  const perms = profile.tab_permissions as Record<string, string> | null
  return (perms?.['bar-wastage'] ?? 'none') === 'edit'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!await canEditGlassware(supabase)) return NextResponse.json({ error: 'Edit permission required' }, { status: 403 })

  const body = await req.json()
  const { name, quantity, cost_per_unit, par_level } = body
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('bar_glassware')
    .insert({ name, quantity: quantity ?? 0, cost_per_unit: cost_per_unit ?? 0, par_level: par_level ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ glassware: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!await canEditGlassware(supabase)) return NextResponse.json({ error: 'Edit permission required' }, { status: 403 })

  const body = await req.json()
  const { id, name, quantity, cost_per_unit, par_level } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('bar_glassware')
    .update({ name, quantity, cost_per_unit, par_level, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ glassware: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('bar_glassware').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
