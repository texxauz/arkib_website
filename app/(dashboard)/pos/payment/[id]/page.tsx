export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { PaymentClient } from './PaymentClient'
import { redirect } from 'next/navigation'

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const { data: userProfile } = await supabase
    .from('users').select('role, full_name').eq('id', user.id).single()
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'

  const [{ data: order }, { data: items }, { data: discounts }, { data: config }] = await Promise.all([
    supabase.from('pos_orders').select('*').eq('id', id).single(),
    supabase.from('pos_order_items').select('*').eq('order_id', id).is('voided_at', null),
    supabase.from('pos_discounts').select('*').eq('is_active', true),
    supabase.from('pos_config').select('key, value'),
  ])

  if (!order || order.status !== 'open') redirect('/pos')

  const configMap = Object.fromEntries((config ?? []).map(c => [c.key, c.value]))

  return (
    <PaymentClient
      order={order}
      items={items ?? []}
      discounts={discounts ?? []}
      userId={user.id}
      userName={userProfile?.full_name ?? 'Staff'}
      isAdmin={isAdmin}
      config={configMap}
    />
  )
}
