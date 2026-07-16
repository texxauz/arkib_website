export interface Candle {
  time: number; // unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NormalizedPattern {
  closes: number[]; // z-score normalized
  highs: number[];
  lows: number[];
  bodyRatios: number[]; // body / (high-low)
  wickRatios: number[]; // wicks normalized
}

export interface EchoMatch {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  pearsonScore: number;
  dtwScore: number;
  cosineScore: number;
  compositeScore: number;
  futureCandles: Candle[];
}

export interface FutureAnalysis {
  matchCount: number;
  bullishPct: number;
  bearishPct: number;
  avgMove: number;
  medianMove: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  volatility: number;
  paths: number[][]; // each path is array of % moves
}

export interface LiquidityLevel {
  price: number;
  type: 'PDH' | 'PDL' | 'EQH' | 'EQL' | 'SWEEP_HIGH' | 'SWEEP_LOW' | 'SWING_HIGH' | 'SWING_LOW' | 'RESISTANCE' | 'SUPPORT';
  strength: number;
  time: number;
  sweepReverseRate?: number;
}

export interface Trade {
  id: string;
  date: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  exit: number;
  stopLoss?: number;
  takeProfit?: number;
  profitLoss: number;
  profitLossPct: number;
  reason: string;
  emotion: string;
  mistakes: string;
  session: string;
  notes: string;
  tags: string[];
}

export interface SetupScore {
  total: number;
  trendAlignment: number;
  sessionQuality: number;
  volatility: number;
  patternSimilarity: number;
  liquiditySweep: number;
  rsiCondition: number;
  maStructure: number;
  label: string;
  edge: 'Positive' | 'Neutral' | 'Negative';
  patternStrength: 'High' | 'Medium' | 'Low';
}
