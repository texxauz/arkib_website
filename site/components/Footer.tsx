import Link from 'next/link'
import { CreatureMark } from './CreatureMark'

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-arkib-black px-5 pb-10 pt-24 md:px-10 md:pb-14 md:pt-32">
      <CreatureMark className="pointer-events-none absolute -right-10 bottom-0 h-[280px] w-[280px] text-black-line md:h-[420px] md:w-[420px]" />

      <div className="relative mx-auto max-w-[1600px]">
        <p className="font-serif text-[13vw] leading-[0.9] tracking-tight text-warm-paper sm:text-[9vw] md:text-[6.5vw]">
          ARKIB
        </p>

        <div className="mt-8 flex flex-col gap-2 border-t border-black-line pt-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="cat-label text-tobacco">Melaka / Malaysia — Est. 2025</p>
            <p className="max-w-md font-serif text-xl italic text-warm-paper/80">
              Some things are worth archiving.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-warm-paper/60" aria-label="Footer">
            <Link href="/world" className="hover:text-warm-paper">World</Link>
            <Link href="/drinks" className="hover:text-warm-paper">Drinks</Link>
            <Link href="/people" className="hover:text-warm-paper">People</Link>
            <Link href="/archive" className="hover:text-warm-paper">Archive</Link>
            <Link href="/visit" className="hover:text-warm-paper">Visit</Link>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-warm-paper"
            >
              Instagram
            </a>
          </nav>
        </div>

        <p className="mt-10 cat-label text-warm-paper/30">
          © {new Date().getFullYear()} ARKIB. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
