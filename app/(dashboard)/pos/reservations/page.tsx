export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { ReservationClient } from './ReservationClient'
import { redirect } from 'next/navigation'

export default async function ReservationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users').select('role, full_name').eq('id', user.id).single()
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'

  // Get today + next 14 days of reservations
  const today = new Date().toISOString().slice(0, 10)
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [{ data: reservations }, { data: tables }] = await Promise.all([
    supabase
      .from('pos_reservations')
      .select('*')
      .gte('date', today)
      .lte('date', twoWeeks)
      .order('date').order('time'),
    supabase
      .from('pos_tables')
      .select('id, name, section, capacity')
      .eq('is_active', true)
      .order('section').order('sort_order'),
  ])

  return (
    <ReservationClient
      initialReservations={reservations ?? []}
      tables={tables ?? []}
      userId={user.id}
      userName={userProfile?.full_name ?? 'Staff'}
      isAdmin={isAdmin ?? false}
      today={today}
    />
  )
}
