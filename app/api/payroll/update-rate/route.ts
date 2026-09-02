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

  const payload = {
    employment_type: employmentType,
    monthly_salary: employmentType === 'full_time' ? Number(monthlySalary ?? 0) : null,
    hourly_rate: employmentType === 'part_time' ? Number(hourlyRate ?? 0) : null,
  }

  const { data: existing } = await supabase.from('employees').select('id').eq('user_id', userId).maybeSingle()

  if (existing) {
    const { error } = await supabase.from('employees').update(payload).eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from('employees').insert({ user_id: userId, ...payload })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
