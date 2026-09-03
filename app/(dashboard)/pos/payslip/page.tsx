import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PayslipClient } from './PayslipClient'

export default async function PayslipPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('full_name, role, payslip_pin').eq('id', user.id).single()

  const { data: records } = await supabase
    .from('payroll_records')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'published')
    .order('month', { ascending: false })

  return (
    <PayslipClient
      records={records ?? []}
      userName={profile?.full_name ?? 'Staff'}
      hasPinSet={!!profile?.payslip_pin}
    />
  )
}
