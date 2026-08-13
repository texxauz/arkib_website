'use client'

import { useState, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { Trash2, Pencil, Plus, ChevronDown, RefreshCw } from 'lucide-react'

type Order = {
  id: string; table_name: string | null; section: string | null
  server_name: string | null; covers: number; status: string
  total: number; opened_at: string; closed_at: string | null
}
type PosTable = {
  id: string; name: string; section: string; capacity: number
  sort_order: number; is_active: boolean; current_order_id: string | null
}
type MenuItem = {
  id: string; name: string; category: string; price: number
  cost_price: number; is_active: boolean; sort_order: number
}
type DailySales = {
  date: string; cocktails_revenue: number; beer_revenue: number
  wine_revenue: number; food_revenue: number; others_revenue: number
  cash_collected: number; credit_card_collected: number; qr_collected: number
  transaction_count: number; total_revenue: number | null; total_collected: number | null
}

type SalesBackup = {
  id: string
  original_date: string
  deleted_at: string
  deleted_by_name: string | null
  data: Record<string, unknown>
}

interface Props {
  orders: Order[]
  tables: PosTable[]
  menuItems: MenuItem[]
  dailySales: DailySales[]
  salesBackups: SalesBackup[]
}

type Tab = 'orders' | 'tables' | 'menu' | 'sales'

const MENU_CATEGORIES = ['house_cocktail', 'classic', 'beer', 'wine', 'whisky', 'food', 'others']

function fmtRM(n: number) {
  return `RM ${(n ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const STATUS_STYLES: Record<string, string> = {
  open:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  closed: 'bg-[#8B5CF6]/15 text-[#A78BFA] border-[#8B5CF6]/30',
  voided: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
}

async function apiFetch(url: string, body: object): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data.error ?? 'Something went wrong' }
  }
  return { ok: true }
}

function Checkbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
        checked || indeterminate
          ? 'bg-[#8B5CF6] border-[#8B5CF6]'
          : 'bg-transparent border-[#3A3A44] hover:border-[#8B5CF6]'
      }`}
    >
      {checked && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
      {!checked && indeterminate && <span className="w-2 h-0.5 bg-white rounded-full" />}
    </button>
  )
}

type ConfirmModal = {
  open: boolean
  title: string
  message: string
  warning?: string
  confirmLabel: string
  onConfirm: () => void
}

const CONFIRM_CLOSED: ConfirmModal = { open: false, title: '', message: '', confirmLabel: 'Delete', onConfirm: () => {} }

