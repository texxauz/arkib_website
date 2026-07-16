'use client'
import { useMemo } from 'react'
import { useEchoQuant } from '@/lib/echoquant/store'
import { calculateMarketClock, HourStats } from '@/lib/echoquant/analytics'

function getVolatilityColor(atr: number, max: number): string {
  if (max === 0) return '#1E2228'
  const ratio = atr / max
  if (ratio > 0.7) return '#F85149'
  if (ratio > 0.4) return '#F59E0B'
  if (ratio > 0.15) return '#58A6FF'
  return '#1E2228'
}

function getSession(hour: number): string {
  if (hour >= 0 && hour < 7) return 'Asian'
  if (hour >= 7 && hour < 12) return 'London'
  if (hour >= 12 && hour < 17) return 'New York'
  if (hour >= 17 && hour < 21) return 'Late NY'
  return 'Off-Hours'
}

function ClockFace({ stats }: { stats: HourStats[] }) {
  const size = 320
  const cx = size / 2
  const cy = size / 2
  const outerR = 140
  const innerR = 90
  const maxAtr = Math.max(...stats.map(s => s.avgRange))
  const now = new Date().getUTCHours()

  const segments = stats.map((s, hour) => {
    const startAngle = (hour / 24) * 2 * Math.PI - Math.PI / 2
    const endAngle = ((hour + 1) / 24) * 2 * Math.PI - Math.PI / 2
    const gap = 0.02

    const x1 = cx + outerR * Math.cos(startAngle + gap)
    const y1 = cy + outerR * Math.sin(startAngle + gap)
    const x2 = cx + outerR * Math.cos(endAngle - gap)
    const y2 = cy + outerR * Math.sin(endAngle - gap)
    const x3 = cx + innerR * Math.cos(endAngle - gap)
    const y3 = cy + innerR * Math.sin(endAngle - gap)
    const x4 = cx + innerR * Math.cos(startAngle + gap)
    const y4 = cy + innerR * Math.sin(startAngle + gap)

    const fill = getVolatilityColor(s.avgRange, maxAtr)

    // Hour label position
    const labelR = outerR + 18
    const labelAngle = (hour / 24) * 2 * Math.PI - Math.PI / 2 + (Math.PI / 24)
    const lx = cx + labelR * Math.cos(labelAngle)
    const ly = cy + labelR * Math.sin(labelAngle)

    return { hour, x1, y1, x2, y2, x3, y3, x4, y4, fill, lx, ly, labelAngle }
  })

  // Current hour dot
  const dotAngle = (now / 24) * 2 * Math.PI - Math.PI / 2 + (Math.PI / 24)
  const dotR = (outerR + innerR) / 2
  const dotX = cx + dotR * Math.cos(dotAngle)
  const dotY = cy + dotR * Math.sin(dotAngle)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {/* Session arcs */}
      {[
        { label: 'Asian', start: 0, end: 7, color: '#9C27B0' },
        { label: 'London', start: 7, end: 12, color: '#F59E0B' },
        { label: 'New York', start: 12, end: 17, color: '#58A6FF' },
      ].map(({ label, start, end, color }) => {
        const sA = (start / 24) * 2 * Math.PI - Math.PI / 2
        const eA = (end / 24) * 2 * Math.PI - Math.PI / 2
        const arcR = outerR + 34
        const mx = cx + arcR * Math.cos((sA + eA) / 2)
        const my = cy + arcR * Math.sin((sA + eA) / 2)
        return (
          <text key={label} x={mx} y={my} textAnchor="middle" dominantBaseline="middle"
            className="text-[8px]" fill={color} fontSize={7} fontWeight="bold">
            {label}
          </text>
        )
      })}

      {/* Segments */}
      {segments.map(({ hour, x1, y1, x2, y2, x3, y3, x4, y4, fill, lx, ly }) => (
        <g key={hour}>
          <path
            d={`M ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 0 0 ${x4} ${y4} Z`}
            fill={fill}
            stroke="#0A0B0E"
            strokeWidth={1}
            opacity={hour === now ? 1 : 0.75}
          />
          {hour % 3 === 0 && (
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="#4B5563" fontSize={9}>
              {hour.toString().padStart(2, '0')}
            </text>
          )}
        </g>
      ))}

      {/* Center */}
      <circle cx={cx} cy={cy} r={innerR - 2} fill="#0A0B0E" />
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#E6EDF3" fontSize={14} fontWeight="bold">
        {now.toString().padStart(2, '0')}:00
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#7D8590" fontSize={9}>
        UTC
      </text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="#F59E0B" fontSize={8}>
        {getSession(now)}
      </text>

      {/* Current hour dot */}
      <circle cx={dotX} cy={dotY} r={5} fill="#F59E0B" />
      <circle cx={dotX} cy={dotY} r={9} fill="none" stroke="#F59E0B" strokeWidth={1} opacity={0.4} />
    </svg>
  )
}

