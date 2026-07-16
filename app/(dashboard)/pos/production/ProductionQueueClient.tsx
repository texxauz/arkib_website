'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle, RefreshCw, Package, FlaskConical, Wine } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'

type Premix = {
  id: string; name: string; cocktail_name: string | null; category: string | null
  opening_serves: number; produced_serves: number; sold_serves: number; ml_per_serve: number
}
type Infusion = {
  id: string; name: string; base_spirit: string | null
  opening_ml: number; produced_ml: number; used_premix_ml: number; wasted_ml: number; ml_per_serve: number | null
}
type Spirit = {
  id: string; name: string; category: string; full_bottles: number; open_ml: number
  used_classics_ml: number; bottle_size_ml: number; min_bottles: number
}
type Reservation = { covers: number; date: string }
type RecentItem = { item_name: string; category: string | null; quantity: number }

type ProductionItem = {
  id: string
  type: 'premix' | 'infusion' | 'spirit'
  name: string
  urgency: 'critical' | 'low' | 'expiring'
  currentStock: string
  recommendedProduction: string
  reason: string
  unit: string
}

type Props = {
  premixes: Premix[]
  infusions: Infusion[]
  spirits: Spirit[]
  reservations: Reservation[]
  recentItems: RecentItem[]
  today: string
}

type FilterType = 'all' | 'critical' | 'low' | 'expiring'

