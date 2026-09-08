export type ArchiveCategory =
  | 'drink'
  | 'sound'
  | 'scent'
  | 'light'
  | 'space'
  | 'person'
  | 'object'
  | 'night'
  | 'collaboration'
  | 'melaka'

export type ArchiveStatus = 'in-rotation' | 'seasonal' | 'archived' | 'ongoing' | 'one-night'

/**
 * No real ARKIB photography has been supplied yet. `tone` drives a graded,
 * archival-style placeholder (see EditorialImage) so every entry still reads
 * as a designed plate rather than a broken image. Swap in `src` per entry
 * once real photographs exist — layout does not change.
 */
export interface ImageRef {
  src?: string
  alt: string
  tone: 'ink' | 'tobacco' | 'paper' | 'smoke'
  plate: string
}

export interface ArchiveEntry {
  id: string
  number: number
  category: ArchiveCategory
  title: string
  kicker?: string
  description: string
  date?: string
  image: ImageRef
  metadata?: { label: string; value: string }[]
  tags?: string[]
  featured?: boolean
  status: ArchiveStatus
}

export interface DrinkEntry extends ArchiveEntry {
  category: 'drink'
  price: string
  ingredients: string[]
  idea?: string
  technique?: string
}

export const CATEGORY_LABEL: Record<ArchiveCategory, string> = {
  drink: 'Drink',
  sound: 'Sound',
  scent: 'Scent',
  light: 'Light',
  space: 'Space',
  person: 'Person',
  object: 'Object',
  night: 'Night',
  collaboration: 'Collaboration',
  melaka: 'Melaka',
}
