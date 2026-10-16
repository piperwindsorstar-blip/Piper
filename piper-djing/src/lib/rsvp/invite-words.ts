/**
 * The words on the invitation: the couple's wording choices, the date and
 * time written out the way a printed invitation sets them, and the monogram.
 * Pure, so the card, the studio, the emails and the tests all agree.
 */

export type InviteWording = {
  /** The line above the names: who is hosting. Empty leaves it off. */
  host: string
  /** The line under the names. */
  request: string
  /** The line after the place, about the party. Empty leaves it off. */
  after: string
  /** A short personal message from the couple. Empty leaves it off. */
  note: string
  /** The couple's own extra lines: dress code, adults only, parking… */
  boxes: TextBox[]
}

/** One custom text box on the card: its words, how big, and where it sits. */
export type TextBox = {
  id: string
  text: string
  size: 'large' | 'normal' | 'small'
  place: 'top' | 'details' | 'bottom'
}

export const BOX_MAX = 4
export const BOX_TEXT_MAX = 200

export const BOX_PLACES: { value: TextBox['place']; label: string }[] = [
  { value: 'top', label: 'Above your names' },
  { value: 'details', label: 'Under the details' },
  { value: 'bottom', label: 'At the bottom' },
]

export const BOX_SIZES: { value: TextBox['size']; label: string }[] = [
  { value: 'large', label: 'Large' },
  { value: 'normal', label: 'Normal' },
  { value: 'small', label: 'Small print' },
]

function parseBoxes(raw: unknown): TextBox[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const boxes: TextBox[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const text =
      typeof record.text === 'string'
        ? record.text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, BOX_TEXT_MAX)
        : ''
    let id = typeof record.id === 'string' ? record.id.replace(/[^a-z0-9-]/gi, '').slice(0, 24) : ''
    if (!id || seen.has(id)) id = `box-${boxes.length + 1}-${seen.size}`
    seen.add(id)
    const size = record.size === 'large' || record.size === 'small' ? record.size : 'normal'
    const place = record.place === 'top' || record.place === 'bottom' ? record.place : 'details'
    boxes.push({ id, text, size, place })
    if (boxes.length >= BOX_MAX) break
  }
  return boxes
}

/** The boxes with words in them, for one spot on the card. */
export function boxesAt(wording: Pick<InviteWording, 'boxes'>, place: TextBox['place']): TextBox[] {
  return (wording.boxes ?? []).filter((box) => box.place === place && box.text.trim() !== '')
}

export const HOST_CHOICES = [
  'Together with their families',
  'Together with their parents',
  'With joyful hearts',
  'Please join us',
]

export const REQUEST_CHOICES = [
  'request the pleasure of your company at their wedding',
  'invite you to celebrate their wedding',
  'are getting married',
  'would love you to be there as they say I do',
]

export const AFTER_CHOICES = [
  'Dinner and dancing to follow',
  'Reception to follow',
  'Cocktails, dinner and dancing to follow',
  'Dancing until late',
]

export const DEFAULT_WORDING: InviteWording = {
  host: HOST_CHOICES[0],
  request: REQUEST_CHOICES[0],
  after: AFTER_CHOICES[0],
  note: '',
  boxes: [],
}

export const NOTE_MAX = 240
export const LINE_MAX = 90

function line(value: unknown, fallback: string, max = LINE_MAX): string {
  if (typeof value !== 'string') return fallback
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

/**
 * Reads stored wording. A missing record gets the classic wording; a line the
 * couple cleared on purpose stays empty (except the request line, which the
 * card always needs).
 */
export function parseWording(raw: unknown): InviteWording {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_WORDING, boxes: [] }
  }
  const record = raw as Record<string, unknown>
  const request = line(record.request, DEFAULT_WORDING.request)
  return {
    host: line(record.host, DEFAULT_WORDING.host),
    request: request || DEFAULT_WORDING.request,
    after: line(record.after, DEFAULT_WORDING.after),
    note:
      typeof record.note === 'string'
        ? record.note.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, NOTE_MAX)
        : '',
    boxes: parseBoxes(record.boxes),
  }
}

