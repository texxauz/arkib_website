import { createClient } from '@/lib/supabase/server'
import { BarInventoryClient } from './BarInventoryClient'

export default async function BarInventoryPage() {
  const supabase = await createClient()

  const [{ data: spirits }, { data: infusions }, { data: premixes }, { data: activities }, { data: recipes }, { data: cocktails }] = await Promise.all([
    supabase.from('bar_spirits').select('*').order('category').order('name'),
    supabase.from('bar_infusions').select('*').order('name'),
    supabase.from('bar_premixes').select('*').order('category').order('cocktail_name'),
    supabase.from('bar_activity_log').select('*').order('logged_at', { ascending: false }).limit(100),
    supabase.from('bar_premix_recipes').select('*'),
    supabase.from('cocktails').select('id, name, selling_price, total_cost').eq('is_on_menu', true).is('deleted_at', null).order('name'),
  ])

  return (
    <BarInventoryClient
      initialSpirits={spirits ?? []}
      initialInfusions={infusions ?? []}
      initialPremixes={premixes ?? []}
      initialActivities={activities ?? []}
      recipes={recipes ?? []}
      cocktails={(cocktails ?? []) as any}
    />
  )
}
