'use client'
import { useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, Landmark, ArrowUpRight, ArrowDownRight } from 'lucide-react'

type SaleRow = { date: string; total_revenue: number }
type ExpenseRow = { date: string; paid_at: string | null; amount: number; category: string; description: string | null; is_paid: boolean }

interface Props {
  openingBalance: number
  openingDate: string
  salesData: SaleRow[]
  expensesData: ExpenseRow[]
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function TreasuryClient({ openingBalance, openingDate, salesData, expensesData }: Props) {
  // Build a flat list of all transactions after the opening date, sorted by date
  const transactions = useMemo(() => {
    const list: { date: string; label: string; amount: number; type: 'in' | 'out'; category: string }[] = []

    for (const s of salesData) {
      if (s.date < openingDate) continue
      if (s.total_revenue === 0) continue
      list.push({ date: s.date, label: 'Sales', amount: s.total_revenue, type: 'in', category: 'Sales' })
    }

    for (const e of expensesData) {
      const dateStr = e.paid_at ? e.paid_at.slice(0, 10) : e.date
      if (dateStr < openingDate) continue
      list.push({
        date: dateStr,
        label: e.description || e.category,
        amount: e.amount,
        type: 'out',
        category: e.category,
      })
    }

    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [salesData, expensesData, openingDate])

  // Running balance
  const transactionsWithBalance = useMemo(() => {
    let balance = openingBalance
    return transactions.map(t => {
      balance = t.type === 'in' ? balance + t.amount : balance - t.amount
      return { ...t, balance }
    })
  }, [transactions, openingBalance])

  const currentBalance = transactionsWithBalance.length > 0
    ? transactionsWithBalance[transactionsWithBalance.length - 1].balance
    : openingBalance

  // Monthly summary
  const monthlySummary = useMemo(() => {
    const months: Record<string, { month: string; inflow: number; outflow: number; openingBal: number; closingBal: number }> = {}
    let runningBal = openingBalance

    for (const t of transactionsWithBalance) {
      const month = t.date.slice(0, 7)
      if (!months[month]) {
        months[month] = { month, inflow: 0, outflow: 0, openingBal: runningBal, closingBal: runningBal }
      }
      if (t.type === 'in') months[month].inflow += t.amount
      else months[month].outflow += t.amount
      months[month].closingBal = t.balance
      runningBal = t.balance
    }

    return Object.values(months).sort((a, b) => b.month.localeCompare(a.month))
  }, [transactionsWithBalance, openingBalance])

  const totalIn = transactions.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0)
  const totalOut = transactions.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0)
  const recentTx = [...transactionsWithBalance].reverse().slice(0, 30)

  return (
    <div className="min-h-screen bg-[#0A0A0D]">
      <TopBar title="Treasury" subtitle="Company cash position — owner only" />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

        {/* Current balance hero */}
        <div className="rounded-2xl border border-[#2A2A30] bg-gradient-to-br from-[#12121A] to-[#0D0D14] p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Landmark size={18} className="text-[#A78BFA]" />
                <span className="text-[#9896A4] text-sm font-medium uppercase tracking-wider">Current Bank Balance</span>
              </div>
              <p className={`text-5xl font-bold tracking-tight ${currentBalance >= 0 ? 'text-[#F0EEF6]' : 'text-rose-400'}`}>
                {formatCurrency(currentBalance)}
              </p>
              <p className="text-[#5A5865] text-xs mt-2">Opening balance: {formatCurrency(openingBalance)} on {fmtDate(openingDate)}</p>
            </div>
            <div className={`text-right px-4 py-2 rounded-xl border ${currentBalance >= openingBalance ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
              <p className={`text-xs font-medium ${currentBalance >= openingBalance ? 'text-emerald-400' : 'text-rose-400'}`}>
                {currentBalance >= openingBalance ? '+' : ''}{formatCurrency(currentBalance - openingBalance)}
              </p>
              <p className="text-[#5A5865] text-[10px] mt-0.5">since opening</p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowUpRight size={14} className="text-emerald-400" />
                <span className="text-emerald-400 text-xs font-medium">Total In</span>
              </div>
              <p className="text-[#F0EEF6] font-bold text-xl">{formatCurrency(totalIn)}</p>
              <p className="text-[#5A5865] text-xs mt-0.5">Sales revenue</p>
            </div>
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowDownRight size={14} className="text-rose-400" />
                <span className="text-rose-400 text-xs font-medium">Total Out</span>
              </div>
              <p className="text-[#F0EEF6] font-bold text-xl">{formatCurrency(totalOut)}</p>
              <p className="text-[#5A5865] text-xs mt-0.5">Paid expenses</p>
            </div>
          </div>
        </div>

        {/* Monthly breakdown */}
        {monthlySummary.length > 0 && (
          <div className="card">
            <h2 className="text-[#F0EEF6] font-semibold text-sm mb-4">Monthly Breakdown</h2>
            <div className="space-y-0">
              {/* Header */}
              <div className="grid grid-cols-5 gap-2 px-3 py-2 bg-[#0D0D10] rounded-lg mb-2">
                {['Month', 'Opening', '+ In', '− Out', 'Closing'].map(h => (
                  <span key={h} className="text-[#5A5865] text-[10px] uppercase tracking-wider font-semibold text-right first:text-left">{h}</span>
                ))}
              </div>
              {monthlySummary.map(m => (
                <div key={m.month} className="grid grid-cols-5 gap-2 px-3 py-2.5 rounded-lg hover:bg-[#1A1A1E] transition-colors">
                  <span className="text-[#F0EEF6] text-sm font-medium">
                    {new Date(m.month + '-01').toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}
                  </span>
                  <span className="text-[#9896A4] text-sm text-right">{formatCurrency(m.openingBal)}</span>
                  <span className="text-emerald-400 text-sm text-right">+{formatCurrency(m.inflow)}</span>
                  <span className="text-rose-400 text-sm text-right">−{formatCurrency(m.outflow)}</span>
                  <span className={`text-sm font-semibold text-right ${m.closingBal >= m.openingBal ? 'text-[#F0EEF6]' : 'text-rose-400'}`}>
                    {formatCurrency(m.closingBal)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent transactions */}
        <div className="card">
          <h2 className="text-[#F0EEF6] font-semibold text-sm mb-4">Recent Transactions</h2>
          {recentTx.length === 0 ? (
            <p className="text-[#5A5865] text-sm text-center py-8">No transactions recorded yet</p>
          ) : (
            <div className="space-y-0">
              <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-[#0D0D10] rounded-lg mb-2">
                {['Date', 'Description', 'Amount', 'Balance'].map(h => (
                  <span key={h} className="text-[#5A5865] text-[10px] uppercase tracking-wider font-semibold last:text-right">{h}</span>
                ))}
              </div>
              {recentTx.map((t, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 px-3 py-2.5 rounded-lg hover:bg-[#1A1A1E] transition-colors border-b border-[#1A1A1E] last:border-0">
                  <span className="text-[#9896A4] text-xs">{fmtDate(t.date)}</span>
                  <div>
                    <p className="text-[#F0EEF6] text-sm">{t.label}</p>
                    <p className="text-[#5A5865] text-[10px]">{t.category}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {t.type === 'in'
                      ? <><TrendingUp size={12} className="text-emerald-400" /><span className="text-emerald-400 text-sm">+{formatCurrency(t.amount)}</span></>
                      : <><TrendingDown size={12} className="text-rose-400" /><span className="text-rose-400 text-sm">−{formatCurrency(t.amount)}</span></>
                    }
                  </div>
                  <span className="text-[#F0EEF6] text-sm font-semibold text-right">{formatCurrency(t.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
