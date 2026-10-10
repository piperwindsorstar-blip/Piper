import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState } from 'react'
import {
  EVENT_TYPES,
  dateCheckAnswer,
  parseDateRequest,
  todayInToronto,
} from '../../lib/crm/date-request.ts'
import type { EventType } from '../../lib/crm/date-request.ts'
import { checkDate } from '../../lib/crm/public.functions.ts'
import { LINKS } from './content.ts'
import { useDateDraft } from './date-draft.tsx'
import { Icon } from './icon.tsx'

export function DateCheckForm() {
  const check = useServerFn(checkDate)
  const { date, setDate } = useDateDraft()
  const [eventType, setEventType] = useState('Wedding')
  const [company, setCompany] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    message: string
    booking: { date: string; event: EventType } | null
  } | null>(null)
  const ticket = useRef(0)
  const field =
    'mt-2 w-full rounded-lg border border-line bg-mist px-4 py-3 text-ink focus:border-violet focus:bg-paper focus:outline-none'

  return (
    <form
      id="check-dates"
      className="relative rounded-2xl border border-ink bg-paper p-7 shadow-[8px_8px_0_0_#EEE8FF]"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault()
        const parsed = parseDateRequest(
          { date, eventType, company },
          todayInToronto(),
        )
        if (!parsed.ok) {
          setResult(null)
          setError(parsed.error)
          return
        }
        if (parsed.silent) return
        const current = ++ticket.current
        setError(null)
        setResult(null)
        setPending(true)
        void check({ data: { date: parsed.date } })
          .then((answer) => {
            if (current !== ticket.current) return
            setResult({
              message: dateCheckAnswer(answer.open),
              booking: answer.open
                ? { date: parsed.date, event: parsed.eventType }
                : null,
            })
          })
          .catch(() => {
            if (current !== ticket.current) return
            setResult(null)
            setError(
              'That date could not be checked. Email PiperPWeddingDJ@gmail.com and Piper will write back.',
            )
          })
          .finally(() => {
            if (current === ticket.current) setPending(false)
          })
      }}
    >
      <p className="font-mono text-xs tracking-[0.2em] text-violet uppercase">
        Free · no commitment
      </p>
      <h2 className="mt-2 font-display text-3xl font-bold text-balance">
        Got a date in mind?
      </h2>
      <label
        htmlFor="w-date"
        className="mt-6 block text-xs font-bold tracking-widest text-soft uppercase"
      >
        Event date
      </label>
      <input
        id="w-date"
        type="date"
        required
        min={todayInToronto()}
        value={date}
        onChange={(event) => {
          setDate(event.target.value)
          setResult(null)
          setError(null)
        }}
        className={field}
      />
      <label
        htmlFor="w-type"
        className="mt-4 block text-xs font-bold tracking-widest text-soft uppercase"
      >
        Event type
      </label>
      <select
        id="w-type"
        value={eventType}
        onChange={(event) => {
          setEventType(event.target.value)
          setResult(null)
          setError(null)
        }}
        className={field}
      >
        {EVENT_TYPES.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <label htmlFor="w-company" className="sr-only">
        Company
      </label>
      <input
        id="w-company"
        name="company"
        value={company}
        onChange={(event) => setCompany(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-4 font-bold text-white shadow-[0_8px_24px_-8px_rgba(255,0,127,0.6)] transition hover:bg-hot disabled:opacity-60"
      >
        {pending ? 'Checking the date' : 'Check Wedding Dates'}
        <Icon n="arrow" className="h-4 w-4" />
      </button>
      {result ? (
        <p
          role="status"
          className="mt-4 text-center font-display text-xl font-bold text-balance text-ink"
        >
          {result.message}
        </p>
      ) : null}
      {result?.booking ? (
        <Link
          to="/book"
          search={{ date: result.booking.date, event: result.booking.event }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-ink py-3 font-bold text-ink transition hover:bg-ink hover:text-white"
        >
          Book this date
          <Icon n="arrow" className="h-4 w-4" />
        </Link>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-3 text-center text-sm font-medium text-ink"
        >
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-center text-xs text-soft">
        Or email{' '}
        <span className="font-medium text-ink select-all">{LINKS.email}</span>
      </p>
    </form>
  )
}
