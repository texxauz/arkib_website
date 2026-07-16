import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function POSLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role, tab_permissions').eq('id', user.id).single()

  const isAdmin = profile?.role === 'owner' || profile?.role === 'manager'
  const perms = profile?.tab_permissions as Record<string, string> | null
  const hasPosAccess = isAdmin || (
    perms != null &&
    Object.entries(perms).some(([k, v]) => k.startsWith('pos') && v !== 'none')
  )

  if (!hasPosAccess) redirect('/dashboard')

  return <>{children}</>
}
