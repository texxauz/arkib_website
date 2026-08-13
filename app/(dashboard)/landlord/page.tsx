import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandlordPnlClient } from './LandlordPnlClient'

export default async function LandlordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'owner' && profile?.role !== 'investor') {
    redirect('/dashboard')
  }

  return <LandlordPnlClient userRole={profile?.role ?? 'investor'} />
}
