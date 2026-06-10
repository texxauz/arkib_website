'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, TrendingUp, Receipt, FileText, Users, DollarSign,
  Package, GlassWater, Truck, Building, PieChart, BarChart3, Settings,
  LogOut, ChevronRight, Menu, X, FlaskConical
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sales', label: 'Sales', icon: TrendingUp },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/receipts', label: 'Receipts', icon: FileText },

  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/bar-inventory', label: 'Bar Stock', icon: FlaskConical },
  { href: '/cocktails', label: 'Cocktails', icon: GlassWater },
  { href: '/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/rent', label: 'Rent & Fixed', icon: Building },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[#2A2A30]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center">
            <GlassWater size={16} className="text-white" />
          </div>
          <div>
            <p className="text-[#F0EEF6] font-bold text-sm tracking-widest">ARKIB</p>
            <p className="text-[#5A5865] text-[10px] tracking-wider">BAR MANAGEMENT</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/20'
                      : 'text-[#9896A4] hover:text-[#F0EEF6] hover:bg-[#1A1A1E]'
                  )}
                >
                  <Icon size={16} className={isActive ? 'text-[#8B5CF6]' : ''} />
                  <span>{label}</span>
                  {isActive && <ChevronRight size={12} className="ml-auto text-[#8B5CF6]" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="px-2 py-3 border-t border-[#2A2A30]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#9896A4] hover:text-rose-400 hover:bg-rose-500/10 transition-all w-full"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-[#0D0D0F] border-r border-[#2A2A30] fixed top-0 left-0 h-full z-30">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#0D0D0F] border-b border-[#2A2A30] flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center">
            <GlassWater size={14} className="text-white" />
          </div>
          <p className="text-[#F0EEF6] font-bold text-sm tracking-widest">ARKIB</p>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-[#9896A4] hover:text-[#F0EEF6] p-2"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-0 left-0 w-64 h-full bg-[#0D0D0F] border-r border-[#2A2A30]">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0D0D0F] border-t border-[#2A2A30] flex items-center justify-around px-2 py-2">
        {[navItems[0], navItems[1], navItems[2], navItems[4], navItems[11]].map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-1 px-3 py-1">
              <Icon size={20} className={isActive ? 'text-[#8B5CF6]' : 'text-[#5A5865]'} />
              <span className={cn('text-[9px] font-medium', isActive ? 'text-[#A78BFA]' : 'text-[#5A5865]')}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
