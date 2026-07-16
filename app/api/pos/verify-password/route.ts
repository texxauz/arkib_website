import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limit: max 10 password verification attempts per IP per 15 minutes.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`verify-password:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait before trying again.' },
      { status: 429 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { password } = await req.json()
  if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 })

  // Verify by attempting sign-in with the user's own email + supplied password.
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { error } = await adminSupabase.auth.signInWithPassword({ email: user.email, password })
  if (error) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })

  return NextResponse.json({ valid: true })
}
