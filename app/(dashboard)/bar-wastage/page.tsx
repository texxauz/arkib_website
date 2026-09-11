import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BarWastageClient } from './BarWastageClient'

export default async function BarWastagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role, full_name, tab_permissions').eq('id', user.id).single()
  const perms = profile?.tab_permissions as Record<string, string> | null
  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'

  if (!isAdmin && (perms?.['bar-wastage'] ?? 'none') === 'none') redirect('/dashboard')

  const [{ data: spirits }, { data: premixes }, { data: menuItems }, { data: glassware }] = await Promise.all([
    supabase.from('bar_spirits').select('id, name, bottle_size_ml, full_bottles, open_ml, used_classics_ml').order('name'),
    supabase.from('bar_premixes').select('id, name, opening_serves, produced_serves, sold_serves').order('name'),
    supabase.from('menu_items').select('id, name, stock_qty').not('stock_qty', 'is', null).order('name'),
    supabase.from('bar_glassware').select('*').order('name'),
  ])

  return (
    <BarWastageClient
      isAdmin={isAdmin}
      spirits={spirits ?? []}
      premixes={premixes ?? []}
      menuItems={menuItems ?? []}
      glassware={glassware ?? []}
    />
  )
}
