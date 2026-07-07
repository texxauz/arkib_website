export const revalidate = 30

import { createClient } from '@/lib/supabase/server'
import { BarInventoryClient } from './BarInventoryClient'
import { redirect } from 'next/navigation'

export default async function BarInventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'

  const [{ data: spirits }, { data: infusions }, { data: premixes }, { data: activities }, { data: recipes }, { data: cocktails }, { data: menuItems }] = await Promise.all([
    supabase.from('bar_spirits').select('*').order('category').order('name'),
    supabase.from('bar_infusions').select('*').order('name'),
    supabase.from('bar_premixes').select('*').order('category').order('cocktail_name'),
    supabase.from('bar_activity_log').select('*').order('logged_at', { ascending: false }).limit(100),
    supabase.from('bar_premix_recipes').select('*'),
    supabase.from('cocktails').select('id, name, selling_price, total_cost').eq('is_on_menu', true).is('deleted_at', null).order('name'),
    supabase.from('menu_items').select('*').eq('is_active', true).order('category').order('sort_order').order('name'),
  ])

  return (
    <BarInventoryClient
      initialSpirits={spirits ?? []}
      initialInfusions={infusions ?? []}
      initialPremixes={premixes ?? []}
      initialActivities={activities ?? []}
      initialRecipes={recipes ?? []}
      cocktails={(cocktails ?? []) as any}
      initialMenuItems={(menuItems ?? []) as any}
      isAdmin={isAdmin ?? false}
    />
  )
}
