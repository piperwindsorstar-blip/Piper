import { Link } from '@tanstack/react-router'
import { NAV } from './content.ts'
import { useDateDraft } from './date-draft.tsx'

export function Header({
  sectionBase = '',
}: {
  sectionBase?: '' | '/weddings'
}) {
  const { date } = useDateDraft()
  return (
    <header
      className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link
          to="/"
          className="font-display text-xl font-extrabold tracking-tight"
        >
          DJ PIPER <span className="text-neon">P</span>
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
        <Link
          to="/book"
          search={date ? { date } : {}}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-neon"
        >
          Check Dates
        </Link>
      </div>
    </header>
  )
}