/** "S & M": the first letter of each first name, in capitals. */
export function monogramLetters(partnerOne: string, partnerTwo: string): [string, string] {
  const first = (name: string) => {
    const letter = Array.from(name.trim())[0] ?? ''
    return letter.toLocaleUpperCase('en-CA')
  }
  return [first(partnerOne), first(partnerTwo)]
}

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const ORDINAL_ONES = [
  '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth',
  'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth',
  'seventeenth', 'eighteenth', 'nineteenth',
]
const ORDINAL_TENS: Record<number, string> = { 20: 'twentieth', 30: 'thirtieth' }
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function numberWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 9999) return String(value)
  if (value < 20) return ONES[value]
  if (value < 100) {
    const tens = TENS[Math.floor(value / 10)]
    const rest = value % 10
    return rest ? `${tens}-${ONES[rest]}` : tens
  }
  if (value < 1000) {
    const hundreds = `${ONES[Math.floor(value / 100)]} hundred`
    const rest = value % 100
    return rest ? `${hundreds} ${numberWords(rest)}` : hundreds
  }
  const thousands = `${ONES[Math.floor(value / 1000)]} thousand`
  const rest = value % 1000
  return rest ? `${thousands} ${numberWords(rest)}` : thousands
}

export function ordinalWords(day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 31) return String(day)
  if (day < 20) return ORDINAL_ONES[day]
  if (ORDINAL_TENS[day]) return ORDINAL_TENS[day]
  return `${TENS[Math.floor(day / 10)]}-${ORDINAL_ONES[day % 10]}`
}

export type InviteDate = {
  /** "Saturday" */
  weekday: string
  /** "June 12, 2027" */
  plain: string
  /** "Saturday, June 12, 2027" */
  full: string
  /** "06 · 12 · 2027" */
  numeric: string
  /** "JUN", "12", "2027" for the modern block date */
  parts: { month: string; day: string; year: string; weekdayShort: string }
}

export function inviteDate(iso: string): InviteDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  const weekday = WEEKDAYS[date.getUTCDay()]
  const monthName = MONTHS[month - 1]
  return {
    weekday,
    plain: `${monthName} ${day}, ${year}`,
    full: `${weekday}, ${monthName} ${day}, ${year}`,
    numeric: `${match[2]} · ${match[3]} · ${match[1]}`,
    parts: {
      month: monthName.slice(0, 3).toUpperCase(),
      day: String(day),
      year: String(year),
      weekdayShort: weekday.slice(0, 3).toUpperCase(),
    },
  }
}

/**
 * "4:00 PM" → "four o'clock in the afternoon"; "4:30 PM" → "half past four in
 * the afternoon"; "5:15 PM" → "quarter past five in the evening". A time it
 * cannot read comes back as written.
 */
export function timeWords(value: string): string {
  const raw = value.trim()
  const match = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?$/i.exec(raw)
  if (!match) return raw
  let hour = Number(match[1])
  const minute = Number(match[2] ?? '0')
  const pm = match[3].toLowerCase() === 'p'
  if (hour < 1 || hour > 12 || minute > 59) return raw
  const hour24 = (hour % 12) + (pm ? 12 : 0)
  const part =
    hour24 < 12 ? 'in the morning' : hour24 < 17 ? 'in the afternoon' : 'in the evening'
  if (hour24 === 12 && minute === 0) return 'twelve noon'
  const name = (h: number) => numberWords(h)
  if (minute === 0) return `${name(hour)} o'clock ${part}`
  if (minute === 30) return `half past ${name(hour)} ${part}`
  if (minute === 15) return `quarter past ${name(hour)} ${part}`
  if (minute === 45) {
    hour = hour === 12 ? 1 : hour + 1
    return `quarter to ${name(hour)} ${part}`
  }
  return `${numberWords(minute)} minutes past ${name(hour)} ${part}`
}

/** "4:00 PM" → "4 pm", "4:30 PM" → "4:30 pm", for the modern styles. */
export function shortTime(value: string): string {
  const raw = value.trim()
  const match = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?$/i.exec(raw)
  if (!match) return raw
  const minutes = match[2] && match[2] !== '00' ? `:${match[2]}` : ''
  return `${Number(match[1])}${minutes} ${match[3].toLowerCase()}m`
}
