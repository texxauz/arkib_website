import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, employmentType, monthlySalary, hourlyRate } = await request.json()
  if (!userId || !employmentType) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { error } = await supabase.from('employees').upsert({
    user_id: userId,
    employment_type: employmentType,
    monthly_salary: employmentType === 'full_time' ? Number(monthlySalary ?? 0) : null,
    hourly_rate: employmentType === 'part_time' ? Number(hourlyRate ?? 0) : null,
  }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
