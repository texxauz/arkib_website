'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium min-w-[280px] animate-in slide-in-from-right duration-200',
            t.type === 'success' ? 'bg-emerald-950 border-emerald-800 text-emerald-300' :
            t.type === 'error' ? 'bg-rose-950 border-rose-800 text-rose-300' :
            'bg-[#1A1A1E] border-[#2A2A30] text-[#F0EEF6]'
          )}>
            {t.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {t.message}
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="ml-auto opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