export function ProductionQueueClient({ premixes, infusions, spirits, reservations, recentItems, today }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterType>('all')
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())

  const totalCovers = useMemo(() =>
    reservations.reduce((sum, r) => sum + (r.covers ?? 0), 0),
    [reservations]
  )

  const demandBoost = totalCovers > 30

  const productionQueue = useMemo((): ProductionItem[] => {
    const items: ProductionItem[] = []

    // 1. Premixes
    for (const p of premixes) {
      const availableServes = p.opening_serves + p.produced_serves - p.sold_serves
      if (availableServes <= 2) {
        const baseRec = Math.max(12, Math.round(p.sold_serves * 1.5))
        const rec = demandBoost ? Math.round(baseRec * 1.2) : baseRec
        items.push({
          id: p.id,
          type: 'premix',
          name: p.cocktail_name ?? p.name,
          urgency: 'critical',
          currentStock: `${availableServes} serves`,
          recommendedProduction: `${rec} serves`,
          reason: availableServes <= 0 ? 'Out of stock' : `Only ${availableServes} serve${availableServes === 1 ? '' : 's'} remaining`,
          unit: 'serves',
        })
      } else if (availableServes <= 6) {
        const baseRec = 8
        const rec = demandBoost ? Math.round(baseRec * 1.2) : baseRec
        items.push({
          id: p.id,
          type: 'premix',
          name: p.cocktail_name ?? p.name,
          urgency: 'low',
          currentStock: `${availableServes} serves`,
          recommendedProduction: `${rec} serves`,
          reason: `Running low — ${availableServes} serves left`,
          unit: 'serves',
        })
      }
    }

    // 2. Infusions
    for (const inf of infusions) {
      const remainingMl = inf.opening_ml + inf.produced_ml - inf.used_premix_ml - inf.wasted_ml
      if (remainingMl <= 0) {
        items.push({
          id: inf.id,
          type: 'infusion',
          name: inf.name,
          urgency: 'critical',
          currentStock: '0 ml',
          recommendedProduction: '500 ml',
          reason: 'Out of stock',
          unit: 'ml',
        })
      } else if (remainingMl <= 100) {
        items.push({
          id: inf.id,
          type: 'infusion',
          name: inf.name,
          urgency: 'low',
          currentStock: `${remainingMl} ml`,
          recommendedProduction: '500 ml',
          reason: `Only ${remainingMl}ml remaining`,
          unit: 'ml',
        })
      }
    }

    // 3. Spirits
    for (const sp of spirits) {
      const remainingMl = sp.full_bottles * sp.bottle_size_ml + sp.open_ml - sp.used_classics_ml
      const remainingBottles = remainingMl / sp.bottle_size_ml
      if (remainingBottles < sp.min_bottles) {
        const toOrder = Math.ceil(sp.min_bottles - remainingBottles + 2)
        items.push({
          id: sp.id,
          type: 'spirit',
          name: sp.name,
          urgency: 'critical',
          currentStock: `${remainingBottles.toFixed(1)} btls`,
          recommendedProduction: `${toOrder} bottles to order`,
          reason: `Below minimum stock (${sp.min_bottles} btls)`,
          unit: 'bottles',
        })
      }
    }

    // Sort: critical first, then low, then expiring
    const urgencyOrder = { critical: 0, low: 1, expiring: 2 }
    return items.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
  }, [premixes, infusions, spirits, demandBoost])

  const filteredQueue = useMemo(() => {
    if (filter === 'all') return productionQueue
    return productionQueue.filter(item => item.urgency === filter)
  }, [productionQueue, filter])

  const criticalCount = productionQueue.filter(i => i.urgency === 'critical').length
  const lowCount = productionQueue.filter(i => i.urgency === 'low').length

  const markDone = (id: string) => {
    setCompletedIds(prev => new Set([...prev, id]))
  }

  const TypeIcon = ({ type }: { type: ProductionItem['type'] }) => {
    if (type === 'premix') return <Package size={14} className="inline mr-1" />
    if (type === 'infusion') return <FlaskConical size={14} className="inline mr-1" />
    return <Wine size={14} className="inline mr-1" />
  }

  const typeLabel = (type: ProductionItem['type']) => {
    if (type === 'premix') return 'Premix'
    if (type === 'infusion') return 'Infusion'
    return 'Spirit'
  }

  const urgencyBarColor = (urgency: ProductionItem['urgency']) => {
    if (urgency === 'critical') return 'bg-rose-500'
    if (urgency === 'low') return 'bg-amber-500'
    return 'bg-purple-500'
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <TopBar
        title="Production Queue"
        subtitle="Today's production recommendations"
        actions={
          <button
            onClick={() => router.refresh()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Stats row */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold">
              {criticalCount}
            </span>
            <span className="text-sm text-neutral-400">Critical items</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
              {lowCount}
            </span>
            <span className="text-sm text-neutral-400">Low stock</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">
              {totalCovers}
            </span>
            <span className="text-sm text-neutral-400">Upcoming covers (3 days)</span>
          </div>
          {demandBoost && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-900/30 border border-purple-700/40">
              <AlertTriangle size={14} className="text-purple-400" />
              <span className="text-sm text-purple-300">High demand — quantities boosted 20%</span>
            </div>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'critical', 'low'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? f === 'critical'
                    ? 'bg-rose-500 text-white'
                    : f === 'low'
                    ? 'bg-amber-500 text-black'
                    : 'bg-neutral-200 text-neutral-900'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              {f === 'all' ? 'All' : f === 'critical' ? 'Critical' : 'Low Stock'}
            </button>
          ))}
        </div>

        {/* Production cards */}
        {filteredQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <CheckCircle size={48} className="text-emerald-500" />
            <p className="text-lg font-medium text-neutral-200">All stocked up!</p>
            <p className="text-sm text-neutral-500">Nothing needs production today.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQueue.map(item => {
              const isCompleted = completedIds.has(item.id)
              return (
                <div
                  key={item.id}
                  className={`flex gap-0 rounded-xl border overflow-hidden transition-opacity ${
                    isCompleted ? 'opacity-50' : ''
                  } ${
                    item.urgency === 'critical'
                      ? 'border-rose-800/50 bg-rose-950/20'
                      : item.urgency === 'low'
                      ? 'border-amber-800/50 bg-amber-950/20'
                      : 'border-purple-800/50 bg-purple-950/20'
                  }`}
                >
                  {/* Urgency bar */}
                  <div className={`w-1 shrink-0 ${urgencyBarColor(item.urgency)}`} />

                  {/* Content */}
                  <div className="flex flex-1 items-start justify-between gap-4 p-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-semibold text-neutral-100 ${isCompleted ? 'line-through text-neutral-500' : ''}`}>
                          {item.name}
                        </p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.type === 'premix'
                            ? 'bg-blue-900/40 text-blue-300'
                            : item.type === 'infusion'
                            ? 'bg-violet-900/40 text-violet-300'
                            : 'bg-teal-900/40 text-teal-300'
                        }`}>
                          <TypeIcon type={item.type} />
                          {typeLabel(item.type)}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-400">
                        Remaining: <span className="text-neutral-200">{item.currentStock}</span>
                      </p>
                      <p className="text-sm">
                        {item.type === 'spirit' ? 'Order' : 'Produce'}:{' '}
                        <span className={`font-semibold ${
                          item.urgency === 'critical' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                          {item.recommendedProduction}
                        </span>
                      </p>
                      <p className="text-xs text-neutral-500">{item.reason}</p>
                    </div>

                    {/* Mark done */}
                    <button
                      onClick={() => markDone(item.id)}
                      disabled={isCompleted}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isCompleted
                          ? 'bg-emerald-900/30 text-emerald-400 cursor-default'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircle size={14} />
                          Done
                        </>
                      ) : (
                        'Mark Done'
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer note */}
        <p className="text-xs text-neutral-600 text-center pb-4">
          Recommendations based on current inventory levels and upcoming reservations. Always verify before production.
        </p>
      </div>
    </div>
  )
}
