'use client'
import { useCallback, useState } from 'react'
import Papa from 'papaparse'
import { Candle } from '@/lib/echoquant/types'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  onUpload: (candles: Candle[]) => void
}

export default function CSVUploader({ onUpload }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [count, setCount] = useState(0)
  const [error, setError] = useState('')

  const parseCSV = useCallback((file: File) => {
    setStatus('loading')
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data as Record<string, string>[]
          const candles: Candle[] = []

          for (const row of rows) {
            const getVal = (names: string[]) => {
              for (const name of names) {
                const key = Object.keys(row).find(k => k.toLowerCase().trim().replace(/["ï»¿]/g, '') === name)
                if (key) return parseFloat(row[key].replace(/,/g, ''))
              }
              return NaN
            }

            // Match date column: handles "Date", "Timestamp", "Datetime", "Etc/UTC", "GMT+0", etc.
            const dateKey = Object.keys(row).find(k => {
              const lk = k.toLowerCase().trim().replace(/[^a-z0-9/]/g, '')
              return ['date', 'timestamp', 'datetime', 'time'].includes(lk) ||
                lk.startsWith('etc/') || lk.startsWith('gmt') || lk.startsWith('utc')
            })
            const timeKey = Object.keys(row).find(k => k.toLowerCase().trim() === 'time' && k !== dateKey)

            let ts = NaN
            if (dateKey) {
              const dateStr = timeKey ? `${row[dateKey]} ${row[timeKey]}` : row[dateKey]
              const d = new Date(dateStr)
              if (!isNaN(d.getTime())) {
                ts = Math.floor(d.getTime() / 1000)
              } else {
                // DD.MM.YYYY HH:MM
                const m = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/)
                if (m) ts = Math.floor(new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00Z`).getTime() / 1000)
                // YYYY.MM.DD HH:MM:SS (Dukascopy)
                const m2 = dateStr.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/)
                if (!m && m2) ts = Math.floor(new Date(`${m2[1]}-${m2[2]}-${m2[3]}T${m2[4]}:${m2[5]}:00Z`).getTime() / 1000)
              }
            }

            const open = getVal(['open'])
            const high = getVal(['high'])
            const low = getVal(['low'])
            const close = getVal(['close', 'price'])
            const volume = getVal(['volume', 'vol', 'tickvol', 'tick volume']) || 0

            if (!isNaN(ts) && !isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close)) {
              candles.push({ time: ts, open, high, low, close, volume })
            }
          }

          if (candles.length === 0) throw new Error('No valid candles parsed. Check CSV format.')

          candles.sort((a, b) => a.time - b.time)
          setCount(candles.length)
          setStatus('done')
          onUpload(candles)
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : 'Unknown error')
          setStatus('error')
        }
      },
      error: (e: { message: string }) => { setError(e.message); setStatus('error') }
    })
  }, [onUpload])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) parseCSV(file)
  }, [parseCSV])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseCSV(file)
  }, [parseCSV])

  return (
    <div
      onDrop={onDrop}
      onDragOver={e => e.preventDefault()}
      className="border-2 border-dashed border-[#2A2D35] rounded-lg p-8 text-center hover:border-[#F59E0B] transition-colors cursor-pointer"
      onClick={() => document.getElementById('csv-input')?.click()}
    >
      <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={onFileChange} />
      {status === 'idle' && (
        <div className="flex flex-col items-center gap-3">
          <Upload className="w-10 h-10 text-[#6B7280]" />
          <p className="text-[#9CA3AF]">Drop XAUUSD CSV here or click to upload</p>
          <p className="text-xs text-[#4B5563]">Expected columns: Date, Open, High, Low, Close, Volume</p>
        </div>
      )}
      {status === 'loading' && <p className="text-[#F59E0B] animate-pulse">Parsing CSV...</p>}
      {status === 'done' && (
        <div className="flex flex-col items-center gap-2">
          <CheckCircle className="w-8 h-8 text-green-500" />
          <p className="text-green-400 font-mono">{count.toLocaleString()} candles loaded</p>
        </div>
      )}
      {status === 'error' && (
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
