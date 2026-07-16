'use client'
import { Candle, NormalizedPattern, EchoMatch, FutureAnalysis, LiquidityLevel, SetupScore } from './types'

// ---- NORMALIZATION ----
export function normalizePattern(candles: Candle[]): NormalizedPattern {
  const closes = candles.map(c => c.close)
  const highs = candles.map(c => c.high)
  const lows = candles.map(c => c.low)

  const mean = closes.reduce((a,b) => a+b, 0) / closes.length
  const std = Math.sqrt(closes.reduce((s,c) => s + (c-mean)**2, 0) / closes.length)
  const zCloses = closes.map(c => std === 0 ? 0 : (c - mean) / std)
  const zHighs = highs.map(h => std === 0 ? 0 : (h - mean) / std)
  const zLows = lows.map(l => std === 0 ? 0 : (l - mean) / std)

  const bodyRatios = candles.map(c => {
    const range = c.high - c.low
    return range === 0 ? 0 : Math.abs(c.close - c.open) / range
  })

  const wickRatios = candles.map(c => {
    const range = c.high - c.low
    const body_top = Math.max(c.open, c.close)
    return range === 0 ? 0 : (c.high - body_top) / range
  })

  return { closes: zCloses, highs: zHighs, lows: zLows, bodyRatios, wickRatios }
}

// ---- SIMILARITY METRICS ----
export function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length
  const meanA = a.reduce((s,v) => s+v, 0) / n
  const meanB = b.reduce((s,v) => s+v, 0) / n
  const num = a.reduce((s,v,i) => s + (v - meanA) * (b[i] - meanB), 0)
  const denA = Math.sqrt(a.reduce((s,v) => s + (v - meanA)**2, 0))
  const denB = Math.sqrt(b.reduce((s,v) => s + (v - meanB)**2, 0))
  return denA === 0 || denB === 0 ? 0 : num / (denA * denB)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((s,v,i) => s + v * b[i], 0)
  const magA = Math.sqrt(a.reduce((s,v) => s + v**2, 0))
  const magB = Math.sqrt(b.reduce((s,v) => s + v**2, 0))
  return magA === 0 || magB === 0 ? 0 : dot / (magA * magB)
}

export function dtwDistance(a: number[], b: number[]): number {
  const n = a.length, m = b.length
  const dtw: number[][] = Array.from({length: n+1}, () => new Array(m+1).fill(Infinity))
  dtw[0][0] = 0
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(a[i-1] - b[j-1])
      dtw[i][j] = cost + Math.min(dtw[i-1][j], dtw[i][j-1], dtw[i-1][j-1])
    }
  }
  return dtw[n][m]
}

export function dtwSimilarity(a: number[], b: number[]): number {
  const dist = dtwDistance(a, b)
  return 1 / (1 + dist / a.length)
}

export function compositeScore(pearson: number, dtw: number, cosine: number): number {
  const p = (pearson + 1) / 2
  return (p * 0.4 + dtw * 0.35 + ((cosine + 1) / 2) * 0.25)
}

// ---- ECHO PATTERN FINDER ----
export function findEchoMatches(
  candles: Candle[],
  patternLength: number,
  forwardLength: number,
  minScore: number = 0.7
): EchoMatch[] {
  if (candles.length < patternLength * 2 + forwardLength) return []

  const targetCandles = candles.slice(-patternLength)
  const targetPattern = normalizePattern(targetCandles)

  const matches: EchoMatch[] = []
  const limit = candles.length - patternLength - forwardLength

  for (let i = 0; i <= limit - patternLength; i += 3) {
    const windowCandles = candles.slice(i, i + patternLength)
    const windowPattern = normalizePattern(windowCandles)

    const pearson = pearsonCorrelation(targetPattern.closes, windowPattern.closes)
    const dtw = dtwSimilarity(targetPattern.closes, windowPattern.closes)
    const cosine = cosineSimilarity(targetPattern.closes, windowPattern.closes)
    const score = compositeScore(pearson, dtw, cosine)

    if (score >= minScore) {
      const futureCandles = candles.slice(i + patternLength, i + patternLength + forwardLength)
      matches.push({
        startIndex: i,
        endIndex: i + patternLength,
        startTime: candles[i].time,
        endTime: candles[i + patternLength - 1].time,
        pearsonScore: pearson,
        dtwScore: dtw,
        cosineScore: cosine,
        compositeScore: score,
        futureCandles
      })
    }
  }

  return matches.sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 50)
}

