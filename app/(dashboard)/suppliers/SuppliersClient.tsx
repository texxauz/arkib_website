'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Building2, Search, Package, ChevronDown, Phone, Mail, User, X, Loader2 } from 'lucide-react'

interface Supplier {
  id: string
  name: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  notes: string | null
}

interface Product {
  id: string
  item_name: string
  brand: string | null
  category: string | null
  size: string | null
  price_rm: number | null
  trade_offer: string | null
}

interface Props {
  suppliers: Supplier[]
  supplierCategories: Record<string, string[]>
  userRole: string
}

export function SuppliersClient({ suppliers, supplierCategories, userRole }: Props) {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    suppliers.length === 1 ? suppliers[0] : null
  )
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  useEffect(() => {
    if (!selectedSupplier) return
    setProducts([])
    setPage(0)
    setSearch('')
    setCategoryFilter('')
    loadProducts(selectedSupplier.id, '', '', 0)
  }, [selectedSupplier])

  const loadProducts = async (supplierId: string, searchTerm: string, cat: string, pageNum: number) => {
    setLoadingProducts(true)
    try {
      const params = new URLSearchParams({
        supplierId,
        search: searchTerm,
        category: cat,
        offset: String(pageNum * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      })
      const res = await fetch(`/api/suppliers/products?${params}`)
      const data = await res.json()
      if (pageNum === 0) setProducts(data.products ?? [])
      else setProducts(p => [...p, ...(data.products ?? [])])
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleSearch = (q: string) => {
    setSearch(q)
    setPage(0)
    if (selectedSupplier) loadProducts(selectedSupplier.id, q, categoryFilter, 0)
  }

  const handleCategory = (cat: string) => {
    setCategoryFilter(cat)
    setPage(0)
    if (selectedSupplier) loadProducts(selectedSupplier.id, search, cat, 0)
  }

  const handleLoadMore = () => {
    const next = page + 1
    setPage(next)
    if (selectedSupplier) loadProducts(selectedSupplier.id, search, categoryFilter, next)
  }

  const categories = selectedSupplier ? (supplierCategories[selectedSupplier.id] ?? []) : []

  return (
    <div className="min-h-screen bg-[#0D0D10]">
      <TopBar title="Suppliers" subtitle="Product catalogues and pricing" />

      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Supplier selector (if more than one) */}
        {suppliers.length > 1 && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suppliers.map(s => (
              <button key={s.id} onClick={() => setSelectedSupplier(s)}
                className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                  selectedSupplier?.id === s.id
                    ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/30 text-[#F0EEF6]'
                    : 'bg-[#141417] border-[#2A2A30] text-[#9896A4] hover:bg-[#1A1A1E]'
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Building2 size={14} className={selectedSupplier?.id === s.id ? 'text-[#8B5CF6]' : 'text-[#5A5865]'} />
                  <span className="font-medium text-sm">{s.name}</span>
                </div>
                {supplierCategories[s.id] && (
                  <p className="text-xs text-[#5A5865]">{supplierCategories[s.id].length} categories</p>
                )}
              </button>
            ))}
          </div>
        )}

        {suppliers.length === 0 && (
          <div className="text-center py-20 text-[#5A5865]">
            <Building2 size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No suppliers yet</p>
          </div>
        )}

        {selectedSupplier && (
          <>
            {/* Supplier info card */}
            <div className="bg-[#141417] border border-[#2A2A30] rounded-xl px-5 py-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 size={16} className="text-[#8B5CF6]" />
                    <h2 className="text-[#F0EEF6] font-semibold">{selectedSupplier.name}</h2>
                  </div>
                  {selectedSupplier.notes && (
                    <p className="text-[#5A5865] text-xs mt-1">{selectedSupplier.notes}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-[#9896A4]">
                  {selectedSupplier.contact_name && (
                    <span className="flex items-center gap-1"><User size={11} /> {selectedSupplier.contact_name}</span>
                  )}
                  {selectedSupplier.contact_phone && (
                    <span className="flex items-center gap-1"><Phone size={11} /> {selectedSupplier.contact_phone}</span>
                  )}
                  {selectedSupplier.contact_email && (
                    <span className="flex items-center gap-1"><Mail size={11} /> {selectedSupplier.contact_email}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5865]" />
                <input
                  type="text"
                  placeholder="Search items, brands…"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  className="w-full bg-[#141417] border border-[#2A2A30] rounded-lg pl-8 pr-3 py-2 text-[#F0EEF6] text-sm focus:outline-none focus:border-[#8B5CF6]"
                />
                {search && (
                  <button onClick={() => handleSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A5865] hover:text-[#9896A4]">
                    <X size={12} />
                  </button>
                )}
              </div>
              {categories.length > 0 && (
                <div className="relative">
                  <select value={categoryFilter} onChange={e => handleCategory(e.target.value)}
                    className="bg-[#141417] border border-[#2A2A30] rounded-lg px-3 py-2 text-[#9896A4] text-sm focus:outline-none focus:border-[#8B5CF6] appearance-none pr-8 min-w-[180px]">
                    <option value="">All categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A5865] pointer-events-none" />
                </div>
              )}
            </div>

            {/* Products table */}
            {loadingProducts && products.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-[#5A5865]">
                <Loader2 size={20} className="animate-spin mr-2" /> Loading products…
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16 text-[#5A5865]">
                <Package size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No products found</p>
              </div>
            ) : (
              <>
                <div className="bg-[#141417] border border-[#2A2A30] rounded-xl overflow-hidden mb-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#2A2A30]">
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Item</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Brand</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Category</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Size</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-[#5A5865]">Price (RM)</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#5A5865]">Trade Offer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => (
                          <tr key={p.id} className="border-b border-[#2A2A30] last:border-0 hover:bg-[#1A1A1E] transition-colors">
                            <td className="px-4 py-2.5 text-[#F0EEF6] text-sm">{p.item_name}</td>
                            <td className="px-4 py-2.5 text-[#9896A4] text-sm">{p.brand || '—'}</td>
                            <td className="px-4 py-2.5">
                              {p.category && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2A2A30] text-[#9896A4] font-medium">{p.category}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-[#5A5865] text-xs">{p.size || '—'}</td>
                            <td className="px-4 py-2.5 text-[#F0EEF6] text-sm font-medium tabular-nums text-right">
                              {p.price_rm != null ? Number(p.price_rm).toFixed(2) : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-[#5A5865] text-xs">{p.trade_offer || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {products.length >= PAGE_SIZE && (
                  <div className="text-center">
                    <button onClick={handleLoadMore} disabled={loadingProducts}
                      className="px-5 py-2 rounded-lg bg-[#141417] border border-[#2A2A30] text-[#9896A4] text-sm hover:bg-[#1A1A1E] transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto">
                      {loadingProducts ? <Loader2 size={13} className="animate-spin" /> : null}
                      Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
