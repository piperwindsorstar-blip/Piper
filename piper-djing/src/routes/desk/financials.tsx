import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
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
import type { RunResult } from '../../components/action-button.tsx'
import { deskHead } from '../../lib/desk-head.ts'
import {
  INCOME_CATEGORIES,
  MONTH_NAMES,
  categoryLabel,
  dollars,
  hoursText,
  incomeTotals,
  payPeriods,
  shiftHours,
  shortDay,
  weeklyCsv,
  weeklyHours,
} from '../../lib/fin/fin.ts'
import type { IncomeEntry, Rate, Shift } from '../../lib/fin/fin.ts'
import { deleteFinRow, getFinancials, saveIncome, saveRate, saveShift } from '../../lib/fin/fin.functions.ts'

/** Private: Martin's income and Pynx hours. Never shown on the public site. */
export const Route = createFileRoute('/desk/financials')({
  codeSplitGroupings: [['loader', 'component']],
  head: () => deskHead('Financials · DJ Piper P'),
  loader: () => getFinancials(),
  component: FinancialsPage,
})

type Tab = 'income' | 'periods' | 'weekly' | 'shifts'
type Result = { ok: true } | { ok: false; error: string }

function asRun(result: Result, done: string): RunResult {
  return result.ok ? { ok: true, message: done } : { ok: false, message: result.error }
}

const field = (form: FormData, name: string) => String(form.get(name) ?? '')

function FinancialsPage() {
  const data = Route.useLoaderData()
  const years = useMemo(() => {
    const set = new Set<string>([
      ...data.income.map((row) => row.date.slice(0, 4)),
      ...data.shifts.map((row) => row.date.slice(0, 4)),
      new Date().getFullYear().toString(),
    ])
    return [...set].sort().reverse()
  }, [data])
  const [year, setYear] = useState(years[0] ?? '2026')
  const [tab, setTab] = useState<Tab>('income')

  const income = data.income.filter((row) => row.date.startsWith(year))
  const shifts = data.shifts.filter((row) => row.date.startsWith(year))
  const totals = incomeTotals(income)
  const periods = payPeriods(shifts, data.rates).filter((row) => row.start.startsWith(year) || row.end.startsWith(year))
  const hours = shifts.reduce((sum, row) => sum + shiftHours(row), 0)
  const hourlyPay = periods.reduce((sum, row) => sum + row.cents, 0)
  const gigs = shifts.filter((row) => row.kind === 'gig').length

  const tabs: [Tab, string][] = [
    ['income', 'Income'],
    ['periods', 'Pay periods'],
    ['weekly', 'Weekly hours'],
    ['shifts', 'Shifts'],
  ]

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <DeskTitle kicker="Business" title="Financials">
          <p>Your income and Pynx hours. Private to the Desk.</p>
        </DeskTitle>
        <label className="field w-32">
          Year
          <select value={year} onChange={(event) => setYear(event.target.value)}>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totals">
        <Stat label={`Income ${year}`} value={dollars(totals.total)} hint={`${income.length} entries`} big />
        <Stat label="Pynx pay" value={dollars(totals.byCategory.pynx)} hint="Shifts and Pynx weddings" />
        <Stat
          label="Your own work"
          value={dollars(totals.byCategory.piper + totals.byCategory.gig + totals.byCategory.tip + totals.byCategory.other)}
          hint={`Bookings ${dollars(totals.byCategory.piper)} · Gigs ${dollars(totals.byCategory.gig)} · Tips ${dollars(totals.byCategory.tip)}`}
        />
        <Stat
          label="Pynx hours"
          value={hoursText(hours)}
          hint={`${gigs} Pynx weddings · about ${dollars(hourlyPay)} hourly pay, already in Pynx pay`}
        />
      </section>

      <div role="tablist" aria-label="Financials" className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3.5 text-sm font-semibold ${
              tab === id ? 'bg-[#1c1533] !text-white' : 'border border-[#d6cce8] bg-white text-[#1c1533] hover:border-[#ff007f]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'income' ? <IncomeTab income={income} byMonth={totals.byMonth} /> : null}
      {tab === 'periods' ? <PeriodsTab periods={periods} rates={data.rates} /> : null}
      {tab === 'weekly' ? <WeeklyTab shifts={shifts} year={year} /> : null}
      {tab === 'shifts' ? <ShiftsTab shifts={shifts} /> : null}
    </div>
  )
}

function Stat({ label, value, hint, big = false }: { label: string; value: string; hint: string; big?: boolean }) {
  return (
    <div className={`${deskCard} grid gap-1`}>
      <p className="text-sm font-semibold text-[#4a4262]">{label}</p>
      <p className={`font-display font-extrabold ${big ? 'text-4xl' : 'text-3xl'}`} data-fin-stat={label}>
        {value}
      </p>
      <p className="text-sm text-[#4a4262]">{hint}</p>
    </div>
  )
}

