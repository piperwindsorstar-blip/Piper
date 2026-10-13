import { useEffect, useState } from 'react'
import { tableLabel } from '../../lib/rsvp/seating.ts'
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

export function PrintSeating({
  plan,
  guests,
  couple,
  dateLabel,
}: {
  plan: SeatingPlan
  guests: SeatableGuest[]
  couple: string
  dateLabel: string
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
  return (
    <section style={sheetStyle} className="print-sheet p-6">
      <h1 style={{ fontSize: 26, margin: 0 }}>Seating chart</h1>
      <p style={{ margin: '4px 0 16px', color: '#444' }}>
        {couple}
        {dateLabel ? ` · ${dateLabel}` : ''}
      </p>
      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: 12,
          padding: 8,
          breakInside: 'avoid',
        }}
      >
        <FloorPlan plan={plan} guests={byId} print />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
          marginTop: 20,
          breakBefore: 'page',
        }}
      >
        {tables.map(({ table, seated }) => (
          <div key={table.id} style={{ breakInside: 'avoid' }}>
            <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>
              {tableLabel(table.name)}
            </h2>
            <p style={{ fontSize: 11, color: '#555', margin: '0 0 6px' }}>
              {seated.length} / {table.seats} seated
            </p>
            <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
              {seated.map(({ seat, guest }) => (
                <li key={guest.id} style={{ fontSize: 12, lineHeight: 1.5 }}>
                  {seat + 1}. {guest.name}
                  {guest.isChild ? ' (child)' : ''}
                  {guest.meal ? (
                    <span style={{ color: '#555' }}> · {guest.meal}</span>
                  ) : null}
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
        <div style={{ marginTop: 20, breakInside: 'avoid' }}>
          <h2 style={{ fontSize: 16, margin: '0 0 6px' }}>
            Not seated yet ({unassigned.length})
          </h2>
          <p style={{ fontSize: 12, margin: 0 }}>
            {unassigned.map((guest) => guest.name).join(', ')}
          </p>
        </div>
      ) : null}
    </section>
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
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #222' }}>
            <th style={{ padding: '6px 8px 6px 0', width: 90 }}>Time</th>
            <th style={{ padding: '6px 8px' }}>Moment</th>
            <th style={{ padding: '6px 8px' }}>Location</th>
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
                {moment.location || venue}
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
