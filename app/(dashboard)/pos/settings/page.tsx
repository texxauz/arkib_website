export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { POSSettingsClient } from './POSSettingsClient'
import { redirect } from 'next/navigation'

export default async function POSSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (!userProfile || !['owner', 'manager'].includes(userProfile.role)) redirect('/pos')

  const [{ data: tables }, { data: config }, { data: discounts }] = await Promise.all([
    supabase.from('pos_tables').select('*').order('section').order('sort_order'),
    supabase.from('pos_config').select('key, value'),
    supabase.from('pos_discounts').select('*').order('name'),
  ])

  const configMap = Object.fromEntries((config ?? []).map(c => [c.key, c.value]))

  return (
    <POSSettingsClient
      initialTables={tables ?? []}
      config={configMap}
      initialDiscounts={discounts ?? []}
    />
  )
}
