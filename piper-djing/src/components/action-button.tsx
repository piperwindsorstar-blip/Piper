import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * The one button that answers back. Every button on the site that sends, saves
 * or uploads goes through here, so a click always disables the button, shows a
 * spinner with what it is doing, and then lands on a clear result: a green
 * "✓ Sent" for three seconds, or a red message with the button ready to retry.
 *
 * A second click during a send does nothing, so nothing is ever sent twice.
 */

export type RunResult = {
  ok: boolean
  /** The line under the button: the success note or the reason it failed. */
  message?: string
}

/** Work that already reports its own errors may return nothing at all. */
export type MaybeResult = RunResult | undefined | void

export type ActionButtonProps = {
  /**
   * Does the work. Resolve with ok:false to show the error and allow a retry.
   * The form the button sits in arrives as FormData, so a saved form needs no
   * extra plumbing.
   */
  onRun: (
    form: FormData,
    element: HTMLFormElement | null,
  ) => MaybeResult | Promise<MaybeResult>
  /** The idle label. */
  children: ReactNode
  /** "Sending…", "Saving…", "Uploading…" */
  busy: string
  /** "Sent", "Saved", "Uploaded" — shown as "✓ Sent". */
  done: string
  /** The button's own classes. */
  className: string
  /** Which colours the success and error lines use. */
  surface?: 'dark' | 'light'
  /** Quiet line under the button, e.g. "Sent today 8:15 AM". */
  lastUsed?: string
  /** Asked before the work starts, on the couple's own click. */
  confirmMessage?: string
  disabled?: boolean
  /** Why the button is off, shown quietly beside it. */
  disabledHint?: string
  /** Leave the spinner off for work that is instant. */
  wrapperClassName?: string
  /** Check the surrounding form's required fields before running. */
  checkForm?: boolean
}

export function Spinner({ label }: { label?: string }) {
  return (
    <svg
      className="h-4 w-4 shrink-0 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {label ? <title>{label}</title> : null}
    </svg>
  )
}

export function useAction(
  onRun: (
    form: FormData,
    element: HTMLFormElement | null,
  ) => MaybeResult | Promise<MaybeResult>,
) {
  const [phase, setPhase] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  const start = (form: FormData, element: HTMLFormElement | null) => {
    if (phase === 'busy') return
    setPhase('busy')
    setMessage('')
    void Promise.resolve(onRun(form, element))
      .then((result) => {
        const outcome: RunResult = result ?? {
          ok: false,
          message: 'That did not go through.',
        }
        setMessage(outcome.message ?? '')
        if (!outcome.ok) {
          setPhase('error')
          return
        }
        setPhase('done')
        timer.current = window.setTimeout(() => {
          setPhase('idle')
          setMessage('')
        }, 3000)
      })
      .catch(() => {
        setPhase('error')
        setMessage('That did not go through. Try again.')
      })
  }

  return { phase, message, start }
}

export function ActionButton({
  onRun,
  children,
  busy,
  done,
  className,
  surface = 'dark',
  lastUsed = '',
  confirmMessage,
  disabled = false,
  disabledHint = '',
  wrapperClassName = 'inline-flex flex-col items-start gap-1',
  checkForm = false,
}: ActionButtonProps) {
  const { phase, message, start } = useAction(onRun)
  const good = surface === 'light' ? 'text-emerald-600' : 'text-emerald-400'
  const bad = surface === 'light' ? 'text-rose-600' : 'text-rose-400'
  const hint = surface === 'light' ? 'text-[#5b5370]' : 'text-[#a9a9b2]'

  const label =
    phase === 'busy' ? (
      <>
        <Spinner label={busy} />
        {busy}
      </>
    ) : phase === 'done' ? (
      <>✓ {done}</>
    ) : (
      children
    )

  return (
    <span className={wrapperClassName}>
      <button
        type="button"
        className={className}
        disabled={disabled || phase === 'busy'}
        aria-busy={phase === 'busy'}
        onClick={(event) => {
          if (phase === 'busy') return
          const form = event.currentTarget.closest('form')
          // Keeps the browser's own "please fill this in" for required fields.
          if (checkForm && form && !form.reportValidity()) return
          if (confirmMessage && !window.confirm(confirmMessage)) return
          start(form ? new FormData(form) : new FormData(), form)
        }}
      >
        {label}
      </button>
      {message ? (
        <span
          role={phase === 'error' ? 'alert' : 'status'}
          className={`text-sm ${phase === 'error' ? bad : good}`}
        >
          {phase === 'error' ? `${message} Try again.` : message}
        </span>
      ) : null}
      {!message && phase === 'idle' && lastUsed ? (
        <span className={`text-xs ${hint}`}>{lastUsed}</span>
      ) : null}
      {!message && disabled && disabledHint ? (
        <span className={`text-xs ${hint}`}>{disabledHint}</span>
      ) : null}
    </span>
  )
}
