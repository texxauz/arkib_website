export const revalidate = 30

import { createClient } from '@/lib/supabase/server'
import { PnlClient } from './PnlClient'

export default async function PnlPage() {
  const supabase = await createClient()

  const [{ data: salesData }, { data: cogsData }, { data: expensesData }] = await Promise.all([
    supabase.from('daily_sales').select('date, total_revenue, cocktails_revenue, beer_revenue, wine_revenue, food_revenue, others_revenue').is('deleted_at', null).order('date'),
    supabase.from('cocktail_sales').select('date, total_cogs').order('date'),
    supabase.from('expenses').select('date, expense_period, amount, category').is('deleted_at', null).order('date'),
  ])

  return (
    <PnlClient
      salesData={salesData ?? []}
      cogsData={cogsData ?? []}
      expensesData={expensesData ?? []}
    />
  )
}
