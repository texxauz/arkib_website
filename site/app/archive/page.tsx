import type { Metadata } from 'next'
import { ArkibHeader } from '@/components/ArkibHeader'
import { Footer } from '@/components/Footer'
import { PageIntro } from '@/components/PageIntro'
import { Reveal } from '@/components/Reveal'
import { ArchiveGrid } from '@/components/ArchiveGrid'
import { getArchiveByCategory } from '@/lib/content/archive'

export const metadata: Metadata = {
  title: 'Archive',
  description:
    'The ARKIB archive — drinks, sounds, objects, nights, people, collaborations and Melaka, catalogued as they happen.',
}

export default function ArchivePage() {
  const entries = getArchiveByCategory()

  return (
    <>
      <ArkibHeader />
      <main>
        <PageIntro
          eyebrow="Archive"
          title="A living record of what happens here."
          description="Not everything interesting at ARKIB is a drink. Some of it is a sound, an object, a night, a person passing through. This is where it's kept."
        />

        <section className="bg-arkib-black px-5 pb-28 md:px-10 md:pb-40">
          <div className="mx-auto max-w-[1600px]">
            <Reveal>
              <ArchiveGrid entries={entries} />
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
