import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Auto-fills cost_price on menu_items by matching names to:
// - cocktails table (for house_cocktail / classic items)
// - ingredients table (cost_per_bottle for bottle items like wine/beer/whisky)
// Only updates items where cost_price is currently 0 (won't overwrite manual entries).
// Owner/manager only.

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Fetch all menu items with cost_price = 0
  const { data: menuItems, error: mErr } = await supabase
    .from('menu_items')
    .select('id, name, category, cost_price')
    .eq('cost_price', 0)

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
  if (!menuItems?.length) return NextResponse.json({ updated: 0, message: 'All items already have cost prices set.' })

  // Fetch cocktails with their computed total_cost
  const { data: cocktails, error: cErr } = await supabase
    .from('cocktails')
    .select('name, garnish_cost, ice_cost, other_cost, cocktail_recipes(quantity_ml, ingredients(cost_per_unit))')

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  // Fetch ingredients (cost_per_bottle = cost for bottle-sold items)
  const { data: ingredients, error: iErr } = await supabase
    .from('ingredients')
    .select('name, cost_per_bottle, cost_per_unit, unit')

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })

  // Build cost map from cocktails (by lowercase name)
  const cocktailCostByName: Record<string, number> = {}
  for (const c of cocktails ?? []) {
    const recipes = c.cocktail_recipes as unknown as { quantity_ml: number; ingredients: { cost_per_unit: number | null } | null }[]
    const ingCost = recipes.reduce((s, r) => s + (r.quantity_ml ?? 0) * (r.ingredients?.cost_per_unit ?? 0), 0)
    cocktailCostByName[c.name.toLowerCase().trim()] = ingCost + (c.garnish_cost ?? 0) + (c.ice_cost ?? 0) + (c.other_cost ?? 0)
  }

  // Build cost map from ingredients (by lowercase name) — use cost_per_bottle for bottle items
  const ingredientCostByName: Record<string, number> = {}
  for (const i of ingredients ?? []) {
    const cost = i.unit === 'bottle' ? (i.cost_per_bottle ?? 0) : (i.cost_per_unit ?? 0)
    if (cost > 0) ingredientCostByName[i.name.toLowerCase().trim()] = cost
  }

  let updated = 0
  let skipped = 0

  for (const item of menuItems) {
    const key = item.name.toLowerCase().trim()
    const isCocktail = ['house_cocktail', 'classic'].includes(item.category)

    let newCost = 0
    if (isCocktail) {
      newCost = cocktailCostByName[key] ?? 0
    } else {
      // For beer/wine/whisky/food/others — try ingredient match first, then cocktail
      newCost = ingredientCostByName[key] ?? cocktailCostByName[key] ?? 0
    }

    if (!newCost || newCost === 0) { skipped++; continue }

    const { error } = await supabase.from('menu_items').update({ cost_price: newCost }).eq('id', item.id)
    if (!error) updated++
  }

  return NextResponse.json({
    updated,
    skipped,
    message: skipped > 0
      ? `Synced ${updated} items. ${skipped} couldn't be matched — set those manually.`
      : `Synced ${updated} items successfully.`,
  })
}
