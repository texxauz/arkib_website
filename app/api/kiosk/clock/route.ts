import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limit: 10 attempts per IP per 5 minutes
const attempts = new Map<string, { count: number; resetAt: number }>()
function rateOk(ip: string): boolean {
  const now = Date.now()
  const e = attempts.get(ip)
  if (!e || now > e.resetAt) { attempts.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 }); return true }
  if (e.count >= 10) return false
  e.count++; return true
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateOk(ip)) return NextResponse.json({ error: 'Too many attempts. Try again in 5 minutes.' }, { status: 429 })

  const { userId, pin } = await req.json()
  if (!userId || !pin) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Verify PIN against the user's clock_pin (service role bypasses RLS)
  const { data: user, error: userErr } = await adminClient
    .from('users')
    .select('id, full_name, role, clock_pin, is_active')
    .eq('id', userId)
    .single()

  if (userErr || !user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (!user.is_active) return NextResponse.json({ error: 'Account is inactive' }, { status: 403 })
  if (!user.clock_pin || user.clock_pin !== String(pin).trim()) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 403 })
  }

  // Check if already clocked in
  const { data: activeShift } = await adminClient
    .from('staff_shifts')
    .select('id, clock_in')
    .eq('user_id', userId)
    .is('clock_out', null)
    .maybeSingle()

  const now = new Date().toISOString()

  if (activeShift) {
    // Clock out — only update if shift is still open (guards against concurrent requests)
    const { error } = await adminClient
      .from('staff_shifts')
      .update({ clock_out: now })
      .eq('id', activeShift.id)
      .is('clock_out', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ action: 'clock_out', name: user.full_name, time: now })
  } else {
    // Re-check for active shift right before inserting to reduce race window
    const { data: recheck } = await adminClient
      .from('staff_shifts')
      .select('id')
      .eq('user_id', userId)
      .is('clock_out', null)
      .maybeSingle()
    if (recheck) return NextResponse.json({ error: 'Already clocked in' }, { status: 409 })

    // Clock in — fetch hourly rate from employees table
    const { data: emp } = await adminClient
      .from('employees')
      .select('hourly_rate')
      .eq('user_id', userId)
      .maybeSingle()

    const { error } = await adminClient
      .from('staff_shifts')
      .insert({
        user_id: userId,
        clock_in: now,
        hourly_rate: emp?.hourly_rate ?? 10,
        is_public_holiday: false,
      })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ action: 'clock_in', name: user.full_name, time: now })
  }
}
