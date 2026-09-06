'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, ChevronRight, Check, Flame } from 'lucide-react'

type KDSItem = {
  id: string
  order_id: string
  item_name: string
  category: string | null
  quantity: number
  modifiers: string[] | null
  notes: string | null
  status: string
  kds_sent_at: string | null
  created_at: string
  pos_orders: {
    table_name: string | null
    section: string | null
    covers: number
    status: string
  }
}

type OrderGroup = {
  orderId: string
  tableName: string | null
  section: string | null
  covers: number
  items: KDSItem[]
  earliestCreatedAt: string
}

interface Props {
  initialItems: KDSItem[]
}

function getElapsedSeconds(createdAt: string, now: number): number {
  return Math.floor((now - new Date(createdAt).getTime()) / 1000)
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function elapsedColor(seconds: number): string {
  if (seconds > 600) return 'text-rose-400'
  if (seconds > 300) return 'text-amber-400'
  return 'text-emerald-400'
}

function groupByOrder(items: KDSItem[]): OrderGroup[] {
  const map = new Map<string, OrderGroup>()
  for (const item of items) {
    const existing = map.get(item.order_id)
    if (existing) {
      existing.items.push(item)
      if (item.created_at < existing.earliestCreatedAt) {
        existing.earliestCreatedAt = item.created_at
      }
    } else {
      map.set(item.order_id, {
        orderId: item.order_id,
        tableName: item.pos_orders.table_name,
        section: item.pos_orders.section,
        covers: item.pos_orders.covers,
        items: [item],
        earliestCreatedAt: item.created_at,
      })
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.earliestCreatedAt).getTime() - new Date(b.earliestCreatedAt).getTime()
  )
}

function LiveClock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="tabular-nums">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}

type ServedItem = KDSItem & { servedAt: number }

function playNewOrderChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const times = [0, 0.18, 0.36]
    for (const t of times) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = t === 0 ? 880 : t === 0.18 ? 1100 : 880
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.25, ctx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.25)
    }
  } catch {}
}

export function KDSClient({ initialItems }: Props) {
  const [items, setItems] = useState<KDSItem[]>(initialItems)
  const [servedItems, setServedItems] = useState<ServedItem[]>([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    const itemsChannel = supabase
      .channel('kds-order-items')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_order_items' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as KDSItem
            if (['pending', 'sent', 'making'].includes(newItem.status)) {
              // Fetch the related order info
              supabase
                .from('pos_order_items')
                .select('*, pos_orders!inner(table_name, section, covers, status)')
                .eq('id', newItem.id)
                .single()
                .then(({ data }) => {
                  if (data) {
                    setItems((prev) => {
                      if (prev.find((i) => i.id === data.id)) return prev
                      playNewOrderChime()
                      return [...prev, data as KDSItem]
                    })
                  }
                })
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as KDSItem
            if (['pending', 'sent', 'making'].includes(updated.status)) {
              setItems((prev) => {
                const exists = prev.find((i) => i.id === updated.id)
                if (exists) {
                  return prev.map((i) => i.id === updated.id ? { ...i, ...updated } : i)
                }
                // Item not in state yet (e.g. KDS opened after order was placed) — fetch with join and add
                supabase
                  .from('pos_order_items')
                  .select('*, pos_orders!inner(table_name, section, covers, status)')
                  .eq('id', updated.id)
                  .single()
                  .then(({ data }) => {
                    if (data) {
                      setItems((p) => p.find((i) => i.id === data.id) ? p : [...p, data as KDSItem])
                      playNewOrderChime()
                    }
                  })
                return prev
              })
            } else {
              // served or voided — remove from view
              setItems((prev) => prev.filter((i) => i.id !== updated.id))
            }
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((i) => i.id !== (payload.old as KDSItem).id))
          }
        }
      )
      .subscribe()

    const ordersChannel = supabase
      .channel('kds-orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pos_orders' },
        (payload) => {
          const updated = payload.new as { id: string; status: string }
          if (['closed', 'voided', 'cancelled'].includes(updated.status)) {
            setItems((prev) => prev.filter((i) => i.order_id !== updated.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(itemsChannel)
      supabase.removeChannel(ordersChannel)
    }
  }, [])

  // Auto-clear served items after 60 seconds
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - 60_000
      setServedItems(prev => prev.filter(i => i.servedAt > cutoff))
    }, 5_000)
    return () => clearInterval(id)
  }, [])

  async function handleBump(itemId: string, newStatus: 'making' | 'served') {
    const supabase = createClient()
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'making') updates.made_at = new Date().toISOString()
    if (newStatus === 'served') updates.served_at = new Date().toISOString()

    await supabase.from('pos_order_items').update(updates).eq('id', itemId)

    if (newStatus === 'served') {
      const item = items.find(i => i.id === itemId)
      if (item) setServedItems(prev => [...prev, { ...item, status: 'served', servedAt: Date.now() }])
      setItems((prev) => prev.filter((i) => i.id !== itemId))
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, status: newStatus } : i))
      )
    }
  }

  const pendingItems = items.filter((i) => i.status === 'pending')
  const makingItems = items.filter((i) => i.status === 'sent' || i.status === 'making')
  const servedGroups = groupByOrder(servedItems)

  const pendingGroups = groupByOrder(pendingItems)
  const makingGroups = groupByOrder(makingItems)

  return (
    <div className="fixed inset-0 lg:left-56 z-20 bg-[#08080A] text-[#F0EEF6] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#2A2A30] bg-[#0E0E11] shrink-0">
        <div className="flex items-center gap-3">
          <Flame size={20} className="text-[#8B5CF6]" />
          <span className="font-semibold text-lg tracking-tight">Bar Display</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 font-medium text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              {pendingItems.length} New
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 font-medium text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {makingItems.length} Making
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[#9896A4]">
            <Clock size={14} />
            <LiveClock />
          </div>
        </div>
      </header>

      {/* Columns */}
      <div className="flex-1 grid grid-cols-3 gap-0 overflow-hidden">
        {/* Column 1: New Orders */}
        <Column
          title="New Orders"
          accent="rose"
          count={pendingItems.length}
          empty="No new orders"
        >
          {pendingGroups.map((group) => (
            <OrderCard
              key={group.orderId}
              group={group}
              now={now}
              variant="start"
              onAction={(itemId) => handleBump(itemId, 'making')}
            />
          ))}
        </Column>

        {/* Column 2: In Progress */}
        <Column
          title="In Progress"
          accent="amber"
          count={makingItems.length}
          empty="Nothing cooking"
          borderLeft
        >
          {makingGroups.map((group) => (
            <OrderCard
              key={group.orderId}
              group={group}
              now={now}
              variant="done"
              onAction={(itemId) => handleBump(itemId, 'served')}
            />
          ))}
        </Column>

        {/* Column 3: Served */}
        <Column
          title="Served"
          accent="emerald"
          count={servedItems.length}
          empty="Served items appear here"
          borderLeft
        >
          {servedGroups.map((group) => (
            <OrderCard
              key={group.orderId}
              group={group}
              now={now}
              variant="served"
              onAction={() => {}}
            />
          ))}
        </Column>
      </div>
    </div>
  )
}

