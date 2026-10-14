import { Link } from '@tanstack/react-router'
import { LINKS, LOGO_ALT, LOGO_SRC, NAV } from './content.ts'

export function Header({ anchorBase = '' }: { anchorBase?: '' | '/' }) {
  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur-xl"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
        <Link
          to="/"
          aria-label={LOGO_ALT}
          className="inline-flex shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hot"
        >
          <img src={LOGO_SRC} alt="" className="h-10 w-auto min-[400px]:h-12 sm:h-14" />
        </Link>
        <nav className="hidden gap-8 text-sm text-white/65 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={
                item.href.startsWith('/')
                  ? item.href
                  : `${anchorBase}${item.href}`
              }
              className="transition hover:text-white hover:[text-shadow:0_0_14px_#FF1493]"
            >
              {item.label}
            </a>
          ))}
          <Link
            to="/rsvp"
            className="transition hover:text-white hover:[text-shadow:0_0_14px_#FF1493]"
          >
            RSVP
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/rsvp"
            className="text-sm text-white/80 transition hover:text-white md:hidden"
          >
            RSVP
          </Link>
          <a
            href={anchorBase ? `${anchorBase}#check-a-date` : '#check-a-date'}
            className="whitespace-nowrap rounded-full border border-hot/60 px-3 py-2 text-sm font-semibold text-white transition hover:border-hot hover:shadow-[0_0_24px_rgba(255,0,127,.4)] sm:px-4"
          >
            Check a date
          </a>
          {/* The header's main call to action, on every screen size. */}
          <Link
            to={LINKS.weddings}
            className="inline-flex items-center whitespace-nowrap rounded-full bg-neon px-3.5 py-2 text-sm font-semibold text-white shadow-[0_0_24px_rgba(255,0,127,0.5)] transition hover:bg-hot hover:shadow-[0_0_36px_rgba(255,20,147,0.7)] sm:px-5"
          >
            Weddings
          </Link>
        </div>
      </div>
    </header>
  )
}
