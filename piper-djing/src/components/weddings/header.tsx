import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { LOGO_ALT, LOGO_SRC, NAV } from './content.ts'
import { useDateDraft } from './date-draft.tsx'

/** The phone menu's links, the same on every inner page. */
const MENU = [
  ['Home', '/'],
  ['Weddings', '/weddings'],
  ['Vendors', '/wedding-vendors'],
  ['FAQ', '/faq'],
  ['Book', '/book'],
  ['RSVP', '/rsvp'],
  ['Couples Sign In', '/portal'],
] as const

export function Header({
  sectionBase = '',
}: {
  sectionBase?: '' | '/weddings'
}) {
  const { openCalendar } = useDateDraft()
  const [open, setOpen] = useState(false)
  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10 bg-ink/95 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-5 py-3.5">
        <Link
          to="/"
          aria-label={LOGO_ALT}
          className="inline-flex shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        >
          <img src={LOGO_SRC} alt="" className="h-12 w-auto sm:h-14" />
        </Link>
        <nav className="hidden gap-8 text-sm font-medium text-white/75 md:flex">
          {NAV.map(([label, href]) => (
            <a
              key={label}
              href={href.startsWith('/') ? href : `${sectionBase}${href}`}
              className="hover:text-white"
            >
              {label}
            </a>
          ))}
          <Link to="/rsvp" className="hover:text-white">
            RSVP
          </Link>
        </nav>
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Link to="/rsvp" className="text-sm font-medium text-white/75 md:hidden">
            RSVP
          </Link>
          <button
            type="button"
            onClick={openCalendar}
            className="rounded-lg bg-neon px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-white transition hover:bg-hot sm:px-4"
          >
            Check Dates
          </button>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="inner-menu"
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/40 text-xl leading-none text-white md:hidden"
          >
            <span aria-hidden="true">{open ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>
      {open ? (
        <nav
          id="inner-menu"
          aria-label="Menu"
          className="grid border-t border-white/10 px-5 pb-3 text-lg font-semibold text-white md:hidden"
        >
          {MENU.map(([label, href]) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="border-b border-white/10 py-3 last:border-b-0 hover:text-neon"
            >
              {label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  )
}
