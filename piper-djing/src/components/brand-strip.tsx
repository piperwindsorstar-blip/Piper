import type { PublicBrand } from '../lib/crm/brands.ts'
import { stripCopies } from '../lib/crm/brands.ts'

/**
 * "Brands I've worked with": brand names in the same scrolling row as the
 * towns strip. The first copy of the list is the real one; the rest only fill
 * the loop and are hidden from screen readers and from reduced-motion visitors.
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
      className={`brand-strip overflow-hidden border-y py-4 ${dark ? 'border-white/10 bg-ink-900' : 'border-line bg-mist'}`}
    >
      <h2
        id="brands-title"
        className={`px-5 text-center text-xs font-bold tracking-[0.2em] uppercase ${dark ? 'text-white/60' : 'text-soft'}`}
      >
        Brands I’ve worked with
      </h2>
      <ul
        className={`marquee mt-3 flex gap-10 font-display font-semibold ${dark ? 'text-2xl text-white/30' : 'text-xl text-soft/70'}`}
      >
        {items.map(({ brand, copy }) => {
          const extra = copy > 0
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
                  className={dark ? 'hover:text-white' : 'hover:text-ink'}
                >
                  {brand.name}
                </a>
              ) : (
                <span>{brand.name}</span>
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
