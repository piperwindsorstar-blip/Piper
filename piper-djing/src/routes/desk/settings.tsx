import { createFileRoute } from '@tanstack/react-router'
import { DeskTitle, deskCard } from '../../components/desk-ui.tsx'
import { getSettings } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk/settings')({
  head: () => deskHead('Settings · Piper DJing'),
  loader: () => getSettings(),
  component: SettingsPage,
})

function SettingsPage() {
  const settings = Route.useLoaderData()

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Settings" title="Settings" />
      <section className={deskCard}>
        <dl className="divide-y divide-white/10 text-sm">
          <div className="flex flex-wrap justify-between gap-3 py-3">
            <dt className="text-white/65">Desk owner</dt>
            <dd className="font-semibold">{settings.email}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-3 py-3">
            <dt className="text-white/65">Home base for travel</dt>
            <dd className="font-semibold">{settings.homeBase}</dd>
          </div>
        </dl>
      </section>
      <section className={deskCard}>
        <p className="text-sm leading-relaxed text-white/85">
          Travel is calculated from kilometres. The first 20 kilometres are
          included, then each further kilometre is added. Two venues is the
          maximum. There is no flat travel fee to type in.
        </p>
      </section>
      <section className={deskCard}>
        <p className="text-sm leading-relaxed text-white/85">
          {settings.mailReady
            ? `Email uses the PiperPWeddingDJ@gmail.com inbox. Messages go out as ${settings.mailFrom}.`
            : `Email uses the PiperPWeddingDJ@gmail.com inbox. Messages are written as ${settings.mailFrom}. They are not sent until that inbox has its Gmail app password.`}
        </p>
        {settings.localBook ? (
          <p className="mt-3 text-sm text-white/65">
            This desk is using the local book. It clears when the server
            reloads. The published book is left alone.
          </p>
        ) : null}
      </section>
      <section className={deskCard}>
        <h2 className="font-display text-xl font-bold">Emails</h2>
        {settings.emails.length === 0 ? (
          <p className="mt-3 text-sm text-white/65">No emails yet.</p>
        ) : (
          <ul className="mt-3 grid gap-3 text-sm">
            {settings.emails.map((email) => (
              <li
                key={email.id}
                className="rounded-xl border border-white/10 bg-ink-950 px-4 py-3"
              >
                <p>
                  {email.kind === 'invoice' ? 'Invoice' : 'Booking'} ·{' '}
                  {email.to}
                </p>
                <p className="text-white/65">{email.subject}</p>
                <p>{email.delivered ? 'Sent.' : email.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
