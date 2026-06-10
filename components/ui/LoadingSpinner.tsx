'use client'
import { cn } from '@/lib/utils'

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="w-6 h-6 border-2 border-[#2A2A30] border-t-[#8B5CF6] rounded-full animate-spin" />
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#2A2A30] border-t-[#8B5CF6] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#9896A4] text-sm">Loading ARKIB...</p>
      </div>
    </div>
  )
}
