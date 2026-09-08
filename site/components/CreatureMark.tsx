import { cn } from '@/lib/cn'

/**
 * The ARKIB creature — an abstract, moth-like archival mark. Used sparingly:
 * as a background graphic, a cropped detail, a stamp, or a watermark. Never
 * as a literal logo. See AGENTS brief §18 — it should be discovered, not
 * explained.
 */
export function CreatureMark({
  className,
  strokeWidth = 1,
}: {
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 240 220"
      fill="none"
      className={cn('overflow-visible', className)}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {/* body */}
        <path d="M120 58 C127 58 132 78 132 105 C132 132 127 160 120 168 C113 160 108 132 108 105 C108 78 113 58 120 58 Z" />
        {/* upper wings */}
        <path d="M118 78 C90 58 46 52 20 66 C40 82 46 96 44 112 C64 108 92 98 118 96" />
        <path d="M122 78 C150 58 194 52 220 66 C200 82 194 96 196 112 C176 108 148 98 122 96" />
        {/* lower wings */}
        <path d="M117 108 C94 116 58 128 42 154 C66 158 78 170 82 186 C98 168 112 138 117 116" />
        <path d="M123 108 C146 116 182 128 198 154 C174 158 162 170 158 186 C142 168 128 138 123 116" />
        {/* wing markings */}
        <circle cx="66" cy="82" r="5" />
        <circle cx="174" cy="82" r="5" />
        <path d="M70 138 C74 146 74 154 68 162" />
        <path d="M170 138 C166 146 166 154 172 162" />
        {/* antennae */}
        <path d="M115 60 C108 48 100 42 92 40" />
        <path d="M125 60 C132 48 140 42 148 40" />
      </g>
    </svg>
  )
}
