import { EditorialImage } from './EditorialImage'
import { CATEGORY_LABEL, type ArchiveEntry } from '@/lib/content/types'
import { cn } from '@/lib/cn'

export function ArchiveCard({ entry, className }: { entry: ArchiveEntry; className?: string }) {
  return (
    <article className={cn('group', className)}>
      <EditorialImage image={entry.image} aspect="4 / 5" className="border border-black-line" />
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="cat-label text-tobacco">
            {String(entry.number).padStart(3, '0')} / {CATEGORY_LABEL[entry.category]}
          </p>
          <h3 className="mt-1 font-serif text-xl text-warm-paper">{entry.title}</h3>
        </div>
        {entry.status === 'seasonal' && (
          <span className="cat-label mt-1 shrink-0 text-smoke">Seasonal</span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-warm-paper/60">{entry.description}</p>
    </article>
  )
}
