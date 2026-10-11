import { LINKS } from './content.ts'
import { Icon } from './icon.tsx'

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
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-1.5 select-all">
            <Icon n="mail" className="h-4 w-4 text-hot" />
            {LINKS.email}
          </span>
          <a
            href={LINKS.insta}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-white"
          >
            <Icon n="insta" className="h-4 w-4 text-hot" />
            @DJ_PIPERP
          </a>
          <a
            href={LINKS.review}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-white"
          >
            <Icon n="star" className="h-4 w-4 text-hot" />
            Google reviews
          </a>
        </div>
      </div>
    </footer>
  )
}
