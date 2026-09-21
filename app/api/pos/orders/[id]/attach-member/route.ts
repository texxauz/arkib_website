import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMembershipAccess } from '@/lib/membership-auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role, tab_permissions').eq('id', user.id).single()
  const access = getMembershipAccess(profile?.role, profile?.tab_permissions)
  if (access !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { memberId } = await req.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  // Verify member exists and is active
  const { data: member } = await supabase
    .from('members').select('id, status').eq('id', memberId).single()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (member.status === 'inactive') return NextResponse.json({ error: 'Member is inactive' }, { status: 400 })

  // Verify order is open
  const { data: order } = await supabase
    .from('pos_orders').select('id, status').eq('id', orderId).single()
  if (!order || order.status !== 'open') return NextResponse.json({ error: 'Order not found or not open' }, { status: 400 })

  const { error } = await supabase
    .from('pos_orders').update({ member_id: memberId }).eq('id', orderId).eq('status', 'open')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
