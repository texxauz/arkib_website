export const revalidate = 30

import { createClient } from '@/lib/supabase/server'
import { POSReportsClient } from './POSReportsClient'
import { redirect } from 'next/navigation'

export default async function POSReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'

  // Last 30 days
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [{ data: orders }, { data: items }, { data: payments }, { data: voids }, { data: discountLogs }] = await Promise.all([
    supabase.from('pos_orders')
      .select('id, table_name, covers, opened_at, closed_at, total, discount_amount, service_charge, status, server_name')
      .gte('opened_at', from + 'T00:00:00')
      .eq('status', 'closed')
      .order('opened_at', { ascending: false }),
    supabase.from('pos_order_items')
      .select('item_name, category, quantity, unit_price, voided_at, created_at')
      .gte('created_at', from + 'T00:00:00')
      .is('voided_at', null),
    supabase.from('pos_payments')
      .select('method, amount, captured_at')
      .gte('captured_at', from + 'T00:00:00'),
    supabase.from('pos_order_items')
      .select('item_name, quantity, unit_price, voided_at, void_reason, created_at')
      .gte('created_at', from + 'T00:00:00')
      .not('voided_at', 'is', null),
    supabase.from('pos_audit_log')
      .select('payload, created_at')
      .eq('event', 'discount.applied')
      .gte('created_at', from + 'T00:00:00'),
  ])

  return (
    <POSReportsClient
      orders={orders ?? []}
      items={items ?? []}
      payments={payments ?? []}
      voids={voids ?? []}
      discountLogs={discountLogs ?? []}
      isAdmin={isAdmin ?? false}
    />
  )
}
