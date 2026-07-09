export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { KDSClient } from './KDSClient'
import { redirect } from 'next/navigation'

export default async function KDSPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load all open order items that aren't served or voided
  const { data: items } = await supabase
    .from('pos_order_items')
    .select('id, order_id, item_name, category, quantity, modifiers, notes, status, kds_sent_at, created_at, pos_orders!inner(table_name, section, covers, status)')
    .in('status', ['pending', 'sent', 'making'])
    .is('voided_at', null)
    .order('created_at', { ascending: true })

  return <KDSClient initialItems={(items ?? []) as any[]} />
}
