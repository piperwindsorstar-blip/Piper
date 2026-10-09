import { Link } from '@tanstack/react-router'
import { LINKS, NAV } from './content.ts'

export function Header() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur-xl"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
        <Link
          to="/"
          className="font-display text-xl font-extrabold tracking-tight"
        >
          DJ PIPER <span className="text-neon text-glow">P</span>
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
        <Link
          to={LINKS.weddings}
          className="rounded-full border border-hot/60 px-5 py-2 text-sm font-semibold transition hover:bg-neon hover:shadow-[0_0_24px_rgba(255,0,127,.5)]"
        >
          Weddings
        </Link>
      </div>
    </header>
  )
}
