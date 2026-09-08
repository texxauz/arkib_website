import { Reveal } from './Reveal'
import { cn } from '@/lib/cn'

export function PageIntro({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('bg-arkib-black px-5 pb-20 pt-40 md:px-10 md:pb-28 md:pt-52', className)}>
      <div className="mx-auto max-w-[1600px]">
        <Reveal>
          <p className="cat-label text-tobacco">{eyebrow}</p>
          <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[1.03] tracking-tight text-warm-paper sm:text-6xl md:text-7xl">
            {title}
          </h1>
          {description && (
            <p className="mt-8 max-w-md text-base leading-relaxed text-warm-paper/60">
              {description}
            </p>
          )}
        </Reveal>
      </div>
    </section>
  )
}
