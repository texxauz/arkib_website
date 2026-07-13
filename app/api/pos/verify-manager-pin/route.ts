import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// In-memory rate limiter: max 5 attempts per IP per 15 minutes
// Note: resets on serverless cold start; a Redis-backed solution is more durable.
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

  const { data: manager } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('manager_pin', String(pin).trim())
    .in('role', ['owner', 'manager'])
    .maybeSingle()

  if (!manager) {
    return NextResponse.json({ error: 'Invalid manager PIN' }, { status: 403 })
  }

  // Successful auth — reset the rate limit counter for this IP
  resetRateLimit(ip)

  return NextResponse.json({ success: true, approvedBy: manager.full_name })
}
