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

  const body = await request.json()
  const { userId, month, employmentType, basicPay, hoursWorked, hourlyRate, deductions, notes } = body

  if (!userId || !month || !employmentType || basicPay == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const deductionsList: { label: string; amount: number }[] = Array.isArray(deductions) ? deductions : []
  const deductionsTotal = deductionsList.reduce((sum, d) => sum + Number(d.amount ?? 0), 0)
  const netPay = Number(basicPay) - deductionsTotal

  const { data, error } = await supabase.from('payroll_records').upsert({
    user_id: userId,
    month,
    employment_type: employmentType,
    basic_pay: Number(basicPay),
    hours_worked: hoursWorked != null ? Number(hoursWorked) : null,
    hourly_rate: hourlyRate != null ? Number(hourlyRate) : null,
    deductions: deductionsList,
    deductions_total: deductionsTotal,
    net_pay: netPay,
    notes: notes ?? null,
    status: 'draft',
    created_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,month' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ record: data })
}
