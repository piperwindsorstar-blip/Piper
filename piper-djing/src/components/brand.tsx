import { Link } from '@tanstack/react-router'
import { GOOGLE_REVIEW_URL, INSTAGRAM_URL } from '../lib/crm/defaults.ts'
import { personJsonLd } from '../lib/seo.ts'
import { SiteFooter, SiteHeader } from './site-frame.tsx'

const focus =
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink'
const focusLight =
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ivory'

export function BrandHome() {
  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: personJsonLd() }}
      />
      <SiteHeader brand />
      <div className="h-1 bg-mark" aria-hidden="true" />
      <main>
        <section className="mx-auto grid w-full max-w-6xl items-start gap-10 px-5 pt-10 pb-16 md:grid-cols-12 md:px-8 md:pt-16 md:pb-24">
          <div className="md:col-span-7">
            <h1>
              <img
                src="/photos/logo-inverted.png"
                alt="DJ Piper P"
                fetchPriority="high"
                className="h-auto w-full"
              />
            </h1>
            <p className="mt-6 text-lg text-ink-soft">
              Piper DJing · Brantford
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/weddings"
                className={`inline-flex min-h-12 items-center bg-mark px-5 text-sm font-medium text-stage ${focus}`}
              >
                Weddings
              </Link>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-12 items-center border border-ink px-5 text-sm ${focus}`}
              >
                @DJ_PIPERP
              </a>
            </div>
          </div>
          <figure className="md:col-span-5">
            <img
              src="/photos/dj-piper-at-the-booth.jpg"
              alt="DJ Piper at the booth, headphones on, with the DJ Piper P laptop."
              width={923}
              height={1232}
              className="h-auto w-full"
            />
          </figure>
        </section>
        <section className="bg-stage text-ivory">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-5 py-14 sm:flex-row sm:items-center md:px-8 md:py-16">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={focusLight}
            >
              <img
                src="/photos/instagram-nametag.png"
                alt="QR code for Instagram @DJ_PIPERP"
                width={320}
                height={360}
                className="size-36 bg-ivory p-2"
              />
            </a>
            <div>
              <h2 className="text-3xl font-medium tracking-tight">
                @DJ_PIPERP
              </h2>
              <div className="mt-3 flex flex-wrap gap-x-5">
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex min-h-11 items-center text-mark ${focusLight}`}
                >
                  Instagram
                </a>
                <a
                  href={GOOGLE_REVIEW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex min-h-11 items-center text-mark ${focusLight}`}
                >
                  Google review
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter brand />
    </div>
  )
}
