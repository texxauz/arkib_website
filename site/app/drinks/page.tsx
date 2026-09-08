import type { Metadata } from 'next'
import { ArkibHeader } from '@/components/ArkibHeader'
import { Footer } from '@/components/Footer'
import { PageIntro } from '@/components/PageIntro'
import { Reveal } from '@/components/Reveal'
import { DrinkArchiveEntry } from '@/components/DrinkArchiveEntry'
import { DRINKS } from '@/lib/content/archive'

export const metadata: Metadata = {
  title: 'Drinks',
  description: 'The current drinks archive at ARKIB — cocktails treated as objects in a collection, not a menu.',
}

export default function DrinksPage() {
  const sorted = [...DRINKS].sort((a, b) => a.number - b.number)

  return (
    <>
      <ArkibHeader />
      <main>
        <PageIntro
          eyebrow="Drinks Archive"
          title="Not a menu. A collection."
          description="Every drink here is catalogued, not marketed — an idea, an ingredient, a technique. Some are permanent. Some are seasonal, and won't come back the same way twice."
        />

        <section className="bg-arkib-black px-5 pb-28 md:px-10 md:pb-40">
          <div className="mx-auto max-w-[1600px] space-y-24 md:space-y-32">
            {sorted.map((drink, i) => (
              <Reveal key={drink.id}>
                <DrinkArchiveEntry drink={drink} reverse={i % 2 === 1} />
              </Reveal>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
