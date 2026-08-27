'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Clock, ChevronRight, ChevronDown, WifiOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

type PosTable = {
  id: string
  name: string
  section: string
  capacity: number
  pos_x: number
  pos_y: number
  shape: string
  is_active: boolean
  sort_order: number
  current_order_id: string | null
}

type OpenOrder = {
  id: string
  table_id: string | null
  covers: number
  opened_at: string
  server_name: string | null
  guest_name: string | null
  total: number
  status: string
}

type ConfigMap = Record<string, string>

interface Props {
  initialTables: PosTable[]
  openOrders: OpenOrder[]
  userId: string
  userName: string
  isAdmin: boolean
  config: ConfigMap
  staffList: string[]
}

const statusStyles = {
  available: {
    card: 'bg-emerald-500/10 border-emerald-500/20',
    badge: 'bg-emerald-500/20 text-emerald-400',
    dot: 'bg-emerald-400',
    label: 'Available',
  },
  occupied: {
    card: 'bg-amber-500/10 border-amber-500/20',
    badge: 'bg-amber-500/20 text-amber-400',
    dot: 'bg-amber-400',
    label: 'Occupied',
  },
  reserved: {
    card: 'bg-[#8B5CF6]/10 border-[#8B5CF6]/20',
    badge: 'bg-[#8B5CF6]/20 text-[#A78BFA]',
    dot: 'bg-[#A78BFA]',
    label: 'Reserved',
  },
}

