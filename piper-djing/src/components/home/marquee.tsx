import { TAGS } from './content.ts'

export function Marquee() {
  return (
    <div
      className="overflow-hidden border-y border-white/10 bg-ink-900 py-4"
      aria-hidden="true"
    >
      <div className="marquee flex gap-10 font-display text-2xl font-semibold text-white/30">
        {[...TAGS, ...TAGS].map((item, index) => (
          <span key={`${item}-${index}`} className="flex items-center gap-10">
            {item}
            <span className="text-neon">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}
