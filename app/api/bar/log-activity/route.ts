import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const adminClient = () => createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    logged_at, week_number, activity_type, product, qty, vol_ml, notes,
    spirit_1, vol_1, spirit_2, vol_2, spirit_3, vol_3,
  } = body

  const admin = adminClient()

  // Insert activity log
  const { data: newActivity, error: insertError } = await admin
    .from('bar_activity_log')
    .insert({ logged_at, week_number, activity_type, product, qty, vol_ml, notes, spirit_1, vol_1, spirit_2, vol_2, spirit_3, vol_3 })
    .select()
    .single()
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const effects: string[] = []
  const warnings: string[] = []

  if (activity_type === 'Infusion Made' && vol_ml) {
    // Increase infusion produced_ml
    const { data: infusion } = await admin.from('bar_infusions').select('id, produced_ml').ilike('name', product).single()
    if (infusion) {
      await admin.from('bar_infusions').update({ produced_ml: infusion.produced_ml + vol_ml }).eq('id', infusion.id)
    } else {
      warnings.push(`Infusion "${product}" not found — inventory not updated. Check the name matches exactly.`)
    }
    // Deduct spirits
    for (const [name, vol] of [[spirit_1, vol_1], [spirit_2, vol_2], [spirit_3, vol_3]] as [string, number][]) {
      if (!name || !vol) continue
      const { data: spirit } = await admin.from('bar_spirits').select('id, used_classics_ml').ilike('name', name).single()
      if (spirit) {
        await admin.from('bar_spirits').update({ used_classics_ml: spirit.used_classics_ml + vol }).eq('id', spirit.id)
        effects.push(`${name} −${vol}ml`)
      } else {
        warnings.push(`Spirit "${name}" not found — not deducted. Check the name matches exactly.`)
      }
    }
  } else if (activity_type === 'Premix Made') {
    // Increase premix produced_serves
    const { data: premix } = await admin.from('bar_premixes').select('id, produced_serves').ilike('name', product).single()
    if (premix) {
      await admin.from('bar_premixes').update({ produced_serves: premix.produced_serves + qty }).eq('id', premix.id)
    } else {
      warnings.push(`Premix "${product}" not found — inventory not updated. Check the name matches exactly.`)
    }
    // Auto-deduct via recipe
    const { data: recipes } = await admin.from('bar_premix_recipes').select('*').ilike('premix_name', product)
    for (const r of recipes ?? []) {
      const totalMl = r.ml_per_serve * qty
      if (r.ingredient_type === 'infusion') {
        const { data: inf } = await admin.from('bar_infusions').select('id, used_premix_ml').ilike('name', r.ingredient_name).single()
        if (inf) {
          await admin.from('bar_infusions').update({ used_premix_ml: inf.used_premix_ml + totalMl }).eq('id', inf.id)
          effects.push(`${r.ingredient_name} −${totalMl}ml`)
        } else {
          warnings.push(`Recipe ingredient "${r.ingredient_name}" not found — not deducted.`)
        }
      } else if (r.ingredient_type === 'spirit') {
        const { data: sp } = await admin.from('bar_spirits').select('id, used_classics_ml').ilike('name', r.ingredient_name).single()
        if (sp) {
          await admin.from('bar_spirits').update({ used_classics_ml: sp.used_classics_ml + totalMl }).eq('id', sp.id)
          effects.push(`${r.ingredient_name} −${totalMl}ml`)
        } else {
          warnings.push(`Recipe ingredient "${r.ingredient_name}" not found — not deducted.`)
        }
      }
    }
    // Manually specified raw spirits
    for (const [name, vol] of [[spirit_1, vol_1], [spirit_2, vol_2], [spirit_3, vol_3]] as [string, number][]) {
      if (!name || !vol) continue
      const totalMl = vol * qty
      const { data: spirit } = await admin.from('bar_spirits').select('id, used_classics_ml').ilike('name', name).single()
      if (spirit) {
        await admin.from('bar_spirits').update({ used_classics_ml: spirit.used_classics_ml + totalMl }).eq('id', spirit.id)
        effects.push(`${name} −${totalMl}ml`)
      } else {
        warnings.push(`Spirit "${name}" not found — not deducted. Check the name matches exactly.`)
      }
    }
  }

  return NextResponse.json({ activity: newActivity, effects, warnings })
}
