import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Closing times per day the shift OPENED (MYT, day-of-week 0=Sun)
// Tuesday (2) is closed — bar doesn't operate
const CLOSING_HOUR: Record<number, { hour: number; nextDay: boolean }> = {
  0: { hour: 1,  nextDay: true  }, // Sun → 1am Mon
  1: { hour: 1,  nextDay: true  }, // Mon → 1am Tue
  // 2 = Tuesday — bar closed, no shifts expected
  3: { hour: 1,  nextDay: true  }, // Wed → 1am Thu
  4: { hour: 1,  nextDay: true  }, // Thu → 1am Fri
  5: { hour: 2,  nextDay: true  }, // Fri → 2am Sat
  6: { hour: 2,  nextDay: true  }, // Sat → 2am Sun
}

function getExpectedCloseTime(openedAt: string): Date {
  // Convert opened_at to MYT (UTC+8)
  const openedUtc = new Date(openedAt)
  const mytOffset = 8 * 60 * 60 * 1000
  const openedMyt = new Date(openedUtc.getTime() + mytOffset)

  // Day of week in MYT
  const dow = openedMyt.getUTCDay()
  const rule = CLOSING_HOUR[dow]

  if (!rule) {
    // Fallback: 1am MYT next day = 17:00 UTC same MYT-day
    const fallback = new Date(openedMyt)
    fallback.setUTCDate(fallback.getUTCDate() + 1)
    fallback.setUTCHours(1, 0, 0, 0) // 1am in shifted MYT frame
    return new Date(fallback.getTime() - mytOffset)
  }

  // Build close time in MYT
  const closeMyt = new Date(openedMyt)
  if (rule.nextDay) closeMyt.setUTCDate(closeMyt.getUTCDate() + 1)
  closeMyt.setUTCHours(rule.hour, 0, 0, 0)

  // Convert back to UTC
  return new Date(closeMyt.getTime() - mytOffset)
}

export async function POST(req: NextRequest) {
  // CRON_SECRET is required — no secret means no access, not open access.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET is not set' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = await createClient()

  // Find all shifts that have been open for more than 8 hours
  const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
  const { data: staleShifts } = await supabase
    .from('pos_shifts')
    .select('*')
    .eq('status', 'open')
    .lt('opened_at', cutoff)

  if (!staleShifts?.length) {
    return NextResponse.json({ closed: 0, message: 'No stale shifts found' })
  }

  const results: { shiftId: string; closedAt: string; staffName: string }[] = []
  const errors: { shiftId: string; error: string }[] = []

  for (const shift of staleShifts) {
    const expectedCloseTime = getExpectedCloseTime(shift.opened_at)

    // If the expected close time is in the future, skip — shift may still be active
    if (expectedCloseTime > new Date()) continue

    // Check for open orders under this shift before closing
    const { data: openOrders } = await supabase
      .from('pos_orders')
      .select('id, table_name')
      .eq('shift_id', shift.id)
      .eq('status', 'open')
      .limit(5)

    if (openOrders && openOrders.length > 0) {
      const tableNames = openOrders.map(o => o.table_name ?? 'Walk-in').join(', ')
      await supabase.from('pos_audit_log').insert({
        actor_id: shift.opened_by,
        event: 'shift.auto_close_blocked',
        entity_type: 'pos_shifts',
        entity_id: shift.id,
        payload: {
          reason: 'Auto-close blocked — open orders still exist under this shift',
          open_tables: tableNames,
          open_count: openOrders.length,
        },
      })
      errors.push({ shiftId: shift.id, error: `${openOrders.length} open order(s) still active: ${tableNames}` })
      continue
    }

    // Calculate expected cash at close time
    const { data: payments } = await supabase
      .from('pos_payments')
      .select('amount, pos_orders!inner(shift_id)')
      .eq('pos_orders.shift_id', shift.id)
      .eq('method', 'cash')

    const cashRevenue = (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
    const expectedCash = (shift.opening_float ?? 0) + cashRevenue
    const closedAt = expectedCloseTime.toISOString()

    const { error } = await supabase.from('pos_shifts').update({
      closed_at: closedAt,
      closing_cash: null,     // unknown — not physically counted
      expected_cash: expectedCash,
      variance: null,         // can't compute without physical count
      status: 'closed',
      notes: `Auto-closed by system at scheduled closing time. Staff did not clock out.${shift.notes ? ` Original notes: ${shift.notes}` : ''}`,
    }).eq('id', shift.id).eq('status', 'open')

    if (error) {
      errors.push({ shiftId: shift.id, error: error.message })
      continue
    }

    // Resolve staff name
    const { data: staffUser } = await supabase
      .from('users').select('full_name').eq('id', shift.opened_by).single()
    const staffName = staffUser?.full_name ?? 'Unknown'

    await supabase.from('pos_audit_log').insert({
      actor_id: shift.opened_by,
      actor_name: staffName,
      event: 'shift.auto_closed',
      entity_type: 'pos_shifts',
      entity_id: shift.id,
      payload: {
        reason: 'Staff did not clock out — auto-closed at scheduled closing time',
        opened_at: shift.opened_at,
        auto_closed_at: closedAt,
        expected_cash: expectedCash,
        staff_name: staffName,
      },
    })

    results.push({ shiftId: shift.id, closedAt, staffName })
  }

  return NextResponse.json({
    closed: results.length,
    skipped: staleShifts.length - results.length - errors.length,
    errors: errors.length,
    details: results,
  })
}
