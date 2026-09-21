import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMembershipAccess } from '@/lib/membership-auth'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role, tab_permissions').eq('id', user.id).single()
  const access = getMembershipAccess(profile?.role, profile?.tab_permissions)
  if (access !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { memberId, rewardId, orderId } = body
  if (!memberId || !rewardId || !orderId) {
    return NextResponse.json({ error: 'memberId, rewardId, and orderId are required' }, { status: 400 })
  }

  const { data: result, error } = await supabase.rpc('redeem_reward', {
    p_member_id: memberId,
    p_reward_id: rewardId,
    p_order_id:  orderId,
    p_staff_id:  user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const res = result as { success: boolean; error?: string; discount_amount?: number; discount_label?: string; credits_used?: number; credits_remaining?: number }
  if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json(res)
}
