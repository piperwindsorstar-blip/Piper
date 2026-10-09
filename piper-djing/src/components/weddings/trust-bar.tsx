import { TRUST } from './content.ts'
import { Icon } from './icon.tsx'
import type { IconName } from './icon.tsx'

export function TrustBar() {
  return (
    <section className="border-y border-ink bg-ink text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-6 md:grid-cols-4">
        {TRUST.map(([icon, label]) => (
          <div
            key={label}
            className="flex items-center justify-center gap-2 text-sm font-medium"
          >
            <Icon n={icon as IconName} className="h-5 w-5 text-sky" />
            {label}
          </div>
        ))}
      </div>
    </section>
  )
}
