import { cn } from '@/lib/cn'

const HOURS = [
  { day: 'Tuesday — Thursday', time: '6PM — 1AM' },
  { day: 'Friday — Saturday', time: '6PM — 2AM' },
  { day: 'Sunday', time: '6PM — 12AM' },
  { day: 'Monday', time: 'Closed' },
]

/**
 * Practical info block. Styled ink-on-paper by design — this is the one
 * homepage section where function is allowed to lead, and it's meant to
 * sit on the warm paper background (see §11 of the brief).
 */
export function VisitSection({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-6', className)}>
      <div className="md:col-span-5">
        <p className="cat-label text-tobacco-dim">Visit</p>
        <h2 className="mt-3 font-serif text-4xl text-ink sm:text-5xl">
          ARKIB
          <br />
          Melaka, Malaysia
        </h2>
        <p className="mt-6 max-w-sm text-sm leading-relaxed text-ink/60">
          No. 12, Jalan Hang Lekiu, 75200 Melaka. Two minutes from the river,
          through an unmarked door.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <a
            href="mailto:reserve@arkib.bar"
            className="border border-ink px-6 py-3 text-sm uppercase tracking-wide text-ink transition-colors hover:bg-ink hover:text-warm-paper"
          >
            Reserve a Table
          </a>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noreferrer noopener"
            className="px-6 py-3 text-sm uppercase tracking-wide text-ink/70 underline-offset-4 hover:text-ink hover:underline"
          >
            @arkib on Instagram
          </a>
        </div>
      </div>

      <div className="md:col-span-3 md:col-start-7">
        <p className="cat-label text-ink/40">Hours</p>
        <dl className="mt-4 space-y-3">
          {HOURS.map((h) => (
            <div key={h.day} className="flex justify-between gap-4 border-b border-ink/15 pb-3 text-sm">
              <dt className="text-ink/70">{h.day}</dt>
              <dd className="text-ink/50">{h.time}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="md:col-span-3 md:col-start-10">
        <p className="cat-label text-ink/40">Contact</p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="sr-only">Email</dt>
            <dd>
              <a href="mailto:hello@arkib.bar" className="text-ink/70 hover:text-ink">
                hello@arkib.bar
              </a>
            </dd>
          </div>
          <div>
            <dt className="sr-only">Reservations</dt>
            <dd className="text-ink/50">Walk-ins welcome. Groups of 6+ by request.</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
