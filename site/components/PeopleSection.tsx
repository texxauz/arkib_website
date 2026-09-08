import { EditorialImage } from './EditorialImage'
import type { ArchiveEntry } from '@/lib/content/types'
import { cn } from '@/lib/cn'

export function PeopleSection({ people, className }: { people: ArchiveEntry[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-14 md:grid-cols-3 md:gap-8', className)}>
      {people.map((person, i) => (
        <div key={person.id} className={cn(i === 1 && 'md:mt-16')}>
          <EditorialImage
            image={person.image}
            aspect="3 / 4"
            className="border border-black-line"
          />
          <p className="mt-4 cat-label text-tobacco">{String(person.number).padStart(3, '0')} / Person</p>
          <h3 className="mt-1 font-serif text-2xl text-warm-paper">{person.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-warm-paper/60">{person.description}</p>
        </div>
      ))}
    </div>
  )
}
