'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
import { useEchoQuant } from '@/lib/echoquant/store'
import { calculateSMA, calculateRSI, calculateATR, findEchoMatches } from '@/lib/echoquant/analytics'
import CSVUploader from '@/components/echoquant/CSVUploader'
import { Candle } from '@/lib/echoquant/types'
import { Eye, EyeOff, Zap } from 'lucide-react'

export default function ChartPage() {
  const { candles, setCandles, symbol, timeframe, patternLength, forwardLength, setEchoMatches } = useEchoQuant()
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const rsiContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)
  const rsiChartRef = useRef<ReturnType<typeof createChart> | null>(null)

  const [showSMA20, setShowSMA20] = useState(true)
  const [showSMA50, setShowSMA50] = useState(true)
  const [showSMA200, setShowSMA200] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [atrValue, setAtrValue] = useState<number | null>(null)

  const initChart = useCallback(() => {
    if (!chartContainerRef.current || !rsiContainerRef.current) return
    if (chartRef.current) { try { chartRef.current.remove() } catch {} chartRef.current = null }
    if (rsiChartRef.current) { try { rsiChartRef.current.remove() } catch {} rsiChartRef.current = null }

    const chartOptions = {
      layout: { background: { color: '#0D1117' }, textColor: '#7D8590' },
      grid: { vertLines: { color: '#1E2228' }, horzLines: { color: '#1E2228' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#1E2228' },
      timeScale: { borderColor: '#1E2228', timeVisible: true, secondsVisible: false },
    }

    const chart = createChart(chartContainerRef.current, {
      ...chartOptions,
      width: chartContainerRef.current.clientWidth,
      height: 500,
    })
    chartRef.current = chart

    const rsiChart = createChart(rsiContainerRef.current, {
      ...chartOptions,
      width: rsiContainerRef.current.clientWidth,
      height: 150,
      rightPriceScale: { borderColor: '#1E2228', scaleMargins: { top: 0.1, bottom: 0.1 } },
    })
    rsiChartRef.current = rsiChart

    // Sync time scales
    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range) rsiChart.timeScale().setVisibleLogicalRange(range)
    })
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range) chart.timeScale().setVisibleLogicalRange(range)
    })

    return { chart, rsiChart }
  }, [])

  useEffect(() => {
    if (candles.length === 0) return

    const charts = initChart()
    if (!charts) return
    const { chart, rsiChart } = charts

    // Candlestick
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#3FB950',
      downColor: '#F85149',
      borderUpColor: '#3FB950',
      borderDownColor: '#F85149',
      wickUpColor: '#3FB950',
      wickDownColor: '#F85149',
    })
    candleSeries.setData(candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })))

    // Volume
    const volSeries = chart.addSeries(HistogramSeries, {
      color: '#58A6FF',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
    volSeries.setData(candles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? '#3FB95040' : '#F8514940'
    })))

    // SMAs
    if (showSMA20) {
      const sma20 = calculateSMA(candles, 20)
      const sma20Series = chart.addSeries(LineSeries, { color: '#58A6FF', lineWidth: 1 })
      sma20Series.setData(candles.map((c, i) => ({ time: c.time, value: sma20[i] })).filter(d => !isNaN(d.value)))
    }
    if (showSMA50 && candles.length >= 50) {
      const sma50 = calculateSMA(candles, 50)
      const sma50Series = chart.addSeries(LineSeries, { color: '#F59E0B', lineWidth: 1 })
      sma50Series.setData(candles.map((c, i) => ({ time: c.time, value: sma50[i] })).filter(d => !isNaN(d.value)))
    }
    if (showSMA200 && candles.length >= 200) {
      const sma200 = calculateSMA(candles, 200)
      const sma200Series = chart.addSeries(LineSeries, { color: '#9C27B0', lineWidth: 1 })
      sma200Series.setData(candles.map((c, i) => ({ time: c.time, value: sma200[i] })).filter(d => !isNaN(d.value)))
    }

    // RSI
    const rsiVals = calculateRSI(candles, 14)
    const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#F59E0B', lineWidth: 1 })
    rsiSeries.setData(candles.map((c, i) => ({ time: c.time, value: rsiVals[i] })).filter(d => !isNaN(d.value)))

    // RSI levels
    const ob = rsiChart.addSeries(LineSeries, { color: '#F8514960', lineWidth: 1, lineStyle: 2 })
    const os = rsiChart.addSeries(LineSeries, { color: '#3FB95060', lineWidth: 1, lineStyle: 2 })
    const rsiData = candles.map((c, i) => ({ time: c.time, value: rsiVals[i] })).filter(d => !isNaN(d.value))
    if (rsiData.length > 0) {
      ob.setData(rsiData.map(d => ({ ...d, value: 70 })))
      os.setData(rsiData.map(d => ({ ...d, value: 30 })))
    }

    // ATR
    const atrVals = calculateATR(candles, 14)
    const lastAtr = atrVals[atrVals.length - 1]
    if (!isNaN(lastAtr)) setAtrValue(lastAtr)

    chart.timeScale().fitContent()

    return () => {
      try { chart.remove() } catch {}
      try { rsiChart.remove() } catch {}
      chartRef.current = null
      rsiChartRef.current = null
    }
  }, [candles, showSMA20, showSMA50, showSMA200])

  const handleUpload = useCallback((c: Candle[]) => setCandles(c), [setCandles])

  const runEchoScan = useCallback(async () => {
    if (candles.length === 0) return
    setScanning(true)
    await new Promise(r => setTimeout(r, 50))
    const matches = findEchoMatches(candles, patternLength, forwardLength, 0.7)
    setEchoMatches(matches)
    setScanning(false)
  }, [candles, patternLength, forwardLength, setEchoMatches])

  return (
    <div className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-mono font-bold text-[#E6EDF3]">{symbol} — {timeframe}</h1>
          {atrValue && <p className="text-xs text-[#7D8590] mt-1">ATR(14): <span className="text-[#F59E0B] font-mono">{atrValue.toFixed(2)}</span></p>}
        </div>
        <button
          onClick={runEchoScan}
          disabled={scanning || candles.length === 0}
          className="flex items-center gap-2 bg-[#F59E0B] text-black font-semibold px-4 py-2 rounded-md hover:bg-[#D97706] disabled:opacity-50 transition-colors"
        >
          <Zap className="w-4 h-4" />
          {scanning ? 'Scanning...' : 'Run Echo Scan'}
        </button>
      </div>

      {candles.length === 0 ? (
        <div className="mb-6">
          <CSVUploader onUpload={handleUpload} />
        </div>
      ) : (
        <div className="mb-2 text-xs text-green-400 font-mono">{candles.length.toLocaleString()} candles loaded</div>
      )}

      {/* SMA toggles */}
      <div className="flex gap-3 mb-4">
        {[
          { label: 'SMA 20', active: showSMA20, toggle: () => setShowSMA20(v => !v), color: 'text-blue-400' },
          { label: 'SMA 50', active: showSMA50, toggle: () => setShowSMA50(v => !v), color: 'text-[#F59E0B]' },
          { label: 'SMA 200', active: showSMA200, toggle: () => setShowSMA200(v => !v), color: 'text-purple-400' },
        ].map(({ label, active, toggle, color }) => (
          <button
            key={label}
            onClick={toggle}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${active ? 'border-[#1E2228] bg-[#1E2228]' : 'border-[#1E2228] opacity-40'} ${color}`}
          >
            {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg overflow-hidden mb-2">
        <div ref={chartContainerRef} className="w-full" />
      </div>

      {/* RSI */}
      <div className="bg-[#0D1117] border border-[#1E2228] rounded-lg overflow-hidden">
        <div className="px-3 py-1 border-b border-[#1E2228]">
          <span className="text-xs text-[#7D8590]">RSI (14)</span>
        </div>
        <div ref={rsiContainerRef} className="w-full" />
      </div>
    </div>
  )
}
