'use client'
import React, { createContext, useContext, useState, useCallback } from 'react'
import { Candle, Trade, EchoMatch, FutureAnalysis } from './types'

interface EchoQuantStore {
  candles: Candle[]
  setCandles: (c: Candle[]) => void
  symbol: string
  setSymbol: (s: string) => void
  timeframe: string
  setTimeframe: (t: string) => void
  trades: Trade[]
  setTrades: (t: Trade[]) => void
  addTrade: (t: Trade) => void
  patternLength: number
  setPatternLength: (n: number) => void
  forwardLength: number
  setForwardLength: (n: number) => void
  echoMatches: EchoMatch[]
  setEchoMatches: (m: EchoMatch[]) => void
  futureAnalysis: FutureAnalysis | null
  setFutureAnalysis: (f: FutureAnalysis | null) => void
}

const EchoQuantContext = createContext<EchoQuantStore | null>(null)

export function EchoQuantProvider({ children }: { children: React.ReactNode }) {
  const [candles, setCandles] = useState<Candle[]>([])
  const [symbol, setSymbol] = useState('XAUUSD')
  const [timeframe, setTimeframe] = useState('M15')
  const [trades, setTrades] = useState<Trade[]>([])
  const [patternLength, setPatternLength] = useState(50)
  const [forwardLength, setForwardLength] = useState(20)
  const [echoMatches, setEchoMatches] = useState<EchoMatch[]>([])
  const [futureAnalysis, setFutureAnalysis] = useState<FutureAnalysis | null>(null)

  const addTrade = useCallback((t: Trade) => setTrades(prev => [...prev, t]), [])

  return (
    <EchoQuantContext.Provider value={{
      candles, setCandles, symbol, setSymbol, timeframe, setTimeframe,
      trades, setTrades, addTrade, patternLength, setPatternLength,
      forwardLength, setForwardLength, echoMatches, setEchoMatches,
      futureAnalysis, setFutureAnalysis
    }}>
      {children}
    </EchoQuantContext.Provider>
  )
}

export function useEchoQuant() {
  const ctx = useContext(EchoQuantContext)
  if (!ctx) throw new Error('useEchoQuant must be used within EchoQuantProvider')
  return ctx
}
