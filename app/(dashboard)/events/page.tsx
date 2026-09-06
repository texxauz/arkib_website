export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { EventsClient } from './EventsClient'
import { redirect } from 'next/navigation'

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .is('deleted_at', null)
    .order('event_date', { ascending: false })

  return <EventsClient initialEvents={events ?? []} isAdmin={isAdmin} />
}
