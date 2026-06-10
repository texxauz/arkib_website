import { createClient } from '@/lib/supabase/server'
import { BarInventoryClient } from './BarInventoryClient'

export default async function BarInventoryPage() {
  const supabase = await createClient()

  const [{ data: spirits }, { data: infusions }, { data: premixes }, { data: activities }] = await Promise.all([
    supabase.from('bar_spirits').select('*').order('category').order('name'),
    supabase.from('bar_infusions').select('*').order('name'),
    supabase.from('bar_premixes').select('*').order('category').order('cocktail_name'),
    supabase.from('bar_activity_log').select('*').order('logged_at', { ascending: false }).limit(100),
  ])

  return (
    <BarInventoryClient
      initialSpirits={spirits ?? []}
      initialInfusions={infusions ?? []}
      initialPremixes={premixes ?? []}
      initialActivities={activities ?? []}
    />
  )
}
