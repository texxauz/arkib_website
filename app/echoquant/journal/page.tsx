'use client'
import { useState, useCallback } from 'react'
import { useEchoQuant } from '@/lib/echoquant/store'
import { Trade } from '@/lib/echoquant/types'
import { Plus, TrendingUp, TrendingDown, Brain } from 'lucide-react'

const emotions = ['Confident', 'Fearful', 'Greedy', 'Neutral', 'FOMO']
const sessions = ['Asian', 'London', 'New York', 'Off-Hours']

function emptyForm(): Omit<Trade, 'id'> {
  return {
    date: new Date().toISOString().slice(0, 16),
    symbol: 'XAUUSD',
    direction: 'LONG',
    entry: 0,
    exit: 0,
    stopLoss: undefined,
    takeProfit: undefined,
    profitLoss: 0,
    profitLossPct: 0,
    reason: '',
    emotion: 'Neutral',
    mistakes: '',
    session: 'London',
    notes: '',
    tags: [],
  }
}

function computeInsights(trades: Trade[]) {
  if (trades.length === 0) return null
  const wins = trades.filter(t => t.profitLoss > 0)
  const losses = trades.filter(t => t.profitLoss <= 0)
  const winRate = (wins.length / trades.length) * 100

  const bySession: Record<string, { wins: number; total: number }> = {}
  for (const t of trades) {
    if (!bySession[t.session]) bySession[t.session] = { wins: 0, total: 0 }
    bySession[t.session].total++
    if (t.profitLoss > 0) bySession[t.session].wins++
  }

  const sessionRates = Object.entries(bySession).map(([s, v]) => ({ session: s, rate: (v.wins / v.total) * 100, total: v.total }))
  sessionRates.sort((a, b) => b.rate - a.rate)

  const mistakeCounts: Record<string, number> = {}
  for (const t of trades) {
    if (t.mistakes) {
      const words = t.mistakes.toLowerCase().split(/[\s,]+/).filter(Boolean)
      for (const w of words) { mistakeCounts[w] = (mistakeCounts[w] || 0) + 1 }
    }
  }
  const topMistake = Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1])[0]

  const avgRR = trades.reduce((s, t) => {
    if (!t.stopLoss || !t.takeProfit) return s
    const risk = Math.abs(t.entry - t.stopLoss)
    const reward = Math.abs(t.takeProfit - t.entry)
    return s + (risk > 0 ? reward / risk : 0)
  }, 0) / trades.length

  // Streak
  let currentStreak = 0
  let streakType = ''
  for (let i = trades.length - 1; i >= 0; i--) {
    const isWin = trades[i].profitLoss > 0
    if (currentStreak === 0) { currentStreak = 1; streakType = isWin ? 'win' : 'loss' }
    else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) currentStreak++
    else break
  }

  const totalPnl = trades.reduce((s, t) => s + t.profitLoss, 0)

  return { winRate, sessionRates, topMistake, avgRR, currentStreak, streakType, totalPnl, wins: wins.length, losses: losses.length }
}

