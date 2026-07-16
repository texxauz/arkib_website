export const revalidate = 30

import { createClient } from '@/lib/supabase/server'
import { ProductionQueueClient } from './ProductionQueueClient'
import { redirect } from 'next/navigation'

export default async function ProductionQueuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString().slice(0, 10)
  const in2Days = new Date(Date.now() + 2*24*60*60*1000).toISOString().slice(0, 10)

  const [{ data: premixes }, { data: infusions }, { data: spirits }, { data: reservations }, { data: topItems }] = await Promise.all([
    supabase.from('bar_premixes').select('*').order('cocktail_name'),
    supabase.from('bar_infusions').select('*').order('name'),
    supabase.from('bar_spirits').select('id, name, category, full_bottles, open_ml, used_classics_ml, bottle_size_ml, min_bottles').order('name'),
    // Upcoming reservations (next 3 days) for demand forecasting
    supabase.from('pos_reservations')
      .select('covers, date')
      .gte('date', today)
      .lte('date', in2Days)
      .in('status', ['confirmed', 'seated']),
    // Top 10 items sold in last 7 days for popularity weighting
    supabase.from('pos_order_items')
      .select('item_name, category, quantity')
      .gte('created_at', new Date(Date.now() - 7*24*60*60*1000).toISOString())
      .is('voided_at', null),
  ])

  return (
    <ProductionQueueClient
      premixes={premixes ?? []}
      infusions={infusions ?? []}
      spirits={spirits ?? []}
      reservations={reservations ?? []}
      recentItems={topItems ?? []}
      today={today}
    />
  )
}
