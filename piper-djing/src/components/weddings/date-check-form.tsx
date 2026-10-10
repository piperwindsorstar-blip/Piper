import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  EVENT_TYPES,
  parseDateRequest,
  todayInToronto,
} from '../../lib/crm/date-request.ts'
import { LINKS } from './content.ts'
import { useDateDraft } from './date-draft.tsx'
import { Icon } from './icon.tsx'

export function DateCheckForm() {
  const router = useRouter()
  const { date, setDate } = useDateDraft()
  const [eventType, setEventType] = useState('Wedding')
  const [company, setCompany] = useState('')
  const [error, setError] = useState<string | null>(null)
  const field =
    'mt-2 w-full rounded-lg border border-line bg-mist px-4 py-3 text-ink focus:border-violet focus:bg-paper focus:outline-none'

  return (
    <form
      id="check-dates"
      className="relative rounded-2xl border border-ink bg-paper p-7 shadow-[8px_8px_0_0_#EEE8FF]"
      onSubmit={(event) => {
        event.preventDefault()
        const parsed = parseDateRequest(
          { date, eventType, company },
          todayInToronto(),
        )
        if (!parsed.ok) {
          setError(parsed.error)
          return
        }
        if (parsed.silent) return
        setError(null)
        void router.navigate({
          to: '/book',
          search: { date: parsed.date, event: parsed.eventType },
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
        onChange={(event) => setDate(event.target.value)}
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
        onChange={(event) => setEventType(event.target.value)}
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
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-4 font-bold text-white shadow-[0_8px_24px_-8px_rgba(255,0,127,0.6)] transition hover:bg-hot"
      >
        Check Wedding Dates
        <Icon n="arrow" className="h-4 w-4" />
      </button>
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
