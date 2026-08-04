import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, ...fields } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await adminClient
    .from('bar_activity_log')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Fetch the activity first so we can reverse its inventory effects
  const { data: a, error: fetchErr } = await admin.from('bar_activity_log').select('*').eq('id', id).single()
  if (fetchErr || !a) return NextResponse.json({ error: fetchErr?.message ?? 'Not found' }, { status: 404 })

  // Delete the row
  const { error } = await admin.from('bar_activity_log').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reverse inventory effects
  const qty = a.qty ?? 1

  // Restore spirits
  const spiritEntries: [string | null, number | null][] = [[a.spirit_1, a.vol_1], [a.spirit_2, a.vol_2], [a.spirit_3, a.vol_3]]
  for (const [name, vol] of spiritEntries) {
    if (!name || !vol) continue
    const deducted = a.activity_type === 'Infusion Made' ? vol : vol * qty
    const { data: sp } = await admin.from('bar_spirits').select('id, used_classics_ml').ilike('name', name).single()
    if (sp) await admin.from('bar_spirits').update({ used_classics_ml: Math.max(0, sp.used_classics_ml - deducted) }).eq('id', sp.id)
  }

  if (a.activity_type === 'Infusion Made' && a.vol_ml) {
    const { data: inf } = await admin.from('bar_infusions').select('id, produced_ml').ilike('name', a.product).single()
    if (inf) await admin.from('bar_infusions').update({ produced_ml: Math.max(0, inf.produced_ml - a.vol_ml) }).eq('id', inf.id)
  }

  if (a.activity_type === 'Premix Made') {
    const { data: pm } = await admin.from('bar_premixes').select('id, produced_serves').ilike('name', a.product).single()
    if (pm) await admin.from('bar_premixes').update({ produced_serves: Math.max(0, pm.produced_serves - qty) }).eq('id', pm.id)
    // Restore recipe ingredients
    const { data: recipes } = await admin.from('bar_premix_recipes').select('*').ilike('premix_name', a.product)
    for (const r of recipes ?? []) {
      const totalMl = r.ml_per_serve * qty
      if (r.ingredient_type === 'infusion') {
        const { data: inf } = await admin.from('bar_infusions').select('id, used_premix_ml').ilike('name', r.ingredient_name).single()
        if (inf) await admin.from('bar_infusions').update({ used_premix_ml: Math.max(0, inf.used_premix_ml - totalMl) }).eq('id', inf.id)
      } else if (r.ingredient_type === 'spirit') {
        const { data: sp } = await admin.from('bar_spirits').select('id, used_classics_ml').ilike('name', r.ingredient_name).single()
        if (sp) await admin.from('bar_spirits').update({ used_classics_ml: Math.max(0, sp.used_classics_ml - totalMl) }).eq('id', sp.id)
      }
    }
  }

  if (a.activity_type === 'Stock Received') {
    const { data: sp } = await admin.from('bar_spirits').select('id, full_bottles').ilike('name', a.product).single()
    if (sp) await admin.from('bar_spirits').update({ full_bottles: Math.max(0, sp.full_bottles - qty) }).eq('id', sp.id)
  }

  return NextResponse.json({ success: true })
}
