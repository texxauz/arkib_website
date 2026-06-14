'use client'
import { useState } from 'react'
import { useEchoQuant } from '@/lib/echoquant/store'
import { Trade } from '@/lib/echoquant/types'
import { Download, Trash2, Save } from 'lucide-react'

export default function SettingsPage() {
  const { symbol, setSymbol, timeframe, setTimeframe, candles, setCandles, setTrades, trades } = useEchoQuant()
  const [minSimilarity, setMinSimilarity] = useState(70)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = () => {
    if (confirm('Clear all candle data and trades? This cannot be undone.')) {
      setCandles([])
      setTrades([])
    }
  }

  const exportTrades = () => {
    if (trades.length === 0) return
    const headers = ['id', 'date', 'symbol', 'direction', 'entry', 'exit', 'stopLoss', 'takeProfit', 'profitLoss', 'profitLossPct', 'session', 'emotion', 'reason', 'mistakes', 'notes', 'tags']
    const rows = trades.map((t: Trade) =>
      headers.map(h => {
        const val = t[h as keyof Trade]
        return Array.isArray(val) ? val.join(';') : String(val ?? '')
      }).join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'echoquant_trades.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-mono font-bold text-[#E6EDF3] mb-6">Settings</h1>

      <div className="space-y-6">
        {/* General */}
        <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-5">
          <h2 className="text-sm text-[#7D8590] uppercase tracking-wider mb-4">General</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-[#7D8590] mb-2 block">Default Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={e => setSymbol(e.target.value.toUpperCase())}
                className="w-full bg-[#1E2228] border border-[#2A2D35] text-[#E6EDF3] text-sm rounded px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-[#7D8590] mb-2 block">Default Timeframe</label>
              <select
                value={timeframe}
                onChange={e => setTimeframe(e.target.value)}
                className="w-full bg-[#1E2228] border border-[#2A2D35] text-[#E6EDF3] text-sm rounded px-3 py-2"
              >
                {['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map(tf => (
                  <option key={tf}>{tf}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs text-[#7D8590] mb-2 block">
              Min Similarity Threshold: <span className="text-[#F59E0B] font-mono">{minSimilarity}%</span>
            </label>
            <input
              type="range"
              min={60}
              max={95}
              step={1}
              value={minSimilarity}
              onChange={e => setMinSimilarity(parseInt(e.target.value))}
              className="w-full accent-[#F59E0B]"
            />
            <div className="flex justify-between text-[10px] text-[#4B5563] mt-1">
              <span>60% (more matches)</span>
              <span>95% (strict)</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-[#F59E0B] text-black font-semibold px-4 py-2 rounded hover:bg-[#D97706] transition-colors text-sm"
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>

        {/* Color theme */}
        <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-5">
          <h2 className="text-sm text-[#7D8590] uppercase tracking-wider mb-4">Theme</h2>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 bg-[#1E2228] border border-[#F59E0B]/40 rounded px-4 py-2">
              <div className="w-4 h-4 rounded-full bg-[#0A0B0E] border border-[#F59E0B]" />
              <span className="text-sm text-[#E6EDF3]">Dark (Active)</span>
            </div>
          </div>
          <p className="text-xs text-[#4B5563] mt-2">Additional themes coming soon.</p>
        </div>

        {/* Data management */}
        <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-5">
          <h2 className="text-sm text-[#7D8590] uppercase tracking-wider mb-4">Data Management</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-[#1E2228]">
              <div>
                <p className="text-sm text-[#E6EDF3]">Candles in memory</p>
                <p className="text-xs text-[#7D8590]">{candles.length.toLocaleString()} candles loaded</p>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[#1E2228]">
              <div>
                <p className="text-sm text-[#E6EDF3]">Trades journal</p>
                <p className="text-xs text-[#7D8590]">{trades.length} trades logged</p>
              </div>
              <button
                onClick={exportTrades}
                disabled={trades.length === 0}
                className="flex items-center gap-1.5 bg-[#1E2228] text-[#E6EDF3] px-3 py-1.5 rounded text-xs hover:bg-[#2D333B] disabled:opacity-40 transition-colors"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-[#E6EDF3]">Clear all data</p>
                <p className="text-xs text-[#7D8590]">Remove all candles and trades from memory</p>
              </div>
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 bg-[#F85149]/10 text-[#F85149] border border-[#F85149]/30 px-3 py-1.5 rounded text-xs hover:bg-[#F85149]/20 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-5">
          <h2 className="text-sm text-[#7D8590] uppercase tracking-wider mb-3">About</h2>
          <p className="text-sm text-[#7D8590]">EchoQuant Terminal — client-side XAUUSD scalping analysis.</p>
          <p className="text-xs text-[#4B5563] mt-2">All data processed locally in your browser. Nothing is sent to any server.</p>
        </div>
      </div>
    </div>
  )
}
