import { createClient } from '@/lib/supabase/server'
import { SalesClient } from './SalesClient'

export default async function SalesPage() {
  const supabase = await createClient()

  const [{ data: recentSales }, { data: eonSales }] = await Promise.all([
    supabase.from('daily_sales').select('*').is('deleted_at', null).order('date', { ascending: false }).limit(60),
    supabase.from('cocktail_sales').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
  ])

  return (
    <SalesClient
      initialSales={recentSales ?? []}
      initialEonSales={(eonSales ?? []) as any[]}
    />
  )
}
