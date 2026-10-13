/** Pure RSVP rules. Guest links are /rsvp/:slug. Paid Piper couples are $20; everyone else is $30. */

import { DEFAULT_TEMPLATE, parsePhoto, parseTemplateId } from './templates.ts'
import type { RsvpPhoto, RsvpTemplateId } from './templates.ts'

export const PIPER_RSVP_CENTS = 2000
export const STANDALONE_RSVP_CENTS = 3000
export const LOOKUP_LIMIT = 8
export const LOOKUP_WINDOW_MS = 10 * 60 * 1000

const RESERVED_SLUGS = new Set(['sign-in', 'manage', 'open', 'start', 'rsvp'])

export type RsvpStatus = 'pending' | 'attending' | 'declined'
export type AccessMode = 'code' | 'checkin' | 'public'
export type PriceKind = 'piper' | 'standalone'
export type SongStatus = 'queued' | 'must' | 'no'
export type QuestionType = 'yesno' | 'choice' | 'pills' | 'song' | 'text'
export type QuestionAudience =
  'everyone' | 'attending' | 'adults' | 'out-of-town'

export type RsvpGuest = {
  id: string
  firstName: string
  lastName: string
  altNames: string[]
  isChild: boolean
  isPlusOne: boolean
  /** The couple allows this guest to bring one plus-one. */
  plusOneAllowed: boolean
  /** Guest id this plus-one belongs to. Empty for everyone else. */
  plusOneOf: string
  replies: Record<string, RsvpStatus>
  meal: string
  dietary: string[]
  dietaryNote: string
  songTitle: string
  songArtist: string
}

export type RsvpParty = {
  id: string
  name: string
  email: string
  note: string
  token: string
  lastRepliedAt: string
  phoneReply: boolean
  plusOneAllowed: boolean
  eventIds: string[]
  guests: RsvpGuest[]
}

export type RsvpEvent = {
  id: string
  name: string
  dateLabel: string
  time: string
  location: string
  note: string
  enabled: boolean
  asksMeal: boolean
  hidden: boolean
}

export type ScheduleItem = {
  name: string
  time: string
  place: string
  note: string
}

export type RsvpQuestion = {
  id: string
  eventId: string
  label: string
  type: QuestionType
  audience: QuestionAudience
  required: boolean
  options: string[]
}

export type RsvpWedding = {
  slug: string
  partnerOne: string
  partnerTwo: string
  email: string
  eventDate: string
  venue: string
  address: string
  deadline: string
  catererDeadline: string
  accessMode: AccessMode
  inviteCode: string
  showContact: boolean
  contactPhone: string
  lockAfterDeadline: boolean
  autoRemind: boolean
  priceCents: number
  priceKind: PriceKind
  paid: boolean
  /** The couple's chosen RSVP theme. Guests see the same one. */
  theme: 'dark' | 'light'
  /** The invitation template the couple picked. Classic Ivory by default. */
  template: RsvpTemplateId
  /** The couple's photo, or null when the template runs without one. */
  photo: RsvpPhoto | null
  bookingSlug: string
  /** Where a confirmed guest reply is emailed. The sign-in address stays on `email`. */
  replyEmail: string
  sample: boolean
  notes: string[]
  schedule: ScheduleItem[]
  events: RsvpEvent[]
  parties: RsvpParty[]
  questions: RsvpQuestion[]
  songStatus: Record<string, SongStatus>
  signInToken: string
  signInExpires: string
  /** Date the last automatic reminder run covered this wedding. */
  remindedOn: string
  /** Party ids that already had the automatic 7-day reminder. */
  remindedIds: string[]
  /** ISO time of the last manual "email parties still waiting" send. */
  remindedManualAt: string
  /** Date the deadline summary went to the couple. */
  deadlineSummaryOn: string
}

export type PaidCouple = {
  email: string
  sample: boolean
  status: string
  receivedCents: number
}

export type CoupleBooking = {
  partnerOne: string
  partnerTwo: string
  eventDate: string
  email: string
  sample: boolean
}

/** Address that hears about a confirmed reply. Never the sign-in address. */
export function coupleReplyAddress(
  wedding: Pick<
    RsvpWedding,
    'partnerOne' | 'partnerTwo' | 'eventDate' | 'replyEmail'
  >,
  bookings: CoupleBooking[],
): string {
  const written = wedding.replyEmail.trim()
  if (written.includes('@')) return written.slice(0, 120)
  const one = foldName(wedding.partnerOne)
  const two = foldName(wedding.partnerTwo)
  if (!one || !two) return ''
  for (const booking of bookings) {
    if (booking.sample) continue
    if (booking.eventDate !== wedding.eventDate) continue
    if (!booking.email.includes('@')) continue
    const left = foldName(booking.partnerOne)
    const right = foldName(booking.partnerTwo)
    const same = left === one && right === two
    const swapped = left === two && right === one
    if (same || swapped) return booking.email.trim().slice(0, 120)
  }
  return ''
}

export type PriceQuote = {
  cents: number
  kind: PriceKind
}

export function quoteRsvp(email: string, bookings: PaidCouple[]): PriceQuote {
  const needle = email.trim().toLowerCase()
  const matched =
    needle.includes('@') &&
    bookings.some(
      (booking) =>
        !booking.sample &&
        booking.email.trim().toLowerCase() === needle &&
        (booking.status === 'booked' || booking.status === 'hold') &&
        booking.receivedCents > 0,
    )
  if (matched) return { cents: PIPER_RSVP_CENTS, kind: 'piper' }
  return { cents: STANDALONE_RSVP_CENTS, kind: 'standalone' }
}

