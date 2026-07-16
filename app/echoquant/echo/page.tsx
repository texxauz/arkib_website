'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useEchoQuant } from '@/lib/echoquant/store'
import { findEchoMatches, analyzeFuturePaths } from '@/lib/echoquant/analytics'
import { EchoMatch } from '@/lib/echoquant/types'
import { Zap, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'

function EchoPathChart({ paths, height = 200 }: { paths: number[][], height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || paths.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    const allVals = paths.flat()
    const minV = Math.min(...allVals)
    const maxV = Math.max(...allVals)
    const range = maxV - minV || 1

    const toX = (i: number, len: number) => (i / (len - 1)) * w
    const toY = (v: number) => h - ((v - minV) / range) * (h - 20) - 10

    // Draw zero line
    ctx.strokeStyle = '#2A2D35'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    const zeroY = toY(0)
    ctx.moveTo(0, zeroY)
    ctx.lineTo(w, zeroY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw individual paths
    for (const path of paths) {
      ctx.strokeStyle = '#58A6FF20'
      ctx.lineWidth = 1
      ctx.beginPath()
      path.forEach((v, i) => {
        if (i === 0) ctx.moveTo(toX(i, path.length), toY(v))
        else ctx.lineTo(toX(i, path.length), toY(v))
      })
      ctx.stroke()
    }

    // Draw median path
    if (paths.length > 0) {
      const len = paths[0].length
      const medianPath = Array.from({ length: len }, (_, i) => {
        const vals = paths.map(p => p[i] ?? 0).sort((a, b) => a - b)
        const mid = Math.floor(vals.length / 2)
        return vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid]
      })

      ctx.strokeStyle = '#F59E0B'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      medianPath.forEach((v, i) => {
        if (i === 0) ctx.moveTo(toX(i, len), toY(v))
        else ctx.lineTo(toX(i, len), toY(v))
      })
      ctx.stroke()
    }
  }, [paths])

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={height}
      className="w-full rounded"
      style={{ height: `${height}px` }}
    />
  )
}

