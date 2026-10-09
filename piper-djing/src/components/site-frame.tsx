import { Link } from '@tanstack/react-router'
import {
  GOOGLE_REVIEW_URL,
  INSTAGRAM_URL,
  PUBLIC_EMAIL,
} from '../lib/crm/defaults.ts'

const focus =
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink'
const focusLight =
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ivory'

export function SiteHeader({
  onDate,
  brand = false,
}: {
  onDate?: () => void
  brand?: boolean
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
        <Link
          to="/"
          className={`${brand ? 'font-medium' : 'font-display'} text-xl tracking-tight ${focus}`}
        >
          {brand ? 'DJ Piper P' : 'Piper DJing'}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/weddings"
            activeOptions={{ exact: true }}
            activeProps={{
              className: 'underline decoration-2 underline-offset-4',
            }}
            className={`inline-flex min-h-11 items-center px-3 text-sm ${focus}`}
          >
            Weddings
          </Link>
          {onDate ? (
            <>
              <button
                type="button"
                className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-ink bg-ivory px-4 text-sm text-ink ${focus}`}
                onClick={onDate}
              >
                Check your date
              </button>
              <Link
                to="/book"
                className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-ink px-4 text-sm text-ivory ${focus}`}
              >
                Book me
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export function SiteFooter({ brand = false }: { brand?: boolean }) {
  return (
    <footer
      className={
        brand
          ? 'border-t border-white/15 bg-stage text-ivory'
          : 'border-t border-line'
      }
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-8 md:px-8">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram, @DJ_PIPERP"
          className={`inline-flex size-11 items-center justify-center hover:text-ink-soft ${brand ? `text-ivory ${focusLight}` : `text-ink ${focus}`}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6"
            aria-hidden="true"
          >
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
          </svg>
        </a>
        <a
          href={`mailto:${PUBLIC_EMAIL}`}
          className={`inline-flex min-h-11 items-center text-sm ${brand ? `text-white/70 ${focusLight}` : `text-muted ${focus}`}`}
        >
          {PUBLIC_EMAIL}
        </a>
        <a
          href={GOOGLE_REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex min-h-11 items-center text-sm underline underline-offset-4 ${brand ? `text-ivory ${focusLight}` : `text-ink ${focus}`}`}
        >
          Google review
        </a>
      </div>
    </footer>
  )
}

export const bigButton =
  'inline-flex w-full min-h-20 flex-col items-center justify-center gap-1 rounded-full px-6 py-4 text-center tracking-tight transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink'
