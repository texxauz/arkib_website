import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './SettingsClient'
import { getCurrentMonth, getCurrentYear } from '@/lib/utils'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const month = getCurrentMonth()
  const year = getCurrentYear()

  const [{ data: profile }, { data: target }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user!.id).single(),
    supabase.from('monthly_targets').select('*').eq('month', month).eq('year', year).single(),
  ])

  return <SettingsClient profile={profile} target={target} month={month} year={year} />
}
