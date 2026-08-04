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

  const body = await request.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Allowlist accepted columns — prevent arbitrary column injection
  const ALLOWED = ['activity_type', 'product', 'qty', 'vol_ml', 'notes', 'spirit_1', 'vol_1', 'spirit_2', 'vol_2', 'spirit_3', 'vol_3', 'logged_at'] as const
  const fields: Record<string, unknown> = {}
  for (const key of ALLOWED) if (key in body) fields[key] = body[key]

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Fetch the old record so we can compute inventory deltas
  const { data: old } = await admin.from('bar_activity_log').select('*').eq('id', id).single()

  const { data, error } = await admin
    .from('bar_activity_log')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Apply server-side inventory corrections for Infusion Made
  if (old?.activity_type === 'Infusion Made' && 'vol_ml' in fields) {
    const oldVol = old.vol_ml ?? 0
    const newVol = (fields.vol_ml as number) ?? 0
    const delta = newVol - oldVol
    if (delta !== 0) {
      const { data: inf } = await admin.from('bar_infusions').select('id, produced_ml').ilike('name', old.product).single()
      if (inf) await admin.from('bar_infusions').update({ produced_ml: Math.max(0, inf.produced_ml + delta) }).eq('id', inf.id)
    }
  }

  // Apply spirit deduction delta for Infusion Made and Premix Made edits
  if (old?.activity_type === 'Infusion Made' || old?.activity_type === 'Premix Made') {
    const oldQty = old.qty ?? 1
    const newQty = (fields.qty as number) ?? oldQty
    const isInfusion = old.activity_type === 'Infusion Made'
    const spiritPairs: [string, string][] = [['spirit_1', 'vol_1'], ['spirit_2', 'vol_2'], ['spirit_3', 'vol_3']]
    for (const [sKey, vKey] of spiritPairs) {
      const oldName = old[sKey] as string | null
      const newName = (fields[sKey] ?? oldName) as string | null
      const oldVol = (old[vKey] as number | null) ?? 0
      const newVol = ((fields[vKey] ?? oldVol) as number) ?? 0
      const oldDeducted = isInfusion ? oldVol : oldVol * oldQty
      const newDeducted = isInfusion ? newVol : newVol * newQty
      // Remove old spirit deduction
      if (oldName && oldDeducted) {
        const { data: sp } = await admin.from('bar_spirits').select('id, used_classics_ml').ilike('name', oldName).single()
        if (sp) await admin.from('bar_spirits').update({ used_classics_ml: Math.max(0, sp.used_classics_ml - oldDeducted) }).eq('id', sp.id)
      }
      // Apply new spirit deduction
      if (newName && newDeducted) {
        const { data: sp } = await admin.from('bar_spirits').select('id, used_classics_ml').ilike('name', newName).single()
        if (sp) await admin.from('bar_spirits').update({ used_classics_ml: sp.used_classics_ml + newDeducted }).eq('id', sp.id)
      }
    }
  }

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
