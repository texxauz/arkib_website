import Image from 'next/image'
import { cn } from '@/lib/cn'
import type { ImageRef } from '@/lib/content/types'

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

const TONE_GRADIENT: Record<ImageRef['tone'], string> = {
  ink: 'radial-gradient(120% 100% at 30% 20%, #2c2720 0%, #16130f 55%, #0c0a08 100%)',
  tobacco: 'radial-gradient(120% 100% at 30% 20%, #9c8563 0%, #4c3f2d 55%, #17130f 100%)',
  smoke: 'radial-gradient(120% 100% at 30% 20%, #635c50 0%, #332f28 55%, #14120f 100%)',
  paper: 'linear-gradient(155deg, #e9e2d5 0%, #ded5c3 60%, #cabfa8 100%)',
}

/**
 * The site's photography system. Real ARKIB photographs are the intended
 * source — pass `image.src` once supplied and it renders full-bleed with
 * next/image. Until then, `image.tone` drives a graded, grained placeholder
 * carrying the same catalogue plate number a real photograph would, so the
 * archive reads as designed rather than unfinished.
 */
export function EditorialImage({
  image,
  aspect,
  className,
  sizes = '100vw',
  priority = false,
  showPlate = true,
}: {
  image: ImageRef
  /** e.g. "4 / 5". Omit for a fill container (parent controls height, e.g. h-full). */
  aspect?: string
  className?: string
  sizes?: string
  priority?: boolean
  showPlate?: boolean
}) {
  const isPaper = image.tone === 'paper'
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      {image.src ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: TONE_GRADIENT[image.tone] }}
        />
      )}
      <div
        className="arkib-grain"
        style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }}
      />
      {!image.src && (
        <div
          className="absolute inset-0"
          style={{
            boxShadow: isPaper
              ? 'inset 0 0 60px rgba(28,26,23,0.12)'
              : 'inset 0 0 90px rgba(0,0,0,0.55)',
          }}
        />
      )}
      {showPlate && (
        <div
          className={cn(
            'absolute bottom-0 left-0 flex items-center gap-2 px-3 py-2 cat-label',
            isPaper ? 'text-ink/70' : 'text-warm-paper/70',
          )}
        >
          <span className="inline-block h-px w-4 bg-current opacity-60" />
          {image.plate}
        </div>
      )}
    </div>
  )
}
