import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

// In-memory rate limiter: max 5 attempts per IP per 15 minutes.
// Note: resets on serverless cold start. For higher security, move to a
// database-backed rate limit table (see lib/db-rate-limit.ts).
const pinAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now()
  const entry = pinAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    pinAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfterSec: 0 }
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count++
  return { allowed: true, retryAfterSec: 0 }
}

function resetRateLimit(ip: string) {
  pinAttempts.delete(ip)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const ip = getClientIp(req)
  const { allowed, retryAfterSec } = checkRateLimit(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many PIN attempts. Try again in ${Math.ceil(retryAfterSec / 60)} minutes.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    )
  }

  const { pin } = await req.json()
  if (!pin || String(pin).trim().length < 4) {
    return NextResponse.json({ error: 'PIN required' }, { status: 400 })
  }

  const pinStr = String(pin).trim()

  // Fetch all users with a PIN set — owners/managers by role, or any staff with a personal pin granted.
  const { data: managers } = await supabase
    .from('users')
    .select('id, full_name, manager_pin, manager_pin_hash')
    .not('manager_pin', 'is', null)
    .eq('is_active', true)

  let matched: { id: string; full_name: string | null } | null = null

  for (const mgr of managers ?? []) {
    if (mgr.manager_pin_hash) {
      // Preferred path: bcrypt compare
      const ok = await bcrypt.compare(pinStr, mgr.manager_pin_hash)
      if (ok) { matched = mgr; break }
    } else if (mgr.manager_pin) {
      // Legacy plain-text fallback (until migration is complete)
      if (mgr.manager_pin === pinStr) { matched = mgr; break }
    }
  }

  if (!matched) {
    return NextResponse.json({ error: 'Invalid manager PIN' }, { status: 403 })
  }

  // Successful auth — reset the rate limit counter for this IP
  resetRateLimit(ip)

  return NextResponse.json({ success: true, approvedBy: matched.full_name })
}
