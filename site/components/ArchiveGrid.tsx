'use client'

import { useMemo, useState } from 'react'
import { ArchiveCard } from './ArchiveCard'
import { CATEGORY_LABEL, type ArchiveCategory, type ArchiveEntry } from '@/lib/content/types'
import { cn } from '@/lib/cn'

const CATEGORIES: (ArchiveCategory | 'all')[] = [
  'all',
  'drink',
  'sound',
  'scent',
  'light',
  'space',
  'person',
  'object',
  'night',
  'collaboration',
  'melaka',
]

export function ArchiveGrid({ entries }: { entries: ArchiveEntry[] }) {
  const [active, setActive] = useState<ArchiveCategory | 'all'>('all')

  const filtered = useMemo(
    () => (active === 'all' ? entries : entries.filter((e) => e.category === active)),
    [entries, active],
  )

  return (
    <div>
      <div
        className="-mx-5 flex gap-x-6 gap-y-2 overflow-x-auto px-5 pb-4 md:mx-0 md:flex-wrap md:px-0"
        role="tablist"
        aria-label="Filter archive by category"
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={active === cat}
            onClick={() => setActive(cat)}
            className={cn(
              'cat-label shrink-0 pb-1 transition-colors',
              active === cat
                ? 'border-b border-tobacco text-tobacco'
                : 'border-b border-transparent text-warm-paper/45 hover:text-warm-paper/80',
            )}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>

      <p className="mt-6 cat-label text-warm-paper/35">
        {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((entry) => (
          <ArchiveCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}
