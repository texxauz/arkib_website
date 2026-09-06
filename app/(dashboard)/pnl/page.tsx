export const revalidate = 30

import { createClient } from '@/lib/supabase/server'
import { PnlClient } from './PnlClient'

export default async function PnlPage() {
  const supabase = await createClient()

  const [{ data: salesData }, { data: cogsData }, { data: expensesData }, { data: eventsData }] = await Promise.all([
    supabase.from('daily_sales').select('date, total_revenue, cocktails_revenue, beer_revenue, wine_revenue, food_revenue, others_revenue').is('deleted_at', null).order('date'),
    supabase.from('cocktail_sales').select('date, total_cogs').order('date'),
    supabase.from('expenses').select('date, expense_period, amount, category').is('deleted_at', null).order('date'),
    supabase.from('events').select('event_date, revenue, cost').is('deleted_at', null).order('event_date'),
  ])

  return (
    <PnlClient
      salesData={salesData ?? []}
      cogsData={cogsData ?? []}
      expensesData={expensesData ?? []}
      eventsData={eventsData ?? []}
    />
  )
}
