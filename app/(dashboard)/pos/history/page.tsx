export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { SalesHistoryClient } from './SalesHistoryClient'
import { redirect } from 'next/navigation'

export default async function SalesHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'

  // Last 30 days of closed orders with their items and payments
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: configRows } = await supabase
    .from('pos_config').select('key, value').eq('key', 'business_day_cutoff_hour')
  const cutoffHour = parseInt(configRows?.find(r => r.key === 'business_day_cutoff_hour')?.value ?? '6', 10)

  const [{ data: orders }, { data: items }, { data: payments }, { data: receiptEmails }] = await Promise.all([
    supabase
      .from('pos_orders')
      .select('id, table_name, section, covers, opened_at, closed_at, subtotal, discount_amount, discount_label, service_charge, tax_amount, total, server_name, status')
      .eq('status', 'closed')
      .gte('closed_at', from + 'T00:00:00')
      .order('closed_at', { ascending: false }),
    supabase
      .from('pos_order_items')
      .select('id, order_id, item_name, category, quantity, unit_price, discount, voided_at')
      .gte('created_at', from + 'T00:00:00'),
    supabase
      .from('pos_payments')
      .select('order_id, method, amount')
      .gte('captured_at', from + 'T00:00:00'),
    supabase
      .from('pos_receipt_emails')
      .select('id, order_id, sent_to, sent_by_name, sent_at, receipt_html')
      .gte('sent_at', from + 'T00:00:00')
      .order('sent_at', { ascending: false }),
  ])

  return (
    <SalesHistoryClient
      orders={orders ?? []}
      items={items ?? []}
      payments={payments ?? []}
      receiptEmails={receiptEmails ?? []}
      isAdmin={isAdmin ?? false}
      cutoffHour={cutoffHour}
    />
  )
}
