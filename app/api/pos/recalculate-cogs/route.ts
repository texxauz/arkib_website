import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Recalculates unit_cost on cocktail_sales rows where it was recorded as 0.
// For cocktail items: uses recipe ingredients to compute cost.
// For non-cocktail items (beer, wine, food, etc.): uses menu_items.cost_price.
// Matches by cocktail_id first, then falls back to cocktail_name.
// total_cogs is a GENERATED column so it updates automatically.
// Owner/manager only.

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // 1. Find ALL cocktail_sales rows with unit_cost = 0
  const { data: zeroCogs, error: fetchErr } = await supabase
    .from('cocktail_sales')
    .select('id, cocktail_id, cocktail_name')
    .eq('unit_cost', 0)

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!zeroCogs?.length) return NextResponse.json({ updated: 0, message: 'No zero-cost rows found' })

  // 2. Fetch all cocktails with recipe costs
  const { data: cocktails, error: cErr } = await supabase
    .from('cocktails')
    .select('id, name, garnish_cost, ice_cost, other_cost, cocktail_recipes(quantity_ml, ingredients(cost_per_unit))')

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  // 3. Fetch all menu items with cost_price (for beer, wine, food, etc.)
  const { data: menuItems, error: mErr } = await supabase
    .from('menu_items')
    .select('id, name, cost_price')

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  // Build cost maps keyed by id and lowercase name
  const costById: Record<string, number> = {}
  const costByName: Record<string, number> = {}

  for (const c of cocktails ?? []) {
    const recipes = c.cocktail_recipes as unknown as { quantity_ml: number; ingredients: { cost_per_unit: number | null } | null }[]
    const ingCost = recipes.reduce((s, r) => s + (r.quantity_ml ?? 0) * (r.ingredients?.cost_per_unit ?? 0), 0)
    const total = ingCost + (c.garnish_cost ?? 0) + (c.ice_cost ?? 0) + (c.other_cost ?? 0)
    costById[c.id] = total
    costByName[c.name.toLowerCase().trim()] = total
  }

  // Menu items fill in gaps (non-cocktail items, or cocktails with no recipe)
  for (const m of menuItems ?? []) {
    const key = m.name.toLowerCase().trim()
    if (!costByName[key] && (m.cost_price ?? 0) > 0) {
      costByName[key] = m.cost_price ?? 0
    }
  }

  // 4. Update each zero-cost row
  let updated = 0
  let skipped = 0

  for (const row of zeroCogs) {
    const newCost = row.cocktail_id
      ? (costById[row.cocktail_id] ?? costByName[(row.cocktail_name ?? '').toLowerCase().trim()])
      : costByName[(row.cocktail_name ?? '').toLowerCase().trim()]

    if (!newCost || newCost === 0) {
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
      ? `Updated ${updated} rows. ${skipped} skipped — set cost prices for those items in Data Manager → Menu Items.`
      : `Updated ${updated} rows successfully.`,
  })
}
