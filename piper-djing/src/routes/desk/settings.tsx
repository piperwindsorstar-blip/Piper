import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { DeskTitle, deskCard, deskPrimary } from '../../components/desk-ui.tsx'
import { getSettings, saveSettings } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk/settings')({
  head: () => deskHead('Settings · Piper DJing'),
  loader: () => getSettings(),
  component: SettingsPage,
})

function SettingsPage() {
  const settings = Route.useLoaderData()
  const save = useServerFn(saveSettings)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Settings" title="Settings" />
      <form
        className={`${deskCard} grid gap-3`}
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void save({
            data: {
              email: String(form.get('email') ?? ''),
              homeBase: String(form.get('homeBase') ?? ''),
            },
          }).then(async (result) => {
            setNotice(result.ok ? 'Saved.' : result.error)
            if (result.ok) await router.invalidate()
          })
        }}
      >
        <label className="field">
          Desk owner
          <input
            name="email"
            type="email"
            required
            defaultValue={settings.email}
          />
        </label>
        <label className="field">
          Home base for travel
          <input name="homeBase" required defaultValue={settings.homeBase} />
        </label>
        <button type="submit" className={`${deskPrimary} w-fit`}>
          Save
        </button>
        {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
      </form>
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
