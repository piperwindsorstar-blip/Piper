import type { PublicBrand } from '../lib/crm/brands.ts'
import { stripCopies } from '../lib/crm/brands.ts'

/**
 * "Brands I've worked with": the same scrolling row as the towns strip, with
 * logos. The first copy of the list is the real one; the rest only fill the
 * loop and are hidden from screen readers and from reduced-motion visitors.
 */
export function BrandStrip({
  brands,
  tone,
}: {
  brands: PublicBrand[]
  tone: 'dark' | 'light'
}) {
  if (brands.length === 0) return null
  const copies = stripCopies(brands.length)
  const half = Array.from({ length: copies }, (_, copy) =>
    brands.map((brand) => ({ brand, copy })),
  ).flat()
  const items = [...half, ...half.map((item) => ({ ...item, copy: item.copy + copies }))]
  const dark = tone === 'dark'
  return (
    <section
      aria-labelledby="brands-title"
      className={`brand-strip overflow-hidden border-y py-6 ${dark ? 'border-white/10 bg-ink-900' : 'border-line bg-mist'}`}
    >
      <h2
        id="brands-title"
        className={`px-5 text-center text-xs font-bold tracking-[0.2em] uppercase ${dark ? 'text-white/60' : 'text-soft'}`}
      >
        Brands I’ve worked with
      </h2>
      <ul className="marquee mt-4 flex items-center gap-10">
        {items.map(({ brand, copy }) => {
          const extra = copy > 0
          const logo = (
            <span className="flex h-14 items-center rounded-xl bg-white px-4">
              <img
                src={brand.logo}
                alt={`${brand.name} logo`}
                loading="lazy"
                className="h-9 w-auto max-w-[9rem] object-contain"
              />
            </span>
          )
          return (
            <li
              key={`${copy}-${brand.id}`}
              aria-hidden={extra ? true : undefined}
              data-copy={extra ? '' : undefined}
              className="flex shrink-0 items-center gap-10"
            >
              {brand.href ? (
                <a
                  href={brand.href}
                  target="_blank"
                  rel="noopener"
                  tabIndex={extra ? -1 : undefined}
                  className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon"
                >
                  {logo}
                </a>
              ) : (
                logo
              )}
              <span className="text-neon" aria-hidden="true">
                ✦
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
