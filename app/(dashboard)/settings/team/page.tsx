import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TeamClient } from './TeamClient'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (currentProfile?.role !== 'owner' && currentProfile?.role !== 'manager') redirect('/dashboard')

  const { data: members } = await supabase.from('users').select('*').order('created_at')

  return <TeamClient members={members ?? []} currentUserId={user.id} />
}
