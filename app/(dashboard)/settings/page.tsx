import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './SettingsClient'
import { getCurrentMonth, getCurrentYear } from '@/lib/utils'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('*').eq('id', user!.id).single()

  const month = getCurrentMonth()
  const year = getCurrentYear()
  const { data: target } = await supabase.from('monthly_targets').select('*').eq('month', month).eq('year', year).single()

  return <SettingsClient profile={profile} target={target} month={month} year={year} />
}
