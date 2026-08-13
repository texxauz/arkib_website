import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandlordPnlClient } from './LandlordPnlClient'

export default async function LandlordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, tab_permissions')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  const tabPerms = profile?.tab_permissions as Record<string, string> | null

  // Owners always have access. Other roles need explicit tab permission.
  if (role === 'owner') {
    // allowed
  } else if (role === 'investor') {
    // investors allowed unless explicitly revoked
    if (tabPerms && tabPerms['landlord'] === 'none') redirect('/dashboard')
  } else if (tabPerms && tabPerms['landlord'] && tabPerms['landlord'] !== 'none') {
    // non-owner/investor can access if explicitly granted
  } else {
    redirect('/dashboard')
  }

  return <LandlordPnlClient userRole={profile?.role ?? 'investor'} />
}