export default function EchoScannerPage() {
  const { candles, patternLength, setPatternLength, forwardLength, setForwardLength, echoMatches, setEchoMatches, futureAnalysis, setFutureAnalysis } = useEchoQuant()
  const [minScore, setMinScore] = useState(0.70)
  const [scanning, setScanning] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<EchoMatch | null>(null)

  const runScan = useCallback(async () => {
    if (candles.length === 0) return
    setScanning(true)
    await new Promise(r => setTimeout(r, 50))
    try {
      const matches = findEchoMatches(candles, patternLength, forwardLength, minScore)
      setEchoMatches(matches)
      const analysis = analyzeFuturePaths(matches, forwardLength)
      setFutureAnalysis(analysis)
    } finally {
      setScanning(false)
    }
  }, [candles, patternLength, forwardLength, minScore, setEchoMatches, setFutureAnalysis])

  const fmt = (n: number, d = 2) => n.toFixed(d)
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-mono font-bold text-[#E6EDF3] mb-6">Echo Scanner</h1>

      {/* Config panel */}
      <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-5 mb-6">
        <h2 className="text-sm text-[#7D8590] uppercase tracking-wider mb-4">Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="text-xs text-[#7D8590] mb-2 block">Pattern Length (candles)</label>
            <div className="flex gap-2">
              {[20, 50, 100].map(v => (
                <button
                  key={v}
                  onClick={() => setPatternLength(v)}
                  className={`flex-1 py-1.5 text-sm rounded border transition-colors ${patternLength === v ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#F59E0B]' : 'border-[#1E2228] text-[#7D8590] hover:text-[#E6EDF3]'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#7D8590] mb-2 block">Forward Length (candles)</label>
            <div className="flex gap-2 flex-wrap">
              {[5, 10, 20, 50].map(v => (
                <button
                  key={v}
                  onClick={() => setForwardLength(v)}
                  className={`px-3 py-1.5 text-sm rounded border transition-colors ${forwardLength === v ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#F59E0B]' : 'border-[#1E2228] text-[#7D8590] hover:text-[#E6EDF3]'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#7D8590] mb-2 block">Min Similarity: <span className="text-[#F59E0B] font-mono">{(minScore * 100).toFixed(0)}%</span></label>
            <input
              type="range"
              min={0.5}
              max={0.95}
              step={0.01}
              value={minScore}
              onChange={e => setMinScore(parseFloat(e.target.value))}
              className="w-full accent-[#F59E0B]"
            />
          </div>
        </div>
        <button
          onClick={runScan}
          disabled={scanning || candles.length === 0}
          className="mt-5 flex items-center gap-2 bg-[#F59E0B] text-black font-semibold px-6 py-2.5 rounded-md hover:bg-[#D97706] disabled:opacity-50 transition-colors"
        >
          <Zap className="w-4 h-4" />
          {scanning ? 'Scanning...' : `Run Echo Scan (${candles.length.toLocaleString()} candles)`}
        </button>
        {candles.length === 0 && (
          <p className="text-xs text-[#7D8590] mt-2">Upload CSV data on the Chart page first.</p>
        )}
      </div>

      {/* Results */}
      {futureAnalysis && (
        <>
          {futureAnalysis.matchCount < 10 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Low sample size ({futureAnalysis.matchCount} matches). Results may not be statistically significant.
            </div>
          )}

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Matches Found', value: futureAnalysis.matchCount.toString(), color: 'text-[#E6EDF3]' },
              { label: 'Bullish', value: `${fmt(futureAnalysis.bullishPct, 1)}%`, color: 'text-[#3FB950]', icon: TrendingUp },
              { label: 'Bearish', value: `${fmt(futureAnalysis.bearishPct, 1)}%`, color: 'text-[#F85149]', icon: TrendingDown },
              { label: 'Median Move', value: fmtPct(futureAnalysis.medianMove), color: futureAnalysis.medianMove >= 0 ? 'text-[#3FB950]' : 'text-[#F85149]' },
              { label: 'Avg Move', value: fmtPct(futureAnalysis.avgMove), color: futureAnalysis.avgMove >= 0 ? 'text-[#3FB950]' : 'text-[#F85149]' },
              { label: 'Best Case (MFE)', value: fmtPct(futureAnalysis.maxFavorableExcursion), color: 'text-[#3FB950]' },
              { label: 'Worst Case (MAE)', value: fmtPct(futureAnalysis.maxAdverseExcursion), color: 'text-[#F85149]' },
              { label: 'Volatility', value: `${fmt(futureAnalysis.volatility)}%`, color: 'text-[#58A6FF]' },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-4">
                <p className="text-xs text-[#7D8590] mb-1">{label}</p>
                <div className="flex items-center gap-1.5">
                  {Icon && <Icon className={`w-3 h-3 ${color}`} />}
                  <p className={`text-xl font-mono font-bold ${color}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Path chart */}
          {futureAnalysis.paths.length > 0 && (
            <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-4 mb-6">
              <h3 className="text-sm text-[#7D8590] mb-3">Echo Paths — <span className="text-[#F59E0B]">amber = median</span>, <span className="text-blue-400/50">blue = individual paths</span></h3>
              <EchoPathChart paths={futureAnalysis.paths} height={220} />
            </div>
          )}

          {/* Matches table */}
          {echoMatches.length > 0 && (
            <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-[#1E2228]">
                <h3 className="text-sm font-semibold text-[#E6EDF3]">Top Matches</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1E2228]">
                      {['Date', 'Similarity', 'Pearson', 'DTW', 'Cosine', 'Future Return'].map(h => (
                        <th key={h} className="text-left text-xs text-[#7D8590] px-4 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {echoMatches.slice(0, 20).map((m, i) => {
                      const futureReturn = m.futureCandles.length > 0
                        ? ((m.futureCandles[m.futureCandles.length - 1].close - m.futureCandles[0].open) / m.futureCandles[0].open) * 100
                        : 0
                      const date = new Date(m.startTime * 1000).toLocaleDateString()
                      return (
                        <tr
                          key={i}
                          onClick={() => setSelectedMatch(selectedMatch === m ? null : m)}
                          className={`border-b border-[#1E2228] cursor-pointer transition-colors ${selectedMatch === m ? 'bg-[#F59E0B]/5' : 'hover:bg-[#1E2228]/50'}`}
                        >
                          <td className="px-4 py-2 font-mono text-xs text-[#7D8590]">{date}</td>
                          <td className="px-4 py-2 font-mono text-[#F59E0B]">{(m.compositeScore * 100).toFixed(1)}%</td>
                          <td className="px-4 py-2 font-mono text-[#E6EDF3]">{fmt(m.pearsonScore, 3)}</td>
                          <td className="px-4 py-2 font-mono text-[#E6EDF3]">{fmt(m.dtwScore, 3)}</td>
                          <td className="px-4 py-2 font-mono text-[#E6EDF3]">{fmt(m.cosineScore, 3)}</td>
                          <td className={`px-4 py-2 font-mono ${futureReturn >= 0 ? 'text-[#3FB950]' : 'text-[#F85149]'}`}>{fmtPct(futureReturn)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-[#1E2228]/50 border border-[#2A2D35] rounded-lg p-4 text-xs text-[#7D8590]">
            <strong className="text-[#E6EDF3]">Disclaimer:</strong> This analysis is based on historical data only. Past similarity does not guarantee future results. This is NOT financial advice.
          </div>
        </>
      )}
    </div>
  )
}
