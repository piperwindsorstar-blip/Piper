import { AREAS } from './content.ts'

export function AreaMarquee() {
  return (
    <div
      className="overflow-hidden border-y border-line bg-mist py-4"
      aria-hidden="true"
    >
      <div className="marquee flex gap-10 font-display text-xl font-semibold text-soft/70">
        {[...AREAS, ...AREAS].map((area, index) => (
          <span key={`${area}-${index}`} className="flex items-center gap-10">
            {area}
            <span className="text-neon">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}
