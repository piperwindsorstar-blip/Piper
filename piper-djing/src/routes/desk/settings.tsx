import { createFileRoute } from '@tanstack/react-router'
import { getSettings } from '../../lib/crm/desk.functions.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/settings')({
  head: () => privateHead('Settings · Piper DJing'),
  loader: () => getSettings(),
  component: SettingsPage,
})

function SettingsPage() {
  const settings = Route.useLoaderData()
  return (
    <div className="grid max-w-prose gap-4">
      <h1 className="font-display text-4xl tracking-tight">Settings</h1>
      <p>Desk owner: {settings.email}</p>
      <p>Home base for travel: {settings.homeBase}</p>
      <p className="text-sm text-ink-soft">
        Travel is calculated from kilometres. The first 20 kilometres are included, then each further kilometre is
        added. Two venues is the maximum. There is no flat travel fee to type in.
      </p>
      <p>
        {settings.mailReady
          ? `Outgoing mail is ready. Messages go out as ${settings.mailFrom}.`
          : `Outgoing mail is not set up. Messages are written as ${settings.mailFrom} and are not sent.`}
      </p>
      {settings.localBook ? (
        <p className="text-sm text-muted">
          This is the empty local book. It clears when the server reloads. The published book is left alone.
        </p>
      ) : null}
      <h2 className="mt-4 font-display text-2xl">Emails</h2>
      {settings.emails.length === 0 ? (
        <p className="text-sm text-muted">No emails yet.</p>
      ) : (
        <ul className="grid gap-3 text-sm">
          {settings.emails.map((email) => (
            <li key={email.id} className="rounded-card border border-line bg-ivory px-4 py-3">
              <p>
                {email.kind === 'invoice' ? 'Invoice' : 'Booking'} · {email.to}
              </p>
              <p className="text-muted">{email.subject}</p>
              <p>{email.delivered ? 'Sent.' : email.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
