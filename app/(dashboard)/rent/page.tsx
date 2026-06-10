import { createClient } from '@/lib/supabase/server'
import { RentClient } from './RentClient'
import { getCurrentMonth, getCurrentYear } from '@/lib/utils'

export default async function RentPage() {
  const supabase = await createClient()
  const month = getCurrentMonth()
  const year = getCurrentYear()

  const [{ data: fixedCosts }, { data: rentalRecords }] = await Promise.all([
    supabase.from('fixed_costs').select('*').is('deleted_at', null).eq('is_active', true).order('name'),
    supabase.from('rental_records').select('*, fixed_costs(name, category)').eq('month', month).eq('year', year),
  ])

  return <RentClient fixedCosts={fixedCosts ?? []} rentalRecords={(rentalRecords as any) ?? []} month={month} year={year} />
}
