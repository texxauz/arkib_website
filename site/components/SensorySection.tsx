'use client'

import { useState } from 'react'
import { EditorialImage } from './EditorialImage'
import { cn } from '@/lib/cn'
import type { ImageRef } from '@/lib/content/types'

const SENSES: { key: string; label: string; copy: string; image: ImageRef }[] = [
  {
    key: 'drink',
    label: 'Drink',
    copy: 'Recipes built like short essays — one idea, argued precisely, then left alone.',
    image: { alt: 'A drink being finished at the bar', tone: 'tobacco', plate: 'PLATE S.01' },
  },
  {
    key: 'sound',
    label: 'Sound',
    copy: 'Tape and vinyl, chosen nightly. Loud enough to matter, quiet enough to talk over.',
    image: { alt: 'Tape deck detail', tone: 'ink', plate: 'PLATE S.02' },
  },
  {
    key: 'scent',
    label: 'Scent',
    copy: 'One signature note, diffused low. Meant to be felt before it is noticed.',
    image: { alt: 'Scent diffuser in low light', tone: 'smoke', plate: 'PLATE S.03' },
  },
  {
    key: 'light',
    label: 'Light',
    copy: 'Every fixture at 2700K. Warm enough that the room disappears into itself.',
    image: { alt: 'Warm tungsten light across the bar', tone: 'tobacco', plate: 'PLATE S.04' },
  },
  {
    key: 'space',
    label: 'Space',
    copy: 'Brass, brick, timber and fabric — chosen to age, not to impress.',
    image: { alt: 'Interior material detail', tone: 'ink', plate: 'PLATE S.05' },
  },
]

export function SensorySection() {
  const [active, setActive] = useState(0)

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16">
      <div className="order-2 md:order-1">
        {SENSES.map((sense, i) => (
          <button
            key={sense.key}
            type="button"
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            aria-pressed={active === i}
            className="block w-full border-b border-black-line py-6 text-left first:border-t"
          >
            <div className="flex items-baseline gap-4">
              <span className="cat-label text-warm-paper/35">0{i + 1}</span>
              <span
                className={cn(
                  'font-serif text-3xl transition-colors sm:text-4xl',
                  active === i ? 'text-tobacco' : 'text-warm-paper',
                )}
              >
                {sense.label}
              </span>
            </div>
            <p
              className={cn(
                'mt-3 max-w-md pl-9 text-sm leading-relaxed text-warm-paper/55 transition-all duration-300',
                active === i ? 'max-h-24 opacity-100' : 'max-h-0 overflow-hidden opacity-0 md:max-h-24 md:opacity-100',
              )}
            >
              {sense.copy}
            </p>
          </button>
        ))}
      </div>

      <div className="order-1 md:order-2">
        <EditorialImage
          image={SENSES[active].image}
          aspect="4 / 5"
          className="border border-black-line"
        />
      </div>
    </div>
  )
}
