/**
 * The couple's run of the wedding day. Each moment has a time and a title; a
 * place and a short note are optional. Moments marked private are for the
 * couple and DJ Piper P only and never reach a guest page.
 */

import { toCsv } from './model.ts'

export type Moment = {
  id: string
  /** 24-hour "HH:MM", as the time picker gives it. */
  time: string
  title: string
  /** Blank means the wedding venue. */
  location: string
  note: string
  /** Shown on the guest pages. Private moments stay with the couple and DJ. */
  guests: boolean
}

export type Timeline = {
  moments: Moment[]
  /** The couple dragged moments into their own order; skip sorting by time. */
  manualOrder: boolean
}

export const MAX_MOMENTS = 40
export const TITLE_MAX = 80
export const LOCATION_MAX = 120
export const NOTE_MAX = 200

/** Times before 6 AM belong to the end of the night, after the evening. */
const NIGHT_ENDS = 6 * 60

export function emptyTimeline(): Timeline {
  return { moments: [], manualOrder: false }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Reads "16:00", "4:00 PM", "4pm" or "4:30 p.m." as "16:00". Empty when the
 * text is not a time.
 */
export function cleanTime(raw: string): string {
  const text = raw.trim().toLowerCase().replace(/\./g, '')
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!match) return ''
  let hour = Number(match[1])
  const minute = Number(match[2] ?? '0')
  const half = match[3]
  if (minute > 59) return ''
  if (half) {
    if (hour < 1 || hour > 12) return ''
    if (half === 'am') hour = hour === 12 ? 0 : hour
    else hour = hour === 12 ? 12 : hour + 12
  } else if (hour > 23) {
    return ''
  } else if (!match[2]) {
    return ''
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** "16:00" → "4:00 PM". */
export function timeLabel(time: string): string {
  const clean = cleanTime(time)
  if (!clean) return time
  const [hour = 0, minute = 0] = clean.split(':').map(Number)
  const half = hour < 12 ? 'AM' : 'PM'
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${twelve}:${String(minute).padStart(2, '0')} ${half}`
}

/** Minutes into the wedding day, with after-midnight moments last. */
export function dayMinutes(time: string): number {
  const clean = cleanTime(time)
  if (!clean) return Number.MAX_SAFE_INTEGER
  const [hour = 0, minute = 0] = clean.split(':').map(Number)
  const minutes = hour * 60 + minute
  return minutes < NIGHT_ENDS ? minutes + 24 * 60 : minutes
}

/** Sorted by time of day, keeping the couple's order for equal times. */
export function sortMoments(moments: Moment[]): Moment[] {
  return moments
    .map((moment, index) => ({ moment, index }))
    .sort(
      (a, b) =>
        dayMinutes(a.moment.time) - dayMinutes(b.moment.time) ||
        a.index - b.index,
    )
    .map(({ moment }) => moment)
}

/** The order the day is shown in: by time unless the couple set their own. */
export function orderedMoments(timeline: Timeline): Moment[] {
  return timeline.manualOrder
    ? timeline.moments.slice()
    : sortMoments(timeline.moments)
}

export function parseTimeline(raw: unknown): Timeline {
  const record = asRecord(raw)
  if (!record) return emptyTimeline()
  const moments: Moment[] = []
  const ids = new Set<string>()
  if (Array.isArray(record.moments)) {
    for (const item of record.moments) {
      const moment = asRecord(item)
      if (!moment) continue
      const id = asText(moment.id, 40)
      if (!id || ids.has(id)) continue
      ids.add(id)
      moments.push({
        id,
        time: cleanTime(asText(moment.time, 20)),
        title: asText(moment.title, TITLE_MAX),
        location: asText(moment.location, LOCATION_MAX),
        note: asText(moment.note, NOTE_MAX),
        guests: moment.guests !== false,
      })
      if (moments.length >= MAX_MOMENTS) break
    }
  }
  return { moments, manualOrder: record.manualOrder === true }
}

/** Every moment needs a time and a title before the day can be saved. */
export function validateTimeline(
  timeline: Timeline,
): { ok: true; timeline: Timeline } | { ok: false; error: string } {
  if (timeline.moments.length > MAX_MOMENTS) {
    return { ok: false, error: `Up to ${MAX_MOMENTS} moments fit in one day.` }
  }
  for (const [index, moment] of timeline.moments.entries()) {
    const which = moment.title ? `"${moment.title}"` : `Moment ${index + 1}`
    if (!cleanTime(moment.time)) {
      return { ok: false, error: `${which} needs a time.` }
    }
    if (!moment.title.trim()) {
      return {
        ok: false,
        error: `The moment at ${timeLabel(moment.time)} needs a title.`,
      }
    }
  }
  return {
    ok: true,
    timeline: {
      manualOrder: timeline.manualOrder,
      moments: orderedMoments(timeline),
    },
  }
}

export type GuestMoment = {
  id: string
  time: string
  title: string
  location: string
  note: string
}

/** What a guest sees: shown moments only, places filled in with the venue. */
export function guestMoments(timeline: Timeline, venue: string): GuestMoment[] {
  return orderedMoments(timeline)
    .filter((moment) => moment.guests && moment.title && cleanTime(moment.time))
    .map((moment) => ({
      id: moment.id,
      time: timeLabel(moment.time),
      title: moment.title,
      location: moment.location || venue,
      note: moment.note,
    }))
}

/** A typical day the couple can start from and edit. Nothing is saved yet. */
export function sampleDay(makeId: () => string): Moment[] {
  const day: [string, string, boolean, string][] = [
    ['15:30', 'Guests arrive', true, 'Find your seat for the ceremony.'],
    ['16:00', 'Ceremony', true, ''],
    ['16:30', 'Photos with family', false, ''],
    ['16:45', 'Cocktail hour', true, ''],
    ['18:00', 'Grand entrance', true, ''],
    ['18:15', 'Dinner', true, ''],
    ['18:30', 'Vendor meals', false, ''],
    ['19:30', 'First dance', true, ''],
    ['19:40', 'Speeches', true, ''],
    ['20:15', 'Cake cutting', true, ''],
    ['20:30', 'Open dancing', true, ''],
    ['00:45', 'Last song', true, ''],
  ]
  return day.map(([time, title, guests, note]) => ({
    id: makeId(),
    time,
    title,
    location: '',
    note,
    guests,
  }))
}

/** Time, Moment, Location, Note, Shown to guests — private moments included. */
export function timelineCsv(timeline: Timeline, venue: string): string {
  const rows = [['Time', 'Moment', 'Location', 'Note', 'Shown to guests']]
  for (const moment of orderedMoments(timeline)) {
    rows.push([
      timeLabel(moment.time),
      moment.title,
      moment.location || venue,
      moment.note,
      moment.guests ? 'yes' : 'no (private)',
    ])
  }
  return toCsv(rows)
}
