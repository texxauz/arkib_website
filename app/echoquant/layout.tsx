'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, LineChart, Search, Clock,
  BookOpen, BarChart3, Settings, ChevronLeft, ChevronRight, Zap
} from 'lucide-react'
import { EchoQuantProvider } from '@/lib/echoquant/store'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/echoquant' },
  { icon: LineChart, label: 'Chart', href: '/echoquant/chart' },
  { icon: Search, label: 'Echo Scanner', href: '/echoquant/echo' },
  { icon: Clock, label: 'Market Clock', href: '/echoquant/clock' },
  { icon: BookOpen, label: 'Journal', href: '/echoquant/journal' },
  { icon: BarChart3, label: 'Statistics', href: '/echoquant/stats' },
  { icon: Settings, label: 'Settings', href: '/echoquant/settings' },
]

export default function EchoQuantLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <EchoQuantProvider>
      <div className="flex min-h-screen bg-[#0A0B0E] text-[#E6EDF3]">
        {/* Sidebar */}
        <aside
          className={`flex flex-col bg-[#0D1117] border-r border-[#1E2228] transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'} shrink-0`}
        >
          {/* Logo */}
          <div className="flex items-center gap-2 px-4 py-5 border-b border-[#1E2228]">
            <Zap className="w-6 h-6 text-[#F59E0B] shrink-0" />
            {!collapsed && (
              <span className="font-mono font-bold text-[#F59E0B] text-sm tracking-wider">ECHOQUANT</span>
            )}
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-1 px-2 py-4 flex-1">
            {navItems.map(({ icon: Icon, label, href }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                    active
                      ? 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20'
                      : 'text-[#7D8590] hover:text-[#E6EDF3] hover:bg-[#1E2228]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </Link>
              )
            })}
          </nav>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center justify-center py-4 border-t border-[#1E2228] text-[#7D8590] hover:text-[#E6EDF3] transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </EchoQuantProvider>
  )
}
