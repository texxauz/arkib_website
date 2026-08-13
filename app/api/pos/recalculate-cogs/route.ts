import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Recalculates unit_cost on cocktail_sales rows where it was recorded as 0.
// Uses current cocktail_recipes + ingredients to derive the correct cost,
// then updates each affected row. total_cogs is a GENERATED column so it
// updates automatically when unit_cost changes.
// Owner/manager only.

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // 1. Find all cocktail_sales rows with unit_cost = 0 and a known cocktail_id
  const { data: zeroCogs, error: fetchErr } = await supabase
    .from('cocktail_sales')
    .select('id, cocktail_id, cocktail_name')
    .eq('unit_cost', 0)
    .not('cocktail_id', 'is', null)

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!zeroCogs?.length) return NextResponse.json({ updated: 0, message: 'No zero-cost rows found' })

  // 2. Get unique cocktail IDs to look up
  const cocktailIds = [...new Set(zeroCogs.map(r => r.cocktail_id!))]

  // 3. Fetch current recipe costs for those cocktails
  const { data: cocktails, error: cErr } = await supabase
    .from('cocktails')
    .select('id, total_cost, garnish_cost, ice_cost, other_cost, cocktail_recipes(quantity_ml, ingredients(cost_per_unit))')
    .in('id', cocktailIds)

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  // Build a map: cocktail_id → computed unit_cost
  const costMap: Record<string, number> = {}
  for (const c of cocktails ?? []) {
    const recipes = c.cocktail_recipes as unknown as { quantity_ml: number; ingredients: { cost_per_unit: number | null } | null }[]
    const ingCost = recipes.reduce((s, r) => s + (r.quantity_ml ?? 0) * (r.ingredients?.cost_per_unit ?? 0), 0)
    costMap[c.id] = ingCost + (c.garnish_cost ?? 0) + (c.ice_cost ?? 0) + (c.other_cost ?? 0)
  }

  // 4. Update each zero-cost row with the computed cost
  let updated = 0
  let skipped = 0

  for (const row of zeroCogs) {
    const newCost = costMap[row.cocktail_id!]
    if (newCost == null || newCost === 0) {
      skipped++
      continue
    }
    const { error: updErr } = await supabase
      .from('cocktail_sales')
      .update({ unit_cost: newCost })
      .eq('id', row.id)
    if (!updErr) updated++
  }

  return NextResponse.json({
    updated,
    skipped,
    message: skipped > 0
      ? `Updated ${updated} rows. ${skipped} skipped — those cocktails still have no recipe costs set.`
      : `Updated ${updated} rows.`,
  })
}
