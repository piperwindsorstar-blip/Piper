import { Link } from '@tanstack/react-router'
import { SHOW_PLACEHOLDER_NOTES, TIERS } from './content.ts'
import { useDateDraft } from './date-draft.tsx'
import { Eyebrow } from './ui.tsx'
import { Icon } from './icon.tsx'

export function Packages() {
  const { date } = useDateDraft()
  return (
    <section
      id="packages"
      className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24"
    >
      <Eyebrow>Weddings & Celebrations</Eyebrow>
      <h2 className="mt-3 max-w-3xl font-display text-4xl font-bold text-balance md:text-5xl">
        Pick the night you want. Piper builds it.
      </h2>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {TIERS.map((tier) => (
          <article
            key={tier.n}
            className={`flex flex-col rounded-2xl border p-8 ${tier.hl ? 'border-ink bg-lilac shadow-[8px_8px_0_0_#FF1493]' : 'border-line bg-paper'}`}
          >
            <p
              className={`font-mono text-xs tracking-widest uppercase ${tier.hl ? 'text-neon' : 'text-violet'}`}
            >
              {tier.tag}
            </p>
            <h3 className="mt-3 font-display text-3xl font-bold text-balance">
              {tier.n}
            </h3>
            <p className="mt-1 text-sm text-soft">
              Custom quote within 24 hours
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
        ))}
      </div>
      {SHOW_PLACEHOLDER_NOTES ? (
        <p className="mt-4 text-center text-xs text-soft">
          Tier names and inclusions are placeholders. Replace with real
          packages.
        </p>
      ) : null}
    </section>
  )
}
