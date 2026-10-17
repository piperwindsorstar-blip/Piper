import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { CatererSheet } from '../../lib/rsvp/caterer.ts'
import {
  findYourSeat,
  formatLength,
  tableLabel,
} from '../../lib/rsvp/seating.ts'
import type { SeatableGuest, SeatingPlan } from '../../lib/rsvp/seating.ts'
import { orderedMoments, timeLabel } from '../../lib/rsvp/timeline.ts'
import type { Timeline } from '../../lib/rsvp/timeline.ts'
import { FloorPlan } from './floor-plan.tsx'

/**
 * Print / PDF. The page stays as it is on screen; while printing, only the
 * chosen sheet shows, in ink on white whatever the RSVP theme. "Save as PDF"
 * in the browser's print window makes the PDF.
 */
export function usePrintSheet() {
  const [sheet, setSheet] = useState<'' | 'seating' | 'timeline'>('')
  useEffect(() => {
    if (!sheet) return
    const done = () => setSheet('')
    window.addEventListener('afterprint', done)
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 50)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', done)
    }
  }, [sheet])
  return { sheet, print: setSheet }
}

const sheetStyle = {
  color: '#111111',
  background: '#ffffff',
  fontFamily: 'Georgia, "Times New Roman", serif',
} as const

export type PaperSize = 'letter' | 'a4'

/**
 * Each printed page is its own white sheet in the preview, with a gap
 * between, and starts a new page when printed, so what is seen is what
 * prints.
 */
const PAGE_CSS = `
  .sheet-page { background: #fff; color: #111; padding: 0.55in; margin: 0 auto 28px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.35); border-radius: 4px; }
  .sheet-page .screen-footer { text-align: center; font-size: 9px; color: #555; margin-top: 18px; }
  .print-footer { display: none; }
  @media print {
    .sheet-page { padding: 0; margin: 0; box-shadow: none; border-radius: 0; }
    .sheet-page + .sheet-page { break-before: page; page-break-before: always; }
    .sheet-page .screen-footer { display: none; }
    .print-footer { display: block; position: fixed; bottom: 0; left: 0; right: 0;
      text-align: center; font-size: 9px; color: #555; }
  }
`

const pageBreak = { breakBefore: 'page', pageBreakBefore: 'always' } as const

const PAPER = {
  // Kept a little under the landscape page's height so the plan, header and
  // caption always fit on page 1 and never spill onto a near-empty page.
  letter: { name: 'Letter', size: 'letter', planHeight: '5.9in' },
  a4: { name: 'A4', size: 'A4', planHeight: '148mm' },
} as const

/**
 * The printed seating chart, black on white whatever the screen theme:
 * page 1 is the floor plan on a landscape page; then every table's guests
 * with their meals; then "Find your seat", alphabetical, for an escort-card
 * display. Each page carries the couple and date; the footer says who it is by.
 */