export default function JournalPage() {
  const { trades, addTrade } = useEchoQuant()
  const [form, setForm] = useState(emptyForm())
  const [tagsInput, setTagsInput] = useState('')
  const [showForm, setShowForm] = useState(false)

  const insights = computeInsights(trades)

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const pl = form.exit - form.entry
    const plPct = form.entry > 0 ? (pl / form.entry) * 100 : 0
    const dirMul = form.direction === 'LONG' ? 1 : -1
    const trade: Trade = {
      ...form,
      id: Date.now().toString(),
      profitLoss: pl * dirMul,
      profitLossPct: plPct * dirMul,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
    }
    addTrade(trade)
    setForm(emptyForm())
    setTagsInput('')
    setShowForm(false)
  }, [form, tagsInput, addTrade])

  const field = (key: keyof typeof form, label: string, type = 'text', opts?: string[]) => (
    <div>
      <label className="text-xs text-[#7D8590] mb-1 block">{label}</label>
      {opts ? (
        <select
          value={form[key] as string}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full bg-[#1E2228] border border-[#2A2D35] text-[#E6EDF3] text-sm rounded px-3 py-2"
        >
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={form[key] as string | number}
          onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
          className="w-full bg-[#1E2228] border border-[#2A2D35] text-[#E6EDF3] text-sm rounded px-3 py-2"
        />
      )}
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-mono font-bold text-[#E6EDF3]">Trading Journal</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-[#F59E0B] text-black font-semibold px-4 py-2 rounded-md hover:bg-[#D97706] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Trade
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-[#E6EDF3] mb-4">New Trade</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {field('date', 'Date & Time', 'datetime-local')}
            {field('direction', 'Direction', 'text', ['LONG', 'SHORT'])}
            {field('entry', 'Entry Price', 'number')}
            {field('exit', 'Exit Price', 'number')}
            {field('stopLoss', 'Stop Loss', 'number')}
            {field('takeProfit', 'Take Profit', 'number')}
            {field('session', 'Session', 'text', sessions)}
            {field('emotion', 'Emotion', 'text', emotions)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {field('reason', 'Setup Reason')}
            {field('mistakes', 'Mistakes Made')}
            <div>
              <label className="text-xs text-[#7D8590] mb-1 block">Tags (comma-separated)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="scalp, london, fvg"
                className="w-full bg-[#1E2228] border border-[#2A2D35] text-[#E6EDF3] text-sm rounded px-3 py-2"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs text-[#7D8590] mb-1 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full bg-[#1E2228] border border-[#2A2D35] text-[#E6EDF3] text-sm rounded px-3 py-2 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="bg-[#F59E0B] text-black font-semibold px-5 py-2 rounded hover:bg-[#D97706] transition-colors text-sm">
              Save Trade
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-[#1E2228] text-[#E6EDF3] px-5 py-2 rounded hover:bg-[#2D333B] transition-colors text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Insights */}
      {insights && (
        <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-[#F59E0B]" />
            <h2 className="text-sm font-semibold text-[#E6EDF3]">AI Insights</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Win Rate', value: `${insights.winRate.toFixed(1)}%`, color: insights.winRate >= 50 ? 'text-[#3FB950]' : 'text-[#F85149]' },
              { label: 'Total P&L', value: `$${insights.totalPnl.toFixed(2)}`, color: insights.totalPnl >= 0 ? 'text-[#3FB950]' : 'text-[#F85149]' },
              { label: 'Avg R:R', value: isNaN(insights.avgRR) ? '—' : insights.avgRR.toFixed(2), color: 'text-[#58A6FF]' },
              { label: 'Current Streak', value: `${insights.currentStreak} ${insights.streakType}s`, color: insights.streakType === 'win' ? 'text-[#3FB950]' : 'text-[#F85149]' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#0A0B0E] rounded p-3">
                <p className="text-xs text-[#7D8590] mb-1">{label}</p>
                <p className={`text-lg font-mono font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm text-[#7D8590]">
            {insights.sessionRates.length >= 2 && (
              <p>Your win rate during <span className="text-[#E6EDF3]">{insights.sessionRates[0].session}</span> session is <span className="text-[#3FB950]">{insights.sessionRates[0].rate.toFixed(0)}%</span> vs <span className="text-[#F85149]">{insights.sessionRates[insights.sessionRates.length - 1].rate.toFixed(0)}%</span> during <span className="text-[#E6EDF3]">{insights.sessionRates[insights.sessionRates.length - 1].session}</span>.</p>
            )}
            {insights.topMistake && (
              <p>Most common mistake keyword: <span className="text-[#F59E0B]">&ldquo;{insights.topMistake[0]}&rdquo;</span> (appears {insights.topMistake[1]}x).</p>
            )}
            <p><span className="text-[#E6EDF3]">{insights.wins}</span> wins and <span className="text-[#E6EDF3]">{insights.losses}</span> losses recorded.</p>
          </div>
        </div>
      )}

      {/* Trade history */}
      <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E2228]">
          <h3 className="text-sm font-semibold text-[#E6EDF3]">Trade History ({trades.length})</h3>
        </div>
        {trades.length === 0 ? (
          <div className="p-8 text-center text-[#4B5563] text-sm">No trades logged yet. Add your first trade above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E2228]">
                  {['Date', 'Dir', 'Entry', 'Exit', 'P&L', 'P&L%', 'Session', 'Emotion', 'Tags', 'Reason'].map(h => (
                    <th key={h} className="text-left text-xs text-[#7D8590] px-4 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...trades].reverse().map(t => (
                  <tr key={t.id} className="border-b border-[#1E2228] hover:bg-[#1E2228]/30 transition-colors">
                    <td className="px-4 py-2 text-xs text-[#7D8590] font-mono whitespace-nowrap">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      <span className={`flex items-center gap-1 text-xs font-semibold ${t.direction === 'LONG' ? 'text-[#3FB950]' : 'text-[#F85149]'}`}>
                        {t.direction === 'LONG' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {t.direction}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-[#E6EDF3]">{t.entry.toFixed(2)}</td>
                    <td className="px-4 py-2 font-mono text-[#E6EDF3]">{t.exit.toFixed(2)}</td>
                    <td className={`px-4 py-2 font-mono font-semibold ${t.profitLoss >= 0 ? 'text-[#3FB950]' : 'text-[#F85149]'}`}>
                      {t.profitLoss >= 0 ? '+' : ''}{t.profitLoss.toFixed(2)}
                    </td>
                    <td className={`px-4 py-2 font-mono ${t.profitLossPct >= 0 ? 'text-[#3FB950]' : 'text-[#F85149]'}`}>
                      {t.profitLossPct >= 0 ? '+' : ''}{t.profitLossPct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-xs text-[#7D8590]">{t.session}</td>
                    <td className="px-4 py-2 text-xs text-[#7D8590]">{t.emotion}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {t.tags.map(tag => (
                          <span key={tag} className="text-[10px] bg-[#1E2228] text-[#7D8590] px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-[#7D8590] max-w-[150px] truncate">{t.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
