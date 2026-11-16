import { useCallback, useEffect, useRef, useState } from 'react'
import { Spinner } from '../action-button.tsx'
import { useRsvpTheme } from './shell.tsx'

export type SavePhase = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Saves a draft a moment after the couple stops changing it. Only the latest
 * draft's answer counts, so a slow earlier save can never overwrite a newer one.
 */
export function useAutosave<T>(
  save: (draft: T) => Promise<{ ok: true } | { ok: false; error: string }>,
  delay = 700,
) {
  const [phase, setPhase] = useState<SavePhase>('idle')
  const [error, setError] = useState('')
  const timer = useRef<number | null>(null)
  const latest = useRef(0)
  const pending = useRef<T | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save

  const run = useCallback((draft: T) => {
    latest.current += 1
    const ticket = latest.current
    pending.current = null
    setPhase('saving')
    setError('')
    void saveRef
      .current(draft)
      .then((result) => {
        if (ticket !== latest.current) return
        if (result.ok) {
          setPhase('saved')
          return
        }
        setPhase('error')
        setError(result.error)
      })
      .catch(() => {
        if (ticket !== latest.current) return
        setPhase('error')
        setError('That did not save. Check your connection.')
      })
  }, [])

  const schedule = useCallback(
    (draft: T) => {
      pending.current = draft
      if (timer.current !== null) window.clearTimeout(timer.current)
      setPhase('saving')
      timer.current = window.setTimeout(() => {
        timer.current = null
        run(draft)
      }, delay)
    },
    [delay, run],
  )

  /** Saves now, skipping the wait (the "Save" button, or leaving the page). */
  const flush = useCallback(
    (draft?: T) => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = null
      const next = draft ?? pending.current
      if (next !== null && next !== undefined) run(next)
    },
    [run],
  )

  /** Shows a problem without saving, e.g. two tables with the same number. */
  const hold = useCallback((message: string) => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    pending.current = null
    latest.current += 1
    setPhase('error')
    setError(message)
  }, [])

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  return { phase, error, schedule, flush, hold }
}

/** "Saving…" with a spinner, then "✓ Saved", or the reason it did not save. */
export function SaveStatus({
  phase,
  error,
}: {
  phase: SavePhase
  error: string
}) {
  const surface = useRsvpTheme()
  const good = surface === 'light' ? 'text-emerald-600' : 'text-emerald-400'
  const bad = surface === 'light' ? 'text-rose-600' : 'text-rose-400'
  if (phase === 'saving') {
    return (
      <span
        className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]"
        role="status"
        aria-live="polite"
      >
        <Spinner label="Saving…" />
        Saving…
      </span>
    )
  }
  if (phase === 'saved') {
    return (
      <span className={`text-sm ${good}`} role="status" aria-live="polite">
        ✓ Saved
      </span>
    )
  }
  if (phase === 'error') {
    return (
      <span className={`text-sm ${bad}`} role="alert">
        {error || 'That did not save.'}
      </span>
    )
  }
  return null
}
