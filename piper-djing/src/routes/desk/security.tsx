import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  ConfirmDelete,
  DeskTitle,
  deskCard,
  deskDanger,
  deskGhost,
  deskH2,
  deskPrimary,
  deskSurface,
} from '../../components/desk-ui.tsx'
import { ActionButton } from '../../components/action-button.tsx'
import { confirmNewPhone, forgetDevice, getSecurity, newBackupCodes, startNewPhone } from '../../lib/auth/server.ts'
import { deskHead } from '../../lib/desk-head.ts'

/** Two-step sign-in: status, backup codes, trusted devices and recovery notes. */
export const Route = createFileRoute('/desk/security')({
  codeSplitGroupings: [['loader', 'component']],
  head: () => deskHead('Security · DJ Piper P'),
  loader: () => getSecurity(),
  component: SecurityPage,
})

function day(ms: number): string {
  if (!ms) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium' }).format(new Date(ms))
}

function SecurityPage() {
  const status = Route.useLoaderData()
  const router = useRouter()
  const regenerate = useServerFn(newBackupCodes)
  const forget = useServerFn(forgetDevice)
  const begin = useServerFn(startNewPhone)
  const finish = useServerFn(confirmNewPhone)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [phone, setPhone] = useState<{ qrSvg: string; secret: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="System" title="Security">
        <p>Two-step sign-in for the Desk: your password, then a code from your authenticator app.</p>
      </DeskTitle>

      <section className={`${deskCard} grid gap-2`} aria-labelledby="status">
        <h2 id="status" className={deskH2}>
          Two-step sign-in
        </h2>
        {status.active ? (
          <p data-2fa-status="on">{`On since ${day(status.enrolledAt)}. ${status.backupLeft} unused backup ${status.backupLeft === 1 ? 'code' : 'codes'} left.`}</p>
        ) : (
          <p data-2fa-status="off">Not set up yet. You will set it up the next time you sign in.</p>
        )}
        {!status.keyReady ? (
          <p className="text-sm text-rose-700">The DESK_2FA_KEY secret is missing on the Worker.</p>
        ) : null}
      </section>

      {status.active ? (
        <section className={`${deskCard} grid gap-3`} aria-labelledby="backup">
          <h2 id="backup" className={deskH2}>
            Backup codes
          </h2>
          <p className="text-sm text-[#4a4262]">
            Making a new set stops every old code from working. You need a current code from your app.
          </p>
          {codes ? (
            <div className="grid gap-2">
              <p className="font-semibold text-[#a3004f]">
                Save these now. Each works once, and they are shown only this one time.
              </p>
              <ul className="grid grid-cols-2 gap-2 rounded-xl border border-[#e6def4] p-4 font-mono text-lg" data-2fa-backup>
                {codes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
              <button type="button" className={`${deskGhost} w-fit`} onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}>
                Copy the codes
              </button>
            </div>
          ) : (
            <form className="grid gap-3 sm:flex sm:items-end" onSubmit={(event) => event.preventDefault()}>
              <label className="field sm:w-56">
                Current app code
                <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
              </label>
              <ActionButton
                className={deskPrimary}
                checkForm
                busy="Making…"
                done="Done"
                surface={deskSurface}
                onRun={async (form) => {
                  const result = await regenerate({ data: { code: String(form.get('code') ?? '') } })
                  if (!result.ok) return { ok: false, message: result.error }
                  setCodes(result.codes)
                  await router.invalidate()
                  return { ok: true, message: 'New codes made. The old ones no longer work.' }
                }}
              >
                Make new backup codes
              </ActionButton>
            </form>
          )}
        </section>
      ) : null}

      {status.active ? (
        <section className={`${deskCard} grid gap-3`} aria-labelledby="phone">
          <h2 id="phone" className={deskH2}>
            New phone
          </h2>
          {phone ? (
            <form className="grid gap-3" onSubmit={(event) => event.preventDefault()}>
              <p className="text-sm text-[#4a4262]">Scan this with the new phone, or type the key. Then enter its code.</p>
              <div
                className="w-52 rounded-xl border border-[#e6def4] bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
                role="img"
                aria-label="QR code for the new phone"
                dangerouslySetInnerHTML={{ __html: phone.qrSvg }}
              />
              <p className="font-mono tracking-wider select-all">{phone.secret}</p>
              <label className="field sm:w-56">
                Code from the new phone
                <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
              </label>
              <ActionButton
                className={`${deskPrimary} w-fit`}
                checkForm
                busy="Checking…"
                done="Switched"
                surface={deskSurface}
                onRun={async (form) => {
                  const result = await finish({ data: { code: String(form.get('code') ?? '') } })
                  if (!result.ok) return { ok: false, message: result.error }
                  setPhone(null)
                  setNotice('Switched. The new phone is the one to use now; the old one stopped working.')
                  await router.invalidate()
                  return { ok: true, message: 'Switched.' }
                }}
              >
                Switch to the new phone
              </ActionButton>
            </form>
          ) : (
            <form className="grid gap-3 sm:flex sm:items-end" onSubmit={(event) => event.preventDefault()}>
              <p className="text-sm text-[#4a4262] sm:basis-full">
                Moving to a new phone? Enter a current code from the old phone, or an unused backup code.
              </p>
              <label className="field sm:w-56">
                Code
                <input name="code" autoComplete="one-time-code" autoCapitalize="none" required />
              </label>
              <ActionButton
                className={deskGhost}
                checkForm
                busy="Checking…"
                done="Ready"
                surface={deskSurface}
                onRun={async (form) => {
                  const result = await begin({ data: { code: String(form.get('code') ?? '') } })
                  if (!result.ok) return { ok: false, message: result.error }
                  setPhone({ qrSvg: result.qrSvg, secret: result.secret })
                  return { ok: true, message: 'Scan the new code.' }
                }}
              >
                Set up a new phone
              </ActionButton>
            </form>
          )}
          {notice ? <p className="text-sm text-[#0b5e41]">{notice}</p> : null}
        </section>
      ) : null}

      <section className={`${deskCard} grid gap-3`} aria-labelledby="devices">
        <h2 id="devices" className={deskH2}>
          Trusted devices
        </h2>
        <p className="text-sm text-[#4a4262]">
          These browsers skip the code for 30 days after you ticked “Trust this device”. They still need the password.
        </p>
        {status.devices.length === 0 ? (
          <p className="text-sm text-[#4a4262]">No trusted devices.</p>
        ) : (
          <ul className="grid gap-2" aria-label="Trusted devices">
            {status.devices.map((device) => (
              <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e6def4] p-3" data-2fa-device>
                <span>
                  <span className="font-semibold">{device.label}</span>
                  {device.current ? <span className="ml-2 text-sm text-[#0b5e41]">This browser</span> : null}
                  <span className="block text-sm text-[#4a4262]">{`Added ${day(device.createdAt)} · until ${day(device.expiresAt)}`}</span>
                </span>
                <ConfirmDelete
                  className={deskDanger}
                  onConfirm={() => {
                    void forget({ data: { id: device.id } }).then(() => router.invalidate())
                  }}
                >
                  Remove
                </ConfirmDelete>
              </li>
            ))}
          </ul>
        )}
        {status.devices.length > 1 ? (
          <ConfirmDelete
            className={`${deskDanger} w-fit`}
            onConfirm={() => {
              void forget({ data: { id: 'all' } }).then(() => router.invalidate())
            }}
          >
            Remove all trusted devices
          </ConfirmDelete>
        ) : null}
      </section>

      <section className={`${deskCard} grid gap-2`} aria-labelledby="recovery">
        <h2 id="recovery" className={deskH2}>
          If you lose your phone
        </h2>
        <p>
          Sign in with your password and one of your backup codes. Each backup code works once. Then use “Set up a new
          phone” above.
        </p>
        <p>
          {'There is no reset link and no email reset. If the phone and every backup code are lost, only the site owner can turn two-step sign-in off, directly in the database: on the piper-djing Book, run '}
          <code className="rounded bg-[#efe9fb] px-1">DELETE FROM desk_2fa; DELETE FROM desk_backup_codes; DELETE FROM desk_trusted;</code>
          {' and the next sign-in with the password sets it up again from the start.'}
        </p>
        <p className="text-sm text-[#4a4262]">
          The app secret is stored encrypted with the DESK_2FA_KEY secret on the Worker. Do not delete or change that
          secret: without it the stored secret cannot be read, and recovery is the database reset above.
        </p>
      </section>
    </div>
  )
}
