import type { Metadata } from 'next'
import { ArkibHeader } from '@/components/ArkibHeader'
import { Footer } from '@/components/Footer'
import { PageIntro } from '@/components/PageIntro'
import { Reveal } from '@/components/Reveal'
import { VisitSection } from '@/components/VisitSection'

export const metadata: Metadata = {
  title: 'Visit',
  description:
    'ARKIB — No. 12, Jalan Hang Lekiu, Melaka, Malaysia. Open Tuesday to Sunday from 6PM. Reservations by request.',
  other: {
    'business:contact_data:street_address': 'No. 12, Jalan Hang Lekiu',
    'business:contact_data:locality': 'Melaka',
    'business:contact_data:country_name': 'Malaysia',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BarOrPub',
  name: 'ARKIB',
  description: 'A design-led cocktail bar in Melaka, Malaysia.',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'No. 12, Jalan Hang Lekiu',
    addressLocality: 'Melaka',
    addressCountry: 'MY',
  },
  openingHours: ['Tu-Th 18:00-01:00', 'Fr-Sa 18:00-02:00', 'Su 18:00-00:00'],
  email: 'hello@arkib.bar',
}

export default function VisitPage() {
  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ArkibHeader />
      <main>
        <PageIntro
          eyebrow="Visit"
          title="Through an unmarked door, two minutes from the river."
        />

        <section className="bg-warm-paper px-5 pb-28 pt-4 text-ink md:px-10 md:pb-40">
          <div className="mx-auto max-w-[1600px]">
            <Reveal>
              <VisitSection />
            </Reveal>

            <Reveal delay={0.1}>
              <div className="mt-24 grid grid-cols-1 gap-10 border-t border-ink/15 pt-12 md:grid-cols-3">
                <div>
                  <p className="cat-label text-tobacco-dim">Reservations</p>
                  <p className="mt-3 text-sm leading-relaxed text-ink/60">
                    Tables are held for parties of six or more. Everyone
                    else — walk in. The bar is often the best seat anyway.
                  </p>
                </div>
                <div>
                  <p className="cat-label text-tobacco-dim">Dress</p>
                  <p className="mt-3 text-sm leading-relaxed text-ink/60">
                    Come as you are. We only ask that you leave enough time
                    to stay a while.
                  </p>
                </div>
                <div>
                  <p className="cat-label text-tobacco-dim">Getting Here</p>
                  <p className="mt-3 text-sm leading-relaxed text-ink/60">
                    A short walk from Jonker Street. Parking is limited —
                    the river path is the better way in after dark.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
