'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, TrendingUp, Receipt, BookOpen,
  GlassWater, Building, BarChart3, Settings,
  LogOut, ChevronRight, ChevronLeft, Menu, X,
  FlaskConical, Users, Clock, PieChart, ClipboardCheck,
  MonitorSmartphone, ChefHat, Timer, CalendarDays, Shield, Zap, SlidersHorizontal, Database, History,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ── Management nav ────────────────────────────────────────────────
const MGMT_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',  icon: LayoutDashboard, key: 'dashboard' },
  { href: '/sales',        label: 'Sales',       icon: TrendingUp,      key: 'sales' },
  { href: '/expenses',     label: 'Expenses',    icon: Receipt,         key: 'expenses' },
  { href: '/receipts',     label: 'Accounting',  icon: BookOpen,        key: 'receipts' },
  { href: '/bar-inventory',label: 'Bar Stock',   icon: FlaskConical,    key: 'bar-inventory' },
  { href: '/checklist',    label: 'Checklist',   icon: ClipboardCheck,  key: 'checklist' },
  { href: '/cocktails',    label: 'Cocktails',   icon: GlassWater,      key: 'cocktails' },
  { href: '/shifts',       label: 'Shifts',      icon: Clock,           key: 'shifts' },
  { href: '/rent',         label: 'Rent & Fixed',icon: Building,        key: 'rent' },
  { href: '/reports',      label: 'Reports',     icon: BarChart3,       key: 'reports' },
  { href: '/pnl',          label: 'P&L',         icon: PieChart,        key: 'pnl' },
  { href: '/settings',     label: 'Settings',    icon: Settings,        key: 'settings' },
  { href: '/settings/team',label: 'Team Access', icon: Users,           key: 'team' },
]

// ── POS nav ───────────────────────────────────────────────────────
const POS_ITEMS = [
  { href: '/pos',              label: 'Floor Plan',       icon: MonitorSmartphone, key: 'pos' },
  { href: '/pos/kds',          label: 'Bar Display',      icon: ChefHat,           key: 'pos-kds' },
  { href: '/pos/shifts',       label: 'Shifts',           icon: Timer,             key: 'pos-shifts' },
  { href: '/pos/history',      label: 'Sales History',    icon: History,           key: 'pos-history' },
  { href: '/pos/reservations', label: 'Reservations',     icon: CalendarDays,      key: 'pos-reservations' },
  { href: '/pos/production',   label: 'Production Queue', icon: Zap,               key: 'pos-production' },
  { href: '/pos/reports',      label: 'POS Reports',      icon: BarChart3,         key: 'pos-reports' },
  { href: '/pos/audit',        label: 'Audit Log',        icon: Shield,            key: 'pos-audit' },
  { href: '/pos/data',         label: 'Data Manager',     icon: Database,          key: 'pos-data' },
  { href: '/pos/settings',     label: 'POS Settings',     icon: SlidersHorizontal, key: 'pos-settings' },
]

function getMgmtItems(userRole: string, tabPermissions: Record<string, string> | null) {
  const isAdmin = userRole === 'owner' || userRole === 'manager'
  return MGMT_ITEMS.filter(item => {
    if (item.key === 'team' || item.key === 'settings') return isAdmin
    if (isAdmin || !tabPermissions) return true
    return (tabPermissions[item.key] ?? 'none') !== 'none'
  })
}

function getPosItems(userRole: string, tabPermissions: Record<string, string> | null) {
  const isAdmin = userRole === 'owner' || userRole === 'manager'
  return POS_ITEMS.filter(item => {
    if (item.key === 'pos-audit' || item.key === 'pos-settings' || item.key === 'pos-data') return isAdmin
    if (isAdmin || !tabPermissions) return true
    return (tabPermissions[item.key] ?? 'none') !== 'none'
  })
}

export function Sidebar({ userRole = 'bartender', tabPermissions = null }: {
  userRole?: string
  tabPermissions?: Record<string, string> | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAdmin = userRole === 'owner' || userRole === 'manager'
  // User has POS access if they're admin, or have at least one pos tab permission set
  const hasPosAccess = isAdmin || (
    tabPermissions != null &&
    Object.entries(tabPermissions).some(([k, v]) => k.startsWith('pos') && v !== 'none')
  )

  const isPOS = pathname.startsWith('/pos')
  const navItems = isPOS ? getPosItems(userRole, tabPermissions) : getMgmtItems(userRole, tabPermissions)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const mobileItems = navItems.slice(0, 5)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / Mode header */}
      <div className="px-4 py-5 border-b border-[#2A2A30]">
        {isPOS ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center">
                <MonitorSmartphone size={16} className="text-white" />
              </div>
              <div>
                <p className="text-[#F0EEF6] font-bold text-sm tracking-widest">POS</p>
                <p className="text-[#5A5865] text-[10px] tracking-wider">POINT OF SALE</p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-[#5A5865] hover:text-[#9896A4] transition-colors"
            >
              <ChevronLeft size={12} />
              Back to Management
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center">
                <GlassWater size={16} className="text-white" />
              </div>
              <div>
                <p className="text-[#F0EEF6] font-bold text-sm tracking-widest">ARKIB</p>
                <p className="text-[#5A5865] text-[10px] tracking-wider">BAR MANAGEMENT</p>
              </div>
            </div>
            {hasPosAccess && (
              <Link
                href="/pos"
                className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#A78BFA] text-xs font-medium hover:bg-[#8B5CF6]/20 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <MonitorSmartphone size={12} />
                  Open POS
                </div>
                <ChevronRight size={11} />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, key }) => {
            const isActive = pathname === href ||
              (href !== '/settings' && href !== '/pos' && pathname.startsWith(href + '/')) ||
              (href === '/pos' && pathname === '/pos')
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/20'
                      : 'text-[#9896A4] hover:text-[#F0EEF6] hover:bg-[#1A1A1E]',
                    key === 'team' ? 'ml-2 text-xs' : ''
                  )}
                >
                  <Icon size={key === 'team' ? 14 : 16} className={isActive ? 'text-[#8B5CF6]' : ''} />
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
            {isPOS ? <MonitorSmartphone size={14} className="text-white" /> : <GlassWater size={14} className="text-white" />}
          </div>
          <p className="text-[#F0EEF6] font-bold text-sm tracking-widest">{isPOS ? 'POS' : 'ARKIB'}</p>
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
        {mobileItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-1 px-2 py-1 min-w-[44px]">
              <Icon size={22} className={isActive ? 'text-[#8B5CF6]' : 'text-[#5A5865]'} />
              <span className={cn('text-[10px] font-medium', isActive ? 'text-[#A78BFA]' : 'text-[#5A5865]')}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