export function DataManagerClient({ orders: initialOrders, tables: initialTables, menuItems: initialMenuItems, dailySales: initialDailySales, salesBackups: initialBackups }: Props) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('orders')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>(CONFIRM_CLOSED)

  function confirm(opts: Omit<ConfirmModal, 'open'>) {
    setConfirmModal({ ...opts, open: true })
  }

  // ── Orders ──────────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all')
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === 'all') return orders
    return orders.filter(o => o.status === orderStatusFilter)
  }, [orders, orderStatusFilter])

  const allOrdersSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedOrders.has(o.id))
  const someOrdersSelected = filteredOrders.some(o => selectedOrders.has(o.id)) && !allOrdersSelected

  function toggleOrder(id: string) {
    setSelectedOrders(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleAllOrders() {
    if (allOrdersSelected) {
      setSelectedOrders(prev => { const s = new Set(prev); filteredOrders.forEach(o => s.delete(o.id)); return s })
    } else {
      setSelectedOrders(prev => { const s = new Set(prev); filteredOrders.forEach(o => s.add(o.id)); return s })
    }
  }

  async function doDeleteOrder(order: Order) {
    setLoadingId(order.id)
    const res = await apiFetch('/api/pos/delete-order', { orderId: order.id })
    setLoadingId(null)
    if (!res.ok) { toast(res.error ?? 'Failed', 'error'); return }
    setOrders(prev => prev.filter(o => o.id !== order.id))
    setSelectedOrders(prev => { const s = new Set(prev); s.delete(order.id); return s })
    setConfirmModal(CONFIRM_CLOSED)
    toast('Order deleted', 'info')
  }

  function handleDeleteOrder(order: Order) {
    confirm({
      title: 'Delete Order',
      message: `Delete the order for ${order.table_name ?? 'Walk-in'} (${fmtRM(order.total)}) opened at ${fmtDatetime(order.opened_at)}? This removes all items and payments. Audit log entries are preserved.`,
      confirmLabel: 'Delete Order',
      onConfirm: () => doDeleteOrder(order),
    })
  }

  function handleBulkDeleteOrders() {
    const ids = filteredOrders.filter(o => selectedOrders.has(o.id)).map(o => o.id)
    if (!ids.length) return
    confirm({
      title: `Delete ${ids.length} Order${ids.length > 1 ? 's' : ''}`,
      message: `This will permanently delete ${ids.length} order${ids.length > 1 ? 's' : ''} and all related payments. Audit log entries are preserved.`,
      confirmLabel: `Delete ${ids.length} Order${ids.length > 1 ? 's' : ''}`,
      onConfirm: async () => {
        setConfirmModal(CONFIRM_CLOSED)
        setBulkLoading(true)
        let failed = 0
        for (const id of ids) {
          const res = await apiFetch('/api/pos/delete-order', { orderId: id })
          if (res.ok) {
            setOrders(prev => prev.filter(o => o.id !== id))
            setSelectedOrders(prev => { const s = new Set(prev); s.delete(id); return s })
          } else { failed++ }
        }
        setBulkLoading(false)
        if (failed > 0) toast(`${failed} order(s) failed to delete`, 'error')
        else toast(`${ids.length} order${ids.length > 1 ? 's' : ''} deleted`, 'info')
      },
    })
  }

  // ── Tables ──────────────────────────────────────────────────────────────────
  const [tables, setTables] = useState<PosTable[]>(initialTables)
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set())
  const [tableModal, setTableModal] = useState<{ open: boolean; table: Partial<PosTable> | null; isNew: boolean }>({ open: false, table: null, isNew: false })
  const [tableLoading, setTableLoading] = useState(false)

  const sections = [...new Set(tables.map(t => t.section))].sort()
  const deletableTables = tables.filter(t => !t.current_order_id)
  const allTablesSelected = deletableTables.length > 0 && deletableTables.every(t => selectedTables.has(t.id))
  const someTablesSelected = deletableTables.some(t => selectedTables.has(t.id)) && !allTablesSelected

  function toggleTable(id: string) {
    setSelectedTables(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleAllTables() {
    if (allTablesSelected) {
      setSelectedTables(prev => { const s = new Set(prev); deletableTables.forEach(t => s.delete(t.id)); return s })
    } else {
      setSelectedTables(prev => { const s = new Set(prev); deletableTables.forEach(t => s.add(t.id)); return s })
    }
  }

  function openTableEdit(table: PosTable) { setTableModal({ open: true, table: { ...table }, isNew: false }) }
  function openTableCreate() { setTableModal({ open: true, table: { name: '', section: sections[0] ?? '', capacity: 4, sort_order: 99, is_active: true }, isNew: true }) }

  async function handleSaveTable() {
    const t = tableModal.table
    if (!t?.name?.trim() || !t?.section?.trim()) { toast('Name and section required', 'error'); return }
    setTableLoading(true)
    if (tableModal.isNew) {
      const res = await apiFetch('/api/pos/manage-table', { action: 'create', name: t.name, section: t.section, capacity: t.capacity, sort_order: t.sort_order })
      setTableLoading(false)
      if (!res.ok) { toast(res.error ?? 'Failed', 'error'); return }
      setTables(prev => [...prev, { ...t, id: crypto.randomUUID(), current_order_id: null, is_active: true } as PosTable])
    } else {
      const res = await apiFetch('/api/pos/manage-table', { action: 'update', id: t.id, name: t.name, section: t.section, capacity: t.capacity, sort_order: t.sort_order, is_active: t.is_active })
      setTableLoading(false)
      if (!res.ok) { toast(res.error ?? 'Failed', 'error'); return }
      setTables(prev => prev.map(x => x.id === t.id ? { ...x, ...t } as PosTable : x))
    }
    setTableModal({ open: false, table: null, isNew: false })
    toast(tableModal.isNew ? 'Table created' : 'Table updated', 'success')
  }

  function handleReleaseTable(table: PosTable) {
    confirm({
      title: `Release ${table.name}`,
      message: `Force-clear the stuck order from ${table.name} (${table.section})? Only use this when the linked order is already closed or cancelled.`,
      warning: 'This logs a "force_released" event in the audit log.',
      confirmLabel: 'Release Table',
      onConfirm: async () => {
        setConfirmModal(CONFIRM_CLOSED)
        setLoadingId(table.id)
        const res = await apiFetch('/api/pos/manage-table', { action: 'release', id: table.id })
        setLoadingId(null)
        if (!res.ok) { toast(res.error ?? 'Failed', 'error'); return }
        setTables(prev => prev.map(t => t.id === table.id ? { ...t, current_order_id: null } : t))
        toast(`${table.name} released`, 'success')
      },
    })
  }

  function handleDeleteTable(table: PosTable) {
    if (table.current_order_id) { toast('Table has an open order — close it first', 'error'); return }
    confirm({
      title: 'Delete Table',
      message: `Delete "${table.name}" (${table.section})? This cannot be undone.`,
      confirmLabel: 'Delete Table',
      onConfirm: async () => {
        setConfirmModal(CONFIRM_CLOSED)
        setLoadingId(table.id)
        const res = await apiFetch('/api/pos/manage-table', { action: 'delete', id: table.id })
        setLoadingId(null)
        if (!res.ok) { toast(res.error ?? 'Failed', 'error'); return }
        setTables(prev => prev.filter(t => t.id !== table.id))
        setSelectedTables(prev => { const s = new Set(prev); s.delete(table.id); return s })
        toast('Table deleted', 'info')
      },
    })
  }

  function handleBulkDeleteTables() {
    const ids = tables.filter(t => selectedTables.has(t.id) && !t.current_order_id).map(t => t.id)
    if (!ids.length) return
    confirm({
      title: `Delete ${ids.length} Table${ids.length > 1 ? 's' : ''}`,
      message: `This will permanently delete ${ids.length} table${ids.length > 1 ? 's' : ''}. This cannot be undone.`,
      confirmLabel: `Delete ${ids.length} Table${ids.length > 1 ? 's' : ''}`,
      onConfirm: async () => {
        setConfirmModal(CONFIRM_CLOSED)
        setBulkLoading(true)
        let failed = 0
        for (const id of ids) {
          const res = await apiFetch('/api/pos/manage-table', { action: 'delete', id })
          if (res.ok) { setTables(prev => prev.filter(t => t.id !== id)); setSelectedTables(prev => { const s = new Set(prev); s.delete(id); return s }) }
          else failed++
        }
        setBulkLoading(false)
        if (failed > 0) toast(`${failed} table(s) failed`, 'error')
        else toast(`${ids.length} table${ids.length > 1 ? 's' : ''} deleted`, 'info')
      },
    })
  }

  async function handleToggleTable(table: PosTable) {
    setLoadingId(table.id)
    const res = await apiFetch('/api/pos/manage-table', { action: 'update', id: table.id, is_active: !table.is_active })
    setLoadingId(null)
    if (!res.ok) { toast(res.error ?? 'Failed', 'error'); return }
    setTables(prev => prev.map(t => t.id === table.id ? { ...t, is_active: !t.is_active } : t))
  }

  // ── Menu Items ───────────────────────────────────────────────────────────────
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems)
  const [selectedMenuItems, setSelectedMenuItems] = useState<Set<string>>(new Set())
  const [menuModal, setMenuModal] = useState<{ open: boolean; item: Partial<MenuItem> | null; isNew: boolean }>({ open: false, item: null, isNew: false })
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuCatFilter, setMenuCatFilter] = useState('all')
  const [recatModal, setRecatModal] = useState(false)
  const [recatTarget, setRecatTarget] = useState(MENU_CATEGORIES[0])
  const [recatLoading, setRecatLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [cogsLoading, setCogsLoading] = useState(false)
  const [syncCostsLoading, setSyncCostsLoading] = useState(false)

  async function handleSyncMenuCosts() {
    setSyncCostsLoading(true)
    try {
      const res = await fetch('/api/pos/sync-menu-costs', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Sync failed', 'error'); return }
      toast(json.message ?? `Synced ${json.updated} items`, json.updated > 0 ? 'success' : 'info')
      if (json.updated > 0) window.location.reload()
    } finally {
      setSyncCostsLoading(false)
    }
  }

  async function handleRecalculateCogs() {
    setCogsLoading(true)
    try {
      const res = await fetch('/api/pos/recalculate-cogs', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Recalculate failed', 'error'); return }
      toast(json.message ?? `Updated ${json.updated} rows`, json.updated > 0 ? 'success' : 'info')
    } finally {
      setCogsLoading(false)
    }
  }

  async function handleSyncCocktails() {
    setSyncLoading(true)
    try {
      const res = await fetch('/api/pos/sync-cocktails', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Sync failed', 'error'); return }
      if (json.added === 0) {
        toast('All cocktails are already in the menu', 'info')
      } else {
        toast(`Added ${json.added} cocktail${json.added !== 1 ? 's' : ''} to menu`, 'success')
        // Reload the page to show the newly added items
        window.location.reload()
      }
    } finally {
      setSyncLoading(false)
    }
  }

  const filteredMenu = useMemo(() => {
    if (menuCatFilter === 'all') return menuItems
    return menuItems.filter(m => m.category === menuCatFilter)
  }, [menuItems, menuCatFilter])

  const allMenuSelected = filteredMenu.length > 0 && filteredMenu.every(m => selectedMenuItems.has(m.id))
  const someMenuSelected = filteredMenu.some(m => selectedMenuItems.has(m.id)) && !allMenuSelected

  function toggleMenuItem(id: string) {
    setSelectedMenuItems(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleAllMenuItems() {
    if (allMenuSelected) {
      setSelectedMenuItems(prev => { const s = new Set(prev); filteredMenu.forEach(m => s.delete(m.id)); return s })
    } else {
      setSelectedMenuItems(prev => { const s = new Set(prev); filteredMenu.forEach(m => s.add(m.id)); return s })
    }
  }

  function openMenuEdit(item: MenuItem) { setMenuModal({ open: true, item: { ...item }, isNew: false }) }
  function openMenuCreate() { setMenuModal({ open: true, item: { name: '', category: MENU_CATEGORIES[0], price: 0, cost_price: 0, is_active: true, sort_order: 99 }, isNew: true }) }

  async function handleSaveMenu() {
    const m = menuModal.item
    if (!m?.name?.trim()) { toast('Name required', 'error'); return }
    if (!m?.price || m.price <= 0) { toast('Price must be greater than 0', 'error'); return }
    setMenuLoading(true)
    if (menuModal.isNew) {
      const res = await apiFetch('/api/pos/manage-menu-item', { action: 'create', name: m.name, category: m.category, price: m.price, cost_price: m.cost_price ?? 0, sort_order: m.sort_order })
      setMenuLoading(false)
      if (!res.ok) { toast(res.error ?? 'Failed', 'error'); return }
      setMenuItems(prev => [...prev, { ...m, id: crypto.randomUUID(), is_active: true } as MenuItem])
    } else {
      const res = await apiFetch('/api/pos/manage-menu-item', { action: 'update', id: m.id, name: m.name, category: m.category, price: m.price, cost_price: m.cost_price ?? 0, is_active: m.is_active, sort_order: m.sort_order })
      setMenuLoading(false)
      if (!res.ok) { toast(res.error ?? 'Failed', 'error'); return }
      setMenuItems(prev => prev.map(x => x.id === m.id ? { ...x, ...m } as MenuItem : x))
    }
    setMenuModal({ open: false, item: null, isNew: false })
    toast(menuModal.isNew ? 'Item created' : 'Item updated', 'success')
  }

  function handleDeleteMenu(item: MenuItem) {
    confirm({
      title: 'Delete Menu Item',
      message: `Delete "${item.name}" (${item.category}, ${fmtRM(item.price)})? This cannot be undone.`,
      confirmLabel: 'Delete Item',
      onConfirm: async () => {
        setConfirmModal(CONFIRM_CLOSED)
        setLoadingId(item.id)
        const res = await apiFetch('/api/pos/manage-menu-item', { action: 'delete', id: item.id })
        setLoadingId(null)
        if (!res.ok) { toast(res.error ?? 'Failed', 'error'); return }
        setMenuItems(prev => prev.filter(m => m.id !== item.id))
        setSelectedMenuItems(prev => { const s = new Set(prev); s.delete(item.id); return s })
        toast('Item deleted', 'info')
      },
    })
  }

  function handleBulkDeleteMenuItems() {
    const ids = filteredMenu.filter(m => selectedMenuItems.has(m.id)).map(m => m.id)
    if (!ids.length) return
    confirm({
      title: `Delete ${ids.length} Menu Item${ids.length > 1 ? 's' : ''}`,
      message: `This will permanently delete ${ids.length} menu item${ids.length > 1 ? 's' : ''}. This cannot be undone.`,
      confirmLabel: `Delete ${ids.length} Item${ids.length > 1 ? 's' : ''}`,
      onConfirm: async () => {
        setConfirmModal(CONFIRM_CLOSED)
        setBulkLoading(true)
        let failed = 0
        for (const id of ids) {
          const res = await apiFetch('/api/pos/manage-menu-item', { action: 'delete', id })
          if (res.ok) { setMenuItems(prev => prev.filter(m => m.id !== id)); setSelectedMenuItems(prev => { const s = new Set(prev); s.delete(id); return s }) }
          else failed++
        }
        setBulkLoading(false)
        if (failed > 0) toast(`${failed} item(s) failed`, 'error')
        else toast(`${ids.length} item${ids.length > 1 ? 's' : ''} deleted`, 'info')
      },
    })
  }

  async function handleBulkRecategorise() {
    const ids = filteredMenu.filter(m => selectedMenuItems.has(m.id)).map(m => m.id)
    if (!ids.length) return
    setRecatLoading(true)
    let failed = 0
    for (const id of ids) {
      const res = await apiFetch('/api/pos/manage-menu-item', { action: 'update', id, category: recatTarget })
      if (res.ok) setMenuItems(prev => prev.map(m => m.id === id ? { ...m, category: recatTarget } : m))
      else failed++
    }
    setRecatLoading(false)
    setRecatModal(false)
    setSelectedMenuItems(new Set())
    if (failed > 0) toast(`${failed} item(s) failed to update`, 'error')
    else toast(`${ids.length} item${ids.length > 1 ? 's' : ''} moved to ${recatTarget}`, 'success')
  }

  async function handleToggleMenu(item: MenuItem) {
    setLoadingId(item.id)
    const res = await apiFetch('/api/pos/manage-menu-item', { action: 'update', id: item.id, is_active: !item.is_active })
    setLoadingId(null)
    if (!res.ok) { toast(res.error ?? 'Failed', 'error'); return }
    setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, is_active: !m.is_active } : m))
  }

  // ── Daily Sales ──────────────────────────────────────────────────────────────
  const [dailySales, setDailySales] = useState<DailySales[]>(initialDailySales)
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set())
  const [salesModal, setSalesModal] = useState<{ open: boolean; row: DailySales | null }>({ open: false, row: null })
  const [salesLoading, setSalesLoading] = useState(false)
  const [editRow, setEditRow] = useState<Partial<DailySales>>({})

  const allSalesSelected = dailySales.length > 0 && dailySales.every(r => selectedSales.has(r.date))
  const someSalesSelected = dailySales.some(r => selectedSales.has(r.date)) && !allSalesSelected

  function toggleSale(date: string) {
    setSelectedSales(prev => { const s = new Set(prev); s.has(date) ? s.delete(date) : s.add(date); return s })
  }
  function toggleAllSales() {
    if (allSalesSelected) {
      setSelectedSales(prev => { const s = new Set(prev); dailySales.forEach(r => s.delete(r.date)); return s })
    } else {
      setSelectedSales(prev => { const s = new Set(prev); dailySales.forEach(r => s.add(r.date)); return s })
    }
  }

  function openSalesEdit(row: DailySales) { setEditRow({ ...row }); setSalesModal({ open: true, row }) }

  async function handleSaveSales() {
    if (!editRow.date) return
    setSalesLoading(true)
    const { date, ...updates } = editRow
    const res = await apiFetch('/api/pos/manage-daily-sales', { action: 'update', date, updates })
    setSalesLoading(false)
    if (!res.ok) { toast(res.error ?? 'Failed', 'error'); return }
    setDailySales(prev => prev.map(r => r.date === date ? { ...r, ...editRow } as DailySales : r))
    setSalesModal({ open: false, row: null })
    toast('Sales record updated', 'success')
  }

  function handleDeleteSales(row: DailySales) {
    confirm({
      title: 'Delete Sales Record',
      message: `Delete the sales record for ${fmtDate(row.date)} (${fmtRM(row.total_revenue ?? 0)} revenue)?`,
      warning: 'This also removes all cocktail sales for this date and cannot be recovered — not even by the system.',
      confirmLabel: 'Delete Record',
      onConfirm: async () => {
        setConfirmModal(CONFIRM_CLOSED)
        setLoadingId(row.date)
        const res = await apiFetch('/api/pos/manage-daily-sales', { action: 'delete', date: row.date })
        setLoadingId(null)
        if (!res.ok) { toast(res.error ?? 'Failed', 'error'); return }
        setDailySales(prev => prev.filter(r => r.date !== row.date))
        setSelectedSales(prev => { const s = new Set(prev); s.delete(row.date); return s })
        toast('Sales record deleted', 'info')
      },
    })
  }

  function handleBulkDeleteSales() {
    const dates = dailySales.filter(r => selectedSales.has(r.date)).map(r => r.date)
    if (!dates.length) return
    confirm({
      title: `Delete ${dates.length} Day${dates.length > 1 ? 's' : ''} of Sales`,
      message: `This will permanently delete ${dates.length} day${dates.length > 1 ? 's' : ''} of sales records.`,
      warning: 'Sales records also include cocktail sales for those dates. This data cannot be recovered — not even by the system.',
      confirmLabel: `Delete ${dates.length} Record${dates.length > 1 ? 's' : ''}`,
      onConfirm: async () => {
        setConfirmModal(CONFIRM_CLOSED)
        setBulkLoading(true)
        let failed = 0
        for (const date of dates) {
          const res = await apiFetch('/api/pos/manage-daily-sales', { action: 'delete', date })
          if (res.ok) { setDailySales(prev => prev.filter(r => r.date !== date)); setSelectedSales(prev => { const s = new Set(prev); s.delete(date); return s }) }
          else failed++
        }
        setBulkLoading(false)
        if (failed > 0) toast(`${failed} record(s) failed`, 'error')
        else toast(`${dates.length} day${dates.length > 1 ? 's' : ''} of sales deleted`, 'info')
      },
    })
  }

  // ── Sales Backups ────────────────────────────────────────────────────────────
  const [backups, setBackups] = useState<SalesBackup[]>(initialBackups)
  const [restoreLoading, setRestoreLoading] = useState<string | null>(null)

  async function handleRestore(backup: SalesBackup) {
    setRestoreLoading(backup.id)
    const res = await apiFetch('/api/pos/manage-daily-sales', { action: 'restore', date: backup.original_date })
    setRestoreLoading(null)
    if (!res.ok) { toast(res.error ?? 'Failed to restore', 'error'); return }
    setBackups(prev => prev.filter(b => b.id !== backup.id))
    toast(`Sales for ${fmtDate(backup.original_date)} restored`, 'success')
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'orders', label: `Orders (${orders.length})` },
    { id: 'tables', label: `Tables (${tables.length})` },
    { id: 'menu', label: `Menu Items (${menuItems.length})` },
    { id: 'sales', label: `Daily Sales (${dailySales.length})` },
  ]

  // ── Bulk action bar ──────────────────────────────────────────────────────────
  const selectedCount =
    activeTab === 'orders' ? [...selectedOrders].filter(id => filteredOrders.some(o => o.id === id)).length :
    activeTab === 'tables' ? selectedTables.size :
    activeTab === 'menu' ? [...selectedMenuItems].filter(id => filteredMenu.some(m => m.id === id)).length :
    selectedSales.size

  return (
    <div className="space-y-6">
      <TopBar title="Data Manager" subtitle="Admin only — edit or delete records" />

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
              activeTab === tab.id
                ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/40 text-[#A78BFA]'
                : 'bg-[#141417] border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6] hover:border-[#3A3A42]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/30">
          <span className="text-[#A78BFA] text-sm font-medium">{selectedCount} selected</span>
          <button
            onClick={
              activeTab === 'orders' ? handleBulkDeleteOrders :
              activeTab === 'tables' ? handleBulkDeleteTables :
              activeTab === 'menu' ? handleBulkDeleteMenuItems :
              handleBulkDeleteSales
            }
            disabled={bulkLoading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-500 transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} />
            {bulkLoading ? 'Deleting…' : `Delete ${selectedCount}`}
          </button>
          {activeTab === 'menu' && (
            <button
              onClick={() => setRecatModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#A78BFA] text-sm font-medium hover:bg-[#8B5CF6]/30 transition-colors"
            >
              Move to Category
            </button>
          )}
          <button
            onClick={() => {
              if (activeTab === 'orders') setSelectedOrders(new Set())
              else if (activeTab === 'tables') setSelectedTables(new Set())
              else if (activeTab === 'menu') setSelectedMenuItems(new Set())
              else setSelectedSales(new Set())
            }}
            className="text-[#9896A4] hover:text-[#F0EEF6] text-sm transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── ORDERS ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="card space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="section-title">Last 30 Days</p>
            <div className="flex gap-1 ml-auto">
              {(['all', 'open', 'closed', 'voided'] as const).map(s => (
                <button key={s} onClick={() => setOrderStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all capitalize ${orderStatusFilter === s ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/40 text-[#A78BFA]' : 'bg-[#141417] border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6]'}`}
                >{s}</button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                  <th className="py-2 pr-3 w-8">
                    <Checkbox checked={allOrdersSelected} indeterminate={someOrdersSelected} onChange={toggleAllOrders} />
                  </th>
                  <th className="text-left py-2 pr-3">Date / Time</th>
                  <th className="text-left py-2 pr-3">Table</th>
                  <th className="text-left py-2 pr-3">Server</th>
                  <th className="text-right py-2 px-3">Covers</th>
                  <th className="text-right py-2 px-3">Total</th>
                  <th className="text-center py-2 px-3">Status</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-[#5A5865]">No orders found</td></tr>
                ) : filteredOrders.map(order => (
                  <tr key={order.id} className={`border-b border-[#1A1A1E] transition-colors ${selectedOrders.has(order.id) ? 'bg-[#8B5CF6]/5' : 'hover:bg-[#1A1A1E]'}`}>
                    <td className="py-2.5 pr-3"><Checkbox checked={selectedOrders.has(order.id)} onChange={() => toggleOrder(order.id)} /></td>
                    <td className="py-2.5 pr-3 text-[#9896A4] text-xs whitespace-nowrap">{fmtDatetime(order.opened_at)}</td>
                    <td className="py-2.5 pr-3 text-[#F0EEF6]">{order.table_name ?? 'Walk-in'}</td>
                    <td className="py-2.5 pr-3 text-[#9896A4] text-xs">{order.server_name ?? '—'}</td>
                    <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums">{order.covers}</td>
                    <td className="py-2.5 px-3 text-right text-[#F0EEF6] font-medium tabular-nums">{fmtRM(order.total)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${STATUS_STYLES[order.status] ?? ''}`}>{order.status}</span>
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <button onClick={() => handleDeleteOrder(order)} disabled={loadingId === order.id}
                        className="p-1.5 rounded-lg text-[#5A5865] hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TABLES ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'tables' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <p className="section-title">All Tables</p>
            <button onClick={openTableCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#A78BFA] text-sm hover:bg-[#8B5CF6]/30 transition-colors">
              <Plus size={14} /> Add Table
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                  <th className="py-2 pr-3 w-8">
                    <Checkbox checked={allTablesSelected} indeterminate={someTablesSelected} onChange={toggleAllTables} />
                  </th>
                  <th className="text-left py-2 pr-3">Name</th>
                  <th className="text-left py-2 pr-3">Section</th>
                  <th className="text-right py-2 px-3">Capacity</th>
                  <th className="text-right py-2 px-3">Sort</th>
                  <th className="text-center py-2 px-3">Active</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {tables.map(table => (
                  <tr key={table.id} className={`border-b border-[#1A1A1E] transition-colors ${selectedTables.has(table.id) ? 'bg-[#8B5CF6]/5' : 'hover:bg-[#1A1A1E]'} ${!table.is_active ? 'opacity-50' : ''}`}>
                    <td className="py-2.5 pr-3">
                      <Checkbox checked={selectedTables.has(table.id)} onChange={() => !table.current_order_id && toggleTable(table.id)} />
                    </td>
                    <td className="py-2.5 pr-3 text-[#F0EEF6] font-medium">{table.name}</td>
                    <td className="py-2.5 pr-3 text-[#9896A4]">{table.section}</td>
                    <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums">{table.capacity}</td>
                    <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums">{table.sort_order}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button onClick={() => handleToggleTable(table)} disabled={loadingId === table.id}
                        className={`w-8 h-4 rounded-full transition-colors relative ${table.is_active ? 'bg-emerald-500' : 'bg-[#2A2A30]'}`}>
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${table.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openTableEdit(table)} className="p-1.5 rounded-lg text-[#5A5865] hover:text-[#A78BFA] hover:bg-[#8B5CF6]/10 transition-colors"><Pencil size={13} /></button>
                        {table.current_order_id && (
                          <button onClick={() => handleReleaseTable(table)} disabled={loadingId === table.id}
                            className="px-2 py-1 rounded-lg text-xs font-medium bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-colors disabled:opacity-50"
                            title="Force-release stuck table">
                            Release
                          </button>
                        )}
                        <button onClick={() => handleDeleteTable(table)} disabled={!!table.current_order_id || loadingId === table.id}
                          className="p-1.5 rounded-lg text-[#5A5865] hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={table.current_order_id ? 'Has open order' : 'Delete'}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MENU ITEMS ──────────────────────────────────────────────────────────── */}
      {activeTab === 'menu' && (
        <div className="card space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="section-title">Menu Items</p>
            <div className="flex gap-1 ml-auto flex-wrap">
              {(['all', ...MENU_CATEGORIES] as const).map(c => (
                <button key={c} onClick={() => setMenuCatFilter(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${menuCatFilter === c ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/40 text-[#A78BFA]' : 'bg-[#141417] border-[#2A2A30] text-[#9896A4] hover:text-[#F0EEF6]'}`}
                >{c}</button>
              ))}
            </div>
            <button onClick={handleSyncMenuCosts} disabled={syncCostsLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141417] border border-[#2A2A30] text-[#9896A4] text-sm hover:text-[#F0EEF6] hover:border-[#3A3A44] transition-colors disabled:opacity-50">
              <RefreshCw size={14} className={syncCostsLoading ? 'animate-spin' : ''} /> Sync Costs
            </button>
            <button onClick={handleRecalculateCogs} disabled={cogsLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141417] border border-[#2A2A30] text-[#9896A4] text-sm hover:text-[#F0EEF6] hover:border-[#3A3A44] transition-colors disabled:opacity-50">
              <RefreshCw size={14} className={cogsLoading ? 'animate-spin' : ''} /> Recalculate COGS
            </button>
            <button onClick={handleSyncCocktails} disabled={syncLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141417] border border-[#2A2A30] text-[#9896A4] text-sm hover:text-[#F0EEF6] hover:border-[#3A3A44] transition-colors disabled:opacity-50">
              <RefreshCw size={14} className={syncLoading ? 'animate-spin' : ''} /> Sync Cocktails
            </button>
            <button onClick={openMenuCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#A78BFA] text-sm hover:bg-[#8B5CF6]/30 transition-colors">
              <Plus size={14} /> Add Item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                  <th className="py-2 pr-3 w-8">
                    <Checkbox checked={allMenuSelected} indeterminate={someMenuSelected} onChange={toggleAllMenuItems} />
                  </th>
                  <th className="text-left py-2 pr-3">Name</th>
                  <th className="text-left py-2 pr-3">Category</th>
                  <th className="text-right py-2 px-3">Price</th>
                  <th className="text-right py-2 px-3">Cost</th>
                  <th className="text-right py-2 px-3">Sort</th>
                  <th className="text-center py-2 px-3">Active</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {filteredMenu.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-[#5A5865]">No items found</td></tr>
                ) : filteredMenu.map(item => (
                  <tr key={item.id} className={`border-b border-[#1A1A1E] transition-colors ${selectedMenuItems.has(item.id) ? 'bg-[#8B5CF6]/5' : 'hover:bg-[#1A1A1E]'} ${!item.is_active ? 'opacity-50' : ''}`}>
                    <td className="py-2.5 pr-3"><Checkbox checked={selectedMenuItems.has(item.id)} onChange={() => toggleMenuItem(item.id)} /></td>
                    <td className="py-2.5 pr-3 text-[#F0EEF6] font-medium">{item.name}</td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/20">{item.category}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#F0EEF6] tabular-nums">{fmtRM(item.price)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[#9896A4]">{fmtRM(item.cost_price ?? 0)}</td>
                    <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums">{item.sort_order}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button onClick={() => handleToggleMenu(item)} disabled={loadingId === item.id}
                        className={`w-8 h-4 rounded-full transition-colors relative ${item.is_active ? 'bg-emerald-500' : 'bg-[#2A2A30]'}`}>
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${item.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openMenuEdit(item)} className="p-1.5 rounded-lg text-[#5A5865] hover:text-[#A78BFA] hover:bg-[#8B5CF6]/10 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteMenu(item)} disabled={loadingId === item.id}
                          className="p-1.5 rounded-lg text-[#5A5865] hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DAILY SALES ─────────────────────────────────────────────────────────── */}
      {activeTab === 'sales' && (
        <div className="card space-y-4">
          <p className="section-title">Daily Sales Records — Last 30 Days</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                  <th className="py-2 pr-3 w-8">
                    <Checkbox checked={allSalesSelected} indeterminate={someSalesSelected} onChange={toggleAllSales} />
                  </th>
                  <th className="text-left py-2 pr-3">Date</th>
                  <th className="text-right py-2 px-3">Cocktails</th>
                  <th className="text-right py-2 px-3">Beer</th>
                  <th className="text-right py-2 px-3">Wine</th>
                  <th className="text-right py-2 px-3">Food</th>
                  <th className="text-right py-2 px-3">Others</th>
                  <th className="text-right py-2 px-3">Txns</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {dailySales.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-[#5A5865]">No sales records found</td></tr>
                ) : dailySales.map(row => (
                  <tr key={row.date} className={`border-b border-[#1A1A1E] transition-colors ${selectedSales.has(row.date) ? 'bg-[#8B5CF6]/5' : 'hover:bg-[#1A1A1E]'}`}>
                    <td className="py-2.5 pr-3"><Checkbox checked={selectedSales.has(row.date)} onChange={() => toggleSale(row.date)} /></td>
                    <td className="py-2.5 pr-3 text-[#F0EEF6] font-medium whitespace-nowrap">{fmtDate(row.date)}</td>
                    <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums text-xs">{fmtRM(row.cocktails_revenue)}</td>
                    <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums text-xs">{fmtRM(row.beer_revenue)}</td>
                    <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums text-xs">{fmtRM(row.wine_revenue)}</td>
                    <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums text-xs">{fmtRM(row.food_revenue)}</td>
                    <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums text-xs">{fmtRM(row.others_revenue)}</td>
                    <td className="py-2.5 px-3 text-right text-[#9896A4] tabular-nums">{row.transaction_count}</td>
                    <td className="py-2.5 pl-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openSalesEdit(row)} className="p-1.5 rounded-lg text-[#5A5865] hover:text-[#A78BFA] hover:bg-[#8B5CF6]/10 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteSales(row)} disabled={loadingId === row.date}
                          className="p-1.5 rounded-lg text-[#5A5865] hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DELETED SALES BACKUPS ───────────────────────────────────────────────── */}
      {activeTab === 'sales' && backups.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <p className="section-title">Deleted Records</p>
            <span className="text-xs text-[#9896A4] bg-[#1A1A1E] border border-[#2A2A30] rounded-full px-2 py-0.5">{backups.length}</span>
            <span className="text-xs text-[#5A5865] ml-1">— click Restore to recover</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#9896A4] text-xs uppercase tracking-wider border-b border-[#2A2A30]">
                  <th className="text-left py-2 pr-3">Date</th>
                  <th className="text-right py-2 px-3">Total Revenue</th>
                  <th className="text-left py-2 px-3">Deleted By</th>
                  <th className="text-left py-2 px-3">Deleted At</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <tr key={b.id} className="border-b border-[#1A1A1E] hover:bg-[#1A1A1E] transition-colors">
                    <td className="py-2.5 pr-3 text-[#F0EEF6] font-medium whitespace-nowrap">{fmtDate(b.original_date)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[#9896A4]">
                      {fmtRM((b.data.total_revenue as number) ?? 0)}
                    </td>
                    <td className="py-2.5 px-3 text-[#9896A4] text-xs">{b.deleted_by_name ?? '—'}</td>
                    <td className="py-2.5 px-3 text-[#5A5865] text-xs whitespace-nowrap">{fmtDatetime(b.deleted_at)}</td>
                    <td className="py-2.5 pl-3 text-right">
                      <button
                        onClick={() => handleRestore(b)}
                        disabled={restoreLoading === b.id}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                      >
                        {restoreLoading === b.id ? 'Restoring…' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CONFIRM MODAL ───────────────────────────────────────────────────────── */}
      <Modal isOpen={confirmModal.open} onClose={() => setConfirmModal(CONFIRM_CLOSED)} title={confirmModal.title} size="sm">
        <div className="space-y-4">
          <p className="text-[#9896A4] text-sm">{confirmModal.message}</p>
          {confirmModal.warning && (
            <div className="flex gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2.5">
              <span className="text-rose-400 text-xs font-semibold shrink-0 mt-0.5">⚠</span>
              <p className="text-rose-400 text-xs">{confirmModal.warning}</p>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConfirmModal(CONFIRM_CLOSED)} className="px-4 py-2 rounded-xl text-sm text-[#9896A4] hover:text-[#F0EEF6] border border-[#2A2A30] hover:bg-[#1A1A1E] transition-all">Cancel</button>
            <button onClick={confirmModal.onConfirm} className="px-4 py-2 rounded-xl text-sm font-medium bg-rose-600 text-white hover:bg-rose-500 transition-all">
              {confirmModal.confirmLabel}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── TABLE EDIT MODAL ─────────────────────────────────────────────────────── */}
      <Modal isOpen={tableModal.open} onClose={() => setTableModal({ open: false, table: null, isNew: false })} title={tableModal.isNew ? 'Add Table' : 'Edit Table'} size="sm">
        {tableModal.table && (
          <div className="space-y-4">
            {[
              { label: 'Name', key: 'name', type: 'text', placeholder: 'e.g. Table 1' },
              { label: 'Section', key: 'section', type: 'text', placeholder: 'e.g. Indoor' },
              { label: 'Capacity', key: 'capacity', type: 'number', placeholder: '4' },
              { label: 'Sort Order', key: 'sort_order', type: 'number', placeholder: '1' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-[#9896A4] text-xs uppercase tracking-wider block mb-1.5">{field.label}</label>
                <input type={field.type} value={(tableModal.table as Record<string, unknown>)[field.key] as string ?? ''}
                  onChange={e => setTableModal(prev => ({ ...prev, table: { ...prev.table, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value } }))}
                  placeholder={field.placeholder}
                  className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] placeholder:text-[#5A5865] focus:outline-none focus:border-[#7B5EA7]"
                />
              </div>
            ))}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setTableModal({ open: false, table: null, isNew: false })} className="px-4 py-2 rounded-xl text-sm text-[#9896A4] hover:text-[#F0EEF6] border border-[#2A2A30] hover:bg-[#1A1A1E] transition-all">Cancel</button>
              <button onClick={handleSaveTable} disabled={tableLoading} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#7B5EA7] text-white hover:bg-[#8B6EB7] transition-all disabled:opacity-50">
                {tableLoading ? 'Saving…' : tableModal.isNew ? 'Create Table' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── BULK RE-CATEGORISE MODAL ─────────────────────────────────────────────── */}
      <Modal isOpen={recatModal} onClose={() => setRecatModal(false)} title="Move to Category" size="sm">
        <div className="space-y-4">
          <p className="text-[#9896A4] text-sm">
            Move {[...selectedMenuItems].filter(id => filteredMenu.some(m => m.id === id)).length} selected item(s) to:
          </p>
          <div className="relative">
            <select
              value={recatTarget}
              onChange={e => setRecatTarget(e.target.value)}
              className="w-full bg-[#1A1A1E] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]/60 appearance-none pr-8"
            >
              {MENU_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5865] pointer-events-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setRecatModal(false)} className="px-4 py-2 rounded-xl text-sm text-[#9896A4] hover:text-[#F0EEF6] border border-[#2A2A30] hover:bg-[#1A1A1E] transition-all">Cancel</button>
            <button onClick={handleBulkRecategorise} disabled={recatLoading} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#7B5EA7] text-white hover:bg-[#8B6EB7] transition-all disabled:opacity-50">
              {recatLoading ? 'Moving…' : 'Move Items'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MENU ITEM EDIT MODAL ─────────────────────────────────────────────────── */}
      <Modal isOpen={menuModal.open} onClose={() => setMenuModal({ open: false, item: null, isNew: false })} title={menuModal.isNew ? 'Add Menu Item' : 'Edit Menu Item'} size="sm">
        {menuModal.item && (
          <div className="space-y-4">
            <div>
              <label className="text-[#9896A4] text-xs uppercase tracking-wider block mb-1.5">Name</label>
              <input type="text" value={menuModal.item.name ?? ''}
                onChange={e => setMenuModal(prev => ({ ...prev, item: { ...prev.item, name: e.target.value } }))}
                className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] focus:outline-none focus:border-[#7B5EA7]" />
            </div>
            <div>
              <label className="text-[#9896A4] text-xs uppercase tracking-wider block mb-1.5">Category</label>
              <div className="relative">
                <select value={menuModal.item.category ?? MENU_CATEGORIES[0]}
                  onChange={e => setMenuModal(prev => ({ ...prev, item: { ...prev.item, category: e.target.value } }))}
                  className="w-full appearance-none bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] focus:outline-none focus:border-[#7B5EA7]">
                  {MENU_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5865] pointer-events-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[#9896A4] text-xs uppercase tracking-wider block mb-1.5">Price (RM)</label>
                <input type="number" step="0.01" value={menuModal.item.price ?? ''}
                  onChange={e => setMenuModal(prev => ({ ...prev, item: { ...prev.item, price: parseFloat(e.target.value) } }))}
                  className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] focus:outline-none focus:border-[#7B5EA7]" />
              </div>
              <div>
                <label className="text-[#9896A4] text-xs uppercase tracking-wider block mb-1.5">Cost Price (RM)</label>
                <input type="number" step="0.01" min="0" value={menuModal.item.cost_price ?? 0}
                  onChange={e => setMenuModal(prev => ({ ...prev, item: { ...prev.item, cost_price: parseFloat(e.target.value) || 0 } }))}
                  className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] focus:outline-none focus:border-[#7B5EA7]" />
              </div>
            </div>
            <div>
              <label className="text-[#9896A4] text-xs uppercase tracking-wider block mb-1.5">Sort Order</label>
              <input type="number" value={menuModal.item.sort_order ?? 99}
                onChange={e => setMenuModal(prev => ({ ...prev, item: { ...prev.item, sort_order: parseInt(e.target.value) } }))}
                className="w-full bg-[#141417] border border-[#2A2A30] rounded-xl px-3 py-2.5 text-sm text-[#F0EEF6] focus:outline-none focus:border-[#7B5EA7]" />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setMenuModal({ open: false, item: null, isNew: false })} className="px-4 py-2 rounded-xl text-sm text-[#9896A4] hover:text-[#F0EEF6] border border-[#2A2A30] hover:bg-[#1A1A1E] transition-all">Cancel</button>
              <button onClick={handleSaveMenu} disabled={menuLoading} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#7B5EA7] text-white hover:bg-[#8B6EB7] transition-all disabled:opacity-50">
                {menuLoading ? 'Saving…' : menuModal.isNew ? 'Create Item' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── DAILY SALES EDIT MODAL ───────────────────────────────────────────────── */}
      <Modal isOpen={salesModal.open} onClose={() => setSalesModal({ open: false, row: null })} title={`Edit Sales — ${salesModal.row?.date ?? ''}`} size="sm">
        {salesModal.row && (
          <div className="space-y-3">
            <p className="text-[#9896A4] text-xs">Adjust revenue figures if an entry was incorrectly recorded.</p>
            {([
              { label: 'Cocktails Revenue', key: 'cocktails_revenue' },
              { label: 'Beer Revenue', key: 'beer_revenue' },
              { label: 'Wine Revenue', key: 'wine_revenue' },
              { label: 'Food Revenue', key: 'food_revenue' },
              { label: 'Others Revenue', key: 'others_revenue' },
              { label: 'Cash Collected', key: 'cash_collected' },
              { label: 'Card Collected', key: 'credit_card_collected' },
              { label: 'QR Collected', key: 'qr_collected' },
            ] as const).map(field => (
              <div key={field.key} className="flex items-center gap-3">
                <label className="text-[#9896A4] text-xs w-36 shrink-0">{field.label}</label>
                <input type="number" step="0.01" value={(editRow as Record<string, unknown>)[field.key] as number ?? 0}
                  onChange={e => setEditRow(prev => ({ ...prev, [field.key]: parseFloat(e.target.value) || 0 }))}
                  className="flex-1 bg-[#141417] border border-[#2A2A30] rounded-lg px-3 py-1.5 text-sm text-[#F0EEF6] focus:outline-none focus:border-[#7B5EA7] tabular-nums" />
              </div>
            ))}
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setSalesModal({ open: false, row: null })} className="px-4 py-2 rounded-xl text-sm text-[#9896A4] hover:text-[#F0EEF6] border border-[#2A2A30] hover:bg-[#1A1A1E] transition-all">Cancel</button>
              <button onClick={handleSaveSales} disabled={salesLoading} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#7B5EA7] text-white hover:bg-[#8B6EB7] transition-all disabled:opacity-50">
                {salesLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