function getElapsed(openedAt: string): string {
  const diff = Math.floor((Date.now() - new Date(openedAt).getTime()) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function FloorPlanClient({
  initialTables,
  openOrders,
  userId,
  userName,
  isAdmin,
  config,
  staffList,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [tables, setTables] = useState<PosTable[]>(initialTables)
  const [orders, setOrders] = useState<OpenOrder[]>(openOrders)
  const [activeSection, setActiveSection] = useState<string>(() => {
    const sections = [...new Set(initialTables.map(t => t.section))]
    return sections[0] ?? ''
  })
  const [newOrderModal, setNewOrderModal] = useState<{ open: boolean; table: PosTable | null }>({
    open: false,
    table: null,
  })
  const [covers, setCovers] = useState(2)
  const [guestName, setGuestName] = useState('')
  const [loading, setLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [serverSwitchOpen, setServerSwitchOpen] = useState(false)
  const [, setTick] = useState(0)

  // Active server: persisted per-device so staff just tap their name when they pick up the iPad
  const [activeServer, setActiveServer] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pos_active_server') ?? userName
    }
    return userName
  })

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    update()
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  // Re-render elapsed times every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!serverSwitchOpen) return
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-server-switcher]')) setServerSwitchOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [serverSwitchOpen])

  function switchServer(name: string) {
    setActiveServer(name)
    localStorage.setItem('pos_active_server', name)
    setServerSwitchOpen(false)
  }

  const sections = [...new Set(tables.map(t => t.section))]

  // Keep activeSection valid when sections change
  useEffect(() => {
    if (sections.length > 0 && !sections.includes(activeSection)) {
      setActiveSection(sections[0])
    }
  }, [sections.join(',')])

  function getTableOrder(tableId: string): OpenOrder | undefined {
    return orders.find(o => o.table_id === tableId)
  }

  function getTableStatus(table: PosTable): 'available' | 'occupied' | 'reserved' {
    if (table.current_order_id) return 'occupied'
    return 'available'
  }

  function handleOpenOrder(table: PosTable) {
    setCovers(2)
    setGuestName('')
    setNewOrderModal({ open: true, table })
  }

  async function handleCreateOrder() {
    setLoading(true)
    try {
      const res = await fetch('/api/pos/open-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: newOrderModal.table?.id ?? null,
          tableName: newOrderModal.table?.name ?? null,
          section: newOrderModal.table?.section ?? null,
          covers,
          guestName: guestName.trim() || null,
          serverName: activeServer,
          userId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to open order')
      setNewOrderModal({ open: false, table: null })
      router.push(`/pos/order/${data.orderId}`)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const supabase = createClient()

    const tableChannel = supabase
      .channel('pos_tables_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_tables' },
        payload => {
          if (payload.eventType === 'UPDATE') {
            setTables(prev =>
              prev.map(t => (t.id === (payload.new as PosTable).id ? (payload.new as PosTable) : t))
            )
          } else if (payload.eventType === 'INSERT') {
            setTables(prev => [...prev, payload.new as PosTable])
          } else if (payload.eventType === 'DELETE') {
            setTables(prev => prev.filter(t => t.id !== (payload.old as PosTable).id))
          }
        }
      )
      .subscribe()

    const orderChannel = supabase
      .channel('pos_orders_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_orders' },
        payload => {
          if (payload.eventType === 'INSERT') {
            const o = payload.new as OpenOrder
            if (o.status === 'open') setOrders(prev => [...prev, o])
          } else if (payload.eventType === 'UPDATE') {
            const o = payload.new as OpenOrder
            setOrders(prev => {
              const filtered = prev.filter(x => x.id !== o.id)
              return o.status === 'open' ? [...filtered, o] : filtered
            })
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(x => x.id !== (payload.old as OpenOrder).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(tableChannel)
      supabase.removeChannel(orderChannel)
    }
  }, [])

  const sectionTables = tables.filter(t => t.section === activeSection)
  const totalTables = sectionTables.length
  const occupiedCount = sectionTables.filter(t => getTableStatus(t) === 'occupied').length
  const allOpenCount = tables.filter(t => getTableStatus(t) === 'occupied').length

  return (
    <div className="min-h-screen bg-[#0D0D0F] p-4 sm:p-6">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <WifiOff size={15} />
          <span className="font-medium">You're offline.</span>
          <span className="text-amber-300/70">Orders cannot be opened until connection is restored.</span>
        </div>
      )}

      {/* Open tables warning banner */}
      {allOpenCount > 0 && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <Clock size={15} className="shrink-0" />
          <span className="font-medium">{allOpenCount} table{allOpenCount > 1 ? 's' : ''} still open.</span>
          <span className="text-red-300/70">Close all tables before ending the shift.</span>
        </div>
      )}

      <TopBar
        title="Floor Plan"
        subtitle={`${occupiedCount} of ${totalTables} tables occupied`}
        actions={
          <div className="flex items-center gap-2">
            {/* Active server switcher */}
            <div className="relative" data-server-switcher>
              <button
                onClick={() => setServerSwitchOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1E] border border-[#2A2A30] text-sm text-[#F0EEF6] hover:border-[#8B5CF6]/50 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="max-w-[100px] truncate">{activeServer}</span>
                <ChevronDown size={13} className="text-[#9896A4]" />
              </button>
              {serverSwitchOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl bg-[#1A1A1E] border border-[#2A2A30] shadow-xl overflow-hidden">
                  <p className="px-3 py-2 text-[#5A5865] text-xs uppercase tracking-wider">Switch server</p>
                  {staffList.map(name => (
                    <button
                      key={name}
                      onClick={() => switchServer(name)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        name === activeServer
                          ? 'text-[#A78BFA] bg-[#8B5CF6]/10'
                          : 'text-[#F0EEF6] hover:bg-[#2A2A30]'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => { setCovers(2); setNewOrderModal({ open: true, table: null }) }}
              disabled={!isOnline}
              className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={15} />
              Walk-in
            </button>
          </div>
        }
      />

      {/* Section Tabs */}
      {sections.length > 1 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {sections.map(section => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                activeSection === section
                  ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/40 text-[#A78BFA]'
                  : 'bg-[#141417] border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:border-[#3A3A42]'
              }`}
            >
              {section}
            </button>
          ))}
        </div>
      )}

      {/* Stats Row */}
      <div className="flex gap-3 mb-5 overflow-x-auto pb-1">
        {(['available', 'occupied'] as const).map(status => {
          const count = sectionTables.filter(t => getTableStatus(t) === status).length
          const s = statusStyles[status]
          return (
            <div
              key={status}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap ${s.card}`}
            >
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className={s.badge.split(' ')[1]}>{count} {s.label}</span>
            </div>
          )
        })}
      </div>

      {/* Table Grid */}
      {sectionTables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#5A5865]">
          <p className="text-sm">No tables in this section.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {sectionTables.map(table => {
            const status = getTableStatus(table)
            const order = status === 'occupied' ? getTableOrder(table.id) : undefined
            const s = statusStyles[status]
            return (
              <button
                key={table.id}
                onClick={() => {
                  if (status === 'occupied' && table.current_order_id) {
                    router.push(`/pos/order/${table.current_order_id}`)
                  } else if (status === 'available' && isOnline) {
                    handleOpenOrder(table)
                  } else if (status === 'available' && !isOnline) {
                    toast('Cannot open orders while offline', 'error')
                  }
                }}
                className={`relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all hover:brightness-110 active:scale-95 ${s.card} ${status === 'available' && !isOnline ? 'opacity-50' : ''}`}
              >
                {/* Table name */}
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[#F0EEF6] font-semibold text-sm leading-tight">{table.name}</span>
                  {status === 'occupied' && (
                    <ChevronRight size={14} className="text-[#9896A4] shrink-0 mt-0.5" />
                  )}
                </div>

                {/* Status badge */}
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${s.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>

                {/* Order details */}
                {order && (
                  <div className="flex flex-col gap-1 mt-1">
                    {order.guest_name && (
                      <p className="text-[#F0EEF6] text-xs font-medium truncate">{order.guest_name}</p>
                    )}
                    {order.covers > 0 && (
                      <div className="flex items-center gap-1 text-[#9896A4] text-xs">
                        <Users size={11} />
                        <span>{order.covers} covers</span>
                      </div>
                    )}
                    {order.server_name && (
                      <p className="text-[#9896A4] text-xs truncate">{order.server_name}</p>
                    )}
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="flex items-center gap-1 text-[#9896A4] text-xs">
                        <Clock size={11} />
                        <span>{getElapsed(order.opened_at)}</span>
                      </div>
                      {order.total > 0 && (
                        <span className="text-[#F0EEF6] text-xs font-medium">
                          RM {order.total.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Capacity (available only) */}
                {status === 'available' && (
                  <div className="flex items-center gap-1 text-[#5A5865] text-xs mt-auto">
                    <Users size={11} />
                    <span>Up to {table.capacity}</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* New Order Modal */}
      <Modal
        isOpen={newOrderModal.open}
        onClose={() => setNewOrderModal({ open: false, table: null })}
        title={newOrderModal.table ? `Open Order — ${newOrderModal.table.name}` : 'Walk-in Order'}
        size="sm"
      >
        <div className="flex flex-col gap-5">
          {newOrderModal.table && (
            <div className="flex items-center gap-2 text-sm text-[#9896A4]">
              <span>Section:</span>
              <span className="text-[#F0EEF6]">{newOrderModal.table.section}</span>
              <span className="ml-auto flex items-center gap-1">
                <Users size={13} />
                Capacity {newOrderModal.table.capacity}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#9896A4] mb-2">Guest Name <span className="text-[#5A5865] normal-case font-normal">(optional)</span></label>
            <input
              type="text"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="e.g. Ahmad, Table Reservation..."
              className="w-full bg-[#141417] border border-[#2A2A30] rounded-lg px-3 py-2.5 text-sm text-[#F0EEF6] placeholder:text-[#5A5865] focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9896A4] mb-2">Covers</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCovers(c => Math.max(1, c - 1))}
                className="w-9 h-9 rounded-lg bg-[#1A1A1E] border border-[#2A2A30] text-[#F0EEF6] text-lg font-bold flex items-center justify-center hover:border-[#8B5CF6] transition-colors"
              >
                −
              </button>
              <span className="text-[#F0EEF6] font-semibold text-xl w-8 text-center">{covers}</span>
              <button
                type="button"
                onClick={() => setCovers(c => c + 1)}
                className="w-9 h-9 rounded-lg bg-[#1A1A1E] border border-[#2A2A30] text-[#F0EEF6] text-lg font-bold flex items-center justify-center hover:border-[#8B5CF6] transition-colors"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setNewOrderModal({ open: false, table: null })}
              className="flex-1 px-4 py-2 rounded-lg bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] text-sm hover:text-[#F0EEF6] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={loading}
              className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm py-2 disabled:opacity-60"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Plus size={15} />
              )}
              Open Order
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
