import type { Metadata } from 'next'
import { ArkibHeader } from '@/components/ArkibHeader'
import { Footer } from '@/components/Footer'
import { PageIntro } from '@/components/PageIntro'
import { Reveal } from '@/components/Reveal'
import { PeopleSection } from '@/components/PeopleSection'
import { PEOPLE } from '@/lib/content/archive'

export const metadata: Metadata = {
  title: 'People',
  description: 'The bartenders, guest shifts, musicians and makers behind ARKIB.',
}

export default function PeoplePage() {
  return (
    <>
      <ArkibHeader />
      <main>
        <PageIntro
          eyebrow="People"
          title="The archive is ultimately made of people."
          description="Bartenders, guest shifts, resident musicians, local makers. Everyone here has left something in the room, whether it shows or not."
        />

        <section className="bg-arkib-black px-5 pb-28 md:px-10 md:pb-40">
          <div className="mx-auto max-w-[1600px]">
            <Reveal>
              <PeopleSection people={PEOPLE} />
            </Reveal>
          </div>
        </section>

        <section className="bg-warm-paper px-5 py-24 text-ink md:px-10 md:py-32">
          <div className="mx-auto max-w-[1600px]">
            <Reveal>
              <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
                <div className="md:col-span-4">
                  <p className="cat-label text-tobacco-dim">Guest Shifts</p>
                  <h2 className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">
                    One night a season, the bar belongs to someone else.
                  </h2>
                </div>
                <p className="max-w-md text-sm leading-relaxed text-ink/60 md:col-span-6 md:col-start-6">
                  Bartenders and collaborators from elsewhere are invited to
                  run service for a night — their recipes, their music,
                  their rules. Announced with little notice, usually on
                  Instagram. Ask at the door if one is coming up.
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
