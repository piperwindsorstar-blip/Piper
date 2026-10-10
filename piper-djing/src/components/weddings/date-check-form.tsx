import { longDate } from '../../lib/crm/dates.ts'
import { EVENT_TYPES } from '../../lib/crm/date-request.ts'
import { LINKS } from './content.ts'
import { useDateDraft } from './date-draft.tsx'
import { Icon } from './icon.tsx'

export function DateCheckForm() {
  const { date, eventType, setEventType, company, setCompany, openCalendar } =
    useDateDraft()
  const field =
    'mt-2 w-full rounded-lg border border-line bg-mist px-4 py-3 text-left text-ink focus:border-violet focus:bg-paper focus:outline-none'

  return (
    <form
      id="check-dates"
      className="relative rounded-2xl border border-ink bg-paper p-7 shadow-[8px_8px_0_0_#EEE8FF]"
      onSubmit={(event) => {
        event.preventDefault()
        openCalendar()
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
      <button
        id="w-date"
        type="button"
        onClick={openCalendar}
        className={field}
      >
        {date ? longDate(date) : 'Choose a date'}
      </button>
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
          const next = EVENT_TYPES.find((item) => item === event.target.value)
          if (next) setEventType(next)
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
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-4 font-bold text-white shadow-[0_8px_24px_-8px_rgba(255,0,127,0.6)] transition hover:bg-hot"
      >
        Check Wedding Dates
        <Icon n="arrow" className="h-4 w-4" />
      </button>
      <p className="mt-3 text-center text-xs text-soft">
        Or email{' '}
        <span className="font-medium text-ink select-all">{LINKS.email}</span>
      </p>
    </form>
  )
}
