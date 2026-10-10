import { Link } from '@tanstack/react-router'
import { LOGO_ALT, LOGO_SRC, NAV } from './content.ts'
import { useDateDraft } from './date-draft.tsx'

export function Header({
  sectionBase = '',
}: {
  sectionBase?: '' | '/weddings'
}) {
  const { openCalendar } = useDateDraft()
  return (
    <header
      className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link
          to="/"
          aria-label={LOGO_ALT}
          className="inline-flex shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        >
          <img src={LOGO_SRC} alt="" className="h-12 w-auto sm:h-14" />
        </Link>
        <nav className="hidden gap-8 text-sm font-medium text-soft md:flex">
          {NAV.map(([label, href]) => (
            <a
              key={label}
              href={`${sectionBase}${href}`}
              className="hover:text-ink"
            >
              {label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={openCalendar}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-neon"
        >
          Check Dates
        </button>
      </div>
    </header>
  )
}
