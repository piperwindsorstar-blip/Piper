import { Link } from '@tanstack/react-router'
import { GOOGLE_REVIEW_URL, INSTAGRAM_URL } from '../lib/crm/defaults.ts'
import { personJsonLd } from '../lib/seo.ts'
import { SiteFooter, SiteHeader } from './site-frame.tsx'

const focus =
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ivory'

const glass =
  'rounded-3xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgb(255_255_255/0.04)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-mark/50 hover:shadow-[0_0_32px_rgb(240_52_234/0.22)]'

export function BrandHome() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-night text-ivory">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: personJsonLd() }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-mark/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[28rem] -left-24 h-72 w-72 rounded-full bg-mark/15 blur-3xl"
      />
      <SiteHeader brand />
      <main className="relative">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pt-12 pb-16 md:grid-cols-12 md:px-8 md:pt-20 md:pb-24">
          <div className="md:col-span-6">
            <p className="motion-safe:animate-brand-float inline-flex items-center gap-2 rounded-full border border-mark/40 bg-mark/10 px-3 py-1 text-xs font-medium tracking-wide text-ivory shadow-[0_0_24px_rgb(240_52_234/0.25)]">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-mark"
              />
              Brantford
            </p>
            <h1 className="mt-6 text-5xl leading-none font-extrabold tracking-tight sm:text-7xl">
              DJ{' '}
              <span className="bg-linear-to-r from-ivory via-mark to-ivory bg-clip-text text-transparent">
                Piper P
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              Piper DJing. Headphones on, reading the room. Wedding dates,
              packages, and the dance floor live on their own page.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/weddings"
                className={`motion-safe:animate-brand-glow inline-flex min-h-12 items-center rounded-full bg-mark px-6 text-sm font-semibold text-stage ${focus}`}
              >
                Weddings
              </Link>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-12 items-center rounded-full border border-white/25 bg-white/5 px-6 text-sm backdrop-blur-md transition hover:border-mark/60 ${focus}`}
              >
                @DJ_PIPERP
              </a>
            </div>
          </div>
          <div className="md:col-span-6">
            <div className="rounded-[2rem] border border-mark/40 bg-white/5 p-3 shadow-[0_0_48px_rgb(240_52_234/0.28)] backdrop-blur-md">
              <img
                src="/photos/logo-inverted.png"
                alt="DJ Piper P"
                fetchPriority="high"
                className="h-auto w-full rounded-[1.4rem] bg-ivory"
              />
              <figure className="mt-3 overflow-hidden rounded-[1.4rem]">
                <img
                  src="/photos/dj-piper-at-the-booth.jpg"
                  alt="DJ Piper at the booth, headphones on, with the DJ Piper P laptop."
                  width={923}
                  height={1232}
                  className="h-auto max-h-[32rem] w-full object-cover object-top transition duration-500 hover:scale-[1.03]"
                />
              </figure>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="pillars-title"
          className="mx-auto w-full max-w-6xl px-5 pb-16 md:px-8 md:pb-24"
        >
          <h2 id="pillars-title" className="text-3xl font-bold tracking-tight">
            The booth, the dates, the name
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Pillar
              title="The booth"
              body="Headphones on. The mix follows the room."
              icon="booth"
            />
            <Pillar
              title="Weddings"
              body="Ceremony audio and the reception, on their own page."
              icon="dates"
              href="/weddings"
            />
            <Pillar
              title="Brantford"
              body="Piper DJing, based in Brantford."
              icon="pin"
            />
            <Pillar
              title="Google review"
              body="A public review on Google, in your words."
              icon="star"
              external={GOOGLE_REVIEW_URL}
            />
          </ul>
        </section>

        <section
          aria-label="Where to find DJ Piper P"
          className="mx-auto grid w-full max-w-6xl gap-4 px-5 pb-16 sm:grid-cols-3 md:px-8 md:pb-24"
        >
          <Fact label="Home" value="Brantford" />
          <Fact label="Instagram" value="@DJ_PIPERP" href={INSTAGRAM_URL} />
          <Fact label="Wedding dates" value="Weddings" to="/weddings" />
        </section>

        <section
          aria-labelledby="gallery-title"
          className="mx-auto w-full max-w-6xl px-5 pb-16 md:px-8 md:pb-24"
        >
          <h2 id="gallery-title" className="text-3xl font-bold tracking-tight">
            At the booth
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-12">
            <GalleryCard
              src="/photos/dj-piper-at-the-booth.jpg"
              alt="DJ Piper at the booth, headphones on, with the DJ Piper P laptop."
              caption="DJ Piper P at the booth."
              className="md:col-span-7"
              tall
            />
            <div className="grid gap-4 md:col-span-5">
              <GalleryCard
                src="/photos/wedding-reception-dance.jpg"
                alt="A bride dancing with guests under blue light at a wedding reception."
                caption="The reception."
              />
              <GalleryCard
                src="/photos/wedding-first-dance.jpg"
                alt="A bride and groom sharing their first dance, with wedding guests standing around them."
                caption="The first dance."
              />
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 md:px-8">
          <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-mark/30 bg-white/5 px-6 py-14 text-center shadow-[0_0_80px_rgb(240_52_234/0.18)] backdrop-blur-md md:px-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-mark/30 blur-3xl"
            />
            <h2 className="relative text-4xl font-extrabold tracking-tight sm:text-5xl">
              Book the booth for a wedding
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg leading-relaxed text-white/75">
              Dates, packages, and the dance floor are on the weddings page.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/weddings"
                className={`inline-flex min-h-12 items-center rounded-full bg-mark px-6 text-sm font-semibold text-stage ${focus}`}
              >
                See wedding dates
              </Link>
              <Link
                to="/book"
                className={`inline-flex min-h-12 items-center rounded-full border border-white/25 bg-white/5 px-6 text-sm backdrop-blur-md ${focus}`}
              >
                Book me
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter brand />
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
  icon: 'booth' | 'dates' | 'pin' | 'star'
  href?: '/weddings'
  external?: string
}) {
  const inner = (
    <>
      <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-mark/30 bg-mark/10 text-mark">
        <PillarIcon name={icon} />
      </span>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/70">{body}</p>
    </>
  )
  if (href) {
    return (
      <li>
        <Link to={href} className={`block h-full p-6 ${glass} ${focus}`}>
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
          className={`block h-full p-6 ${glass} ${focus}`}
        >
          {inner}
        </a>
      </li>
    )
  }
  return <li className={`p-6 ${glass}`}>{inner}</li>
}

function PillarIcon({ name }: { name: 'booth' | 'dates' | 'pin' | 'star' }) {
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
  if (name === 'pin') {
    return (
      <svg {...common}>
        <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.2" />
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
      <path d="M4 10v8h16v-8" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M4 14h16" />
    </svg>
  )
}

function Fact({
  label,
  value,
  href,
  to,
}: {
  label: string
  value: string
  href?: string
  to?: '/weddings'
}) {
  const body = (
    <>
      <p className="text-xs tracking-wide text-white/55 uppercase">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
    </>
  )
  if (to) {
    return (
      <Link to={to} className={`block p-6 ${glass} ${focus}`}>
        {body}
      </Link>
    )
  }
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`block p-6 ${glass} ${focus}`}
      >
        {body}
      </a>
    )
  }
  return <div className={`p-6 ${glass}`}>{body}</div>
}

function GalleryCard({
  src,
  alt,
  caption,
  className = '',
  tall = false,
}: {
  src: string
  alt: string
  caption: string
  className?: string
  tall?: boolean
}) {
  return (
    <figure
      className={`group relative overflow-hidden rounded-[1.6rem] border border-white/10 ${className}`}
    >
      <img
        src={src}
        alt={alt}
        className={`w-full object-cover transition duration-500 group-hover:scale-105 ${tall ? 'h-full max-h-[40rem] min-h-80' : 'h-56 sm:h-64'}`}
      />
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-night via-night/70 to-transparent px-4 pt-16 pb-4 text-sm">
        {caption}
      </figcaption>
    </figure>
  )
}
