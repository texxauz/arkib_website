import { createClient } from '@/lib/supabase/server'
import { SalesClient } from './SalesClient'

export default async function SalesPage() {
  const supabase = await createClient()

  const { data: recentSales } = await supabase
    .from('daily_sales')
    .select('*')
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .limit(30)

  return <SalesClient initialSales={recentSales ?? []} />
}
