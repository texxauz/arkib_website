import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? '0', 10)
  const year = parseInt(searchParams.get('year') ?? '0', 10)
  if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 })

  const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)

  const [{ data: sales }, { data: expenses }, { data: cocktails }] = await Promise.all([
    supabase.from('daily_sales').select('*').gte('date', firstOfMonth).lte('date', lastDay).is('deleted_at', null).order('date'),
    supabase.from('expenses').select('*').gte('date', firstOfMonth).lte('date', lastDay).is('deleted_at', null),
    supabase.from('cocktails').select('*').eq('is_active', true).order('profit_margin', { ascending: false }),
  ])

  return NextResponse.json({ sales: sales ?? [], expenses: expenses ?? [], cocktails: cocktails ?? [] })
}
