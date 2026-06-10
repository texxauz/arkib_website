'use client'
import { useEffect, useRef, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className={cn(
        'relative bg-[#141417] border border-[#2A2A30] rounded-2xl w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200',
        sizeClasses[size]
      )}>
        <div className="flex items-center justify-between p-5 border-b border-[#2A2A30]">
          <h2 className="text-[#F0EEF6] font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            className="text-[#9896A4] hover:text-[#F0EEF6] hover:bg-[#1A1A1E] p-1.5 rounded-lg transition-all"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[80vh]">
          {children}
        </div>
      </div>
    </div>
  )
}
