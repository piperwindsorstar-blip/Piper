import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState } from 'react'
import { longDate } from '../../lib/crm/dates.ts'
import {
  CUSTOM_EVENT,
  HOME_EVENT_TYPES,
  calendarWeeks,
  dateCheckAnswer,
  parseCheckedEvent,
  todayInToronto,
} from '../../lib/crm/date-request.ts'
import { checkDate } from '../../lib/crm/public.functions.ts'
import { Eyebrow } from './ui.tsx'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function DateChecker() {
  const check = useServerFn(checkDate)
  const navigate = useNavigate()
  const today = todayInToronto()
  const [eventType, setEventType] = useState<(typeof HOME_EVENT_TYPES)[number] | typeof CUSTOM_EVENT>(
    'Wedding',
  )
  const [custom, setCustom] = useState('')
  const [company, setCompany] = useState('')
  const [year, setYear] = useState(() => Number(today.slice(0, 4)))
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1)
  const [picked, setPicked] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ticket = useRef(0)
  const timer = useRef(0)
  const customRef = useRef(custom)
  customRef.current = custom
  const weeks = calendarWeeks(year, month)
  const title = new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month, 1)))
  const currentMonth = today.slice(0, 7)
  const cursorMonth = `${year}-${String(month + 1).padStart(2, '0')}`
  const field =
    'mt-2 w-full rounded-lg border border-white/15 bg-ink-950 px-4 py-3 text-white focus:border-neon focus:outline-none'

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(year, month + delta, 1))
    setYear(next.getUTCFullYear())
    setMonth(next.getUTCMonth())
  }

  function pick(day: string) {
    window.clearTimeout(timer.current)
    const parsed = parseCheckedEvent(
      {
        date: day,
        eventType,
        custom: customRef.current,
        company,
        allowed: HOME_EVENT_TYPES,
      },
      today,
    )
    if (!parsed.ok) {
      setMessage(null)
      setError(parsed.error)
      return
    }
    if (parsed.silent) return
    const [pickedYear = year, pickedMonth = month + 1] = day
      .split('-')
      .map(Number)
    setYear(pickedYear)
    setMonth(pickedMonth - 1)
    setPicked(day)
    const current = ++ticket.current
    setError(null)
    setMessage(null)
    setPending(true)
    void check({ data: { date: parsed.date } })
      .then((answer) => {
        if (current !== ticket.current) return
        setMessage(dateCheckAnswer(answer.open))
        if (!answer.open) return
        timer.current = window.setTimeout(() => {
          if (current !== ticket.current) return
          void navigate({
            to: '/book',
            search: { date: parsed.date, event: parsed.event },
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
    <section
      id="check-a-date"
      className="mx-auto max-w-xl scroll-mt-24 px-5 py-24"
    >
      <Eyebrow>Check a date</Eyebrow>
      <h2 className="mt-4 font-display text-4xl font-bold text-balance md:text-6xl">
        See if Piper is free.
      </h2>
      <p className="mt-4 text-white/70">
        Pick the event, then a day. An open date continues to the inquiry.
      </p>
      <div className="relative mt-8 rounded-3xl border border-white/10 bg-ink-900 p-5 sm:p-7">
        <label
          htmlFor="home-event"
          className="block text-xs font-bold tracking-widest text-white/55 uppercase"
        >
          Event
        </label>
        <select
          id="home-event"
          value={eventType}
          onChange={(event) => {
            const next = event.target.value
            if (next === CUSTOM_EVENT) {
              setEventType(CUSTOM_EVENT)
            } else if ((HOME_EVENT_TYPES as readonly string[]).includes(next)) {
              setEventType(next as (typeof HOME_EVENT_TYPES)[number])
            } else {
              return
            }
            setMessage(null)
            setError(null)
          }}
          className={field}
        >
          {HOME_EVENT_TYPES.map((item) => (
            <option key={item}>{item}</option>
          ))}
          <option>{CUSTOM_EVENT}</option>
        </select>
        {eventType === CUSTOM_EVENT ? (
          <label
            htmlFor="home-custom-event"
            className="mt-4 block text-xs font-bold tracking-widest text-white/55 uppercase"
          >
            What is the event?
            <input
              id="home-custom-event"
              value={custom}
              maxLength={80}
              onChange={(event) => {
                setCustom(event.target.value)
                setMessage(null)
                setError(null)
              }}
              className={field}
            />
          </label>
        ) : null}
        <label htmlFor="home-company" className="sr-only">
          Company
        </label>
        <input
          id="home-company"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="absolute -left-[9999px] h-px w-px overflow-hidden"
        />
        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Previous month"
            disabled={cursorMonth <= currentMonth}
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Prev
          </button>
          <p className="font-display text-lg font-bold">{title}</p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold"
          >
            Next
          </button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold tracking-wide text-white/45 uppercase">
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
                const selected = cell.date === picked
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
                          ? 'text-white hover:bg-white/10'
                          : 'text-white/35 hover:bg-white/10'
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
          <p className="mt-4 text-center text-sm text-white/60">
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
          <p role="alert" className="mt-3 text-center text-sm font-medium text-hot">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}
