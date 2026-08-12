import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Fetch all active cocktails from the recipe system
  const { data: cocktails, error: cocktailErr } = await supabase
    .from('cocktails')
    .select('name, selling_price')
    .eq('is_active', true)
    .eq('is_on_menu', true)
    .is('deleted_at', null)

  if (cocktailErr) return NextResponse.json({ error: cocktailErr.message }, { status: 500 })
  if (!cocktails?.length) return NextResponse.json({ added: 0, skipped: 0 })

  // Fetch existing menu item names (lowercase) to detect duplicates
  const { data: existing } = await supabase.from('menu_items').select('name')
  const existingNames = new Set((existing ?? []).map(i => i.name.toLowerCase().trim()))

  const toInsert = cocktails
    .filter(c => !existingNames.has(c.name.toLowerCase().trim()))
    .map(c => ({
      name: c.name,
      category: 'house_cocktail',
      price: c.selling_price,
      is_active: true,
      sort_order: 99,
    }))

  if (!toInsert.length) {
    return NextResponse.json({ added: 0, skipped: cocktails.length })
  }

  const { error: insertErr } = await supabase.from('menu_items').insert(toInsert)
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ added: toInsert.length, skipped: cocktails.length - toInsert.length })
}
