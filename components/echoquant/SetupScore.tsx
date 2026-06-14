'use client'
import { SetupScore as SetupScoreType } from '@/lib/echoquant/types'

interface Props {
  score: SetupScoreType
  hasLiquiditySweep?: boolean
}

function ScoreGauge({ value }: { value: number }) {
  const size = 140
  const cx = size / 2
  const cy = size / 2
  const r = 55
  const circumference = Math.PI * r // half circle
  const progress = (value / 100) * circumference

  const edgeColor = value >= 65 ? '#3FB950' : value >= 45 ? '#F59E0B' : '#F85149'

  // Arc from left to right (bottom half circle approach: -180 to 0 degrees)
  const startAngle = Math.PI
  const endAngle = 0
  const trackStart = {
    x: cx + r * Math.cos(startAngle),
    y: cy + r * Math.sin(startAngle),
  }
  const trackEnd = {
    x: cx + r * Math.cos(endAngle),
    y: cy + r * Math.sin(endAngle),
  }

  const fillAngle = startAngle + (value / 100) * Math.PI
  const fillEnd = {
    x: cx + r * Math.cos(fillAngle),
    y: cy + r * Math.sin(fillAngle),
  }

  return (
    <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
      {/* Track */}
      <path
        d={`M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 0 1 ${trackEnd.x} ${trackEnd.y}`}
        fill="none"
        stroke="#1E2228"
        strokeWidth={10}
        strokeLinecap="round"
      />
      {/* Fill */}
      {value > 0 && (
        <path
          d={`M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 0 1 ${fillEnd.x} ${fillEnd.y}`}
          fill="none"
          stroke={edgeColor}
          strokeWidth={10}
          strokeLinecap="round"
        />
      )}
      {/* Score text */}
      <text x={cx} y={cy - 4} textAnchor="middle" fill={edgeColor} fontSize={28} fontWeight="bold" fontFamily="monospace">
        {value}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#7D8590" fontSize={10}>
        / 100
      </text>
    </svg>
  )
}

function ScoreBar({ label, value, max = 20 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[#7D8590] w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-[#1E2228] rounded-full h-1.5 overflow-hidden">
        <div className="h-full bg-[#F59E0B] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-[#E6EDF3] w-6 text-right">{value}</span>
    </div>
  )
}

export default function SetupScore({ score, hasLiquiditySweep = false }: Props) {
  const edgeColors = {
    Positive: 'text-[#3FB950] bg-[#3FB950]/10 border-[#3FB950]/30',
    Neutral: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30',
    Negative: 'text-[#F85149] bg-[#F85149]/10 border-[#F85149]/30',
  }
  const strengthColors = {
    High: 'text-[#3FB950] bg-[#3FB950]/10 border-[#3FB950]/30',
    Medium: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30',
    Low: 'text-[#7D8590] bg-[#1E2228] border-[#2A2D35]',
  }

  return (
    <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg p-5">
      <h3 className="text-sm text-[#7D8590] uppercase tracking-wider mb-4">Setup Score</h3>

      {/* Gauge */}
      <div className="flex justify-center mb-2">
        <ScoreGauge value={score.total} />
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 justify-center mb-5">
        <span className={`text-xs px-2.5 py-1 rounded border font-semibold ${edgeColors[score.edge]}`}>
          {score.edge} Edge
        </span>
        <span className={`text-xs px-2.5 py-1 rounded border ${strengthColors[score.patternStrength]}`}>
          {score.patternStrength} Pattern
        </span>
        <span className="text-xs px-2.5 py-1 rounded border border-[#2A2D35] text-[#7D8590]">
          {score.label}
        </span>
        {hasLiquiditySweep && (
          <span className="text-xs px-2.5 py-1 rounded border border-[#F59E0B]/30 text-[#F59E0B] bg-[#F59E0B]/10">
            Liq. Sweep
          </span>
        )}
      </div>

      {/* Score breakdown */}
      <div className="space-y-2">
        <ScoreBar label="Trend Align" value={score.trendAlignment} max={20} />
        <ScoreBar label="Session" value={score.sessionQuality} max={20} />
        <ScoreBar label="Volatility" value={score.volatility} max={15} />
        <ScoreBar label="Pattern Sim." value={score.patternSimilarity} max={20} />
        <ScoreBar label="Liq. Sweep" value={score.liquiditySweep} max={15} />
        <ScoreBar label="RSI" value={score.rsiCondition} max={15} />
        <ScoreBar label="MA Structure" value={score.maStructure} max={10} />
      </div>
    </div>
  )
}
