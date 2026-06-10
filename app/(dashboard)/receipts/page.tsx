import { createClient } from '@/lib/supabase/server'
import { ReceiptsClient } from './ReceiptsClient'

export default async function ReceiptsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: receipts }, { data: expenses }] = await Promise.all([
    supabase.from('receipts').select('*, expenses(description, amount, date, category), users(full_name)').order('created_at', { ascending: false }).limit(100),
    supabase.from('expenses').select('id, description, amount, date, category').is('deleted_at', null).order('date', { ascending: false }).limit(100),
  ])

  return (
    <ReceiptsClient
      initialReceipts={(receipts as any) ?? []}
      expenses={expenses ?? []}
      currentUserId={user?.id ?? ''}
    />
  )
}
