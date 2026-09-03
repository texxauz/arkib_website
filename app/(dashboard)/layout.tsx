import { Sidebar } from '@/components/layout/Sidebar'
import { ToastProvider } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, tab_permissions, is_active')
    .eq('id', user.id)
    .single()

  let purchaseRequestBadge = 0
  if (profile && ['owner', 'manager', 'full_timer'].includes(profile.role)) {
    const isAdmin = profile.role === 'owner' || profile.role === 'manager'
    // Admins: count pending requests awaiting approval
    // Full timers: count their own pending requests
    let q = supabase.from('purchase_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    if (!isAdmin) q = q.eq('requested_by', user.id)
    const { count } = await q
    purchaseRequestBadge = count ?? 0
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#0A0A0B]">
        <Sidebar userRole={profile?.role ?? 'bartender'} tabPermissions={profile?.tab_permissions as Record<string, string> | null} purchaseRequestBadge={purchaseRequestBadge} />
        <main className="lg:ml-56 min-h-screen">
          <div className="pt-0 lg:pt-0 pb-20 lg:pb-0">
            <div className="px-4 lg:px-6 py-5 pt-16 lg:pt-5">
              {children}
            </div>
          </div>
        </main>
      </div>
    </ToastProvider>
  )
}