export function PrintSeating({
  plan,
  guests,
  couple,
  dateLabel,
  paper = 'letter',
}: {
  plan: SeatingPlan
  guests: SeatableGuest[]
  couple: string
  dateLabel: string
  paper?: PaperSize
}) {
  const byId = new Map(guests.map((guest) => [guest.id, guest]))
  const tables = plan.tables.map((table) => ({
    table,
    seated: Object.entries(plan.seats)
      .filter(([, spot]) => spot.tableId === table.id)
      .sort((a, b) => a[1].seat - b[1].seat)
      .flatMap(([guestId, spot]) => {
        const guest = byId.get(guestId)
        return guest ? [{ seat: spot.seat, guest }] : []
      }),
  }))
  const unassigned = guests.filter((guest) => !plan.seats[guest.id])
  const escort = findYourSeat(plan, guests)
  const page = PAPER[paper]
  const header = (title: string) => (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        borderBottom: '2px solid #111',
        paddingBottom: 6,
        marginBottom: 12,
      }}
    >
      <h1 style={{ fontSize: 22, margin: 0 }}>{title}</h1>
      <p style={{ margin: 0, fontSize: 13 }}>
        <strong>{couple}</strong>
        {dateLabel ? ` · ${dateLabel}` : ''}
      </p>
    </header>
  )
  return (
    <div
      style={{ ...sheetStyle, background: 'transparent' }}
      className="seating-print"
    >
      <style>{`
        @page seating-plan { size: ${page.size} landscape; margin: 0.45in; }
        @page { size: ${page.size} portrait; margin: 0.55in 0.55in 0.75in; }
        @media print {
          html, body { background: #fff !important; }
          .seating-print .plan-page { page: seating-plan; break-inside: avoid; }
          .seating-print .plan-page svg { height: auto !important; max-height: ${page.planHeight} !important; width: 100% !important; }

        }
        ${PAGE_CSS}
      `}</style>
      <section className="plan-page sheet-page">
        {header('Seating chart')}
        <div style={{ border: '1px solid #bbb', borderRadius: 8, padding: 6 }}>
          <FloorPlan plan={plan} guests={byId} print />
        </div>
        <p style={{ fontSize: 10, color: '#555', margin: '6px 0 0' }}>
          Room {formatLength(plan.room.width, plan.room.unit, 'room')} ×{' '}
          {formatLength(plan.room.length, plan.room.unit, 'room')} ·{' '}
          {plan.tables.length} table{plan.tables.length === 1 ? '' : 's'} ·{' '}
          {guests.length - unassigned.length} of {guests.length} guests seated
        </p>
        <p className="screen-footer">Seating by DJ Piper P</p>
      </section>
      <section className="sheet-page" style={pageBreak}>
        {header('Tables')}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 18,
          }}
        >
          {tables.map(({ table, seated }) => (
            <div key={table.id} style={{ breakInside: 'avoid' }}>
              <h2
                style={{
                  fontSize: 17,
                  margin: '0 0 2px',
                  borderBottom: '1px solid #999',
                }}
              >
                {tableLabel(table.name)}
              </h2>
              <p style={{ fontSize: 10, color: '#555', margin: '0 0 6px' }}>
                {seated.length} / {table.seats} seated
              </p>
              <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                {seated.map(({ seat, guest }) => (
                  <li key={guest.id} style={{ fontSize: 12, lineHeight: 1.55 }}>
                    <span style={{ color: '#666' }}>{seat + 1}.</span>{' '}
                    {guest.name}
                    {guest.isChild ? ' (child)' : ''}
                    <span style={{ color: '#444', fontStyle: 'italic' }}>
                      {' '}
                      · {guest.meal || 'meal not chosen'}
                    </span>
                  </li>
                ))}
                {seated.length === 0 ? (
                  <li style={{ fontSize: 12, color: '#777' }}>No one yet</li>
                ) : null}
              </ol>
            </div>
          ))}
        </div>
        {unassigned.length > 0 ? (
          <div style={{ marginTop: 18, breakInside: 'avoid' }}>
            <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>
              Not seated yet ({unassigned.length})
            </h2>
            <p style={{ fontSize: 12, margin: 0 }}>
              {unassigned.map((guest) => guest.name).join(', ')}
            </p>
          </div>
        ) : null}
        <p className="screen-footer">Seating by DJ Piper P</p>
      </section>
      <section className="sheet-page" style={pageBreak}>
        {header('Find your seat')}
        {escort.length === 0 ? (
          <p style={{ fontSize: 12, color: '#777' }}>No one is seated yet.</p>
        ) : (
          <ol
            style={{
              columns: 3,
              columnGap: 24,
              margin: 0,
              padding: 0,
              listStyle: 'none',
            }}
          >
            {escort.map((row) => (
              <li
                key={`${row.name}-${row.table}-${row.seat}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 13,
                  lineHeight: 1.7,
                  borderBottom: '1px dotted #bbb',
                  breakInside: 'avoid',
                }}
              >
                <span>{row.name}</span>
                <strong>{row.table}</strong>
              </li>
            ))}
          </ol>
        )}
        <p className="screen-footer">Seating by DJ Piper P</p>
      </section>
      <footer className="print-footer">Seating by DJ Piper P</footer>
    </div>
  )
}

/**
 * "Print / PDF": a clean print layout opens over the page with a choice of
 * Letter or A4. Printing shows only this layout; "Save as PDF" in the
 * browser's print window makes the PDF.
 */
export function PrintDialog({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
  children: (paper: PaperSize) => ReactNode
}) {
  const [paper, setPaper] = useState<PaperSize>('letter')
  useEffect(() => {
    if (!open) return
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 overflow-auto bg-black/70 p-3 print:static print:inset-auto print:overflow-visible print:bg-white print:p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="mx-auto mb-3 flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface)] p-3 text-[var(--text)] print:hidden">
        <fieldset className="flex items-center gap-2 text-sm">
          <legend className="sr-only">Paper size</legend>
          {(['letter', 'a4'] as const).map((size) => (
            <label
              key={size}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 ${paper === size ? 'border-[var(--pink)]' : 'border-[var(--border-strong)]'}`}
            >
              <input
                type="radio"
                name="paper"
                checked={paper === size}
                onChange={() => setPaper(size)}
              />
              {PAPER[size].name}
            </label>
          ))}
        </fieldset>
        <div className="flex gap-2">
          <button
            type="button"
            className="min-h-11 rounded-full bg-[var(--pink)] px-5 font-semibold text-[var(--on-accent,#0D0D0D)]"
            onClick={() => window.print()}
          >
            Print / Save as PDF
          </button>
          <button
            type="button"
            className="min-h-11 rounded-full border border-[var(--border-strong)] px-4"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-5xl print:max-w-none">
        {children(paper)}
      </div>
    </div>
  )
}

