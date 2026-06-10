'use client'
import { cn, formatCurrency } from '@/lib/utils'
import { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: number
  currency?: boolean
  className?: string
  accent?: 'purple' | 'gold' | 'green' | 'red' | 'amber'
}

const accentColors = {
  purple: 'text-violet-400 bg-violet-500/10',
  gold: 'text-yellow-400 bg-yellow-500/10',
  green: 'text-emerald-400 bg-emerald-500/10',
  red: 'text-rose-400 bg-rose-500/10',
  amber: 'text-amber-400 bg-amber-500/10',
}

export function StatCard({ title, value, subtitle, icon, trend, currency, className, accent = 'purple' }: StatCardProps) {
  const displayValue = currency && typeof value === 'number' ? formatCurrency(value) : String(value)

  return (
    <div className={cn('card flex flex-col gap-3', className)}>
      <div className="flex items-start justify-between">
        <p className="text-[#9896A4] text-xs font-medium uppercase tracking-wider">{title}</p>
        {icon && (
          <div className={cn('p-2 rounded-lg text-sm', accentColors[accent])}>
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className="text-[#F0EEF6] text-2xl font-bold tracking-tight">{displayValue}</p>
        {subtitle && <p className="text-[#9896A4] text-xs mt-1">{subtitle}</p>}
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1">
          <span className={cn('text-xs font-medium', trend >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-[#5A5865] text-xs">vs last month</span>
        </div>
      )}
    </div>
  )
}