// ---- FUTURE PATH ANALYSIS ----
export function analyzeFuturePaths(matches: EchoMatch[], forwardLength: number): FutureAnalysis {
  if (matches.length === 0) {
    return { matchCount: 0, bullishPct: 0, bearishPct: 0, avgMove: 0, medianMove: 0, maxFavorableExcursion: 0, maxAdverseExcursion: 0, volatility: 0, paths: [] }
  }

  const paths: number[][] = []

  for (const match of matches) {
    if (match.futureCandles.length === 0) continue
    const entryPrice = match.futureCandles[0].open
    const path = match.futureCandles.map(c => ((c.close - entryPrice) / entryPrice) * 100)
    paths.push(path)
  }

  const finalMoves = paths.map(p => p[p.length - 1] ?? 0)
  const bullish = finalMoves.filter(m => m > 0).length
  const bullishPct = (bullish / finalMoves.length) * 100

  const sorted = [...finalMoves].sort((a,b) => a-b)
  const mid = Math.floor(sorted.length / 2)
  const medianMove = sorted.length % 2 === 0 ? (sorted[mid-1] + sorted[mid]) / 2 : sorted[mid]
  const avgMove = finalMoves.reduce((s,v) => s+v, 0) / finalMoves.length

  let mfe = 0, mae = 0
  for (const path of paths) {
    const maxGain = Math.max(...path)
    const maxLoss = Math.min(...path)
    if (maxGain > mfe) mfe = maxGain
    if (maxLoss < mae) mae = maxLoss
  }

  const variance = finalMoves.reduce((s,v) => s + (v - avgMove)**2, 0) / finalMoves.length
  const volatility = Math.sqrt(variance)

  return {
    matchCount: paths.length,
    bullishPct,
    bearishPct: 100 - bullishPct,
    avgMove,
    medianMove,
    maxFavorableExcursion: mfe,
    maxAdverseExcursion: mae,
    volatility,
    paths
  }
}

// ---- TECHNICAL INDICATORS ----
export function calculateSMA(candles: Candle[], period: number): number[] {
  return candles.map((_, i) => {
    if (i < period - 1) return NaN
    const slice = candles.slice(i - period + 1, i + 1)
    return slice.reduce((s, c) => s + c.close, 0) / period
  })
}

export function calculateRSI(candles: Candle[], period: number = 14): number[] {
  const rsi: number[] = new Array(candles.length).fill(NaN)
  if (candles.length < period + 1) return rsi

  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i-1].close
    if (diff >= 0) gains += diff; else losses -= diff
  }

  let avgGain = gains / period
  let avgLoss = losses / period
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i-1].close
    const gain = diff >= 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }

  return rsi
}

export function calculateATR(candles: Candle[], period: number = 14): number[] {
  const atr: number[] = new Array(candles.length).fill(NaN)
  if (candles.length < 2) return atr

  const trueRanges = candles.map((c, i) => {
    if (i === 0) return c.high - c.low
    const prev = candles[i-1]
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
  })

  let sum = trueRanges.slice(0, period).reduce((s,v) => s+v, 0)
  atr[period-1] = sum / period

  for (let i = period; i < candles.length; i++) {
    atr[i] = (atr[i-1] * (period - 1) + trueRanges[i]) / period
  }

  return atr
}

// ---- LIQUIDITY DETECTION ----
export function detectLiquidityLevels(candles: Candle[]): LiquidityLevel[] {
  const levels: LiquidityLevel[] = []
  if (candles.length < 20) return levels

  const last = candles[candles.length - 1]
  const lastTime = last.time

  const lookback = Math.min(50, candles.length)
  const recent = candles.slice(-lookback)

  for (let i = 2; i < recent.length - 2; i++) {
    const h = recent[i].high
    if (h > recent[i-1].high && h > recent[i-2].high && h > recent[i+1].high && h > recent[i+2].high) {
      const swept = recent.slice(i+1).some(c => c.high > h)
      levels.push({
        price: h,
        type: swept ? 'SWEEP_HIGH' : 'SWING_HIGH',
        strength: swept ? 0.9 : 0.6,
        time: recent[i].time
      })
    }
    const l = recent[i].low
    if (l < recent[i-1].low && l < recent[i-2].low && l < recent[i+1].low && l < recent[i+2].low) {
      const swept = recent.slice(i+1).some(c => c.low < l)
      levels.push({
        price: l,
        type: swept ? 'SWEEP_LOW' : 'SWING_LOW',
        strength: swept ? 0.9 : 0.6,
        time: recent[i].time
      })
    }
  }

  const tolerance = last.close * 0.001
  const highs = recent.map(c => c.high).sort((a,b) => a-b)
  const lows = recent.map(c => c.low).sort((a,b) => a-b)

  for (let i = 0; i < highs.length - 1; i++) {
    if (Math.abs(highs[i] - highs[i+1]) < tolerance) {
      levels.push({ price: (highs[i] + highs[i+1])/2, type: 'EQH', strength: 0.8, time: lastTime })
      i++
    }
  }
  for (let i = 0; i < lows.length - 1; i++) {
    if (Math.abs(lows[i] - lows[i+1]) < tolerance) {
      levels.push({ price: (lows[i] + lows[i+1])/2, type: 'EQL', strength: 0.8, time: lastTime })
      i++
    }
  }

  return levels.slice(0, 20)
}

