import { Link } from '@tanstack/react-router'
import { LINKS } from './content.ts'
import { Icon } from './icon.tsx'
import { CpdjaBadge } from '../cpdja-badge.tsx'
import { TOWN_LIST } from '../weddings/towns.ts'

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 px-5 py-10 text-sm text-white/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-bold text-white">
            DJ Piper P
          </p>
          <p className="mt-1 flex items-center gap-1.5">
            <Icon n="pin" className="h-4 w-4 text-hot" />
            Wedding & event DJ · Brantford, Ontario
          </p>
          <p className="mt-1">
            {'Wedding DJ in '}
            {TOWN_LIST.map((town, index) => (
              <span key={town.path}>
                {index > 0 ? ' · ' : ''}
                <a href={town.path} className="underline underline-offset-2 hover:text-white">
                  {town.name}
                </a>
              </span>
            ))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href={`mailto:${LINKS.email}`}
            className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-white underline underline-offset-4 hover:text-white"
          >
            <Icon n="mail" className="h-4 w-4 text-hot" />{`Email Piper: ${LINKS.email ?? ''}`}
          </a>
          <a
            href={LINKS.insta}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-white"
          >
            <Icon n="insta" className="h-4 w-4 text-hot" />
            @DJ_PIPERP
          </a>
          {LINKS.facebook ? (
            <a
              href={LINKS.facebook}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-white"
            >
              <Icon n="facebook" className="h-4 w-4 text-hot" />
              Facebook
            </a>
          ) : null}
          <Link to="/contact" className="hover:text-white">
            Contact
          </Link>
          <Link to="/wedding-vendors" className="hover:text-white">
            Vendors
          </Link>
          <Link to="/rsvp" className="hover:text-white">
            RSVP
          </Link>
          <a
            href={LINKS.review}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-white"
          >
            <Icon n="star" className="h-4 w-4 text-hot" />
            Google reviews
          </a>
          <CpdjaBadge />
        </div>
      </div>
    </footer>
  )
}
