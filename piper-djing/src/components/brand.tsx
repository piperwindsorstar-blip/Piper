import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { GOOGLE_REVIEW_URL } from '../lib/crm/defaults.ts'
import { personJsonLd } from '../lib/seo.ts'
import { SiteFooter, SiteHeader } from './site-frame.tsx'

const focus =
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ivory'

export function BrandHome() {
  return (
    <div className="min-h-screen bg-night text-ivory">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: personJsonLd() }}
      />
      <SiteHeader brand />
      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-16 px-5 pt-16 pb-8 md:grid-cols-2 md:gap-20 md:px-8 md:pt-28">
          <div>
            <h1 className="text-6xl leading-none font-extrabold tracking-tight sm:text-8xl">
              DJ <span className="text-mark">Piper P</span>
            </h1>
            <p className="mt-8 text-2xl tracking-tight text-white/80">
              Brantford.
            </p>
            <Link
              to="/weddings"
              className={`mt-10 inline-flex min-h-12 items-center rounded-full bg-mark px-6 text-sm font-semibold text-stage ${focus}`}
            >
              Weddings
            </Link>
          </div>
          <Frame>
            <img
              src="/photos/brand/brand-mixer.jpg"
              alt="A black DJ mixer and headphones under magenta light."
              width={1280}
              height={720}
              fetchPriority="high"
              className="aspect-video w-full object-cover"
            />
          </Frame>
        </section>

        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-24 md:grid-cols-2 md:gap-20 md:px-8 md:py-36">
          <div>
            <h2 className="text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
              Headphones on.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/75">
              Piper DJing reads the room from the booth.
            </p>
          </div>
          <Frame>
            <img
              src="/photos/brand/brand-phones.jpg"
              alt="Black headphones against a magenta glow."
              width={864}
              height={1152}
              className="aspect-3/4 w-full object-cover"
            />
          </Frame>
        </section>

        <section
          aria-label="The booth, wedding dates, and a Google review"
          className="mx-auto w-full max-w-6xl px-5 pb-24 md:px-8 md:pb-36"
        >
          <ul className="grid gap-6 md:grid-cols-3">
            <Pillar
              title="The booth"
              body="Decks, headphones, and the room in front of them."
              icon="booth"
            />
            <Pillar
              title="Weddings"
              body="Dates and packages, on their own page."
              icon="dates"
              href="/weddings"
            />
            <Pillar
              title="Google review"
              body="A public review, in your words."
              icon="star"
              external={GOOGLE_REVIEW_URL}
            />
          </ul>
        </section>

        <section
          aria-label="Magenta stills of a light beam and stacked speakers"
          className="mx-auto grid w-full max-w-6xl gap-6 px-5 pb-24 md:grid-cols-2 md:px-8 md:pb-36"
        >
          <Frame>
            <img
              src="/photos/brand/brand-beam.jpg"
              alt="A magenta beam across a dark floor."
              width={1152}
              height={864}
              className="aspect-4/3 w-full object-cover"
            />
          </Frame>
          <Frame>
            <img
              src="/photos/brand/brand-stack.jpg"
              alt="Two black speakers outlined in magenta."
              width={1024}
              height={1024}
              className="aspect-4/3 w-full object-cover"
            />
          </Frame>
        </section>

        <section className="px-5 pb-24 md:px-8 md:pb-32">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-8 border-t border-mark py-14 md:flex-row md:items-center">
            <h2 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
              Got a date?
            </h2>
            <Link
              to="/book"
              className={`inline-flex min-h-12 items-center rounded-full bg-mark px-6 text-sm font-semibold text-stage ${focus}`}
            >
              Book me
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter brand />
    </div>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.75rem] bg-linear-to-br from-mark/80 via-white/25 to-mark/40 p-px">
      <div className="overflow-hidden rounded-[1.7rem] bg-night">
        {children}
      </div>
    </div>
  )
}

function Pillar({
  title,
  body,
  icon,
  href,
  external,
}: {
  title: string
  body: string
  icon: 'booth' | 'dates' | 'star'
  href?: '/weddings'
  external?: string
}) {
  const inner = (
    <>
      <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-mark/40 text-mark transition-colors duration-200 group-hover:border-mark group-hover:bg-mark/10">
        <PillarIcon name={icon} />
      </span>
      <h3 className="mt-8 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-white/70">{body}</p>
    </>
  )
  const shell = `group block h-full rounded-[1.75rem] border border-white/10 p-7 transition-colors duration-200 hover:border-mark ${focus}`
  if (href) {
    return (
      <li>
        <Link to={href} className={shell}>
          {inner}
        </Link>
      </li>
    )
  }
  if (external) {
    return (
      <li>
        <a
          href={external}
          target="_blank"
          rel="noopener noreferrer"
          className={shell}
        >
          {inner}
        </a>
      </li>
    )
  }
  return <li className={shell}>{inner}</li>
}

function PillarIcon({ name }: { name: 'booth' | 'dates' | 'star' }) {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    className: 'size-5',
    'aria-hidden': true as const,
  }
  if (name === 'dates') {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </svg>
    )
  }
  if (name === 'star') {
    return (
      <svg {...common}>
        <path d="m12 3 2.4 5.4L20 9.2l-4 3.9.9 5.9L12 16.8 7.1 19l.9-5.9-4-3.9 5.6-.8z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M6 12a6 6 0 0 1 12 0" />
      <path d="M4 13v3a2 2 0 0 0 2 2h1v-7H6a2 2 0 0 0-2 2z" />
      <path d="M20 13v3a2 2 0 0 1-2 2h-1v-7h1a2 2 0 0 1 2 2z" />
    </svg>
  )
}
