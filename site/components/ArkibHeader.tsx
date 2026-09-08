'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

const NAV = [
  { href: '/world', label: 'World' },
  { href: '/drinks', label: 'Drinks' },
  { href: '/people', label: 'People' },
  { href: '/archive', label: 'Archive' },
  { href: '/visit', label: 'Visit' },
]

export function ArkibHeader() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    document.documentElement.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [menuOpen])

  return (
    // Two independent fixed elements, not nested: `backdrop-blur` below
    // creates a new containing block for fixed descendants, which would
    // otherwise clamp the full-screen mobile overlay to the bar's own height.
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-colors duration-500',
          scrolled || menuOpen ? 'bg-arkib-black/90 backdrop-blur-sm' : 'bg-transparent',
        )}
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-5 md:px-10">
          <Link
            href="/"
            className="font-serif text-lg tracking-[0.08em] text-warm-paper"
            aria-label="ARKIB — return home"
          >
            ARKIB
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'cat-label text-warm-paper/70 transition-colors hover:text-warm-paper',
                  pathname === item.href && 'text-tobacco',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="cat-label text-warm-paper md:hidden"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
      </header>

      <div
        className={cn(
          'fixed inset-0 z-40 flex flex-col justify-center gap-2 bg-arkib-black px-8 transition-opacity duration-400 md:hidden',
          menuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        {NAV.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            className="border-b border-black-line py-4 font-serif text-4xl text-warm-paper transition-colors hover:text-tobacco xs:text-5xl"
            style={{ transitionDelay: menuOpen ? `${i * 40}ms` : '0ms' }}
          >
            {item.label}
          </Link>
        ))}
        <p className="mt-8 cat-label text-warm-paper/50">Melaka, Malaysia — Est. 2025</p>
      </div>
    </>
  )
}
