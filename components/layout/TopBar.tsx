'use client'
import { Bell, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface TopBarProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-[#F0EEF6] font-bold text-xl">{title}</h1>
        {subtitle && <p className="text-[#9896A4] text-sm mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <div className="hidden sm:flex items-center gap-1.5 text-[#5A5865] text-xs bg-[#141417] border border-[#2A2A30] px-3 py-1.5 rounded-lg">
          <Calendar size={12} />
          {formatDate(new Date())}
        </div>
      </div>
    </div>
  )
}
