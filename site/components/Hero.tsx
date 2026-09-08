import Link from 'next/link'
import { EditorialImage } from './EditorialImage'

export function Hero() {
  return (
    <section className="relative h-[100svh] min-h-[560px] overflow-hidden bg-arkib-black">
      <div className="hero-image-in absolute inset-0">
        <EditorialImage
          image={{ alt: 'ARKIB, Melaka, at night', tone: 'ink', plate: 'PLATE 001' }}
          className="h-full w-full"
          priority
          showPlate={false}
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-arkib-black via-transparent to-arkib-black/50" />

      <div className="hero-in relative flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="cat-label text-warm-paper/60">Melaka, Malaysia</p>
        <h1 className="mt-6 font-serif text-[18vw] leading-[0.85] tracking-tight text-warm-paper sm:text-[13vw] md:text-[9vw]">
          ARKIB
        </h1>
        <p className="mt-6 font-serif text-xl italic text-warm-paper/85 sm:text-2xl">
          A bar for what stays.
        </p>

        <div className="mt-14 flex flex-col items-center gap-6">
          <a
            href="#archive"
            className="inline-flex items-center gap-3 border border-tobacco px-7 py-3 text-sm uppercase tracking-[0.15em] text-warm-paper transition-colors duration-300 hover:bg-tobacco hover:text-ink"
          >
            Enter the Archive
          </a>
          <Link href="/visit" className="cat-label text-warm-paper/40 transition-colors hover:text-warm-paper/70">
            Reservations
          </Link>
        </div>
      </div>

      <div className="hero-in absolute bottom-8 left-1/2 -translate-x-1/2 cat-label text-warm-paper/40">
        Scroll
      </div>
    </section>
  )
}
