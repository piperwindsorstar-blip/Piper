import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  DeskTitle,
  deskCard,
  deskGhost,
  deskPrimary,
} from '../../components/desk-ui.tsx'
import { priceLabel } from '../../lib/rsvp/model.ts'
import {
  createSampleRsvp,
  getRsvpDesk,
  markRsvpPaid,
  openRsvpDesk,
  removeRsvpDesk,
} from '../../lib/rsvp/rsvp.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk/rsvp')({
  head: () => deskHead('RSVP · DJ Piper P'),
  loader: () => getRsvpDesk(),
  component: RsvpDesk,
})

function RsvpDesk() {
  const rows = Route.useLoaderData()
  const sample = useServerFn(createSampleRsvp)
  const open = useServerFn(openRsvpDesk)
  const pay = useServerFn(markRsvpPaid)
  const remove = useServerFn(removeRsvpDesk)
  const router = useRouter()
  const [notice, setNotice] = useState('')
  return (
    <div className="grid gap-6">
      <DeskTitle kicker="RSVP" title="Wedding RSVPs">
        A paid Piper couple is $20. A standalone RSVP is $30. The guest link
        starts with /rsvp.
      </DeskTitle>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={deskPrimary}
          onClick={() => {
            void sample().then(async (result) => {
              if (!result.ok) return
              setNotice('Sample wedding is ready.')
              await router.invalidate()
            })
          }}
        >
          Open the sample wedding
        </button>
        <Link to="/rsvp" className={deskGhost}>
          Public page
        </Link>
      </div>
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      <ul className="grid gap-3">
        {rows.map((row) => (
          <li
            key={row.slug}
            className={`${deskCard} flex flex-wrap items-center justify-between gap-3`}
          >
            <div>
              <p className="font-semibold">{row.couple}</p>
              <p className="text-sm text-white/60">
                {row.path} · {priceLabel(row.cents)} ·{' '}
                {row.paid ? 'Paid' : 'Due'}
                {row.sample ? ' · Sample' : ''} · {row.parties} parties
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={deskGhost}
                onClick={() => {
                  void open({ data: { slug: row.slug } }).then(() => {
                    void router.navigate({ to: '/rsvp/manage' })
                  })
                }}
              >
                Open
              </button>
              <button
                type="button"
                className={deskGhost}
                onClick={() => {
                  void pay({ data: { slug: row.slug, paid: !row.paid } }).then(
                    () => router.invalidate(),
                  )
                }}
              >
                {row.paid ? 'Mark unpaid' : 'Mark paid'}
              </button>
              <button
                type="button"
                className={deskGhost}
                onClick={() => {
                  void remove({ data: { slug: row.slug } }).then(() =>
                    router.invalidate(),
                  )
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
