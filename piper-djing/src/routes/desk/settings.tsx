import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  DeskTitle,
  deskCard,
  deskGhost,
  deskPrimary,
  deskSurface,
} from '../../components/desk-ui.tsx'
import {
  getSettings,
  saveCardPayments,
  saveSettings,
} from '../../lib/crm/desk.functions.ts'
import { DESK_TRAVEL_COPY } from '../../lib/crm/travel-copy.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'

export const Route = createFileRoute('/desk/settings')({
  head: () => deskHead('Settings · DJ Piper P'),
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
        onSubmit={(event) => event.preventDefault()}
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
        <ActionButton
          className={`${deskPrimary} w-fit`}
          checkForm
          busy="Saving…"
          done="Saved"
          surface={deskSurface}
          onRun={async (form: FormData): Promise<RunResult | undefined> => {
            const result = await save({
              data: {
                email: String(form.get('email') ?? ''),
                homeBase: String(form.get('homeBase') ?? ''),
              },
            })
            setNotice(result.ok ? 'Saved.' : result.error)
            if (result.ok) await router.invalidate()
            return {
              ok: result.ok,
              message: result.ok ? 'Saved.' : result.error,
            }
          }}
        >
          Save
        </ActionButton>
        {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
      </form>
      <CardPaymentsSetting card={settings.card} />
      <section className={deskCard}>
        <p className="text-sm leading-relaxed text-white/85">
          {DESK_TRAVEL_COPY} There is no flat travel fee to type in.
        </p>
      </section>
      <section className={deskCard}>
        <p className="text-sm leading-relaxed text-white/85">
          {settings.mailReady
            ? `Owner messages go to ${settings.email}. They are sent from the PiperPWeddingDJ@gmail.com inbox as ${settings.mailFrom}.`
            : `Owner messages go to ${settings.email}. They are written as ${settings.mailFrom}. They are not sent until the PiperPWeddingDJ@gmail.com inbox has its Gmail app password.`}
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

function CardPaymentsSetting({
  card,
}: {
  card: { configured: boolean; enabled: boolean; live: boolean }
}) {
  const save = useServerFn(saveCardPayments)
  const router = useRouter()
  const next = !card.enabled
  return (
    <section className={deskCard} aria-labelledby="card-payments">
      <h2 id="card-payments" className="font-display text-xl font-bold">
        Pay by card
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-white/85">
        {!card.configured
          ? 'Off. Stripe is not set up: add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to the piper-djing Worker in Cloudflare, then turn this on. Couples see no card button until then.'
          : card.enabled
            ? `On. Invoices show a "Pay by card" button through Stripe Checkout${card.live ? '' : ' in TEST mode (no real money)'}. Card adds 13% HST on each card payment toward the balance, never on the deposit.`
            : `Off. Stripe is set up${card.live ? '' : ' with test keys'}; couples see e-transfer and cash only.`}
      </p>
      <ActionButton
        className={`${card.enabled ? deskGhost : deskPrimary} mt-4 w-fit`}
        busy={next ? 'Turning on…' : 'Turning off…'}
        done={next ? 'On' : 'Off'}
        surface={deskSurface}
        disabled={!card.configured}
        disabledHint="Add the Stripe secrets first."
        onRun={async (): Promise<RunResult> => {
          const result = await save({ data: { on: next } })
          if (result.ok) await router.invalidate()
          return result.ok
            ? { ok: true, message: next ? 'Pay by card is on.' : 'Pay by card is off.' }
            : { ok: false, message: result.error }
        }}
      >
        {card.enabled ? 'Turn off Pay by card' : 'Turn on Pay by card'}
      </ActionButton>
    </section>
  )
}
