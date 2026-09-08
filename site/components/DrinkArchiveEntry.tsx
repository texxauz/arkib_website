import { EditorialImage } from './EditorialImage'
import type { DrinkEntry } from '@/lib/content/types'
import { cn } from '@/lib/cn'

export function DrinkArchiveEntry({
  drink,
  reverse = false,
  className,
}: {
  drink: DrinkEntry
  reverse?: boolean
  className?: string
}) {
  return (
    <article
      className={cn(
        'grid grid-cols-1 items-center gap-8 md:grid-cols-12 md:gap-4',
        className,
      )}
    >
      <div className={cn('md:col-span-6', reverse && 'md:order-2')}>
        <EditorialImage
          image={drink.image}
          aspect="4 / 5"
          className="border border-black-line"
        />
      </div>

      <div className={cn('md:col-span-5', reverse ? 'md:order-1 md:col-start-2' : 'md:col-start-8')}>
        <p className="cat-label text-tobacco">
          Archive {String(drink.number).padStart(3, '0')}
          {drink.status === 'seasonal' && ' — Seasonal'}
        </p>
        <h3 className="mt-3 font-serif text-4xl text-warm-paper sm:text-5xl">{drink.title}</h3>
        {drink.kicker && (
          <p className="mt-1 text-sm uppercase tracking-wide text-warm-paper/40">{drink.kicker}</p>
        )}
        <p className="mt-5 max-w-sm font-serif text-lg italic leading-relaxed text-warm-paper/75">
          {drink.description}
        </p>

        <div className="rule mt-6 text-warm-paper" />

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="cat-label text-warm-paper/35">Ingredients</dt>
            <dd className="mt-1 text-warm-paper/70">{drink.ingredients.join(', ')}</dd>
          </div>
          <div>
            <dt className="cat-label text-warm-paper/35">Price</dt>
            <dd className="mt-1 text-warm-paper/70">{drink.price}</dd>
          </div>
          <div>
            <dt className="cat-label text-warm-paper/35">Availability</dt>
            <dd className="mt-1 text-warm-paper/70 capitalize">{drink.status.replace('-', ' ')}</dd>
          </div>
        </dl>
      </div>
    </article>
  )
}
