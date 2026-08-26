'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import {
  Plus, Minus, Trash2, Send, CreditCard, Search,
  ChevronLeft, UtensilsCrossed, Clock, Users, User, ArrowRightLeft, UserRound, WifiOff,
  Printer, Mail, Wand2,
} from 'lucide-react'
import { ReceiptPrint, ReceiptData } from './ReceiptPrint'

type PosOrder = {
  id: string; table_id: string | null; table_name: string | null; section: string | null
  server_name: string | null; covers: number; status: string
  subtotal: number; discount_amount: number; service_charge: number
  tax_amount: number; total: number; notes: string | null; opened_at: string
  customer_name: string | null
}

type PosTable = { id: string; name: string; section: string; capacity: number; current_order_id: string | null }

type OrderItem = {
  id: string; order_id: string; item_type: string; item_id: string | null
  item_name: string; category: string | null; quantity: number
  unit_price: number; unit_cost: number; discount: number
  modifiers: string[] | null; notes: string | null; status: string
  voided_at: string | null
}

type Cocktail = { id: string; name: string; selling_price: number; total_cost: number }
type MenuItem = { id: string; name: string; category: string; price: number; is_active: boolean; sort_order: number; stock_qty: number | null }

interface Props {
  order: PosOrder
  initialItems: OrderItem[]
  cocktails: Cocktail[]
  menuItems: MenuItem[]
  allTables: PosTable[]
  userId: string
  userName: string
  isAdmin: boolean
  canCreateCustomItem: boolean
  canCancelOrder: boolean
  config: Record<string, string>
}

const MENU_CATEGORIES = ['All', 'Cocktails', 'Classics', 'Beer', 'Wine', 'Spirits', 'Food', 'Others']