// ---- MARKET CLOCK ----
export interface HourStats {
  hour: number
  avgRange: number
  avgVolume: number
  bullishPct: number
  bearishPct: number
  atr: number
  sampleSize: number
}

export function calculateMarketClock(candles: Candle[]): HourStats[] {
  const byHour: Record<number, Candle[]> = {}

  for (const c of candles) {
    const hour = new Date(c.time * 1000).getUTCHours()
    if (!byHour[hour]) byHour[hour] = []
    byHour[hour].push(c)
  }

  return Array.from({length: 24}, (_, hour) => {
    const cs = byHour[hour] || []
    if (cs.length === 0) return { hour, avgRange: 0, avgVolume: 0, bullishPct: 0, bearishPct: 0, atr: 0, sampleSize: 0 }

    const ranges = cs.map(c => ((c.high - c.low) / c.low) * 100)
    const avgRange = ranges.reduce((s,v) => s+v, 0) / ranges.length
    const avgVolume = cs.reduce((s,c) => s+c.volume, 0) / cs.length
    const bullish = cs.filter(c => c.close > c.open).length
    const bullishPct = (bullish / cs.length) * 100

    return {
      hour,
      avgRange,
      avgVolume,
      bullishPct,
      bearishPct: 100 - bullishPct,
      atr: avgRange,
      sampleSize: cs.length
    }
  })
}

// ---- SETUP SCORE ----
export function calculateSetupScore(
  candles: Candle[],
  echoScore: number,
  hasLiquiditySweep: boolean
): SetupScore {
  if (candles.length < 20) return { total: 0, trendAlignment: 0, sessionQuality: 0, volatility: 0, patternSimilarity: 0, liquiditySweep: 0, rsiCondition: 0, maStructure: 0, label: 'Insufficient data', edge: 'Neutral', patternStrength: 'Low' }

  const sma20 = calculateSMA(candles, 20)
  const sma50 = candles.length >= 50 ? calculateSMA(candles, 50) : null
  const rsiVals = calculateRSI(candles, 14)
  const last = candles[candles.length - 1]
  const lastSma20 = sma20[sma20.length - 1]
  const lastSma50 = sma50 ? sma50[sma50.length - 1] : null
  const lastRsi = rsiVals[rsiVals.length - 1]

  let trendAlignment = 0
  if (!isNaN(lastSma20)) {
    trendAlignment += last.close > lastSma20 ? 12 : -5
    if (lastSma50 && !isNaN(lastSma50)) trendAlignment += last.close > lastSma50 ? 8 : -3
    trendAlignment = Math.max(0, Math.min(20, trendAlignment + 10))
  } else trendAlignment = 10

  const hour = new Date(last.time * 1000).getUTCHours()
  let sessionQuality = 5
  if ((hour >= 7 && hour <= 10) || (hour >= 13 && hour <= 15)) sessionQuality = 20
  else if (hour >= 10 && hour <= 13) sessionQuality = 15
  else if (hour >= 0 && hour <= 3) sessionQuality = 8

  const atrs = calculateATR(candles, 14)
  const lastAtr = atrs[atrs.length - 1]
  const validAtrs = atrs.filter(v => !isNaN(v))
  const avgAtr = validAtrs.reduce((s,v) => s+v, 0) / validAtrs.length
  const volatility = lastAtr > avgAtr * 0.7 && lastAtr < avgAtr * 1.5 ? 15 : 8

  const patternSimilarity = Math.round(echoScore * 20)
  const liquiditySweep = hasLiquiditySweep ? 15 : 5

  let rsiCondition = 8
  if (!isNaN(lastRsi)) {
    if (lastRsi < 35 || lastRsi > 65) rsiCondition = 12
    if (lastRsi < 25 || lastRsi > 75) rsiCondition = 15
  }

  const maStructure = (!isNaN(lastSma20) && lastSma50 && !isNaN(lastSma50) && lastSma20 > lastSma50) ? 10 : 5

  const total = trendAlignment + sessionQuality + volatility + patternSimilarity + liquiditySweep + rsiCondition + maStructure
  const capped = Math.min(100, total)

  const edge: SetupScore['edge'] = capped >= 65 ? 'Positive' : capped >= 45 ? 'Neutral' : 'Negative'
  const patternStrength: SetupScore['patternStrength'] = echoScore >= 0.85 ? 'High' : echoScore >= 0.70 ? 'Medium' : 'Low'
  const session = hour >= 7 && hour <= 10 ? 'London' : hour >= 13 && hour <= 16 ? 'New York' : hour >= 0 && hour <= 3 ? 'Asian' : 'Off-Hours'

  return { total: capped, trendAlignment, sessionQuality, volatility, patternSimilarity, liquiditySweep, rsiCondition, maStructure, label: session, edge, patternStrength }
}
