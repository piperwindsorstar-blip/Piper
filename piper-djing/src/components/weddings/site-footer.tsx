import { LINKS } from './content.ts'
import { Icon } from './icon.tsx'

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-5 py-10 text-sm text-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-bold text-ink">DJ Piper P</p>
          <p className="mt-1 flex items-center gap-1.5">
            <Icon n="pin" className="h-4 w-4 text-neon" />
            Wedding & event DJ · Brantford, Ontario
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-1.5 select-all">
            <Icon n="mail" className="h-4 w-4 text-neon" />
            {LINKS.email}
          </span>
          <a
            href={LINKS.insta}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-ink"
          >
            <Icon n="insta" className="h-4 w-4 text-neon" />
            @DJ_PIPERP
          </a>
          <a
            href={LINKS.review}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-ink"
          >
            <Icon n="star" className="h-4 w-4 text-neon" />
            Leave a Google review
          </a>
        </div>
      </div>
    </footer>
  )
}
