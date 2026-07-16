'use client'

import { useState } from 'react'
import { Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'

type AuditLog = {
  id: string
  actor_id: string | null
  actor_name: string | null
  event: string
  entity_type: string | null
  entity_id: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

interface Props {
  initialLogs: AuditLog[]
}

const EVENT_TYPES = [
  'all',
  'order.created',
  'order.closed',
  'order.cancelled',
  'order.admin_deleted',
  'item.voided',
  'discount.applied',
  'table.force_released',
  'shift.opened',
  'shift.closed',
] as const

const eventBadgeStyles: Record<string, string> = {
  'order.created':    'bg-sky-500/20 text-sky-400 border border-sky-500/20',
  'order.closed':     'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20',
  'order.voided':     'bg-rose-500/20 text-rose-400 border border-rose-500/20',
  'item.voided':      'bg-rose-500/20 text-rose-400 border border-rose-500/20',
  'discount.applied': 'bg-amber-500/20 text-amber-400 border border-amber-500/20',
  'shift.opened':     'bg-purple-500/20 text-purple-400 border border-purple-500/20',
  'shift.closed':     'bg-purple-500/20 text-purple-400 border border-purple-500/20',
}

function formatTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function getPayloadSummary(event: string, payload: Record<string, unknown> | null): string {
  if (!payload) return '—'

  if (event === 'order.closed') {
    const parts: string[] = []
    if (payload.total != null) parts.push(`Total: RM ${Number(payload.total).toFixed(2)}`)
    if (payload.items_count != null) parts.push(`Items: ${payload.items_count}`)
    return parts.join(', ') || '—'
  }

  if (event === 'item.voided') {
    return payload.reason ? String(payload.reason) : (payload.void_reason ? String(payload.void_reason) : '—')
  }

  if (event === 'order.cancelled' || event === 'order.admin_deleted') {
    const parts: string[] = []
    if (payload.table_name) parts.push(`Table: ${payload.table_name}`)
    if (payload.total != null) parts.push(`RM ${Number(payload.total).toFixed(2)}`)
    return parts.join(', ') || '—'
  }

  if (event === 'discount.applied') {
    const parts: string[] = []
    if (payload.discount_type != null) parts.push(String(payload.discount_type))
    const amt = payload.discount_amount ?? payload.amount
    if (amt != null) parts.push(`RM ${Number(amt).toFixed(2)}`)
    return parts.join(' — ') || '—'
  }

  if (event === 'shift.closed') {
    if (payload.variance != null) {
      const v = Number(payload.variance)
      return `Variance: RM ${v.toFixed(2)}`
    }
    return '—'
  }

  if (event === 'shift.opened') {
    if (payload.opening_float != null) return `Float: RM ${Number(payload.opening_float).toFixed(2)}`
    return '—'
  }

  if (event === 'order.created') {
    const name = payload.table_name ?? payload.tableName
    if (name != null) return `Table: ${name}`
    return '—'
  }

  return '—'
}

export function AuditClient({ initialLogs }: Props) {
  const [logs] = useState<AuditLog[]>(initialLogs)
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? logs : logs.filter(l => l.event === filter)

  return (
    <div className="min-h-screen bg-[#0D0D10] text-[#F0EEF6] p-4 sm:p-6">
      <TopBar
        title="Audit Log"
        subtitle="Security and activity record"
        actions={
          <div className="flex items-center gap-1.5 text-[#9896A4] text-xs bg-[#141417] border border-[#2A2A30] px-3 py-1.5 rounded-lg">
            <Shield size={12} />
            {logs.length} records
          </div>
        }
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {EVENT_TYPES.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === type
                ? 'bg-[#6C63FF] border-[#6C63FF] text-white'
                : 'bg-[#141417] border-[#2A2A30] text-[#9896A4] hover:border-[#6C63FF]/40 hover:text-[#F0EEF6]'
            }`}
          >
            {type === 'all' ? 'All events' : type}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#5A5865]">
          <Clock size={32} className="mb-3 opacity-40" />
          <p className="text-sm">No audit logs match this filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#2A2A30] bg-[#141417]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2A30]">
                <th className="text-left px-4 py-3 text-[#5A5865] font-medium text-xs uppercase tracking-wider whitespace-nowrap">Time</th>
                <th className="text-left px-4 py-3 text-[#5A5865] font-medium text-xs uppercase tracking-wider whitespace-nowrap">Event</th>
                <th className="text-left px-4 py-3 text-[#5A5865] font-medium text-xs uppercase tracking-wider whitespace-nowrap">Actor</th>
                <th className="text-left px-4 py-3 text-[#5A5865] font-medium text-xs uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, idx) => (
                <tr
                  key={log.id}
                  className={`border-b border-[#1E1E24] hover:bg-[#1A1A20] transition-colors ${
                    idx === filtered.length - 1 ? 'border-b-0' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-[#9896A4] whitespace-nowrap font-mono text-xs">
                    {formatTime(log.created_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                      eventBadgeStyles[log.event] ?? 'bg-[#2A2A30] text-[#9896A4] border border-[#3A3A40]'
                    }`}>
                      {log.event}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#F0EEF6] whitespace-nowrap">
                    {log.actor_name ?? (
                      <span className="text-[#5A5865] italic">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#9896A4] max-w-xs truncate">
                    {getPayloadSummary(log.event, log.payload)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
