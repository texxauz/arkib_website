'use client'
import { useMemo } from 'react'
import { useEchoQuant } from '@/lib/echoquant/store'
import { calculateATR } from '@/lib/echoquant/analytics'

function getSession(hour: number): string {
  if (hour >= 0 && hour < 7) return 'Asian'
  if (hour >= 7 && hour < 12) return 'London'
  if (hour >= 12 && hour < 17) return 'New York'
  return 'Off-Hours'
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function StatsPage() {
  const { candles, symbol, timeframe } = useEchoQuant()

  const stats = useMemo(() => {
    if (candles.length === 0) return null

    const first = candles[0]
    const last = candles[candles.length - 1]
    const allHighs = candles.map(c => c.high)
    const allLows = candles.map(c => c.low)
    const allHigh = Math.max(...allHighs)
    const allLow = Math.min(...allLows)
    const ranges = candles.map(c => c.high - c.low)
    const bodies = candles.map(c => Math.abs(c.close - c.open))
    const avgRange = ranges.reduce((s, v) => s + v, 0) / ranges.length
    const avgBody = bodies.reduce((s, v) => s + v, 0) / bodies.length

    // Session breakdown
    const sessions: Record<string, { candles: number; bullish: number; totalRange: number }> = {}
    for (const c of candles) {
      const h = new Date(c.time * 1000).getUTCHours()
      const s = getSession(h)
      if (!sessions[s]) sessions[s] = { candles: 0, bullish: 0, totalRange: 0 }
      sessions[s].candles++
      if (c.close > c.open) sessions[s].bullish++
      sessions[s].totalRange += c.high - c.low
    }

    // Day of week
    const byDay: Record<number, { candles: number; bullish: number; totalRange: number }> = {}
    for (const c of candles) {
      const d = new Date(c.time * 1000).getUTCDay()
      if (!byDay[d]) byDay[d] = { candles: 0, bullish: 0, totalRange: 0 }
      byDay[d].candles++
      if (c.close > c.open) byDay[d].bullish++
      byDay[d].totalRange += c.high - c.low
    }

    // Monthly heatmap
    const byMonth: Record<string, { bullish: number; total: number; avgMove: number; totalMove: number }> = {}
    for (const c of candles) {
      const d = new Date(c.time * 1000)
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`
      if (!byMonth[key]) byMonth[key] = { bullish: 0, total: 0, avgMove: 0, totalMove: 0 }
      byMonth[key].total++
      if (c.close > c.open) byMonth[key].bullish++
      byMonth[key].totalMove += ((c.close - c.open) / c.open) * 100
    }

    // Volatility distribution (range buckets)
    const maxRange = Math.max(...ranges)
    const bucketCount = 20
    const bucketSize = maxRange / bucketCount
    const buckets = new Array(bucketCount).fill(0)
    for (const r of ranges) {
      const idx = Math.min(Math.floor(r / bucketSize), bucketCount - 1)
      buckets[idx]++
    }

    const atrs = calculateATR(candles, 14)
    const lastAtr = atrs[atrs.length - 1]

    return { first, last, allHigh, allLow, avgRange, avgBody, sessions, byDay, byMonth, buckets, bucketSize, lastAtr, total: candles.length }
  }, [candles])

  if (!stats) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-xl font-mono font-bold text-[#E6EDF3] mb-6">Statistics</h1>
        <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-8 text-center text-[#4B5563]">
          Upload CSV data to see statistics.
        </div>
      </div>
    )
  }

  const { first, last, allHigh, allLow, avgRange, avgBody, sessions, byDay, byMonth, buckets, bucketSize, lastAtr, total } = stats

  const startDate = new Date(first.time * 1000).toLocaleDateString()
  const endDate = new Date(last.time * 1000).toLocaleDateString()

  const monthEntries = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))
  const maxBucket = Math.max(...buckets)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-mono font-bold text-[#E6EDF3] mb-6">Statistics</h1>

      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Candles', value: total.toLocaleString() },
          { label: 'Symbol', value: symbol },
          { label: 'Timeframe', value: timeframe },
          { label: 'Date Range', value: `${startDate} — ${endDate}` },
          { label: 'All-Time High', value: allHigh.toFixed(2) },
          { label: 'All-Time Low', value: allLow.toFixed(2) },
          { label: 'Avg Range', value: avgRange.toFixed(4) },
          { label: 'ATR(14)', value: isNaN(lastAtr) ? '—' : lastAtr.toFixed(4) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-4">
            <p className="text-xs text-[#7D8590] mb-1">{label}</p>
            <p className="font-mono text-[#E6EDF3] text-sm">{value}</p>
          </div>
        ))}
      </div>

      {/* Session breakdown */}
      <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-5 mb-6">
        <h2 className="text-sm text-[#7D8590] uppercase tracking-wider mb-4">Session Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(sessions).map(([session, data]) => (
            <div key={session} className="bg-[#0A0B0E] rounded-lg p-4">
              <p className="text-sm font-semibold text-[#E6EDF3] mb-2">{session}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#7D8590]">Candles</span>
                  <span className="font-mono text-[#E6EDF3]">{data.candles.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7D8590]">Bullish</span>
                  <span className="font-mono text-[#3FB950]">{((data.bullish / data.candles) * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7D8590]">Avg Range</span>
                  <span className="font-mono text-[#F59E0B]">{(data.totalRange / data.candles).toFixed(4)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Day of week */}
      <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-5 mb-6">
        <h2 className="text-sm text-[#7D8590] uppercase tracking-wider mb-4">Day of Week Analysis</h2>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, d) => {
            const data = byDay[d] || { candles: 0, bullish: 0, totalRange: 0 }
            const bullPct = data.candles > 0 ? (data.bullish / data.candles) * 100 : 0
            return (
              <div key={d} className="bg-[#0A0B0E] rounded p-3 text-center">
                <p className="text-xs font-semibold text-[#E6EDF3] mb-2">{DAY_NAMES[d]}</p>
                <div className="h-16 flex flex-col justify-end mb-2">
                  <div
                    className="rounded-sm mx-auto w-6"
                    style={{
                      height: `${data.candles > 0 ? Math.max(4, (bullPct / 100) * 64) : 0}px`,
                      backgroundColor: bullPct >= 50 ? '#3FB950' : '#F85149',
                    }}
                  />
                </div>
                <p className="text-[10px] font-mono" style={{ color: bullPct >= 50 ? '#3FB950' : '#F85149' }}>
                  {bullPct.toFixed(0)}%
                </p>
                <p className="text-[9px] text-[#4B5563]">{data.candles}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Monthly heatmap */}
      <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-5 mb-6">
        <h2 className="text-sm text-[#7D8590] uppercase tracking-wider mb-4">Monthly Performance Heatmap</h2>
        <div className="flex flex-wrap gap-2">
          {monthEntries.map(([key, data]) => {
            const [year, month] = key.split('-').map(Number)
            const bullPct = data.total > 0 ? (data.bullish / data.total) * 100 : 50
            const avgMove = data.total > 0 ? data.totalMove / data.total : 0
            const intensity = Math.min(1, Math.abs(bullPct - 50) / 50)
            const bg = bullPct >= 50
              ? `rgba(63,185,80,${0.1 + intensity * 0.5})`
              : `rgba(248,81,73,${0.1 + intensity * 0.5})`
            return (
              <div
                key={key}
                className="rounded p-2 text-center min-w-[56px] border border-[#1E2228]"
                style={{ backgroundColor: bg }}
                title={`${MONTH_NAMES[month]} ${year}: ${bullPct.toFixed(0)}% bullish, avg move ${avgMove.toFixed(3)}%`}
              >
                <p className="text-[9px] text-[#7D8590]">{MONTH_NAMES[month]}</p>
                <p className="text-[9px] text-[#7D8590]">{year}</p>
                <p className="text-xs font-mono font-bold" style={{ color: bullPct >= 50 ? '#3FB950' : '#F85149' }}>
                  {bullPct.toFixed(0)}%
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Volatility distribution */}
      <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-5">
        <h2 className="text-sm text-[#7D8590] uppercase tracking-wider mb-4">Volatility Distribution (Candle Range)</h2>
        <div className="flex items-end gap-1 h-32">
          {buckets.map((count, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-[#F59E0B] hover:bg-[#D97706] transition-colors"
                style={{ height: `${maxBucket > 0 ? (count / maxBucket) * 120 : 0}px` }}
                title={`${(bucketSize * i).toFixed(2)}–${(bucketSize * (i + 1)).toFixed(2)}: ${count}`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-[#4B5563] mt-1">
          <span>0</span>
          <span>{(bucketSize * 10).toFixed(2)}</span>
          <span>{(bucketSize * 20).toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