export default function MarketClockPage() {
  const { candles } = useEchoQuant()

  const stats = useMemo(() => {
    if (candles.length === 0) return null
    return calculateMarketClock(candles)
  }, [candles])

  const sortedByRange = useMemo(() => stats ? [...stats].sort((a, b) => b.avgRange - a.avgRange) : [], [stats])
  const sortedByBullish = useMemo(() => stats ? [...stats].filter(s => s.sampleSize > 0).sort((a, b) => b.bullishPct - a.bullishPct) : [], [stats])

  const placeholderStats: HourStats[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    avgRange: 0,
    avgVolume: 0,
    bullishPct: 50,
    bearishPct: 50,
    atr: 0,
    sampleSize: 0,
  }))

  const displayStats = stats ?? placeholderStats

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-mono font-bold text-[#E6EDF3] mb-6">Market Clock</h1>

      {!stats && (
        <div className="bg-[#1E2228]/50 border border-[#2A2D35] rounded-lg p-4 text-sm text-[#7D8590] mb-6">
          Upload CSV data to see your personalized hourly volatility analysis. The clock will color each hour by its historical average range.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Clock */}
        <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-6">
          <h2 className="text-sm text-[#7D8590] uppercase tracking-wider mb-4">24h Volatility Clock (UTC)</h2>
          <ClockFace stats={displayStats} />
          <div className="flex justify-center gap-6 mt-4 text-xs">
            {[
              { color: '#F85149', label: 'High vol' },
              { color: '#F59E0B', label: 'Med vol' },
              { color: '#58A6FF', label: 'Low vol' },
              { color: '#1E2228', label: 'Quiet' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-[#7D8590]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="space-y-4">
          <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-4">
            <h3 className="text-xs text-[#7D8590] uppercase tracking-wider mb-3">Best 3 Hours (Highest Volatility)</h3>
            {sortedByRange.slice(0, 3).map(s => (
              <div key={s.hour} className="flex justify-between items-center py-1.5 border-b border-[#1E2228] last:border-0">
                <span className="font-mono text-[#E6EDF3]">{s.hour.toString().padStart(2, '0')}:00 UTC</span>
                <span className="text-xs text-[#7D8590]">{getSession(s.hour)}</span>
                <span className="font-mono text-[#F59E0B]">{s.avgRange.toFixed(4)}%</span>
              </div>
            ))}
            {sortedByRange.length === 0 && <p className="text-xs text-[#4B5563]">No data yet</p>}
          </div>

          <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-4">
            <h3 className="text-xs text-[#7D8590] uppercase tracking-wider mb-3">Most Bullish Hours</h3>
            {sortedByBullish.slice(0, 3).map(s => (
              <div key={s.hour} className="flex justify-between items-center py-1.5 border-b border-[#1E2228] last:border-0">
                <span className="font-mono text-[#E6EDF3]">{s.hour.toString().padStart(2, '0')}:00 UTC</span>
                <div className="flex-1 mx-4 bg-[#1E2228] rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-[#3FB950]" style={{ width: `${s.bullishPct}%` }} />
                </div>
                <span className="font-mono text-[#3FB950]">{s.bullishPct.toFixed(0)}%</span>
              </div>
            ))}
            {sortedByBullish.length === 0 && <p className="text-xs text-[#4B5563]">No data yet</p>}
          </div>

          <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-4">
            <h3 className="text-xs text-[#7D8590] uppercase tracking-wider mb-3">Most Bearish Hours</h3>
            {[...sortedByBullish].reverse().slice(0, 3).map(s => (
              <div key={s.hour} className="flex justify-between items-center py-1.5 border-b border-[#1E2228] last:border-0">
                <span className="font-mono text-[#E6EDF3]">{s.hour.toString().padStart(2, '0')}:00 UTC</span>
                <div className="flex-1 mx-4 bg-[#1E2228] rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-[#F85149]" style={{ width: `${s.bearishPct}%` }} />
                </div>
                <span className="font-mono text-[#F85149]">{s.bearishPct.toFixed(0)}%</span>
              </div>
            ))}
            {sortedByBullish.length === 0 && <p className="text-xs text-[#4B5563]">No data yet</p>}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E2228]">
          <h3 className="text-sm font-semibold text-[#E6EDF3]">Hourly Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E2228]">
                {['Hour (UTC)', 'Session', 'Avg Range %', 'Avg Volume', 'Bullish %', 'Bearish %', 'Samples'].map(h => (
                  <th key={h} className="text-left text-xs text-[#7D8590] px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayStats.map(s => (
                <tr key={s.hour} className="border-b border-[#1E2228] hover:bg-[#1E2228]/30 transition-colors">
                  <td className="px-4 py-2 font-mono text-[#E6EDF3]">{s.hour.toString().padStart(2, '0')}:00</td>
                  <td className="px-4 py-2 text-xs text-[#7D8590]">{getSession(s.hour)}</td>
                  <td className="px-4 py-2 font-mono text-[#F59E0B]">{s.avgRange.toFixed(4)}%</td>
                  <td className="px-4 py-2 font-mono text-[#E6EDF3]">{s.avgVolume.toFixed(0)}</td>
                  <td className="px-4 py-2 font-mono text-[#3FB950]">{s.bullishPct.toFixed(1)}%</td>
                  <td className="px-4 py-2 font-mono text-[#F85149]">{s.bearishPct.toFixed(1)}%</td>
                  <td className="px-4 py-2 font-mono text-[#7D8590]">{s.sampleSize}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