function Column({
  title,
  accent,
  count,
  empty,
  borderLeft,
  faded,
  children,
}: {
  title: string
  accent: 'rose' | 'amber' | 'emerald'
  count: number
  empty: string
  borderLeft?: boolean
  faded?: boolean
  children: React.ReactNode
}) {
  const accentMap = {
    rose: 'text-rose-400 border-rose-500/30',
    amber: 'text-amber-400 border-amber-500/30',
    emerald: 'text-emerald-400 border-emerald-500/30',
  }
  const items = Array.isArray(children) ? children : []
  const hasItems = items.length > 0

  return (
    <div
      className={[
        'flex flex-col bg-[#0E0E11] overflow-hidden',
        borderLeft ? 'border-l border-[#2A2A30]' : '',
        faded ? 'opacity-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Column header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-[#2A2A30]`}>
        <span className={`font-semibold text-sm ${accentMap[accent].split(' ')[0]}`}>
          {title}
        </span>
        {count > 0 && (
          <span
            className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full border ${accentMap[accent]}`}
          >
            {count}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {hasItems ? children : (
          <div className="flex flex-col items-center justify-center h-32 text-[#9896A4] text-sm gap-2">
            <ChevronRight size={20} className="opacity-30" />
            <span>{empty}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function OrderCard({
  group,
  now,
  variant,
  onAction,
}: {
  group: OrderGroup
  now: number
  variant: 'start' | 'done' | 'served'
  onAction: (itemId: string) => void
}) {
  const elapsed = getElapsedSeconds(group.earliestCreatedAt, now)
  const timeColor = elapsedColor(elapsed)
  const tableLabel = [group.tableName, group.section].filter(Boolean).join(' · ') || 'Unknown Table'

  return (
    <div className={[
      'border rounded-xl overflow-hidden',
      variant === 'served' ? 'bg-[#0E1210] border-emerald-900/40' : 'bg-[#141417] border-[#2A2A30]'
    ].join(' ')}>
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2A2A30] bg-[#17171B]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[#F0EEF6]">{tableLabel}</span>
          <span className="text-xs text-[#9896A4] bg-[#0E0E11] px-1.5 py-0.5 rounded-md">
            {group.covers} covers
          </span>
        </div>
        <span className={`text-xs font-mono font-bold ${variant === 'served' ? 'text-emerald-400' : timeColor}`}>
          {variant === 'served' ? '✓ served' : formatElapsed(elapsed)}
        </span>
      </div>

      {/* Items with inline action */}
      <div className="divide-y divide-[#2A2A30]/50">
        {group.items.map((item) => (
          <div key={item.id} className="px-3 py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#F0EEF6] text-sm leading-tight">
                  {item.item_name}
                </span>
                <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#8B5CF6]/20 text-[#A78BFA] text-xs font-bold">
                  {item.quantity}
                </span>
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <p className="mt-0.5 text-xs italic text-[#9896A4]">{item.modifiers.join(', ')}</p>
              )}
              {item.notes && (
                <p className="mt-1 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
                  {item.notes}
                </p>
              )}
            </div>

            {/* Inline action button */}
            {variant !== 'served' && (
              <button
                onClick={() => onAction(item.id)}
                title={variant === 'start' ? 'Start making' : 'Mark as done'}
                className={[
                  'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90',
                  variant === 'start'
                    ? 'bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/40 text-[#A78BFA] border border-[#8B5CF6]/30'
                    : 'bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/25',
                ].join(' ')}
              >
                {variant === 'done' ? <Check size={15} /> : <Flame size={15} />}
              </button>
            )}
            {variant === 'served' && (
              <Check size={15} className="shrink-0 text-emerald-400" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
