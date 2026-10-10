import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useRef, useState } from 'react'
import { longDate } from '../../lib/crm/dates.ts'
import {
  EVENT_TYPES,
  calendarWeeks,
  dateCheckAnswer,
  parseDateRequest,
  todayInToronto,
} from '../../lib/crm/date-request.ts'
import { checkDate } from '../../lib/crm/public.functions.ts'
import { useDateDraft } from './date-draft.tsx'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function DateCalendarDialog() {
  const {
    date,
    setDate,
    eventType,
    setEventType,
    company,
    calendarOpen,
    closeCalendar,
  } = useDateDraft()
  const check = useServerFn(checkDate)
  const navigate = useNavigate()
  const today = todayInToronto()
  const [year, setYear] = useState(() => Number(today.slice(0, 4)))
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ticket = useRef(0)
  const timer = useRef(0)
  const eventTypeRef = useRef(eventType)
  const dateRef = useRef(date)
  const dialogRef = useRef<HTMLDivElement>(null)
  eventTypeRef.current = eventType
  dateRef.current = date

  useEffect(() => {
    if (!calendarOpen) {
      window.clearTimeout(timer.current)
      return
    }
    setMessage(null)
    setError(null)
    setPending(false)
    const seed = dateRef.current >= today ? dateRef.current : today
    setYear(Number(seed.slice(0, 4)))
    setMonth(Number(seed.slice(5, 7)) - 1)
    dialogRef.current?.focus()
  }, [calendarOpen, today])

  useEffect(() => {
    if (!calendarOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCalendar()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [calendarOpen, closeCalendar])

  if (!calendarOpen) return null

  const weeks = calendarWeeks(year, month)
  const title = new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month, 1)))
  const currentMonth = today.slice(0, 7)
  const cursorMonth = `${year}-${String(month + 1).padStart(2, '0')}`

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(year, month + delta, 1))
    setYear(next.getUTCFullYear())
    setMonth(next.getUTCMonth())
  }

  function pick(day: string) {
    window.clearTimeout(timer.current)
    const parsed = parseDateRequest({ date: day, eventType, company }, today)
    if (!parsed.ok) {
      setMessage(null)
      setError(parsed.error)
      return
    }
    if (parsed.silent) {
      closeCalendar()
      return
    }
    const [pickedYear = year, pickedMonth = month + 1] = day
      .split('-')
      .map(Number)
    setYear(pickedYear)
    setMonth(pickedMonth - 1)
    setDate(day)
    const current = ++ticket.current
    setError(null)
    setMessage(null)
    setPending(true)
    void check({ data: { date: parsed.date } })
      .then((answer) => {
        if (current !== ticket.current) return
        const text = dateCheckAnswer(answer.open)
        setMessage(text)
        if (!answer.open) return
        timer.current = window.setTimeout(() => {
          if (current !== ticket.current) return
          closeCalendar()
          void navigate({
            to: '/book',
            search: { date: parsed.date, event: eventTypeRef.current },
          })
        }, 1200)
      })
      .catch(() => {
        if (current !== ticket.current) return
        setMessage(null)
        setError(
          'That date could not be checked. Email PiperPWeddingDJ@gmail.com and Piper will write back.',
        )
      })
      .finally(() => {
        if (current === ticket.current) setPending(false)
      })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40">
      <button
        type="button"
        aria-label="Close the calendar"
        className="fixed inset-0 cursor-default"
        onClick={closeCalendar}
      />
      <div className="flex min-h-full items-start justify-center px-4 py-6 sm:items-center">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="date-calendar-title"
          tabIndex={-1}
          className="relative w-full max-w-sm rounded-2xl border border-ink bg-paper p-5 shadow-[8px_8px_0_0_#EEE8FF] outline-none"
        >
          <div className="flex items-start justify-between gap-3">
            <h2
              id="date-calendar-title"
              className="font-display text-2xl font-bold"
            >
              Pick a date
            </h2>
            <button
              type="button"
              onClick={closeCalendar}
              className="rounded-lg px-2 py-1 text-sm font-semibold text-soft hover:text-ink"
            >
              Close
            </button>
          </div>
          <label
            htmlFor="calendar-event"
            className="mt-4 block text-xs font-bold tracking-widest text-soft uppercase"
          >
            Event type
          </label>
          <select
            id="calendar-event"
            value={eventType}
            onChange={(event) => {
              const next = EVENT_TYPES.find(
                (item) => item === event.target.value,
              )
              if (next) setEventType(next)
            }}
            className="mt-2 w-full rounded-lg border border-line bg-mist px-4 py-3 text-ink focus:border-violet focus:bg-paper focus:outline-none"
          >
            {EVENT_TYPES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              disabled={cursorMonth <= currentMonth}
              onClick={() => shiftMonth(-1)}
              className="rounded-lg border border-line px-3 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Prev
            </button>
            <p className="font-display text-lg font-bold">{title}</p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              className="rounded-lg border border-line px-3 py-2 text-sm font-semibold"
            >
              Next
            </button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold tracking-wide text-soft uppercase">
            {WEEKDAYS.map((day) => (
              <span key={day} aria-hidden="true">
                {day.slice(0, 1)}
              </span>
            ))}
          </div>
          <div className="mt-1 grid gap-1">
            {weeks.map((week) => (
              <div key={week[0]?.date} className="grid grid-cols-7 gap-1">
                {week.map((cell) => {
                  const past = cell.date < today
                  const selected = cell.date === date
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      disabled={past || pending}
                      aria-label={longDate(cell.date)}
                      aria-pressed={selected}
                      onClick={() => pick(cell.date)}
                      className={`grid h-10 place-items-center rounded-lg text-sm font-semibold ${
                        selected
                          ? 'bg-neon text-white'
                          : cell.inMonth
                            ? 'text-ink hover:bg-blush'
                            : 'text-soft hover:bg-blush'
                      } disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent`}
                    >
                      {Number(cell.date.slice(8, 10))}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          {pending ? (
            <p className="mt-4 text-center text-sm text-soft">
              Checking the date
            </p>
          ) : null}
          {message ? (
            <p
              role="status"
              className="mt-4 text-center font-display text-xl font-bold text-balance"
            >
              {message}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-center text-sm font-medium">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