export function priceLabel(cents: number): string {
  if (cents % 100 === 0) return `$${cents / 100}`
  return `$${(cents / 100).toFixed(2)}`
}

export function rsvpPath(slug: string): string {
  return `/rsvp/${slug}`
}

export function coupleTitle(wedding: {
  partnerOne: string
  partnerTwo: string
}): string {
  const one = wedding.partnerOne.trim()
  const two = wedding.partnerTwo.trim()
  if (one && two) return `${one} & ${two}`
  return one || two || 'Your wedding'
}

export function foldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function coupleSlug(partnerOne: string, partnerTwo: string): string {
  const base = foldName(`${partnerOne} and ${partnerTwo}`)
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  if (!base || RESERVED_SLUGS.has(base)) return 'wedding'
  return base
}

export function codesMatch(given: string, expected: string): boolean {
  const left = foldName(given).replace(/ /g, '')
  const right = foldName(expected).replace(/ /g, '')
  if (!left || left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

export function noteLookup(
  stamps: number[],
  now: number,
): { ok: boolean; stamps: number[] } {
  const recent = stamps.filter((stamp) => now - stamp < LOOKUP_WINDOW_MS)
  if (recent.length >= LOOKUP_LIMIT) return { ok: false, stamps: recent }
  return { ok: true, stamps: [...recent, now] }
}

export type LookupResult =
  { ok: true; party: RsvpParty } | { ok: false; reason: 'short' | 'none' }

export function findParty(
  wedding: RsvpWedding,
  first: string,
  last: string,
): LookupResult {
  const foldedFirst = foldName(first)
  const foldedLast = foldName(last)
  if (foldedFirst.length < 2 || foldedLast.length < 2) {
    return { ok: false, reason: 'short' }
  }
  const hits = wedding.parties.filter((party) =>
    party.guests.some((guest) => guestMatches(guest, foldedFirst, foldedLast)),
  )
  if (hits.length !== 1) return { ok: false, reason: 'none' }
  return { ok: true, party: hits[0] }
}

function guestMatches(guest: RsvpGuest, first: string, last: string): boolean {
  const full = `${first} ${last}`
  if (guest.altNames.some((alt) => foldName(alt) === full)) return true
  const firstNames = [
    foldName(guest.firstName),
    ...guest.altNames.map(foldName),
  ]
  const lastNames = [foldName(guest.lastName), ...guest.altNames.map(foldName)]
  return firstNames.includes(first) && lastNames.includes(last)
}

export function partyByToken(
  wedding: RsvpWedding,
  token: string,
): RsvpParty | null {
  const clean = token.trim()
  if (!clean) return null
  return wedding.parties.find((party) => party.token === clean) ?? null
}

export function partyLine(party: RsvpParty): string {
  const named = party.guests.filter((guest) => !guest.isPlusOne)
  const plus = party.guests.filter((guest) => guest.isPlusOne).length
  const names = named
    .map((guest) => `${guest.firstName} ${guest.lastName}`.trim())
    .filter((name) => name.length > 0)
  const extra =
    plus === 0 ? '' : plus === 1 ? ' + 1 guest' : ` + ${plus} guests`
  return `${names.join(', ')}${extra}`
}

export function replyFor(guest: RsvpGuest, eventId: string): RsvpStatus {
  if (!Object.hasOwn(guest.replies, eventId)) return 'pending'
  const value = guest.replies[eventId]
  if (value === 'attending' || value === 'declined') return value
  return 'pending'
}

export function invitedEvents(
  wedding: RsvpWedding,
  party: RsvpParty,
): RsvpEvent[] {
  return wedding.events.filter(
    (event) => event.enabled && party.eventIds.includes(event.id),
  )
}

export function mealOptions(wedding: RsvpWedding): string[] {
  const question = wedding.questions.find((item) => item.type === 'choice')
  return question ? question.options : []
}

export function dietaryOptions(wedding: RsvpWedding): string[] {
  const question = wedding.questions.find((item) => item.type === 'pills')
  return question ? question.options : []
}

export function asksSong(wedding: RsvpWedding): boolean {
  return wedding.questions.some((item) => item.type === 'song')
}

export function repliesLocked(wedding: RsvpWedding, today: string): boolean {
  if (!wedding.lockAfterDeadline) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(wedding.deadline)) return false
  return today > wedding.deadline
}

export function shiftDate(iso: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [year, month, day] = iso.split('-').map((part) => Number(part))
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysUntil(iso: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return null
  }
  const start = Date.parse(`${today}T00:00:00Z`)
  const end = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.round((end - start) / 86_400_000)
}

export function longWeddingDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [year, month, day] = iso.split('-').map((part) => Number(part))
  if (!year || !month || !day) return ''
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function shortMonthDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [year, month, day] = iso.split('-').map((part) => Number(part))
  if (!year || !month || !day) return ''
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function greeting(name: string, hour: number): string {
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const who = name.trim() || 'there'
  return `Good ${part}, ${who}`
}

export function splitSong(line: string): { title: string; artist: string } {
  const parts = line.trim().split(/\s+[–—-]\s+/)
  const title = (parts[0] ?? '').trim().slice(0, 120)
  const artist = parts.slice(1).join(' - ').trim().slice(0, 120)
  return { title, artist }
}

export function songKey(title: string, artist: string): string {
  return `${foldName(title)}|${foldName(artist)}`
}

function splitPerson(full: string): { first: string; last: string } {
  const parts = full
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
  return {
    first: (parts[0] ?? '').slice(0, 40),
    last: parts.slice(1).join(' ').slice(0, 40),
  }
}

export function emptyGuest(
  id: string,
  firstName: string,
  lastName: string,
  isPlusOne: boolean,
): RsvpGuest {
  return {
    id,
    firstName,
    lastName,
    altNames: [],
    isChild: false,
    isPlusOne,
    plusOneAllowed: false,
    plusOneOf: '',
    replies: {},
    meal: '',
    dietary: [],
    dietaryNote: '',
    songTitle: '',
    songArtist: '',
  }
}

export type HouseholdGuestPatch = {
  id: string
  replies: Record<string, RsvpStatus>
  meal: string
  dietary: string[]
  dietaryNote: string
  song: string
  plusOneName: string
}

export type PlusOneDraft = {
  id: string
  hostId: string
  name: string
  meal: string
  dietaryNote: string
}

export type HouseholdPatch = {
  email: string
  note: string
  final: boolean
  today: string
  now: string
  guests: HouseholdGuestPatch[]
  removePlusOneIds: string[]
  addPlusOne: { id: string; name: string } | null
  plusOnes?: PlusOneDraft[] | null
}

function hostMayBring(party: RsvpParty, hostId: string): boolean {
  const host = party.guests.find(
    (guest) => guest.id === hostId && !guest.isPlusOne,
  )
  if (!host) return false
  if (host.plusOneAllowed) return true
  if (!party.plusOneAllowed) return false
  if (party.guests.some((guest) => !guest.isPlusOne && guest.plusOneAllowed)) {
    return false
  }
  const first = party.guests.find((guest) => !guest.isPlusOne)
  return first?.id === hostId
}

function syncPlusOnes(
  wedding: RsvpWedding,
  party: RsvpParty,
  extras: PlusOneDraft[],
  final: boolean,
): { ok: true } | { ok: false; error: string } {
  const meals = new Set(mealOptions(wedding))
  const wanted = extras.filter((extra) => hostMayBring(party, extra.hostId))
  const hosts = new Set(wanted.map((extra) => extra.hostId))
  const previous = party.guests.filter((guest) => guest.isPlusOne)
  party.guests = party.guests.filter((guest) => !guest.isPlusOne)
  for (const extra of wanted) {
    const host = party.guests.find(
      (guest) => guest.id === extra.hostId && !guest.isPlusOne,
    )
    if (!host) continue
    const name = splitPerson(extra.name)
    if (!name.first) {
      if (final) return { ok: false, error: "Enter the plus-one's name." }
      continue
    }
    const earlier =
      previous.find((guest) => guest.plusOneOf === host.id) ??
      previous.find((guest) => guest.id === extra.id)
    const plus = earlier
      ? structuredClone(earlier)
      : emptyGuest(extra.id, name.first, name.last, true)
    plus.firstName = name.first
    plus.lastName = name.last
    plus.isPlusOne = true
    plus.plusOneOf = host.id
    plus.replies = { ...host.replies }
    plus.dietaryNote = extra.dietaryNote.trim().slice(0, 240)
    const coming = party.eventIds.some(
      (id) => replyFor(plus, id) === 'attending',
    )
    const meal = extra.meal.trim().slice(0, 80)
    if (!coming || meals.size === 0) plus.meal = ''
    else if (meals.has(meal)) plus.meal = meal
    else plus.meal = ''
    if (final && coming && meals.size > 0 && !plus.meal) {
      return {
        ok: false,
        error: `Choose a meal for ${plus.firstName}.`,
      }
    }
    if (!hosts.has(host.id)) continue
    party.guests.push(plus)
  }
  return { ok: true }
}

export function applyHousehold(
  wedding: RsvpWedding,
  token: string,
  patch: HouseholdPatch,
):
  | { ok: true; wedding: RsvpWedding; party: RsvpParty }
  | { ok: false; error: string } {
  if (repliesLocked(wedding, patch.today)) {
    return { ok: false, error: 'Replies are closed.' }
  }
  const next = structuredClone(wedding)
  const party = next.parties.find((item) => item.token === token)
  if (!party)
    return { ok: false, error: 'That invitation link does not match.' }
  const remove = new Set(patch.removePlusOneIds)
  party.guests = party.guests.filter(
    (guest) => !(guest.isPlusOne && remove.has(guest.id)),
  )
  if (
    !patch.plusOnes &&
    patch.addPlusOne &&
    party.plusOneAllowed &&
    !party.guests.some((guest) => guest.isPlusOne)
  ) {
    const name = splitPerson(patch.addPlusOne.name)
    if (name.first) {
      party.guests.push(
        emptyGuest(patch.addPlusOne.id, name.first, name.last, true),
      )
    }
  }
  const meals = new Set(mealOptions(next))
  const diets = new Set(dietaryOptions(next))
  for (const incoming of patch.guests) {
    const guest = party.guests.find((item) => item.id === incoming.id)
    if (!guest) continue
    const replies: Record<string, RsvpStatus> = {}
    for (const eventId of party.eventIds) {
      const value = incoming.replies[eventId]
      replies[eventId] =
        value === 'attending' || value === 'declined' ? value : 'pending'
    }
    guest.replies = replies
    if (guest.isPlusOne && incoming.plusOneName.trim()) {
      const name = splitPerson(incoming.plusOneName)
      guest.firstName = name.first
      guest.lastName = name.last
    }
    const coming = party.eventIds.some((id) => replies[id] === 'attending')
    const mealEvent = party.eventIds.some((id) => {
      const event = next.events.find((item) => item.id === id)
      return Boolean(event?.asksMeal) && replies[id] === 'attending'
    })
    guest.dietary = incoming.dietary
      .filter((item) => diets.has(item))
      .slice(0, 8)
    guest.dietaryNote = incoming.dietaryNote.trim().slice(0, 240)
    if (!coming) {
      guest.meal = ''
      guest.songTitle = ''
      guest.songArtist = ''
      continue
    }
    const song = splitSong(incoming.song)
    guest.songTitle = song.title
    guest.songArtist = song.artist
    if (guest.isChild || !mealEvent) guest.meal = ''
    else if (meals.size === 0 || meals.has(incoming.meal)) {
      guest.meal = incoming.meal.trim().slice(0, 80)
    }
  }
  if (patch.plusOnes) {
    const synced = syncPlusOnes(next, party, patch.plusOnes, patch.final)
    if (!synced.ok) return synced
  }
  if (patch.final) {
    for (const guest of party.guests) {
      const pending = party.eventIds.every(
        (id) => replyFor(guest, id) === 'pending',
      )
      if (pending) {
        return {
          ok: false,
          error: `Let us know if ${guest.firstName || 'your guest'} can make it.`,
        }
      }
      const mealEvent = party.eventIds.some((id) => {
        const event = next.events.find((item) => item.id === id)
        return Boolean(event?.asksMeal) && replyFor(guest, id) === 'attending'
      })
      if (mealEvent && !guest.isChild && meals.size > 0 && !guest.meal) {
        return {
          ok: false,
          error: `Choose a dinner for ${guest.firstName || 'your guest'}.`,
        }
      }
    }
    party.lastRepliedAt = patch.now
  }
  party.email = patch.email.trim().slice(0, 120)
  party.note = patch.note.trim().slice(0, 400)
  return { ok: true, wedding: next, party }
}

export type PartyDraft = {
  id: string
  name: string
  email: string
  plusOneAllowed: boolean
  eventIds: string[]
  guests: {
    id: string
    firstName: string
    lastName: string
    altNames: string[]
    isChild: boolean
    isPlusOne: boolean
    plusOneAllowed?: boolean
  }[]
}

export function applyPartyDraft(
  wedding: RsvpWedding,
  draft: PartyDraft,
  token: string,
): { ok: true; wedding: RsvpWedding } | { ok: false; error: string } {
  const name = draft.name.trim().slice(0, 80)
  if (!name) return { ok: false, error: 'Give the party a name.' }
  const guests = draft.guests
    .map((guest) => ({
      ...guest,
      firstName: guest.firstName.trim().slice(0, 40),
      lastName: guest.lastName.trim().slice(0, 40),
      altNames: guest.altNames
        .map((alt) => alt.trim().slice(0, 40))
        .filter((alt) => alt.length > 0)
        .slice(0, 8),
    }))
    .filter((guest) => guest.firstName.length > 0)
  if (guests.length === 0) {
    return { ok: false, error: 'Add at least one guest.' }
  }
  const known = new Set(wedding.events.map((event) => event.id))
  const eventIds = draft.eventIds.filter((id) => known.has(id))
  const next = structuredClone(wedding)
  const existing = next.parties.find((party) => party.id === draft.id)
  if (!existing) {
    next.parties.push({
      id: draft.id,
      name,
      email: draft.email.trim().slice(0, 120),
      note: '',
      token,
      lastRepliedAt: '',
      phoneReply: false,
      plusOneAllowed: draft.plusOneAllowed,
      eventIds,
      guests: guests.map((guest) => ({
        ...emptyGuest(
          guest.id,
          guest.firstName,
          guest.lastName,
          guest.isPlusOne,
        ),
        altNames: guest.altNames,
        isChild: guest.isChild,
        plusOneAllowed: guest.plusOneAllowed === true,
      })),
    })
    return { ok: true, wedding: next }
  }
  existing.name = name
  existing.email = draft.email.trim().slice(0, 120)
  existing.plusOneAllowed = draft.plusOneAllowed
  existing.eventIds = eventIds
  existing.guests = guests.map((guest) => {
    const previous = existing.guests.find((item) => item.id === guest.id)
    const base =
      previous ??
      emptyGuest(guest.id, guest.firstName, guest.lastName, guest.isPlusOne)
    return {
      ...base,
      firstName: guest.firstName,
      lastName: guest.lastName,
      altNames: guest.altNames,
      isChild: guest.isChild,
      isPlusOne: guest.isPlusOne,
      plusOneAllowed: guest.plusOneAllowed === true,
    }
  })
  return { ok: true, wedding: next }
}

export function deleteParty(
  wedding: RsvpWedding,
  partyId: string,
): RsvpWedding {
  const next = structuredClone(wedding)
  next.parties = next.parties.filter((party) => party.id !== partyId)
  return next
}

export type GuestOutcome = 'attending' | 'declined' | 'waiting'

export function guestOutcome(guest: RsvpGuest, party: RsvpParty): GuestOutcome {
  if (!party.lastRepliedAt) return 'waiting'
  let coming = false
  let declined = false
  for (const id of party.eventIds) {
    const reply = replyFor(guest, id)
    if (reply === 'attending') coming = true
    if (reply === 'declined') declined = true
  }
  if (coming) return 'attending'
  if (declined) return 'declined'
  return 'waiting'
}

export function draftTally(party: RsvpParty): {
  attending: number
  declined: number
} {
  let attending = 0
  let declined = 0
  for (const guest of party.guests) {
    const coming = party.eventIds.some(
      (id) => replyFor(guest, id) === 'attending',
    )
    const no = party.eventIds.some((id) => replyFor(guest, id) === 'declined')
    if (coming) attending += 1
    else if (no) declined += 1
  }
  return { attending, declined }
}

export type OverviewStats = {
  guests: number
  parties: number
  attending: number
  declined: number
  waitingGuests: number
  waitingParties: number
  repliedGuests: number
  byEvent: { id: string; name: string; attending: number }[]
  meals: { label: string; count: number }[]
  latest: {
    partyId: string
    name: string
    label: string
    tone: 'ok' | 'no'
    ago: string
  }[]
}

export function overviewStats(
  wedding: RsvpWedding,
  now: number,
): OverviewStats {
  let attending = 0
  let declined = 0
  let waitingGuests = 0
  let waitingParties = 0
  let repliedGuests = 0
  let guests = 0
  for (const party of wedding.parties) {
    if (!party.lastRepliedAt) waitingParties += 1
    for (const guest of party.guests) {
      guests += 1
      const outcome = guestOutcome(guest, party)
      if (outcome === 'attending') attending += 1
      else if (outcome === 'declined') declined += 1
      else waitingGuests += 1
      if (party.lastRepliedAt) repliedGuests += 1
    }
  }
  const byEvent = wedding.events
    .filter((event) => event.enabled)
    .map((event) => ({
      id: event.id,
      name: event.name,
      attending: wedding.parties.reduce((sum, party) => {
        if (!party.eventIds.includes(event.id)) return sum
        return (
          sum +
          party.guests.filter(
            (guest) => replyFor(guest, event.id) === 'attending',
          ).length
        )
      }, 0),
    }))
  const mealCounts = new Map<string, number>()
  for (const party of wedding.parties) {
    for (const guest of party.guests) {
      if (!guest.meal) continue
      if (guestOutcome(guest, party) !== 'attending') continue
      mealCounts.set(guest.meal, (mealCounts.get(guest.meal) ?? 0) + 1)
    }
  }
  const meals = [...mealCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  const latest = wedding.parties
    .filter((party) => party.lastRepliedAt)
    .slice()
    .sort((a, b) => b.lastRepliedAt.localeCompare(a.lastRepliedAt))
    .slice(0, 6)
    .map((party) => {
      const summary = partySummary(party)
      return {
        partyId: party.id,
        name: party.name,
        label: summary.label,
        tone: summary.tone,
        ago: ago(party.lastRepliedAt, now),
      }
    })
  return {
    guests,
    parties: wedding.parties.length,
    attending,
    declined,
    waitingGuests,
    waitingParties,
    repliedGuests,
    byEvent,
    meals,
    latest,
  }
}

function partySummary(party: RsvpParty): { label: string; tone: 'ok' | 'no' } {
  const outcomes = party.guests.map((guest) => guestOutcome(guest, party))
  const attending = outcomes.filter((item) => item === 'attending').length
  const declined = outcomes.filter((item) => item === 'declined').length
  if (party.phoneReply && attending > 0) {
    return { label: 'Attending · added by the couple', tone: 'ok' }
  }
  if (attending === 0 && declined > 0)
    return { label: "Can't make it", tone: 'no' }
  if (attending === party.guests.length && party.guests.length === 2) {
    return { label: 'Both attending', tone: 'ok' }
  }
  return {
    label: `${attending} of ${party.guests.length} attending`,
    tone: 'ok',
  }
}

export function ago(iso: string, now: number): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ''
  const minutes = Math.max(0, Math.round((now - then) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export type SongRow = {
  title: string
  artist: string
  count: number
  who: string
  status: SongStatus
}

export function songRows(wedding: RsvpWedding): SongRow[] {
  const groups = new Map<
    string,
    { title: string; artist: string; who: string[] }
  >()
  for (const party of wedding.parties) {
    if (!party.lastRepliedAt) continue
    for (const guest of party.guests) {
      if (guestOutcome(guest, party) !== 'attending') continue
      const title = guest.songTitle.trim()
      if (!title) continue
      const artist = guest.songArtist.trim()
      const key = songKey(title, artist)
      const name = `${guest.firstName} ${guest.lastName}`.trim()
      const current = groups.get(key)
      if (!current) groups.set(key, { title, artist, who: [name] })
      else current.who.push(name)
    }
  }
  const rows: SongRow[] = []
  for (const [key, group] of groups) {
    rows.push({
      title: group.title,
      artist: group.artist,
      count: group.who.length,
      who: whoLine(group.who),
      status: statusFor(wedding, key),
    })
  }
  rows.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
  return rows
}

function whoLine(names: string[]): string {
  if (names.length <= 2) return names.join(', ')
  const extra = names.length - 2
  return `${names[0]}, ${names[1]} +${extra}`
}

function statusFor(wedding: RsvpWedding, key: string): SongStatus {
  if (!Object.hasOwn(wedding.songStatus, key)) return 'queued'
  const value = wedding.songStatus[key]
  if (value === 'must' || value === 'no') return value
  return 'queued'
}

export function setSongStatus(
  wedding: RsvpWedding,
  title: string,
  artist: string,
  status: SongStatus,
): RsvpWedding {
  const next = structuredClone(wedding)
  next.songStatus[songKey(title, artist)] = status
  return next
}

function unansweredParties(wedding: RsvpWedding): RsvpParty[] {
  return wedding.parties.filter(
    (party) => party.email.includes('@') && !party.lastRepliedAt,
  )
}

export function partiesToRemind(
  wedding: RsvpWedding,
  today: string,
): RsvpParty[] {
  if (!wedding.autoRemind || !wedding.paid) return []
  if (shiftDate(wedding.deadline, -7) !== today) return []
  if (wedding.remindedOn === today) return []
  return unansweredParties(wedding)
}

/** Parties a manual reminder can reach. The 7-day rule does not apply. */
export function partiesWaiting(wedding: RsvpWedding): RsvpParty[] {
  if (!wedding.paid) return []
  return unansweredParties(wedding)
}

export function csvCell(value: string): string {
  let cell = value.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  if (/^[=+\-@]/.test(cell)) cell = `'${cell}`
  if (/[",\n]/.test(cell)) return `"${cell.replaceAll('"', '""')}"`
  return cell
}

export function toCsv(rows: string[][]): string {
  const body = rows
    .map((row) => row.map((cell) => csvCell(cell)).join(','))
    .join('\r\n')
  return `\uFEFF${body}`
}

export function catererCsv(wedding: RsvpWedding): string {
  const rows = [['Name', 'Party', 'Event', 'Meal', 'Dietary', 'Child']]
  for (const party of wedding.parties) {
    for (const guest of party.guests) {
      if (guestOutcome(guest, party) !== 'attending') continue
      for (const event of invitedEvents(wedding, party)) {
        if (replyFor(guest, event.id) !== 'attending') continue
        rows.push([
          `${guest.firstName} ${guest.lastName}`.trim(),
          party.name,
          event.name,
          guest.meal,
          [...guest.dietary, guest.dietaryNote].filter(Boolean).join('; '),
          guest.isChild ? 'yes' : '',
        ])
      }
    }
  }
  return toCsv(rows)
}

export function songCsv(wedding: RsvpWedding): string {
  const rows = [['Song', 'Artist', 'Requests', 'Requested by', 'Status']]
  for (const song of songRows(wedding)) {
    rows.push([
      song.title,
      song.artist,
      String(song.count),
      song.who,
      song.status,
    ])
  }
  return toCsv(rows)
}

export function guestCsv(wedding: RsvpWedding): string {
  const rows = [['Name', 'Party', 'Event', 'Status', 'Email', 'Child']]
  for (const party of wedding.parties) {
    for (const guest of party.guests) {
      const events = invitedEvents(wedding, party)
      const listed = events.length > 0 ? events : [null]
      for (const event of listed) {
        rows.push([
          `${guest.firstName} ${guest.lastName}`.trim(),
          party.name,
          event ? event.name : '',
          event ? replyFor(guest, event.id) : guestOutcome(guest, party),
          party.email,
          guest.isChild ? 'yes' : '',
        ])
      }
    }
  }
  return toCsv(rows)
}

export function seatingCsv(wedding: RsvpWedding): string {
  const rows = [['Party', 'Guest', 'Child', 'Event']]
  for (const party of wedding.parties) {
    for (const guest of party.guests) {
      if (guestOutcome(guest, party) !== 'attending') continue
      for (const event of invitedEvents(wedding, party)) {
        if (replyFor(guest, event.id) !== 'attending') continue
        rows.push([
          party.name,
          `${guest.firstName} ${guest.lastName}`.trim(),
          guest.isChild ? 'yes' : '',
          event.name,
        ])
      }
    }
  }
  return toCsv(rows)
}

export type CsvKind = 'caterer' | 'songs' | 'guests' | 'seating'

export function csvFor(wedding: RsvpWedding, kind: CsvKind): string {
  if (kind === 'caterer') return catererCsv(wedding)
  if (kind === 'songs') return songCsv(wedding)
  if (kind === 'seating') return seatingCsv(wedding)
  return guestCsv(wedding)
}

export function calendarIcs(wedding: RsvpWedding): string {
  const stamp = wedding.eventDate.replaceAll('-', '')
  const summary = icsText(coupleTitle(wedding))
  const location = icsText(
    [wedding.venue, wedding.address].filter(Boolean).join(', '),
  )
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DJ Piper P//RSVP//EN',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${stamp}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

function icsText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;')
}

export type GuestEntry = 'missing' | 'unpaid' | 'code' | 'find' | 'home'

export function guestEntry(
  wedding: { paid: boolean; accessMode: AccessMode } | null,
  unlocked: boolean,
): GuestEntry {
  if (!wedding) return 'missing'
  if (!wedding.paid) return 'unpaid'
  if (wedding.accessMode === 'public') return 'home'
  if (wedding.accessMode === 'checkin') return unlocked ? 'home' : 'find'
  return unlocked ? 'home' : 'code'
}

export function blankWedding(input: {
  slug: string
  partnerOne: string
  partnerTwo: string
  email: string
  eventDate: string
  venue: string
  priceCents: number
  priceKind: PriceKind
  inviteCode: string
}): RsvpWedding {
  const deadline = shiftDate(input.eventDate, -21)
  return {
    slug: input.slug,
    partnerOne: input.partnerOne.trim().slice(0, 40),
    partnerTwo: input.partnerTwo.trim().slice(0, 40),
    email: input.email.trim().slice(0, 120),
    eventDate: input.eventDate,
    venue: input.venue.trim().slice(0, 120),
    address: '',
    deadline,
    catererDeadline: shiftDate(input.eventDate, -14),
    accessMode: 'code',
    inviteCode: input.inviteCode,
    showContact: false,
    contactPhone: '',
    lockAfterDeadline: true,
    autoRemind: true,
    priceCents: input.priceCents,
    priceKind: input.priceKind,
    paid: false,
    theme: 'dark',
    template: DEFAULT_TEMPLATE,
    photo: null,
    bookingSlug: '',
    replyEmail: '',
    sample: false,
    notes: [],
    schedule: [
      {
        name: 'Ceremony',
        time: '4:00 PM',
        place: input.venue.trim().slice(0, 80),
        note: '',
      },
      {
        name: 'Reception & dancing',
        time: '6:00 PM',
        place: input.venue.trim().slice(0, 80),
        note: '',
      },
    ],
    events: [
      {
        id: 'ceremony',
        name: 'Ceremony & reception',
        dateLabel: longWeddingDate(input.eventDate),
        time: '4:00 PM',
        location: input.venue.trim().slice(0, 80),
        note: '',
        enabled: true,
        asksMeal: true,
        hidden: false,
      },
    ],
    parties: [],
    questions: defaultQuestions(),
    songStatus: {},
    signInToken: '',
    signInExpires: '',
    remindedOn: '',
    remindedIds: [],
    remindedManualAt: '',
    deadlineSummaryOn: '',
  }
}

export function defaultQuestions(): RsvpQuestion[] {
  return [
    {
      id: 'dinner',
      eventId: 'ceremony',
      label: 'Dinner',
      type: 'choice',
      audience: 'adults',
      required: true,
      options: ['Prime rib', 'Wild salmon', 'Vegetarian risotto'],
    },
    {
      id: 'dietary',
      eventId: 'ceremony',
      label: 'Dietary needs',
      type: 'pills',
      audience: 'attending',
      required: false,
      options: ['Gluten-free', 'Vegetarian', 'Nut allergy', 'Dairy-free'],
    },
    {
      id: 'song',
      eventId: 'ceremony',
      label: 'What song gets you on the dance floor?',
      type: 'song',
      audience: 'attending',
      required: false,
      options: [],
    },
  ]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function asFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

export function parseWedding(raw: unknown, slug: string): RsvpWedding | null {
  const record = asRecord(raw)
  if (!record) return null
  const base = blankWedding({
    slug,
    partnerOne: asText(record.partnerOne, 40),
    partnerTwo: asText(record.partnerTwo, 40),
    email: asText(record.email, 120),
    eventDate: asText(record.eventDate, 10),
    venue: asText(record.venue, 120),
    priceCents:
      record.priceCents === PIPER_RSVP_CENTS
        ? PIPER_RSVP_CENTS
        : STANDALONE_RSVP_CENTS,
    priceKind: record.priceKind === 'piper' ? 'piper' : 'standalone',
    inviteCode: asText(record.inviteCode, 12) || 'RSVP',
  })
  base.address = asText(record.address, 160)
  base.deadline = asText(record.deadline, 10)
  base.catererDeadline = asText(record.catererDeadline, 10)
  base.accessMode =
    record.accessMode === 'checkin' || record.accessMode === 'public'
      ? record.accessMode
      : 'code'
  base.showContact = asFlag(record.showContact)
  base.contactPhone = asText(record.contactPhone, 40)
  base.lockAfterDeadline = record.lockAfterDeadline === false ? false : true
  base.autoRemind = record.autoRemind === false ? false : true
  base.paid = asFlag(record.paid)
  base.theme = record.theme === 'light' ? 'light' : 'dark'
  base.template = parseTemplateId(record.template)
  base.photo = parsePhoto(record.photo)
  base.bookingSlug = asText(record.bookingSlug, 80)
  base.replyEmail = asText(record.replyEmail, 120)
  base.sample = asFlag(record.sample)
  base.notes = Array.isArray(record.notes)
    ? record.notes.map((item) => asText(item, 160)).filter((item) => item)
    : []
  base.schedule = parseSchedule(record.schedule, base.schedule)
  base.events = parseEvents(record.events, base.events)
  base.parties = parseParties(record.parties)
  base.questions = parseQuestions(record.questions, base.questions)
  base.songStatus = parseSongStatus(record.songStatus)
  base.signInToken = asText(record.signInToken, 80)
  base.signInExpires = asText(record.signInExpires, 40)
  base.remindedOn = asText(record.remindedOn, 10)
  base.remindedIds = Array.isArray(record.remindedIds)
    ? record.remindedIds
        .map((item) => asText(item, 40))
        .filter((item) => item !== '')
    : []
  base.remindedManualAt = asText(record.remindedManualAt, 40)
  base.deadlineSummaryOn = asText(record.deadlineSummaryOn, 10)
  base.slug = slug
  return base
}

function parseSchedule(
  value: unknown,
  fallback: ScheduleItem[],
): ScheduleItem[] {
  if (!Array.isArray(value)) return fallback
  const items = value.flatMap((item) => {
    const record = asRecord(item)
    if (!record) return []
    const name = asText(record.name, 80)
    if (!name) return []
    return [
      {
        name,
        time: asText(record.time, 40),
        place: asText(record.place, 80),
        note: asText(record.note, 40),
      },
    ]
  })
  return items.length > 0 ? items : fallback
}

function parseEvents(value: unknown, fallback: RsvpEvent[]): RsvpEvent[] {
  if (!Array.isArray(value)) return fallback
  const items = value.flatMap((item) => {
    const record = asRecord(item)
    if (!record) return []
    const id = asText(record.id, 40)
    const name = asText(record.name, 80)
    if (!id || !name) return []
    return [
      {
        id,
        name,
        dateLabel: asText(record.dateLabel, 80),
        time: asText(record.time, 40),
        location: asText(record.location, 80),
        note: asText(record.note, 40),
        enabled: record.enabled === false ? false : true,
        asksMeal: asFlag(record.asksMeal),
        hidden: asFlag(record.hidden),
      },
    ]
  })
  return items.length > 0 ? items : fallback
}

function parseParties(value: unknown): RsvpParty[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const record = asRecord(item)
    if (!record) return []
    const id = asText(record.id, 40)
    const token = asText(record.token, 80)
    const name = asText(record.name, 80)
    if (!id || !token || !name) return []
    const guests = parseGuests(record.guests)
    if (guests.length === 0) return []
    return [
      {
        id,
        name,
        email: asText(record.email, 120),
        note: asText(record.note, 400),
        token,
        lastRepliedAt: asText(record.lastRepliedAt, 40),
        phoneReply: asFlag(record.phoneReply),
        plusOneAllowed: asFlag(record.plusOneAllowed),
        eventIds: Array.isArray(record.eventIds)
          ? record.eventIds
              .map((eventId) => asText(eventId, 40))
              .filter(Boolean)
          : [],
        guests,
      },
    ]
  })
}

function parseGuests(value: unknown): RsvpGuest[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const record = asRecord(item)
    if (!record) return []
    const id = asText(record.id, 40)
    const firstName = asText(record.firstName, 40)
    if (!id || !firstName) return []
    return [
      {
        id,
        firstName,
        lastName: asText(record.lastName, 40),
        altNames: Array.isArray(record.altNames)
          ? record.altNames.map((alt) => asText(alt, 40)).filter(Boolean)
          : [],
        isChild: asFlag(record.isChild),
        isPlusOne: asFlag(record.isPlusOne),
        plusOneAllowed: asFlag(record.plusOneAllowed),
        plusOneOf: asText(record.plusOneOf, 40),
        replies: parseReplies(record.replies),
        meal: asText(record.meal, 80),
        dietary: Array.isArray(record.dietary)
          ? record.dietary.map((diet) => asText(diet, 40)).filter(Boolean)
          : [],
        dietaryNote: asText(record.dietaryNote, 240),
        songTitle: asText(record.songTitle, 120),
        songArtist: asText(record.songArtist, 120),
      },
    ]
  })
}

function parseReplies(value: unknown): Record<string, RsvpStatus> {
  const record = asRecord(value)
  if (!record) return {}
  const replies: Record<string, RsvpStatus> = {}
  for (const [key, reply] of Object.entries(record)) {
    if (reply === 'attending' || reply === 'declined' || reply === 'pending') {
      replies[key.slice(0, 40)] = reply
    }
  }
  return replies
}

function parseQuestions(
  value: unknown,
  fallback: RsvpQuestion[],
): RsvpQuestion[] {
  if (!Array.isArray(value)) return fallback
  const items = value.flatMap((item) => {
    const record = asRecord(item)
    if (!record) return []
    const id = asText(record.id, 40)
    const label = asText(record.label, 120)
    if (!id || !label) return []
    const type: QuestionType =
      record.type === 'yesno' ||
      record.type === 'choice' ||
      record.type === 'pills' ||
      record.type === 'song' ||
      record.type === 'text'
        ? record.type
        : 'text'
    const audience: QuestionAudience =
      record.audience === 'attending' ||
      record.audience === 'adults' ||
      record.audience === 'out-of-town'
        ? record.audience
        : 'everyone'
    return [
      {
        id,
        eventId: asText(record.eventId, 40),
        label,
        type,
        audience,
        required: asFlag(record.required),
        options: Array.isArray(record.options)
          ? record.options.map((option) => asText(option, 40)).filter(Boolean)
          : [],
      },
    ]
  })
  return items.length > 0 ? items : fallback
}

function parseSongStatus(value: unknown): Record<string, SongStatus> {
  const record = asRecord(value)
  if (!record) return {}
  const status: Record<string, SongStatus> = {}
  for (const [key, item] of Object.entries(record)) {
    if (item === 'queued' || item === 'must' || item === 'no') {
      status[key.slice(0, 160)] = item
    }
  }
  return status
}
