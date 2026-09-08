import Link from 'next/link'
import { ArkibHeader } from '@/components/ArkibHeader'
import { Footer } from '@/components/Footer'
import { Hero } from '@/components/Hero'
import { Reveal } from '@/components/Reveal'
import { SensorySection } from '@/components/SensorySection'
import { DrinkArchiveEntry } from '@/components/DrinkArchiveEntry'
import { PeopleSection } from '@/components/PeopleSection'
import { EditorialImage } from '@/components/EditorialImage'
import { VisitSection } from '@/components/VisitSection'
import { CreatureMark } from '@/components/CreatureMark'
import { getFeaturedDrinks, PEOPLE } from '@/lib/content/archive'
import { CATEGORY_LABEL, type ArchiveCategory } from '@/lib/content/types'

const ARCHIVE_CATEGORIES: ArchiveCategory[] = [
  'drink',
  'sound',
  'object',
  'person',
  'night',
  'collaboration',
  'melaka',
  'space',
]

export default function HomePage() {
  const featuredDrinks = getFeaturedDrinks()

  return (
    <>
      <ArkibHeader />
      <main>
        {/* 01 — OPEN */}
        <Hero />

        {/* 02 — MANIFESTO */}
        <section className="bg-warm-paper px-5 py-28 text-ink md:px-10 md:py-40">
          <div className="mx-auto max-w-[1600px]">
            <Reveal>
              <p className="cat-label text-tobacco-dim">Manifesto</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-6 max-w-4xl font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
                ARKIB is a design-led cocktail bar in Melaka.
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-10 cat-label flex flex-wrap gap-x-3 gap-y-2 text-ink/50">
                {['Drink', 'Sound', 'Scent', 'Light', 'Space', 'People'].map((w, i, arr) => (
                  <span key={w}>
                    {w}
                    {i < arr.length - 1 && <span className="text-tobacco"> /</span>}
                  </span>
                ))}
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <p className="mt-10 max-w-md text-base leading-relaxed text-ink/70">
                Everything in the room was chosen on purpose — and none of it was
                chosen to be photographed. This is where you can taste it.
              </p>
            </Reveal>
          </div>
        </section>

        {/* 03 — THE FIVE SENSES */}
        <section className="bg-arkib-black px-5 py-28 md:px-10 md:py-40">
          <div className="mx-auto max-w-[1600px]">
            <Reveal>
              <p className="cat-label text-tobacco">03 — Designed by Sense</p>
              <h2 className="mt-4 max-w-2xl font-serif text-4xl leading-tight text-warm-paper sm:text-5xl">
                The bar is curated, not decorated.
              </h2>
            </Reveal>
            <div className="mt-16">
              <Reveal delay={0.1}>
                <SensorySection />
              </Reveal>
            </div>
          </div>
        </section>

        {/* 04 — CURRENT ARCHIVE */}
        <section id="archive" className="scroll-mt-20 bg-arkib-black px-5 py-28 md:px-10 md:py-40">
          <div className="mx-auto max-w-[1600px]">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className="cat-label text-tobacco">04 — Current Archive</p>
                  <h2 className="mt-4 max-w-xl font-serif text-4xl leading-tight text-warm-paper sm:text-5xl">
                    What&apos;s poured tonight is also what&apos;s kept.
                  </h2>
                </div>
                <Link
                  href="/drinks"
                  className="cat-label shrink-0 text-warm-paper/50 transition-colors hover:text-warm-paper"
                >
                  Full Drinks Archive →
                </Link>
              </div>
            </Reveal>

            <div className="mt-20 space-y-24 md:space-y-32">
              {featuredDrinks.map((drink, i) => (
                <Reveal key={drink.id} delay={0.05}>
                  <DrinkArchiveEntry drink={drink} reverse={i % 2 === 1} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 05 — SPACE */}
        <section className="relative h-[85vh] min-h-[520px] overflow-hidden bg-arkib-black">
          <EditorialImage
            image={{ alt: 'Inside ARKIB — light, brass and timber', tone: 'smoke', plate: 'PLATE 004' }}
            className="h-full w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-arkib-black via-arkib-black/10 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end px-5 pb-16 md:px-10 md:pb-24">
            <Reveal>
              <p className="cat-label text-tobacco">05 — Space</p>
              <h2 className="mt-4 max-w-lg font-serif text-4xl leading-tight text-warm-paper sm:text-5xl">
                Designed
                <br />
                to be felt.
              </h2>
              <p className="mt-6 max-w-xs text-sm leading-relaxed text-warm-paper/65">
                Light changes. Music moves. Scent lingers. People arrive.
                The night takes over.
              </p>
            </Reveal>
          </div>
        </section>

        {/* 06 — PEOPLE */}
        <section className="bg-arkib-black px-5 py-28 md:px-10 md:py-40">
          <div className="mx-auto max-w-[1600px]">
            <Reveal>
              <p className="cat-label text-tobacco">06 — People</p>
              <h2 className="mt-4 max-w-xl font-serif text-4xl leading-tight text-warm-paper sm:text-5xl">
                The archive is ultimately made of people.
              </h2>
            </Reveal>
            <div className="mt-16">
              <Reveal delay={0.1}>
                <PeopleSection people={PEOPLE} />
              </Reveal>
            </div>
            <Reveal delay={0.15}>
              <Link
                href="/people"
                className="mt-16 inline-block cat-label text-warm-paper/50 transition-colors hover:text-warm-paper"
              >
                Meet the Rest of the Archive →
              </Link>
            </Reveal>
          </div>
        </section>

        {/* 07 — ARCHIVE (index) */}
        <section className="relative overflow-hidden bg-warm-paper px-5 py-28 text-ink md:px-10 md:py-40">
          <CreatureMark className="pointer-events-none absolute -right-16 -top-16 h-[320px] w-[320px] text-paper-dim md:h-[460px] md:w-[460px]" />
          <div className="relative mx-auto max-w-[1600px]">
            <Reveal>
              <p className="cat-label text-tobacco-dim">07 — Archive</p>
              <h2 className="mt-4 max-w-xl font-serif text-4xl leading-tight sm:text-5xl">
                A living record of what happens inside ARKIB.
              </h2>
              <p className="mt-6 max-w-md text-sm leading-relaxed text-ink/60">
                Drinks, objects, sounds, nights, people, collaborations — the
                archive grows with every shift. It is always changing.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-ink/15 pt-8 sm:grid-cols-3 md:grid-cols-4">
                {ARCHIVE_CATEGORIES.map((cat, i) => (
                  <div key={cat} className="border-b border-ink/15 pb-5">
                    <p className="cat-label text-ink/35">{String(i + 1).padStart(2, '0')}</p>
                    <p className="mt-1 font-serif text-xl">{CATEGORY_LABEL[cat]}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <Link
                href="/archive"
                className="mt-12 inline-flex items-center gap-3 border border-ink px-7 py-3 text-sm uppercase tracking-[0.15em] text-ink transition-colors hover:bg-ink hover:text-warm-paper"
              >
                Browse the Archive
              </Link>
            </Reveal>
          </div>
        </section>

        {/* 08 — VISIT */}
        <section className="bg-warm-paper px-5 py-28 text-ink md:px-10 md:py-40">
          <div className="mx-auto max-w-[1600px]">
            <Reveal>
              <VisitSection />
            </Reveal>
          </div>
        </section>
      </main>

      {/* 09 — CLOSE */}
      <Footer />
    </>
  )
}
