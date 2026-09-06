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

  // Get all closed shifts — opened_by/closed_by reference auth.users which PostgREST
  // cannot expose via FK embed; resolve names from public.users after fetching scalar IDs.
  const { data: shiftHistoryRaw } = await supabase
    .from('pos_shifts')
    .select('*, night_report, night_report_saved_at')
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })

  // Collect unique user IDs and resolve names from public.users
  const userIds = [...new Set([
    ...(shiftHistoryRaw ?? []).map(s => s.opened_by).filter(Boolean),
    ...(shiftHistoryRaw ?? []).map(s => s.closed_by).filter(Boolean),
  ])]
  const { data: userNames } = userIds.length
    ? await supabase.from('users').select('id, full_name').in('id', userIds)
    : { data: [] }
  const nameMap = Object.fromEntries((userNames ?? []).map(u => [u.id, u.full_name]))

  const shiftHistory = (shiftHistoryRaw ?? []).map(s => ({
    ...s,
    users_opened: s.opened_by ? { full_name: nameMap[s.opened_by] ?? 'Unknown' } : null,
    users_closed: s.closed_by ? { full_name: nameMap[s.closed_by] ?? 'Unknown' } : null,
  }))

  // If there's an open shift, get its orders summary
  let shiftOrders: {
    count: number; revenue: number; subtotal: number; discount: number
    covers: number; payment_breakdown: Record<string,number>
    drinksSold: number; voidValue: number; voidCount: number
  } | null = null
  if (openShift) {
    // Fetch orders linked to this shift OR closed after the shift opened with no shift assigned
    const [{ data: shiftOrders1 }, { data: shiftOrders2 }] = await Promise.all([
      supabase.from('pos_orders')
        .select('id, total, subtotal, discount_amount, covers, status')
        .eq('shift_id', openShift.id).eq('status', 'closed'),
      supabase.from('pos_orders')
        .select('id, total, subtotal, discount_amount, covers, status')
        .is('shift_id', null).eq('status', 'closed')
        .gte('closed_at', openShift.opened_at),
    ])

    const orders = [...(shiftOrders1 ?? []), ...(shiftOrders2 ?? [])]
    const orderIds = orders.map(o => o.id)

    const [{ data: payments }, { data: orderItems }, { data: voidedItems }] = orderIds.length
      ? await Promise.all([
          supabase.from('pos_payments').select('method, amount').in('order_id', orderIds),
          supabase.from('pos_order_items').select('quantity').in('order_id', orderIds).is('voided_at', null),
          supabase.from('pos_order_items').select('quantity, unit_price').in('order_id', orderIds).not('voided_at', 'is', null),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }]

    const breakdown: Record<string, number> = {}
    for (const p of (payments ?? [])) {
      breakdown[p.method] = (breakdown[p.method] ?? 0) + p.amount
    }
    shiftOrders = {
      count: orders.length,
      revenue: orders.reduce((s, o) => s + (o.total ?? 0), 0),
      subtotal: orders.reduce((s, o) => s + (o.subtotal ?? 0), 0),
      discount: orders.reduce((s, o) => s + (o.discount_amount ?? 0), 0),
      covers: orders.reduce((s, o) => s + (o.covers ?? 0), 0),
      payment_breakdown: breakdown,
      drinksSold: (orderItems ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0),
      voidValue: (voidedItems ?? []).reduce((s, i) => s + i.quantity * i.unit_price, 0),
      voidCount: (voidedItems ?? []).reduce((s, i) => s + i.quantity, 0),
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