// --- Income ------------------------------------------------------------------

function IncomeFields({ entry }: { entry?: IncomeEntry }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="field">
        Date
        <input name="date" type="date" required defaultValue={entry?.date ?? ''} />
      </label>
      <label className="field">
        Amount (CAD)
        <input name="amount" inputMode="decimal" required defaultValue={entry ? String(entry.cents / 100) : ''} />
      </label>
      <label className="field sm:col-span-2">
        What it was for
        <input name="name" required maxLength={120} defaultValue={entry?.name ?? ''} placeholder="Pynx, Tip - Sam/Jordan…" />
      </label>
      <label className="field sm:col-span-2">
        Category
        <select name="category" defaultValue={entry?.category ?? 'pynx'}>
          {INCOME_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function IncomeTab({ income, byMonth }: { income: IncomeEntry[]; byMonth: number[] }) {
  const router = useRouter()
  const save = useServerFn(saveIncome)
  const peak = Math.max(1, ...byMonth)
  return (
    <div className="grid gap-5">
      <section className={`${deskCard} grid gap-3`} aria-labelledby="by-month">
        <h2 id="by-month" className={deskH2}>
          By month
        </h2>
        <ul className="grid h-48 grid-cols-12 items-end gap-1.5" aria-label="Income by month">
          {byMonth.map((cents, index) => (
            <li key={MONTH_NAMES[index]} className="flex h-full flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-semibold text-[#4a4262] tabular-nums">
                {cents > 0 ? `${Math.round(cents / 100000) > 0 ? `${(cents / 100000).toFixed(1)}k` : dollars(cents)}` : ''}
              </span>
              <span
                className="w-full rounded-t-md bg-[#ff007f]"
                style={{ height: `${Math.max(cents > 0 ? 3 : 0, (cents / peak) * 100)}%` }}
                title={`${MONTH_NAMES[index] ?? ''}: ${dollars(cents)}`}
              />
              <span className="text-[11px] text-[#4a4262]">{MONTH_NAMES[index]}</span>
            </li>
          ))}
        </ul>
      </section>

      <form className={`${deskCard} grid gap-3`} onSubmit={(event) => event.preventDefault()}>
        <h2 className={deskH2}>Add income</h2>
        <IncomeFields />
        <ActionButton
          className={`${deskPrimary} w-fit`}
          checkForm
          busy="Saving…"
          done="Added"
          surface={deskSurface}
          onRun={async (form, element) => {
            const result = await save({
              data: { date: field(form, 'date'), name: field(form, 'name'), amount: field(form, 'amount'), category: field(form, 'category') },
            })
            if (result.ok) {
              element?.reset()
              await router.invalidate()
            }
            return asRun(result, 'Added.')
          }}
        >
          Add income
        </ActionButton>
      </form>

      <ul className="grid gap-2" aria-label="Income">
        {income.length === 0 ? <li className="text-sm text-[#4a4262]">No income this year yet.</li> : null}
        {income.map((entry) => (
          <Row
            key={entry.id}
            id={`income-${entry.id}`}
            title={entry.name}
            meta={`${shortDay(entry.date)} · ${categoryLabel(entry.category)}`}
            amount={dollars(entry.cents)}
            table="income"
            rowId={entry.id}
            edit={(close) => (
              <EditForm
                onSave={async (form) => {
                  const result = await save({
                    data: {
                      id: entry.id,
                      date: field(form, 'date'),
                      name: field(form, 'name'),
                      amount: field(form, 'amount'),
                      category: field(form, 'category'),
                    },
                  })
                  if (result.ok) close()
                  return result
                }}
              >
                <IncomeFields entry={entry} />
              </EditForm>
            )}
          />
        ))}
      </ul>
    </div>
  )
}

// --- Shared row with edit and delete -------------------------------------------

function Row({
  id,
  title,
  meta,
  amount,
  table,
  rowId,
  edit,
}: {
  id: string
  title: string
  meta: string
  amount: string
  table: 'income' | 'shift' | 'rate'
  rowId: number
  edit: (close: () => void) => ReactNode
}) {
  const router = useRouter()
  const remove = useServerFn(deleteFinRow)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <li className={`${deskCard} !p-4`} data-fin-row={id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-[#4a4262]">{meta}</p>
        </div>
        <p className="font-display text-xl font-bold whitespace-nowrap tabular-nums">{amount}</p>
        <button type="button" className={`${deskGhost} !min-h-11 !px-4`} onClick={() => setOpen(!open)}>
          {open ? 'Close' : 'Edit'}
        </button>
      </div>
      {notice ? <p className="mt-2 text-sm text-rose-700">{notice}</p> : null}
      {open ? (
        <div className="mt-3 grid gap-3">
          {edit(() => {
            setOpen(false)
            void router.invalidate()
          })}
          <ConfirmDelete
            className={`${deskDanger} w-fit`}
            onConfirm={() => {
              void remove({ data: { table, id: rowId } }).then(async (result) => {
                setNotice(result.ok ? null : result.error)
                if (result.ok) await router.invalidate()
              })
            }}
          >
            Delete
          </ConfirmDelete>
        </div>
      ) : null}
    </li>
  )
}

function EditForm({ children, onSave }: { children: ReactNode; onSave: (form: FormData) => Promise<Result> }) {
  return (
    <form className="grid gap-3" onSubmit={(event) => event.preventDefault()}>
      {children}
      <ActionButton
        className={`${deskPrimary} w-fit`}
        checkForm
        busy="Saving…"
        done="Saved"
        surface={deskSurface}
        onRun={async (form) => asRun(await onSave(form), 'Saved.')}
      >
        Save
      </ActionButton>
    </form>
  )
}

// --- Pay periods ---------------------------------------------------------------

function PeriodsTab({ periods, rates }: { periods: ReturnType<typeof payPeriods>; rates: Rate[] }) {
  const router = useRouter()
  const save = useServerFn(saveRate)
  return (
    <div className="grid gap-5">
      <p className="text-sm text-[#4a4262]">
        Every two weeks from Sunday, January 4. Estimated Pynx hourly pay at your rate, 1.5× after 44 hours in a
        week. It is already inside your Pynx pay, so it is never added to income again.
      </p>
      <ul className="grid gap-3 md:grid-cols-2" aria-label="Pay periods">
        {periods.length === 0 ? <li className="text-sm text-[#4a4262]">No shifts this year yet.</li> : null}
        {periods.map((period) => (
          <li key={period.start} className={`${deskCard} grid gap-1`} data-fin-period={period.start}>
            <p className="text-sm font-semibold text-[#4a4262]">{`${shortDay(period.start)} – ${shortDay(period.end)}`}</p>
            <p className="font-display text-3xl font-extrabold tabular-nums">{dollars(period.cents)}</p>
            <p className="text-sm text-[#4a4262]">
              {`${hoursText(period.hours)} hours`}
              {period.overtimeHours > 0 ? ` · ${hoursText(period.overtimeHours)} overtime` : ''}
              {` · ${period.shifts} ${period.shifts === 1 ? 'shift' : 'shifts'}`}
            </p>
            {period.gigs.length > 0 ? (
              <p className="text-sm text-[#4a4262]">{`Pynx weddings: ${period.gigs.join(', ')}`}</p>
            ) : null}
          </li>
        ))}
      </ul>

      <section className={`${deskCard} grid gap-3`} aria-labelledby="rates">
        <h2 id="rates" className={deskH2}>
          Hourly rate
        </h2>
        <p className="text-sm text-[#4a4262]">A new rate applies from its start date on, never backwards.</p>
        <ul className="grid gap-2">
          {rates.map((rate) => (
            <Row
              key={rate.id}
              id={`rate-${rate.id}`}
              title={`From ${shortDay(rate.from)}, ${rate.from.slice(0, 4)}`}
              meta="Pynx hourly"
              amount={`${dollars(rate.cents)}/h`}
              table="rate"
              rowId={rate.id}
              edit={(close) => (
                <EditForm
                  onSave={async (form) => {
                    const result = await save({ data: { id: rate.id, from: field(form, 'from'), amount: field(form, 'amount') } })
                    if (result.ok) close()
                    return result
                  }}
                >
                  <RateFields rate={rate} />
                </EditForm>
              )}
            />
          ))}
        </ul>
        <form className="grid gap-3" onSubmit={(event) => event.preventDefault()}>
          <RateFields />
          <ActionButton
            className={`${deskGhost} w-fit`}
            checkForm
            busy="Saving…"
            done="Added"
            surface={deskSurface}
            onRun={async (form, element) => {
              const result = await save({ data: { from: field(form, 'from'), amount: field(form, 'amount') } })
              if (result.ok) {
                element?.reset()
                await router.invalidate()
              }
              return asRun(result, 'Added.')
            }}
          >
            Add a new rate
          </ActionButton>
        </form>
      </section>
    </div>
  )
}

function RateFields({ rate }: { rate?: Rate }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="field">
        Starts on
        <input name="from" type="date" required defaultValue={rate?.from ?? ''} />
      </label>
      <label className="field">
        Rate per hour (CAD)
        <input name="amount" inputMode="decimal" required defaultValue={rate ? String(rate.cents / 100) : ''} />
      </label>
    </div>
  )
}

// --- Weekly ----------------------------------------------------------------------

function WeeklyTab({ shifts, year }: { shifts: Shift[]; year: string }) {
  const rows = weeklyHours(shifts)
  const download = () => {
    const blob = new Blob([weeklyCsv(rows)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pynx-hours-${year}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return (
    <section className={`${deskCard} grid gap-3`} aria-labelledby="weekly">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="weekly" className={deskH2}>
          Pynx hours by week
        </h2>
        <button type="button" className={deskGhost} onClick={download}>
          Download CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm tabular-nums">
          <thead>
            <tr className="text-left text-[#4a4262]">
              <th className="py-2 pr-3 font-semibold">Week of</th>
              {days.map((day) => (
                <th key={day} className="px-2 py-2 text-right font-semibold">
                  {day}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.monday} className="border-t border-[#efe9f8]">
                <td className="py-2 pr-3 font-semibold whitespace-nowrap">
                  {shortDay(row.monday)}
                  {row.gigs > 0 ? (
                    <span className="ml-2 rounded-full bg-[#ffe3f0] px-2 py-0.5 text-xs text-[#a30054]">
                      {`${row.gigs} wedding${row.gigs === 1 ? '' : 's'}`}
                    </span>
                  ) : null}
                </td>
                {row.days.map((hours, index) => (
                  <td key={days[index]} className="px-2 py-2 text-right">
                    {hours > 0 ? hoursText(hours) : '·'}
                  </td>
                ))}
                <td
                  className={`px-2 py-2 text-right font-bold ${row.total > 44 ? 'rounded bg-[#ffe3f0] text-[#a30054]' : 'bg-[#f3eefc]'}`}
                >
                  {hoursText(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// --- Shifts ----------------------------------------------------------------------

function ShiftFields({ shift }: { shift?: Shift }) {
  const [kind, setKind] = useState(shift?.kind ?? 'hourly')
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="field">
        Date
        <input name="date" type="date" required defaultValue={shift?.date ?? ''} />
      </label>
      <label className="field">
        Type
        <select name="kind" value={kind} onChange={(event) => setKind(event.target.value === 'gig' ? 'gig' : 'hourly')}>
          <option value="hourly">Hourly shift</option>
          <option value="gig">Pynx wedding</option>
        </select>
      </label>
      {kind === 'hourly' ? (
        <>
          <label className="field">
            In
            <input name="start" type="time" required defaultValue={shift?.start ?? ''} />
          </label>
          <label className="field">
            Out
            <input name="end" type="time" required defaultValue={shift?.end ?? ''} />
          </label>
        </>
      ) : (
        <label className="field sm:col-span-2">
          Job code
          <input name="code" maxLength={40} defaultValue={shift?.code ?? ''} placeholder="26-0012" />
        </label>
      )}
      <label className="field sm:col-span-2">
        Notes
        <input name="notes" maxLength={300} defaultValue={shift?.notes ?? ''} />
      </label>
    </div>
  )
}

function shiftData(form: FormData) {
  return {
    date: field(form, 'date'),
    kind: field(form, 'kind'),
    start: field(form, 'start'),
    end: field(form, 'end'),
    code: field(form, 'code'),
    notes: field(form, 'notes'),
  }
}

function ShiftsTab({ shifts }: { shifts: Shift[] }) {
  const router = useRouter()
  const save = useServerFn(saveShift)
  return (
    <div className="grid gap-5">
      <form className={`${deskCard} grid gap-3`} onSubmit={(event) => event.preventDefault()}>
        <h2 className={deskH2}>Add a Pynx shift</h2>
        <ShiftFields />
        <ActionButton
          className={`${deskPrimary} w-fit`}
          checkForm
          busy="Saving…"
          done="Added"
          surface={deskSurface}
          onRun={async (form, element) => {
            const result = await save({ data: shiftData(form) })
            if (result.ok) {
              element?.reset()
              await router.invalidate()
            }
            return asRun(result, 'Added.')
          }}
        >
          Add the shift
        </ActionButton>
      </form>
      <ul className="grid gap-2" aria-label="Shifts">
        {shifts.length === 0 ? <li className="text-sm text-[#4a4262]">No shifts this year yet.</li> : null}
        {shifts.map((shift) => (
          <Row
            key={shift.id}
            id={`shift-${shift.id}`}
            title={shift.kind === 'gig' ? `Pynx wedding${shift.code ? ` ${shift.code}` : ''}` : `${shift.start} – ${shift.end}`}
            meta={`${shortDay(shift.date)}${shift.notes ? ` · ${shift.notes}` : ''}`}
            amount={shift.kind === 'gig' ? 'Gig' : `${hoursText(shiftHours(shift))} h`}
            table="shift"
            rowId={shift.id}
            edit={(close) => (
              <EditForm
                onSave={async (form) => {
                  const result = await save({ data: { id: shift.id, ...shiftData(form) } })
                  if (result.ok) close()
                  return result
                }}
              >
                <ShiftFields shift={shift} />
              </EditForm>
            )}
          />
        ))}
      </ul>
    </div>
  )
}
