import { createClient } from '@/lib/supabase/server'
import { ExpensesClient } from './ExpensesClient'

export default async function ExpensesPage() {
  const supabase = await createClient()

  const [{ data: expenses }, { data: suppliers }] = await Promise.all([
    supabase.from('expenses').select('*').is('deleted_at', null).order('date', { ascending: false }).limit(50),
    supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
  ])

  return <ExpensesClient initialExpenses={expenses ?? []} suppliers={suppliers ?? []} />
}
