import type { Metadata } from 'next'
import { ArkibHeader } from '@/components/ArkibHeader'
import { Footer } from '@/components/Footer'
import { PageIntro } from '@/components/PageIntro'
import { Reveal } from '@/components/Reveal'
import { SensorySection } from '@/components/SensorySection'
import { CreatureMark } from '@/components/CreatureMark'

export const metadata: Metadata = {
  title: 'World',
  description:
    'ARKIB is a design-led cocktail bar in Melaka, curated through five senses — drink, sound, scent, light and space.',
}

export default function WorldPage() {
  return (
    <>
      <ArkibHeader />
      <main>
        <PageIntro
          eyebrow="World"
          title="ARKIB is a design-led cocktail bar in Melaka."
          description="Not a theme. Not a concept borrowed from elsewhere. A room built the way a small magazine is edited — one decision at a time, all of them in service of one idea."
        />

        <section className="bg-arkib-black px-5 pb-28 md:px-10 md:pb-40">
          <div className="mx-auto max-w-[1600px]">
            <Reveal>
              <SensorySection />
            </Reveal>
          </div>
        </section>

        <section className="relative overflow-hidden bg-warm-paper px-5 py-28 text-ink md:px-10 md:py-40">
          <CreatureMark className="pointer-events-none absolute -bottom-24 -left-16 h-[360px] w-[360px] text-paper-dim md:h-[520px] md:w-[520px]" />
          <div className="relative mx-auto max-w-[1600px]">
            <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
              <Reveal className="md:col-span-4">
                <p className="cat-label text-tobacco-dim">Arkib means archive.</p>
                <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">
                  Not a collection of
                  <br />
                  old things.
                </h2>
              </Reveal>
              <Reveal delay={0.1} className="md:col-span-6 md:col-start-6">
                <p className="text-base leading-relaxed text-ink/70">
                  It is a living record of what happens inside the room — the
                  drinks poured, the people behind the bar, the nights that
                  mattered, the objects that survived them. Some entries stay
                  in rotation for years. Others last one night and are kept
                  anyway.
                </p>
                <p className="mt-6 text-base leading-relaxed text-ink/70">
                  ARKIB is refined but imperfect. Dark but warm. Local but not
                  folkloric. Designed but not sterile. It takes itself
                  seriously without taking itself too seriously — the same
                  way a good bar should.
                </p>
                <p className="mt-6 font-serif text-xl italic text-ink/80">
                  The camera is a guest here, not the host.
                </p>
              </Reveal>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
