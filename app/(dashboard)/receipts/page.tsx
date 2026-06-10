import { createClient } from '@/lib/supabase/server'
import { ReceiptsClient } from './ReceiptsClient'

export default async function ReceiptsPage() {
  const supabase = await createClient()
  const { data: receipts } = await supabase
    .from('receipts')
    .select('*, expenses(description, amount, date)')
    .order('created_at', { ascending: false })
    .limit(50)

  return <ReceiptsClient initialReceipts={(receipts as any) ?? []} />
}
