import { Link } from '@tanstack/react-router'
import type { PackageId } from '../../lib/crm/defaults.ts'
import { PACKAGE_CENTS } from '../../lib/piper/rules.ts'
import { publicPackagePrice } from '../../lib/crm/packages.ts'
import type { PackageOffer } from '../../lib/crm/packages.ts'
import { TIERS } from './content.ts'
import { useDateDraft } from './date-draft.tsx'
import { Eyebrow } from './ui.tsx'
import { Icon } from './icon.tsx'

const TIER_IDS = ['full', 'reception', 'stag', 'ceremony'] as const

export function Packages({ packages }: { packages: PackageOffer[] }) {
  const { date } = useDateDraft()
  const centsFor = (id: PackageId) =>
    packages.find((item) => item.id === id)?.cents ?? PACKAGE_CENTS[id]
  return (
    <section
      id="packages"
      className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24"
    >
      <Eyebrow>Weddings & Celebrations</Eyebrow>
      <h2 className="mt-3 max-w-3xl font-display text-4xl font-bold text-balance md:text-5xl">
        Pick the night you want. Piper builds it.
      </h2>
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {TIERS.map((tier, index) => {
          const id = TIER_IDS[index] ?? 'full'
          const price = publicPackagePrice(id, centsFor(id))
          return (
            <article
              key={tier.n}
              className={`flex flex-col rounded-2xl border p-8 ${tier.hl ? 'border-ink bg-lilac shadow-[8px_8px_0_0_#FF1493]' : 'border-line bg-paper'}`}
            >
              <h3 className="font-display text-3xl font-bold text-balance">
                {tier.n}
              </h3>
              <p
                className={`mt-1 text-sm ${tier.hl ? 'font-medium text-neon' : 'text-soft'}`}
              >
                {tier.plain} · {price}
              </p>
              <ul className="mt-6 flex-1 space-y-3 border-t border-line pt-6">
                {tier.f.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Icon
                      n="check"
                      className="mt-0.5 h-4 w-4 shrink-0 text-neon"
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/book"
                search={date ? { date } : {}}
                className={`mt-8 rounded-lg py-3 text-center font-semibold transition ${tier.hl ? 'bg-neon text-white hover:bg-hot' : 'border border-ink hover:bg-ink hover:text-white'}`}
              >
                Get a Quote
              </Link>
            </article>
          )
        })}
      </div>
      <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-soft">
        The Main Event and The Pre-Party can be booked together for $250 off.
        Travel over 50 km, a second venue, and uplighting ($15 each) are quoted
        separately. Overtime after 1:00 a.m. is $250 an hour.
      </p>
    </section>
  )
}
