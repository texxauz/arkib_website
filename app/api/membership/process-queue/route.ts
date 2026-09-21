import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_ATTEMPTS = 5

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: rows, error: fetchErr } = await supabase
    .from('membership_credit_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at')
    .limit(100)

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!rows?.length) return NextResponse.json({ processed: 0, failed: 0, pending: 0 })

  let processed = 0
  let failed = 0

  for (const row of rows) {
    const now = new Date().toISOString()
    try {
      // Call RPC — returns true (newly awarded) or false (already processed via idempotency).
      // BOTH outcomes mean the credit situation is resolved: mark processed.
      const { data: awarded, error: rpcErr } = await supabase.rpc('award_membership_credits', {
        p_member_id:   row.member_id,
        p_order_id:    row.order_id,
        p_credits:     row.credits_to_award,
        p_order_total: row.order_total,
        p_staff_id:    null,
      })

      if (rpcErr) throw new Error(rpcErr.message)

      // awarded = true → credits newly awarded
      // awarded = false → order already credited (idempotent), still resolved
      void awarded // both are success
      await supabase.from('membership_credit_queue').update({
        status:       'processed',
        processed_at: now,
        last_attempted_at: now,
      }).eq('id', row.id)
      processed++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      const newAttempts = row.attempts + 1
      await supabase.from('membership_credit_queue').update({
        attempts:          newAttempts,
        last_attempted_at: now,
        error_message:     message,
        status:            newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
      }).eq('id', row.id)
      failed++
    }
  }

  const { count: pending } = await supabase
    .from('membership_credit_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  return NextResponse.json({ processed, failed, pending: pending ?? 0 })
}
