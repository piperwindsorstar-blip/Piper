import { Link } from '@tanstack/react-router'
import { LINKS, LOGO_ALT, LOGO_SRC, NAV } from './content.ts'

export function Header() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur-xl"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
        <Link
          to="/"
          aria-label={LOGO_ALT}
          className="inline-flex shrink-0 rounded-xl bg-ivory p-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hot"
        >
          <img src={LOGO_SRC} alt="" className="h-12 w-auto sm:h-14" />
        </Link>
        <nav className="hidden gap-8 text-sm text-white/65 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition hover:text-white hover:[text-shadow:0_0_14px_#FF1493]"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="#check-a-date"
            className="rounded-full bg-neon px-4 py-2 text-sm font-semibold text-white transition hover:bg-hot"
          >
            Check a date
          </a>
          <Link
            to={LINKS.weddings}
            className="hidden rounded-full border border-hot/60 px-5 py-2 text-sm font-semibold transition hover:bg-neon hover:shadow-[0_0_24px_rgba(255,0,127,.5)] sm:inline-flex"
          >
            Weddings
          </Link>
        </div>
      </div>
    </header>
  )
}
