import Link from 'next/link'
import { LineChart, Search, Clock, BookOpen, BarChart3, Settings, TrendingUp, Zap } from 'lucide-react'

const features = [
  {
    icon: LineChart,
    title: 'Chart',
    description: 'Full OHLCV candlestick chart with SMA, RSI, ATR overlays and echo pattern visualization.',
    href: '/echoquant/chart',
    color: 'text-blue-400',
  },
  {
    icon: Search,
    title: 'Echo Scanner',
    description: 'Find historical price patterns similar to current market structure using Pearson, DTW & Cosine similarity.',
    href: '/echoquant/echo',
    color: 'text-[#F59E0B]',
  },
  {
    icon: Clock,
    title: 'Market Clock',
    description: 'Analyze volatility, volume and direction by hour across all trading sessions.',
    href: '/echoquant/clock',
    color: 'text-purple-400',
  },
  {
    icon: BookOpen,
    title: 'Journal',
    description: 'Track your trades, emotions and mistakes. Get AI-powered insights from your trade history.',
    href: '/echoquant/journal',
    color: 'text-green-400',
  },
  {
    icon: BarChart3,
    title: 'Statistics',
    description: 'Deep statistical analysis of your candle data — sessions, days, volatility distribution.',
    href: '/echoquant/stats',
    color: 'text-red-400',
  },
  {
    icon: Settings,
    title: 'Settings',
    description: 'Configure default symbol, timeframe, similarity thresholds and export your data.',
    href: '/echoquant/settings',
    color: 'text-[#7D8590]',
  },
]

export default function EchoQuantDashboard() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <Zap className="w-8 h-8 text-[#F59E0B]" />
          <h1 className="text-3xl font-mono font-bold text-[#E6EDF3]">EchoQuant Terminal</h1>
        </div>
        <p className="text-[#7D8590] text-lg">Professional XAUUSD scalping analysis platform</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Candles Loaded', value: '—', icon: TrendingUp },
          { label: 'Patterns Found', value: '—', icon: Search },
          { label: 'Trades Logged', value: '—', icon: BookOpen },
          { label: 'Win Rate', value: '—', icon: BarChart3 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-xs text-[#7D8590] uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-mono text-[#E6EDF3]">{value}</p>
          </div>
        ))}
      </div>

      {/* Feature cards */}
      <h2 className="text-sm text-[#7D8590] uppercase tracking-wider mb-4">Modules</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map(({ icon: Icon, title, description, href, color }) => (
          <Link
            key={href}
            href={href}
            className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-5 hover:border-[#F59E0B]/40 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <Icon className={`w-5 h-5 ${color} group-hover:scale-110 transition-transform`} />
              <h3 className="font-semibold text-[#E6EDF3]">{title}</h3>
            </div>
            <p className="text-sm text-[#7D8590] leading-relaxed">{description}</p>
          </Link>
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-10 text-xs text-[#4B5563] text-center">
        EchoQuant Terminal — client-side analysis only. Upload your XAUUSD CSV data to begin.
      </p>
    </div>
  )
}
