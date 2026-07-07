export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { ShiftClient } from './ShiftClient'
import { redirect } from 'next/navigation'

export default async function ShiftsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users').select('role, full_name').eq('id', user.id).single()
  const isAdmin = userProfile?.role === 'owner' || userProfile?.role === 'manager'

  // Get current open shift if any
  const { data: openShift } = await supabase
    .from('pos_shifts')
    .select('*')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Get shift history (last 10 closed)
  const { data: shiftHistory } = await supabase
    .from('pos_shifts')
    .select('*, users_opened:opened_by(full_name), users_closed:closed_by(full_name)')
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(10)

  // If there's an open shift, get its orders summary
  let shiftOrders: { count: number; revenue: number; payment_breakdown: Record<string,number> } | null = null
  if (openShift) {
    const { data: orders } = await supabase
      .from('pos_orders')
      .select('total, status')
      .eq('shift_id', openShift.id)
      .eq('status', 'closed')

    const { data: payments } = await supabase
      .from('pos_payments')
      .select('method, amount, pos_orders!inner(shift_id)')
      .eq('pos_orders.shift_id', openShift.id)

    const breakdown: Record<string, number> = {}
    for (const p of (payments ?? [])) {
      breakdown[p.method] = (breakdown[p.method] ?? 0) + p.amount
    }
    shiftOrders = {
      count: orders?.length ?? 0,
      revenue: orders?.reduce((s, o) => s + (o.total ?? 0), 0) ?? 0,
      payment_breakdown: breakdown,
    }
  }

  return (
    <ShiftClient
      openShift={openShift ?? null}
      shiftHistory={(shiftHistory ?? []) as any}
      shiftOrders={shiftOrders}
      userId={user.id}
      userName={userProfile?.full_name ?? 'Staff'}
      isAdmin={isAdmin ?? false}
    />
  )
}