function formatTime(isoString: string) {
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatCurrency(amount: number) {
  return 'RM ' + amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CUSTOM_CATEGORIES = ['cocktail', 'beer', 'wine', 'food', 'others']

export function OrderTicketClient({
  order, initialItems, cocktails, menuItems, allTables, userId, userName, isAdmin, canCreateCustomItem, canCancelOrder, config
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])

  const [items, setItems] = useState<OrderItem[]>(initialItems)
  const [menuCategory, setMenuCategory] = useState('Cocktails')
  const [search, setSearch] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentOrder, setCurrentOrder] = useState(order)

  const [noteModal, setNoteModal] = useState<{ open: boolean; itemId: string | null; text: string }>({
    open: false, itemId: null, text: ''
  })
  const [voidModal, setVoidModal] = useState<{ open: boolean; itemId: string | null; reason: string; itemStatus: string }>({
    open: false, itemId: null, reason: '', itemStatus: 'pending'
  })
  const [voidPin, setVoidPin] = useState('')
  const [moveModal, setMoveModal] = useState(false)
  const [moveTarget, setMoveTarget] = useState<PosTable | null>(null)
  const [guestModal, setGuestModal] = useState(false)
  const [guestName, setGuestName] = useState(order.customer_name ?? '')
  const [cancelModal, setCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelPin, setCancelPin] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [isPaying, setIsPaying] = useState(false)
  const [showBillPreview, setShowBillPreview] = useState(false)
  const [emailModal, setEmailModal] = useState(false)
  const [emailAddress, setEmailAddress] = useState('')
  const [emailSending, setEmailSending] = useState(false)

  const [customModal, setCustomModal] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customCategory, setCustomCategory] = useState('cocktail')
  const [customQty, setCustomQty] = useState('1')
  const [customLoading, setCustomLoading] = useState(false)

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    update()
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  const activeItems = items.filter(i => !i.voided_at)
  const subtotal = activeItems.reduce((sum, i) => sum + i.quantity * i.unit_price - (i.discount ?? 0), 0)

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`order-items-${order.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_order_items', filter: `order_id=eq.${order.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Skip if optimistic update already added it
            setItems(prev => {
              if (prev.find(i => i.id === (payload.new as OrderItem).id)) return prev
              return [...prev, payload.new as OrderItem]
            })
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(i => i.id === (payload.new as OrderItem).id ? payload.new as OrderItem : i))
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== (payload.old as OrderItem).id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [order.id])

  const addItem = useCallback(async (item: Cocktail | MenuItem, type: 'cocktail' | 'menu_item', category: string) => {
    if (currentOrder.status !== 'open') {
      toast('Order is no longer open', 'error')
      return
    }

    const unitPrice = type === 'cocktail' ? (item as Cocktail).selling_price : (item as MenuItem).price
    const unitCost = type === 'cocktail' ? (item as Cocktail).total_cost : 0

    const existing = activeItems.find(i => i.item_id === item.id && i.item_type === type)
    if (existing) {
      // Optimistic update using functional form to avoid stale closure
      setItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i))
      const newQty = existing.quantity + 1
      const { error } = await supabase
        .from('pos_order_items')
        .update({ quantity: newQty })
        .eq('id', existing.id)
      if (error) {
        setItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: existing.quantity } : i))
        toast(error.message, 'error')
      }
      return
    }

    const { data, error } = await supabase.from('pos_order_items').insert({
      order_id: order.id,
      item_type: type,
      item_id: item.id,
      item_name: item.name,
      category,
      quantity: 1,
      unit_price: unitPrice,
      unit_cost: unitCost,
      discount: 0,
      status: 'pending',
      added_by: userId,
    }).select().single()
    if (error) {
      toast(error.message, 'error')
    } else if (data) {
      // Realtime INSERT may have already added this item — skip if so
      setItems(prev => prev.find(i => i.id === (data as OrderItem).id) ? prev : [...prev, data as OrderItem])
    }
  }, [activeItems, order.id, userId, supabase, toast])

  const addCustomItem = async () => {
    const price = parseFloat(customPrice)
    const qty = parseInt(customQty) || 1
    if (!customName.trim()) { toast('Item name is required', 'error'); return }
    if (isNaN(price) || price <= 0) { toast('Price must be greater than 0', 'error'); return }
    setCustomLoading(true)
    const { data, error } = await supabase.from('pos_order_items').insert({
      order_id: order.id,
      item_type: 'custom',
      item_id: null,
      item_name: customName.trim(),
      category: customCategory,
      quantity: qty,
      unit_price: price,
      unit_cost: 0,
      discount: 0,
      status: 'pending',
      added_by: userId,
    }).select().single()
    if (error) {
      toast(error.message, 'error')
    } else if (data) {
      setItems(prev => prev.find(i => i.id === (data as OrderItem).id) ? prev : [...prev, data as OrderItem])
      await supabase.from('pos_audit_log').insert({
        actor_id: userId,
        event: 'order.custom_item_added',
        entity_type: 'pos_orders',
        entity_id: order.id,
        payload: { item_name: customName.trim(), price, qty, category: customCategory, added_by: userName },
      })
      toast(`Added: ${customName.trim()}`, 'success')
      setCustomModal(false)
      setCustomName(''); setCustomPrice(''); setCustomQty('1'); setCustomCategory('cocktail')
    }
    setCustomLoading(false)
  }

  const updateQty = useCallback(async (itemId: string, delta: number) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return
    const newQty = item.quantity + delta
    if (newQty <= 0) {
      const itemStatus = items.find(i => i.id === itemId)?.status ?? 'pending'
      setVoidModal({ open: true, itemId, reason: '', itemStatus })
      return
    }
    // Optimistic update
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: newQty } : i))
    const { error } = await supabase
      .from('pos_order_items')
      .update({ quantity: newQty })
      .eq('id', itemId)
    if (error) {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: item.quantity } : i))
      toast(error.message, 'error')
    }
  }, [items, supabase, toast])

  const handleVoid = useCallback(async () => {
    const { itemId, reason, itemStatus } = voidModal
    if (!itemId) return
    if (!isAdmin && !reason.trim()) {
      toast('A reason is required to void items', 'error')
      return
    }
    const needsPin = !isAdmin && itemStatus !== 'pending'
    if (needsPin && voidPin.length < 4) {
      toast('Enter your manager PIN to void sent items', 'error')
      return
    }
    setLoading(true)
    const res = await fetch('/api/pos/void-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, reason, managerPin: needsPin ? voidPin : undefined }),
    })
    setLoading(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      toast(err.error ?? 'Failed to void item', 'error')
    } else {
      const voidedAt = new Date().toISOString()
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, voided_at: voidedAt } : i))
      toast('Item voided', 'info')
      setVoidModal({ open: false, itemId: null, reason: '', itemStatus: 'pending' })
      setVoidPin('')
    }
  }, [voidModal, voidPin, isAdmin, userId, supabase, toast])

  const handleSendToKDS = useCallback(async () => {
    const pendingIds = activeItems.filter(i => i.status === 'pending').map(i => i.id)
    if (pendingIds.length === 0) {
      toast('No pending items to send', 'info')
      return
    }
    setLoading(true)
    const { error } = await supabase
      .from('pos_order_items')
      .update({ status: 'sent', kds_sent_at: new Date().toISOString() })
      .in('id', pendingIds)
    setLoading(false)
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Sent to bar', 'success')
    }
  }, [activeItems, supabase, toast])

  const handleMoveTable = useCallback(async () => {
    if (!moveTarget) return
    setLoading(true)
    const { error } = await supabase.from('pos_orders').update({
      table_id: moveTarget.id,
      table_name: moveTarget.name,
      section: moveTarget.section,
    }).eq('id', currentOrder.id)
    if (error) { toast(error.message, 'error'); setLoading(false); return }
    // Clear old table
    if (currentOrder.table_id) {
      await supabase.from('pos_tables').update({ current_order_id: null }).eq('id', currentOrder.table_id)
    }
    // Set new table
    await supabase.from('pos_tables').update({ current_order_id: currentOrder.id }).eq('id', moveTarget.id)
    setCurrentOrder(o => ({ ...o, table_id: moveTarget.id, table_name: moveTarget.name, section: moveTarget.section }))
    setMoveModal(false)
    setMoveTarget(null)
    setLoading(false)
    toast(`Moved to ${moveTarget.name}`, 'success')
  }, [moveTarget, currentOrder, supabase, toast])

  const handleSaveGuest = useCallback(async () => {
    const { error } = await supabase.from('pos_orders').update({ customer_name: guestName.trim() || null }).eq('id', currentOrder.id)
    if (error) { toast(error.message, 'error'); return }
    setCurrentOrder(o => ({ ...o, customer_name: guestName.trim() || null }))
    setGuestModal(false)
    toast('Guest name saved', 'success')
  }, [guestName, currentOrder.id, supabase, toast])

  const handleCancelOrder = useCallback(async () => {
    if (!cancelReason.trim()) {
      toast('A reason is required to cancel an order', 'error')
      return
    }
    const needsPin = !isAdmin && !canCancelOrder
    if (needsPin && cancelPin.length < 4) {
      toast('Enter your manager PIN', 'error')
      return
    }
    setLoading(true)
    const res = await fetch('/api/pos/cancel-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: currentOrder.id, reason: cancelReason, managerPin: needsPin ? cancelPin : undefined }),
    })
    setLoading(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      toast(err.error ?? 'Failed to cancel order', 'error')
    } else {
      setCancelModal(false)
      router.push('/pos')
    }
  }, [cancelReason, cancelPin, isAdmin, canCancelOrder, currentOrder.id, router, toast])

  const handleSaveNote = useCallback(async () => {
    if (!noteModal.itemId) return
    const { error } = await supabase
      .from('pos_order_items')
      .update({ notes: noteModal.text })
      .eq('id', noteModal.itemId)
    if (error) {
      toast(error.message, 'error')
    } else {
      setNoteModal({ open: false, itemId: null, text: '' })
    }
  }, [noteModal, supabase, toast])

  // Menu items for current category
  const getMenuDisplay = (): Array<{ id: string; name: string; price: number; type: 'cocktail' | 'menu_item'; category: string }> => {
    let results: Array<{ id: string; name: string; price: number; type: 'cocktail' | 'menu_item'; category: string }> = []

    if (menuCategory === 'All') {
      results = [
        ...cocktails.map(c => ({ id: c.id, name: c.name, price: c.selling_price, type: 'cocktail' as const, category: 'house_cocktail' })),
        ...menuItems.map(m => ({ id: m.id, name: m.name, price: m.price, type: 'menu_item' as const, category: m.category })),
      ]
    } else if (menuCategory === 'Cocktails') {
      results = cocktails.map(c => ({ id: c.id, name: c.name, price: c.selling_price, type: 'cocktail' as const, category: 'house_cocktail' }))
    } else {
      const catMap: Record<string, string[]> = {
        Classics: ['classic'],
        Beer: ['beer'],
        Wine: ['wine'],
        Spirits: ['spirits', 'spirit', 'whisky'],
        Food: ['food'],
        Others: ['other', 'others', 'misc', 'na', 'soft drink', 'water'],
      }
      const cats = catMap[menuCategory] ?? [menuCategory.toLowerCase()]
      results = menuItems
        .filter(m => cats.some(c => m.category.toLowerCase().includes(c)))
        .map(m => ({ id: m.id, name: m.name, price: m.price, type: 'menu_item' as const, category: m.category }))
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter(r => r.name.toLowerCase().includes(q))
    }

    return results
  }

  const menuDisplay = getMenuDisplay()

  const pendingCount = activeItems.filter(i => i.status === 'pending').length

  function buildCurrentReceiptData(isPreliminary = true): ReceiptData {
    const liveSubtotal = activeItems.reduce((s, i) => s + i.quantity * i.unit_price - (i.discount ?? 0), 0)
    const discount = currentOrder.discount_amount ?? 0
    const sc = currentOrder.service_charge ?? 0
    const tax = currentOrder.tax_amount ?? 0
    const total = liveSubtotal - discount + sc + tax
    return {
      orderId: currentOrder.id,
      tableName: currentOrder.table_name,
      serverName: currentOrder.server_name,
      covers: currentOrder.covers,
      openedAt: currentOrder.opened_at,
      closedAt: null,
      items: activeItems.map(i => ({
        id: i.id,
        item_name: i.item_name,
        category: i.category,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
        voided_at: i.voided_at,
      })),
      subtotal: liveSubtotal,
      discountAmount: discount,
      discountLabel: null,
      serviceCharge: sc,
      taxAmount: tax,
      total,
      payments: [],
      footerNote: config.receipt_footer ?? 'Thank you and Come Again!',
      isPreliminary,
    }
  }

  const handleEmailBill = async () => {
    if (!emailAddress.trim()) return
    setEmailSending(true)
    try {
      const res = await fetch('/api/pos/email-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddress.trim(), orderId: currentOrder.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to send')
      toast(`Bill sent to ${emailAddress.trim()}`, 'success')
      setEmailModal(false)
      setEmailAddress('')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to send email', 'error')
    } finally {
      setEmailSending(false)
    }
  }

  const MenuPanel = (
    <div className="flex flex-col h-full bg-[#0E0E11]">
      {/* Search */}
      <div className="p-3 border-b border-[#2A2A30] space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search menu..."
            className="w-full bg-[#141417] border border-[#2A2A30] rounded-lg pl-9 pr-3 py-2 text-sm text-[#F0EEF6] placeholder:text-[#5A5865] focus:outline-none focus:border-[#7B5EA7]"
          />
        </div>
        {canCreateCustomItem && (
          <button
            onClick={() => setCustomModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-[#7B5EA7]/50 text-[#A78BFA] text-xs font-medium hover:bg-[#7B5EA7]/10 transition-all"
          >
            <Wand2 size={13} /> Custom Item
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-[#2A2A30] overflow-x-auto scrollbar-none">
        {MENU_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setMenuCategory(cat)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
              menuCategory === cat
                ? 'bg-[#7B5EA7] text-white'
                : 'text-[#9896A4] hover:text-[#F0EEF6] hover:bg-[#1A1A1E]'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Item grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {menuDisplay.length === 0 ? (
          <div className="text-center py-12 text-[#5A5865] text-sm">No items found</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {menuDisplay.map(item => {
              const inOrder = activeItems.some(i => i.item_id === item.id)
              const menuItem = item.type === 'menu_item' ? menuItems.find(m => m.id === item.id) : null
              const stockQty = menuItem?.stock_qty ?? null
              const soldOut = stockQty !== null && stockQty <= 0
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => addItem(
                    item.type === 'cocktail'
                      ? cocktails.find(c => c.id === item.id)!
                      : menuItems.find(m => m.id === item.id)!,
                    item.type,
                    item.category
                  )}
                  className={cn(
                    'relative flex flex-col items-start p-3 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98]',
                    inOrder
                      ? 'bg-[#1A1230] border-[#7B5EA7]/60'
                      : soldOut
                      ? 'bg-[#141417] border-[#2A2A30] opacity-50'
                      : 'bg-[#141417] border-[#2A2A30] hover:border-[#3A3A44]'
                  )}
                >
                  {inOrder && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-[#7B5EA7] rounded-full" />
                  )}
                  <span className="text-[#F0EEF6] text-sm font-medium leading-snug line-clamp-2">{item.name}</span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[#9896A4] text-xs">{formatCurrency(item.price)}</span>
                    {stockQty !== null && (
                      <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
                        stockQty === 0
                          ? 'bg-rose-900/60 text-rose-400'
                          : stockQty <= 3
                          ? 'bg-amber-900/60 text-amber-400'
                          : 'bg-[#1A1A1E] text-[#9896A4]'
                      )}>
                        {stockQty === 0 ? 'sold out' : `${stockQty} left`}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  const TicketPanel = (
    <div className="flex flex-col h-full bg-[#0A0A0D]">
      {/* Order header */}
      <div className="p-4 border-b border-[#2A2A30]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-[#F0EEF6] font-bold text-lg">{currentOrder.table_name ?? 'Walk-in'}</h2>
            {currentOrder.section && <span className="text-[#5A5865] text-xs">{currentOrder.section}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium',
              currentOrder.status === 'open' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
              'bg-[#1A1A1E] text-[#9896A4] border border-[#2A2A30]'
            )}>
              {currentOrder.status}
            </span>
            {currentOrder.status === 'open' && (
              <button
                onClick={() => { setCancelReason(''); setCancelPin(''); setCancelModal(true) }}
                disabled={loading}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-950 text-rose-400 border border-rose-800 hover:bg-rose-900 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Quick actions row */}
        {currentOrder.status === 'open' && (
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setMoveModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:border-[#3A3A42] transition-colors"
            >
              <ArrowRightLeft size={11} />
              Move Table
            </button>
            <button
              onClick={() => { setGuestName(currentOrder.customer_name ?? ''); setGuestModal(true) }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:border-[#3A3A42] transition-colors"
            >
              <UserRound size={11} />
              {currentOrder.customer_name ? currentOrder.customer_name : 'Add Guest'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-[#9896A4]">
            <User size={11} />
            <span className="truncate">{currentOrder.server_name ?? userName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#9896A4]">
            <Users size={11} />
            <span>{currentOrder.covers} covers</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#9896A4]">
            <Clock size={11} />
            <span>{formatTime(currentOrder.opened_at)}</span>
          </div>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {activeItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#5A5865] gap-2 py-8">
            <UtensilsCrossed size={32} strokeWidth={1.5} />
            <span className="text-sm">No items yet</span>
            <span className="text-xs">Add items from the menu</span>
          </div>
        ) : (
          <div className="divide-y divide-[#1A1A1E]">
            {activeItems.map(item => (
              <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[#F0EEF6] text-sm font-medium truncate">{item.item_name}</span>
                    {item.status === 'sent' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 shrink-0">sent</span>
                    )}
                    {item.status === 'pending' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 shrink-0">pending</span>
                    )}
                  </div>
                  {item.notes && (
                    <p className="text-[#5A5865] text-xs mt-0.5 truncate">{item.notes}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[#9896A4] text-xs">{formatCurrency(item.unit_price)} ea</span>
                    <span className="text-[#7B5EA7] text-xs font-medium">{formatCurrency(item.quantity * item.unit_price)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => updateQty(item.id, -1)}
                    className="w-7 h-7 rounded-lg bg-[#1A1A1E] border border-[#2A2A30] flex items-center justify-center text-[#9896A4] hover:text-[#F0EEF6] hover:bg-[#222228] transition-all"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-6 text-center text-[#F0EEF6] text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.id, 1)}
                    className="w-7 h-7 rounded-lg bg-[#1A1A1E] border border-[#2A2A30] flex items-center justify-center text-[#9896A4] hover:text-[#F0EEF6] hover:bg-[#222228] transition-all"
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    onClick={() => setVoidModal({ open: true, itemId: item.id, reason: '', itemStatus: item.status ?? 'pending' })}
                    className="w-7 h-7 rounded-lg bg-[#1A1A1E] border border-[#2A2A30] flex items-center justify-center text-[#9896A4] hover:text-rose-400 hover:bg-rose-950/40 hover:border-rose-800/40 transition-all ml-0.5"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Voided items (collapsed) */}
        {items.filter(i => i.voided_at).length > 0 && (
          <div className="px-4 py-2 border-t border-[#1A1A1E]">
            <p className="text-[#5A5865] text-xs">{items.filter(i => i.voided_at).length} voided item(s)</p>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-[#2A2A30] p-4 space-y-1.5">
        <div className="flex justify-between text-sm text-[#9896A4]">
          <span>Subtotal</span>
          <span className="text-[#F0EEF6] font-medium">{formatCurrency(subtotal)}</span>
        </div>
        {currentOrder.service_charge > 0 && (
          <div className="flex justify-between text-sm text-[#9896A4]">
            <span>Service charge</span>
            <span>{formatCurrency(currentOrder.service_charge)}</span>
          </div>
        )}
        {currentOrder.tax_amount > 0 && (
          <div className="flex justify-between text-sm text-[#9896A4]">
            <span>Tax</span>
            <span>{formatCurrency(currentOrder.tax_amount)}</span>
          </div>
        )}
        {currentOrder.discount_amount > 0 && (
          <div className="flex justify-between text-sm text-[#9896A4]">
            <span>Discount</span>
            <span className="text-rose-400">-{formatCurrency(currentOrder.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold text-[#F0EEF6] pt-1.5 border-t border-[#2A2A30]">
          <span>Total</span>
          <span className="text-[#7B5EA7]">{formatCurrency(subtotal + currentOrder.service_charge + currentOrder.tax_amount - currentOrder.discount_amount)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-4 pt-0 space-y-2">
        {/* Print Bill + Email Bill row */}
        {currentOrder.status === 'open' && activeItems.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowBillPreview(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:border-[#3A3A42] transition-colors"
            >
              <Printer size={12} />
              Print Bill
            </button>
            <button
              onClick={() => setEmailModal(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium bg-[#1A1A1E] border border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:border-[#3A3A42] transition-colors"
            >
              <Mail size={12} />
              Email Bill
            </button>
          </div>
        )}
        <button
          onClick={handleSendToKDS}
          disabled={loading || pendingCount === 0}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all',
            pendingCount > 0
              ? 'bg-[#1A1A1E] border border-[#3A3A44] text-[#F0EEF6] hover:bg-[#222228]'
              : 'bg-[#141417] border border-[#2A2A30] text-[#5A5865] cursor-not-allowed'
          )}
        >
          <Send size={14} />
          Send to Bar
          {pendingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">{pendingCount}</span>
          )}
        </button>
        {currentOrder.status === 'open' ? (
          <button
            onClick={() => { if (isPaying) return; setIsPaying(true); router.push(`/pos/payment/${order.id}`) }}
            disabled={isPaying}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-[#7B5EA7] text-white hover:bg-[#8B6EB7] transition-all disabled:opacity-60"
          >
            <CreditCard size={14} />
            Payment
          </button>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-[#1A1A1E] border border-[#2A2A30] text-[#5A5865] cursor-not-allowed">
            <CreditCard size={14} />
            Order {currentOrder.status}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 lg:left-56 z-20 flex flex-col bg-[#0A0A0D] overflow-hidden">
      {/* Offline banner */}
      {!isOnline && (
        <div className="mx-4 mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs shrink-0">
          <WifiOff size={13} />
          <span className="font-medium">Offline</span>
          <span className="text-amber-300/70">— changes will not save until connection is restored.</span>
        </div>
      )}

      {/* TopBar */}
      <div className="px-4 pt-4 shrink-0">
        <TopBar
          title={order.table_name ? `Table: ${order.table_name}` : 'Order'}
          subtitle={order.section ?? undefined}
          actions={
            <button
              onClick={() => router.push('/pos')}
              className="flex items-center gap-1.5 text-[#9896A4] hover:text-[#F0EEF6] text-sm transition-colors"
            >
              <ChevronLeft size={16} />
              Back
            </button>
          }
        />
      </div>

      {/* Desktop: two-panel layout */}
      <div className="hidden md:flex flex-1 min-h-0 px-4 pb-4 gap-4">
        <div className="w-2/3 rounded-2xl border border-[#2A2A30] overflow-hidden">
          {MenuPanel}
        </div>
        <div className="w-1/3 rounded-2xl border border-[#2A2A30] overflow-hidden">
          {TicketPanel}
        </div>
      </div>

      {/* Mobile: toggle between ticket and menu */}
      <div className="md:hidden flex flex-col flex-1 min-h-0 px-4 pb-4">
        {/* Toggle buttons */}
        <div className="flex gap-2 mb-3 shrink-0">
          <button
            onClick={() => setShowMenu(false)}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm font-medium transition-all',
              !showMenu ? 'bg-[#7B5EA7] text-white' : 'bg-[#141417] border border-[#2A2A30] text-[#9896A4]'
            )}
          >
            Ticket ({activeItems.length})
          </button>
          <button
            onClick={() => setShowMenu(true)}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm font-medium transition-all',
              showMenu ? 'bg-[#7B5EA7] text-white' : 'bg-[#141417] border border-[#2A2A30] text-[#9896A4]'
            )}
          >
            Menu
          </button>
        </div>
        <div className="flex-1 min-h-0 rounded-2xl border border-[#2A2A30] overflow-hidden">
          {showMenu ? MenuPanel : TicketPanel}
        </div>
      </div>

      {/* Void Modal */}
      <Modal
        isOpen={voidModal.open}
        onClose={() => { setVoidModal({ open: false, itemId: null, reason: '', itemStatus: 'pending' }); setVoidPin('') }}
        title="Void Item"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[#9896A4] text-sm">
            {isAdmin ? 'Enter an optional reason for voiding this item.' : 'A reason is required to void items.'}
          </p>
          <textarea
            value={voidModal.reason}
            onChange={e => setVoidModal(prev => ({ ...prev, reason: e.target.value }))}
            placeholder="Reason for void..."
            rows={3}
            className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] placeholder:text-[#5A5865] focus:outline-none focus:border-[#7B5EA7] resize-none"
          />
          {!isAdmin && voidModal.itemStatus !== 'pending' && (
            <div>
              <p className="text-amber-400 text-xs mb-2">This item has already been sent — a manager PIN is required.</p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={voidPin}
                onChange={e => setVoidPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Manager PIN"
                className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] placeholder:text-[#5A5865] focus:outline-none focus:border-[#7B5EA7] tracking-widest"
              />
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setVoidModal({ open: false, itemId: null, reason: '', itemStatus: 'pending' }); setVoidPin('') }}
              className="px-4 py-2 rounded-xl text-sm text-[#9896A4] hover:text-[#F0EEF6] border border-[#2A2A30] hover:bg-[#1A1A1E] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleVoid}
              disabled={loading || (!isAdmin && !voidModal.reason.trim())}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Void Item
            </button>
          </div>
        </div>
      </Modal>

      {/* Move Table Modal */}
      <Modal isOpen={moveModal} onClose={() => { setMoveModal(false); setMoveTarget(null) }} title="Move Table" size="sm">
        <div className="space-y-3">
          <p className="text-[#9896A4] text-sm">Select the table to move this order to.</p>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {allTables
              .filter(t => t.id !== currentOrder.table_id && !t.current_order_id)
              .map(t => (
                <button
                  key={t.id}
                  onClick={() => setMoveTarget(t)}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all',
                    moveTarget?.id === t.id
                      ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/50 text-[#A78BFA]'
                      : 'bg-[#141417] border-[#2A2A30] text-[#9896A4] hover:border-[#3A3A42] hover:text-[#F0EEF6]'
                  )}
                >
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs opacity-60">{t.section}</p>
                </button>
              ))}
          </div>
          {allTables.filter(t => t.id !== currentOrder.table_id && !t.current_order_id).length === 0 && (
            <p className="text-[#5A5865] text-sm text-center py-4">No available tables to move to.</p>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => { setMoveModal(false); setMoveTarget(null) }} className="px-4 py-2 rounded-xl text-sm text-[#9896A4] hover:text-[#F0EEF6] border border-[#2A2A30] hover:bg-[#1A1A1E] transition-all">Cancel</button>
            <button onClick={handleMoveTable} disabled={!moveTarget || loading} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#7B5EA7] text-white hover:bg-[#8B6EB7] disabled:opacity-40 transition-all">
              Move Order
            </button>
          </div>
        </div>
      </Modal>

      {/* Guest Name Modal */}
      <Modal isOpen={guestModal} onClose={() => setGuestModal(false)} title="Guest Name" size="sm">
        <div className="space-y-4">
          <input
            type="text"
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            placeholder="Enter guest name..."
            className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] placeholder:text-[#5A5865] focus:outline-none focus:border-[#7B5EA7]"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setGuestModal(false)} className="px-4 py-2 rounded-xl text-sm text-[#9896A4] hover:text-[#F0EEF6] border border-[#2A2A30] hover:bg-[#1A1A1E] transition-all">Cancel</button>
            <button onClick={handleSaveGuest} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#7B5EA7] text-white hover:bg-[#8B6EB7] transition-all">Save</button>
          </div>
        </div>
      </Modal>

      {/* Note Modal */}
      <Modal
        isOpen={noteModal.open}
        onClose={() => setNoteModal({ open: false, itemId: null, text: '' })}
        title="Item Note"
        size="sm"
      >
        <div className="space-y-4">
          <textarea
            value={noteModal.text}
            onChange={e => setNoteModal(prev => ({ ...prev, text: e.target.value }))}
            placeholder="Add a note for this item..."
            rows={3}
            className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] placeholder:text-[#5A5865] focus:outline-none focus:border-[#7B5EA7] resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setNoteModal({ open: false, itemId: null, text: '' })}
              className="px-4 py-2 rounded-xl text-sm text-[#9896A4] hover:text-[#F0EEF6] border border-[#2A2A30] hover:bg-[#1A1A1E] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNote}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-[#7B5EA7] text-white hover:bg-[#8B6EB7] transition-all"
            >
              Save Note
            </button>
          </div>
        </div>
      </Modal>

      {/* Bill Preview (print) */}
      {showBillPreview && (
        <ReceiptPrint
          data={buildCurrentReceiptData(true)}
          onClose={() => setShowBillPreview(false)}
        />
      )}

      {/* Email Bill Modal */}
      <Modal isOpen={emailModal} onClose={() => { setEmailModal(false); setEmailAddress('') }} title="Email Bill to Guest" size="sm">
        <div className="space-y-4">
          <p className="text-[#9896A4] text-sm">Enter the guest's email address to send them a copy of the current bill.</p>
          <input
            type="email"
            value={emailAddress}
            onChange={e => setEmailAddress(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleEmailBill() }}
            placeholder="guest@example.com"
            autoFocus
            className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] placeholder:text-[#5A5865] focus:outline-none focus:border-[#7B5EA7]"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setEmailModal(false); setEmailAddress('') }}
              className="px-4 py-2 rounded-xl text-sm text-[#9896A4] hover:text-[#F0EEF6] border border-[#2A2A30] hover:bg-[#1A1A1E] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleEmailBill}
              disabled={emailSending || !emailAddress.trim()}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-[#7B5EA7] text-white hover:bg-[#8B6EB7] disabled:opacity-40 transition-all"
            >
              {emailSending ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Order Modal */}
      <Modal isOpen={cancelModal} onClose={() => setCancelModal(false)} title="Cancel Order" size="sm">
        <div className="space-y-4">
          <p className="text-[#9896A4] text-sm">
            This will void all items and free the table. Every cancellation is permanently logged.
          </p>
          <div>
            <label className="text-[#9896A4] text-xs uppercase tracking-wider block mb-1.5">Reason <span className="text-rose-400">*</span></label>
            <input
              type="text"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="e.g. Customer left, wrong table opened…"
              className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] placeholder:text-[#5A5865] focus:outline-none focus:border-[#7B5EA7]"
            />
          </div>
          {!isAdmin && !canCancelOrder && (
            <div>
              <label className="text-[#9896A4] text-xs uppercase tracking-wider block mb-1.5">Manager PIN <span className="text-rose-400">*</span></label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={cancelPin}
                onChange={e => setCancelPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] placeholder:text-[#5A5865] focus:outline-none focus:border-[#7B5EA7] tracking-widest"
              />
            </div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => setCancelModal(false)}
              className="px-4 py-2 rounded-xl text-sm text-[#9896A4] hover:text-[#F0EEF6] border border-[#2A2A30] hover:bg-[#1A1A1E] transition-all"
            >
              Go Back
            </button>
            <button
              onClick={handleCancelOrder}
              disabled={loading || !cancelReason.trim()}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-rose-600 text-white hover:bg-rose-500 transition-all disabled:opacity-50"
            >
              {loading ? 'Cancelling…' : 'Cancel Order'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Custom Item Modal */}
      <Modal isOpen={customModal} onClose={() => { setCustomModal(false); setCustomName(''); setCustomPrice(''); setCustomQty('1'); setCustomCategory('cocktail') }} title="Custom Item" size="sm">
        <div className="space-y-4">
          <p className="text-[#9896A4] text-sm">Create a one-off item with a custom price. This will be logged for accountability.</p>
          <div>
            <label className="text-[#9896A4] text-xs uppercase tracking-wider block mb-1.5">Item Name <span className="text-rose-400">*</span></label>
            <input
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="e.g. Special Cocktail, Birthday Cake…"
              className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] placeholder:text-[#5A5865] focus:outline-none focus:border-[#7B5EA7]"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#9896A4] text-xs uppercase tracking-wider block mb-1.5">Price (RM) <span className="text-rose-400">*</span></label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={customPrice}
                onChange={e => setCustomPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] placeholder:text-[#5A5865] focus:outline-none focus:border-[#7B5EA7]"
              />
            </div>
            <div>
              <label className="text-[#9896A4] text-xs uppercase tracking-wider block mb-1.5">Qty</label>
              <input
                type="number"
                min="1"
                step="1"
                value={customQty}
                onChange={e => setCustomQty(e.target.value)}
                className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] focus:outline-none focus:border-[#7B5EA7]"
              />
            </div>
          </div>
          <div>
            <label className="text-[#9896A4] text-xs uppercase tracking-wider block mb-1.5">Category</label>
            <select
              value={customCategory}
              onChange={e => setCustomCategory(e.target.value)}
              className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] focus:outline-none focus:border-[#7B5EA7]"
            >
              {CUSTOM_CATEGORIES.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => { setCustomModal(false); setCustomName(''); setCustomPrice(''); setCustomQty('1'); setCustomCategory('cocktail') }}
              className="px-4 py-2 rounded-xl text-sm text-[#9896A4] hover:text-[#F0EEF6] border border-[#2A2A30] hover:bg-[#1A1A1E] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={addCustomItem}
              disabled={customLoading || !customName.trim() || !customPrice}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-[#7B5EA7] text-white hover:bg-[#8B6EB7] disabled:opacity-40 transition-all"
            >
              {customLoading ? 'Adding…' : 'Add Item'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
