import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { LOGO_ALT, LOGO_SRC, NAV } from './content.ts'

export function Header({ anchorBase = '' }: { anchorBase?: '' | '/' }) {
  const [open, setOpen] = useState(false)
  const links = NAV.map((item) => ({
    label: item.label,
    href: item.href.startsWith('/') ? item.href : `${anchorBase}${item.href}`,
  }))
  return (
    <header
      className="bp-header"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="bp-header__bar">
        <Link
          to="/"
          aria-label={LOGO_ALT}
          className="inline-flex shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hot"
        >
          <img src={LOGO_SRC} alt="" className="h-11 w-auto sm:h-14" />
        </Link>
        <nav aria-label="Main" className="bp-header__nav">
          {links.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="bp-header__actions">
          <a
            href={anchorBase ? `${anchorBase}#check-a-date` : '#check-a-date'}
            className="bp-btn bp-btn--small whitespace-nowrap"
          >
            Check a date
          </a>
          <button
            type="button"
            className="bp-menu-button"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden="true">{open ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>
      {open ? (
        <nav id="site-menu" aria-label="Menu" className="bp-menu">
          {links.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  )
}