export function SeatingPrintDialog({
  open,
  onClose,
  ...sheet
}: {
  open: boolean
  onClose: () => void
  plan: SeatingPlan
  guests: SeatableGuest[]
  couple: string
  dateLabel: string
}) {
  return (
    <PrintDialog open={open} onClose={onClose} label="Print seating chart">
      {(paper) => <PrintSeating {...sheet} paper={paper} />}
    </PrintDialog>
  )
}

/** A meal's letter in a ring, the way servers mark it on their sheet. */
function MealMark({ code }: { code: string }) {
  return (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 20,
        height: 20,
        border: '1.5px solid #111',
        borderRadius: code === 'K' ? 4 : 999,
        fontSize: 11,
        fontWeight: 800,
        fontFamily: 'Arial, Helvetica, sans-serif',
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      {code}
    </span>
  )
}

/**
 * The caterer's printout, black on white: page 1 is the summary (who, when,
 * where, the deadline, how many, meal totals with kids counted on their own,
 * and every dietary or allergy note); then table by table, each guest with a
 * meal letter so servers know who gets what.
 */
export function CatererPrint({
  sheet,
  paper = 'letter',
}: {
  sheet: CatererSheet
  paper?: PaperSize
}) {
  const page = PAPER[paper]
  const cell = { padding: '4px 8px', borderBottom: '1px solid #ccc' } as const
  const head = {
    ...cell,
    textAlign: 'left' as const,
    borderBottom: '2px solid #111',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  }
  const header = (title: string) => (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        borderBottom: '2px solid #111',
        paddingBottom: 6,
        marginBottom: 12,
      }}
    >
      <h1 style={{ fontSize: 22, margin: 0 }}>{title}</h1>
      <p style={{ margin: 0, fontSize: 13 }}>
        <strong>{sheet.couple}</strong>
        {sheet.dateLabel ? ` · ${sheet.dateLabel}` : ''}
      </p>
    </header>
  )
  return (
    <div
      style={{ ...sheetStyle, background: 'transparent' }}
      className="caterer-print"
    >
      <style>{`
        @page { size: ${page.size} portrait; margin: 0.55in 0.55in 0.75in; }
        @media print {
          html, body { background: #fff !important; }
        }
        ${PAGE_CSS}
      `}</style>
      <section className="sheet-page">
        {header('Caterer report')}
        <table
          style={{ fontSize: 13, borderCollapse: 'collapse', marginBottom: 14 }}
        >
          <tbody>
            {[
              ['Couple', sheet.couple],
              ['Date', sheet.dateLabel],
              [
                'Venue',
                [sheet.venue, sheet.address].filter(Boolean).join(', '),
              ],
              ['RSVP deadline', sheet.deadline],
            ].map(([label, value]) => (
              <tr key={label}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '2px 16px 2px 0',
                    fontWeight: 600,
                  }}
                >
                  {label}
                </th>
                <td style={{ padding: '2px 0' }}>{value || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 20, margin: '0 0 12px' }}>
          <strong>{sheet.attending} attending</strong>
          <span style={{ fontSize: 14, color: '#333' }}>
            {' '}
            · {sheet.adults} adults · {sheet.kids} kids
          </span>
        </p>
        <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Meals</h2>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
        >
          <thead>
            <tr>
              <th style={{ ...head, width: 34 }} />
              <th style={head}>Meal</th>
              <th style={{ ...head, textAlign: 'right' }}>Adults</th>
              <th style={{ ...head, textAlign: 'right' }}>Kids</th>
              <th style={{ ...head, textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sheet.meals.map((meal) => (
              <tr key={meal.code + meal.meal}>
                <td style={cell}>
                  <MealMark code={meal.code} />
                </td>
                <td style={cell}>{meal.meal}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{meal.adults}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{meal.kids}</td>
                <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>
                  {meal.total}
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ ...cell, borderBottom: 0 }} />
              <td style={{ ...cell, borderBottom: 0, fontWeight: 700 }}>
                Total
              </td>
              <td
                style={{
                  ...cell,
                  borderBottom: 0,
                  textAlign: 'right',
                  fontWeight: 700,
                }}
              >
                {sheet.meals.reduce((sum, meal) => sum + meal.adults, 0)}
              </td>
              <td
                style={{
                  ...cell,
                  borderBottom: 0,
                  textAlign: 'right',
                  fontWeight: 700,
                }}
              >
                {sheet.meals.reduce((sum, meal) => sum + meal.kids, 0)}
              </td>
              <td
                style={{
                  ...cell,
                  borderBottom: 0,
                  textAlign: 'right',
                  fontWeight: 700,
                }}
              >
                {sheet.attending}
              </td>
            </tr>
          </tbody>
        </table>
        <h2 style={{ fontSize: 15, margin: '18px 0 4px' }}>
          Dietary needs and allergies ({sheet.dietary.length})
        </h2>
        {sheet.dietary.length === 0 ? (
          <p style={{ fontSize: 13, color: '#555', margin: 0 }}>
            No guest has added a dietary or allergy note.
          </p>
        ) : (
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}
          >
            <thead>
              <tr>
                <th style={head}>Guest</th>
                <th style={head}>Table</th>
                <th style={head}>Meal</th>
                <th style={head}>Dietary / allergy</th>
              </tr>
            </thead>
            <tbody>
              {sheet.dietary.map((guest) => (
                <tr key={guest.id} style={{ breakInside: 'avoid' }}>
                  <td style={cell}>
                    {guest.name}
                    {guest.child ? ' (child)' : ''}
                  </td>
                  <td style={cell}>{guest.table || 'Not seated'}</td>
                  <td style={cell}>
                    <MealMark code={guest.code} />{' '}
                    {guest.meal || (guest.child ? "Kids' meal" : 'Not chosen')}
                  </td>
                  <td style={{ ...cell, fontWeight: 700 }}>{guest.dietary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="screen-footer">Prepared by DJ Piper P · page 1</p>
      </section>
      <section className="sheet-page" style={pageBreak}>
        {header('Table by table')}
        <p style={{ fontSize: 11, color: '#444', margin: '0 0 10px' }}>
          {sheet.meals.map((meal) => `${meal.code} = ${meal.meal}`).join(' · ')}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 18,
          }}
        >
          {[
            ...sheet.tables,
            ...(sheet.unseated.length > 0
              ? [{ table: 'Not seated yet', guests: sheet.unseated }]
              : []),
          ].map((group) => (
            <div key={group.table} style={{ breakInside: 'avoid' }}>
              <h2
                style={{
                  fontSize: 16,
                  margin: '0 0 4px',
                  borderBottom: '1px solid #999',
                }}
              >
                {group.table}{' '}
                <span style={{ fontSize: 11, fontWeight: 400, color: '#555' }}>
                  · {group.guests.length} guests
                </span>
              </h2>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 12,
                }}
              >
                <tbody>
                  {group.guests.map((guest) => (
                    <tr key={guest.id}>
                      <td style={{ padding: '3px 6px 3px 0', width: 24 }}>
                        <MealMark code={guest.code} />
                      </td>
                      <td style={{ padding: '3px 6px 3px 0' }}>
                        {guest.name}
                        {guest.child ? ' (child)' : ''}
                      </td>
                      <td style={{ padding: '3px 6px 3px 0', color: '#333' }}>
                        {guest.meal || (guest.child ? "Kids' meal" : '—')}
                      </td>
                      <td style={{ padding: '3px 0', fontWeight: 700 }}>
                        {guest.dietary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <p className="screen-footer">Prepared by DJ Piper P</p>
      </section>
      <footer className="print-footer">Prepared by DJ Piper P</footer>
    </div>
  )
}

export function CatererPrintDialog({
  open,
  onClose,
  sheet,
}: {
  open: boolean
  onClose: () => void
  sheet: CatererSheet
}) {
  return (
    <PrintDialog open={open} onClose={onClose} label="Print caterer report">
      {(paper) => <CatererPrint sheet={sheet} paper={paper} />}
    </PrintDialog>
  )
}

export function PrintTimeline({
  timeline,
  venue,
  couple,
  dateLabel,
}: {
  timeline: Timeline
  venue: string
  couple: string
  dateLabel: string
}) {
  const moments = orderedMoments(timeline)
  return (
    <section style={sheetStyle} className="print-sheet p-6">
      <h1 style={{ fontSize: 26, margin: 0 }}>The day</h1>
      <p style={{ margin: '4px 0 16px', color: '#444' }}>
        {couple}
        {dateLabel ? ` · ${dateLabel}` : ''} · for the couple and DJ Piper P
        {venue ? (
          <>
            <br />
            Everything is at {venue} unless a place is given.
          </>
        ) : null}
      </p>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
      >
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #222' }}>
            <th style={{ padding: '6px 8px 6px 0', width: 90 }}>Time</th>
            <th style={{ padding: '6px 8px' }}>Moment</th>
            <th style={{ padding: '6px 8px' }}>Place</th>
            <th style={{ padding: '6px 8px' }}>Note</th>
            <th style={{ padding: '6px 0 6px 8px', width: 70 }}>Guests</th>
          </tr>
        </thead>
        <tbody>
          {moments.map((moment) => (
            <tr
              key={moment.id}
              style={{ borderBottom: '1px solid #ddd', breakInside: 'avoid' }}
            >
              <td style={{ padding: '6px 8px 6px 0', fontWeight: 700 }}>
                {timeLabel(moment.time)}
              </td>
              <td style={{ padding: '6px 8px' }}>{moment.title}</td>
              <td style={{ padding: '6px 8px' }}>
                {moment.location && moment.location !== venue
                  ? moment.location
                  : ''}
              </td>
              <td style={{ padding: '6px 8px', color: '#444' }}>
                {moment.note}
              </td>
              <td style={{ padding: '6px 0 6px 8px' }}>
                {moment.guests ? 'Shown' : 'Private'}
              </td>
            </tr>
          ))}
          {moments.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: '8px 0', color: '#777' }}>
                No moments yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  )
}
