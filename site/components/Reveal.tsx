'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * A single quiet fade-and-rise, triggered once when scrolled into view.
 * Plain IntersectionObserver + CSS transition — no animation library.
 * Kept as the site's only entrance motion so nothing feels like it's
 * performing.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn('reveal', visible && 'is-visible', className)}
      style={{ transitionDelay: `${delay}s` }}
    >
      {children}
    </div>
  )
}
