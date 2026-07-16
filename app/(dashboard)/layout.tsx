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

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#0A0A0B]">
        <Sidebar userRole={profile?.role ?? 'bartender'} tabPermissions={profile?.tab_permissions as Record<string, string> | null} />
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
