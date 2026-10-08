import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { SiteFooter, SiteHeader, bigButton } from '../components/site-frame.tsx'
import { PACKAGE_BUTTON_COPY } from '../lib/crm/defaults.ts'
import { cad } from '../lib/crm/money.ts'
import { sendInquiry } from '../lib/crm/public.functions.ts'
import { PACKAGE_CENTS } from '../lib/piper/rules.ts'
import { publicHead } from '../lib/seo.ts'

export const Route = createFileRoute('/book')({
  head: () =>
    publicHead({
      path: '/book',
      title: 'Book a wedding DJ in Brantford | Piper DJing',
    }),
  component: BookPage,
})

function BookPage() {
  const send = useServerFn(sendInquiry)
  const [packageId, setPackageId] = useState('full')
  const [withStag, setWithStag] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl px-5 py-16 md:px-8">
        <h1 className="font-display text-4xl tracking-tight">Book me</h1>
        <p className="mt-4 text-lg text-ink-soft">
          Tell Piper the date. The reply comes by email.
        </p>
        {done ? (
          <p className="mt-10 font-display text-3xl tracking-tight">
            {message}
          </p>
        ) : (
          <form
            className="mt-10 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              void send({
                data: {
                  partnerOne: String(form.get('partnerOne') ?? ''),
                  partnerTwo: String(form.get('partnerTwo') ?? ''),
                  email: String(form.get('email') ?? ''),
                  phone: String(form.get('phone') ?? ''),
                  eventDate: String(form.get('eventDate') ?? ''),
                  packageId: String(form.get('packageId') ?? ''),
                  withStag: form.get('withStag') === 'on',
                  stagDate: String(form.get('stagDate') ?? ''),
                  message: String(form.get('message') ?? ''),
                },
              }).then((result) => {
                if (!result.ok) {
                  setMessage(result.error)
                  return
                }
                setDone(true)
                setMessage(
                  result.unavailable
                    ? 'That date is already held. Piper has your note.'
                    : 'Thank you. Piper will write back.',
                )
              })
            }}
          >
            <label className="field">
              First partner
              <input name="partnerOne" required autoComplete="given-name" />
            </label>
            <label className="field">
              Second partner
              <input name="partnerTwo" required />
            </label>
            <label className="field">
              Email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label className="field">
              Phone
              <input name="phone" type="tel" autoComplete="tel" />
            </label>
            <label className="field">
              Wedding date
              <input name="eventDate" type="date" required />
            </label>
            <label className="field">
              Package
              <select
                name="packageId"
                value={packageId}
                onChange={(event) => {
                  setPackageId(event.target.value)
                  if (event.target.value !== 'full') setWithStag(false)
                }}
              >
                {PACKAGE_BUTTON_COPY.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {cad(PACKAGE_CENTS[item.id])}
                  </option>
                ))}
              </select>
            </label>
            {packageId === 'full' ? (
              <label className="flex items-center gap-3 text-sm">
                <input
                  name="withStag"
                  type="checkbox"
                  checked={withStag}
                  onChange={(event) => setWithStag(event.target.checked)}
                />
                Add a stag and doe on its own date
              </label>
            ) : null}
            {withStag ? (
              <label className="field">
                Stag and doe date
                <input name="stagDate" type="date" required />
              </label>
            ) : null}
            <label className="field">
              Note
              <textarea name="message" rows={4} />
            </label>
            {message ? <p className="text-sm text-danger">{message}</p> : null}
            <button type="submit" className={`${bigButton} bg-ink text-ivory`}>
              <span className="font-display text-2xl">Send the inquiry</span>
            </button>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
