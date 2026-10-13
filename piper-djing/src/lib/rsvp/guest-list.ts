import { foldName, emptyGuest, guestOutcome, overviewStats } from './model.ts'
import type { RsvpGuest, RsvpParty, RsvpWedding } from './model.ts'

export type NamedGuest = {
  id: string
  name: string
}

export type GuestListRow = {
  id: string
  name: string
  partyId: string
  plusOneAllowed: boolean
}

export type BotGuestRecord = {
  id: string
  name: string
  partyId: string
  attending: 'yes' | 'no' | 'no reply'
  meal: string
  dietaryNote: string
  isPlusOne: boolean
  plusOneOf: string | null
}

/** One guest per line. Commas also split. Blanks and duplicate names drop. */
export function splitGuestPaste(raw: string): string[] {
  return tidyGuestNames(raw.split(/[\r\n,]+/))
}

/** Keeps each saved row as one guest. Still drops blanks and duplicates. */
export function tidyGuestNames(names: string[]): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, 80)
    if (!name) continue
    const key = foldName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    next.push(name)
    if (next.length >= 500) break
  }
  return next
}

export function partyLabel(names: string[]): string {
  const clean = names.map((name) => name.trim()).filter((name) => name !== '')
  if (clean.length <= 1) return (clean[0] ?? 'Party').slice(0, 80)
  if (clean.length === 2) return `${clean[0]} & ${clean[1]}`.slice(0, 80)
  return `${clean.slice(0, -1).join(', ')} & ${clean[clean.length - 1]}`.slice(
    0,
    80,
  )
}

function splitFullName(full: string): { first: string; last: string } {
  const parts = full
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
  return {
    first: (parts[0] ?? '').slice(0, 40),
    last: parts.slice(1).join(' ').slice(0, 40),
  }
}

function fullName(guest: RsvpGuest): string {
  return `${guest.firstName} ${guest.lastName}`.trim()
}

export const MAX_MEALS = 12
export const MEAL_MAX_LENGTH = 40

/**
 * The meal boxes as the couple typed them: one meal per box, so a comma inside
 * a name ("Chicken, lemon herb") stays part of that meal. Blank boxes drop out,
 * spaces are trimmed, and the same meal twice is refused rather than merged.
 */
export function cleanMealList(
  raw: string[],
): { ok: true; meals: string[] } | { ok: false; error: string } {
  const meals: string[] = []
  const seen = new Map<string, string>()
  for (const item of raw) {
    const name = item.trim().replace(/\s+/g, ' ')
    if (!name) continue
    if (name.length > MEAL_MAX_LENGTH) {
      return {
        ok: false,
        error: `Keep each meal to ${MEAL_MAX_LENGTH} characters. "${name.slice(0, 24)}…" is longer.`,
      }
    }
    const key = name.toLowerCase()
    if (seen.has(key)) {
      return { ok: false, error: `"${name}" is listed twice. Remove one.` }
    }
    seen.set(key, name)
    meals.push(name)
  }
  if (meals.length > MAX_MEALS) {
    return { ok: false, error: `Up to ${MAX_MEALS} meals can be offered.` }
  }
  return { ok: true, meals }
}

export function setMealOptions(wedding: RsvpWedding, raw: string[]): void {
  const seen = new Set<string>()
  const options: string[] = []
  for (const item of raw) {
    const name = item.trim().replace(/\s+/g, ' ').slice(0, 40)
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    options.push(name)
    if (options.length >= 12) break
  }
  const question = wedding.questions.find((item) => item.type === 'choice')
  if (question) {
    question.options = options
    return
  }
  if (options.length === 0) return
  let eventId = 'ceremony'
  for (const item of wedding.events) {
    if (!item.asksMeal) continue
    eventId = item.id
    break
  }
  wedding.questions.unshift({
    id: 'dinner',
    eventId,
    label: 'Dinner',
    type: 'choice',
    audience: 'everyone',
    required: true,
    options,
  })
}

/** Saves the pasted list as parties. Each group shares one RSVP link. */
export function confirmGuestList(
  wedding: RsvpWedding,
  rows: GuestListRow[],
  /** Null leaves the meal options exactly as they are. */
  meals: string[] | null,
  fresh: () => string,
): { ok: true; wedding: RsvpWedding } | { ok: false; error: string } {
  const cleaned: GuestListRow[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const name = row.name.trim().replace(/\s+/g, ' ').slice(0, 80)
    if (!name) continue
    const key = foldName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    cleaned.push({
      id: row.id.trim(),
      name,
      partyId: row.partyId.trim(),
      plusOneAllowed: row.plusOneAllowed,
    })
    if (cleaned.length >= 500) break
  }
  const next = structuredClone(wedding)
  const existingGuests = new Map<string, RsvpGuest>()
  const existingParties = new Map<string, RsvpParty>()
  const plusOnes: RsvpGuest[] = []
  for (const party of next.parties) {
    existingParties.set(party.id, party)
    for (const guest of party.guests) {
      if (guest.isPlusOne) plusOnes.push(guest)
      else existingGuests.set(guest.id, guest)
    }
  }
  const groups = new Map<string, GuestListRow[]>()
  for (const row of cleaned) {
    const partyId = row.partyId || fresh()
    const list = groups.get(partyId) ?? []
    list.push(row)
    groups.set(partyId, list)
  }
  const enabled = next.events
    .filter((event) => event.enabled)
    .map((event) => event.id)
  const parties: RsvpParty[] = []
  const used = new Set<string>()
  for (const [partyId, members] of groups) {
    const previous = existingParties.get(partyId)
    const guests: RsvpGuest[] = []
    for (const member of members) {
      const person = splitFullName(member.name)
      if (!person.first) continue
      const previousGuest = member.id
        ? existingGuests.get(member.id)
        : undefined
      const guestId = previousGuest ? previousGuest.id : fresh()
      if (used.has(guestId)) continue
      used.add(guestId)
      const guest = previousGuest
        ? structuredClone(previousGuest)
        : emptyGuest(guestId, person.first, person.last, false)
      guest.firstName = person.first
      guest.lastName = person.last
      guest.plusOneAllowed = member.plusOneAllowed
      guest.isPlusOne = false
      guest.plusOneOf = ''
      guests.push(guest)
    }
    if (guests.length === 0) continue
    for (const extra of plusOnes) {
      if (!guests.some((guest) => guest.id === extra.plusOneOf)) continue
      if (used.has(extra.id)) continue
      used.add(extra.id)
      guests.push(structuredClone(extra))
    }
    parties.push({
      id: previous ? previous.id : fresh(),
      name: partyLabel(
        guests.filter((guest) => !guest.isPlusOne).map(fullName),
      ),
      email: previous?.email ?? '',
      note: previous?.note ?? '',
      token: previous?.token || fresh(),
      lastRepliedAt: previous?.lastRepliedAt ?? '',
      phoneReply: Boolean(previous?.phoneReply),
      plusOneAllowed: false,
      eventIds:
        previous && previous.eventIds.length > 0 ? previous.eventIds : enabled,
      guests,
    })
  }
  for (const extra of plusOnes) {
    if (extra.plusOneOf || used.has(extra.id)) continue
    const oldParty = next.parties.find((party) =>
      party.guests.some((guest) => guest.id === extra.id),
    )
    const kept = oldParty
      ? parties.find((party) => party.id === oldParty.id)
      : undefined
    if (!kept) continue
    used.add(extra.id)
    kept.guests.push(structuredClone(extra))
  }
  next.parties = parties
  if (meals) setMealOptions(next, meals)
  return { ok: true, wedding: next }
}

export function addGuestNames(
  wedding: RsvpWedding,
  names: string[],
  fresh: () => string,
): RsvpWedding {
  const next = structuredClone(wedding)
  const seen = new Set<string>()
  for (const party of next.parties) {
    for (const guest of party.guests) {
      if (!guest.isPlusOne) seen.add(foldName(fullName(guest)))
    }
  }
  const events = next.events
    .filter((event) => event.enabled)
    .map((event) => event.id)
  for (const name of splitGuestPaste(names.join('\n'))) {
    const key = foldName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const person = splitFullName(name)
    if (!person.first) continue
    next.parties.push({
      id: fresh(),
      name: name.slice(0, 80),
      email: '',
      note: '',
      token: fresh(),
      lastRepliedAt: '',
      phoneReply: false,
      plusOneAllowed: false,
      eventIds: events,
      guests: [emptyGuest(fresh(), person.first, person.last, false)],
    })
  }
  return next
}

export function removeGuest(
  wedding: RsvpWedding,
  guestId: string,
): RsvpWedding | null {
  const next = structuredClone(wedding)
  const known = next.parties.some((party) =>
    party.guests.some((guest) => guest.id === guestId),
  )
  if (!known) return null
  const drop = new Set<string>([guestId])
  for (const party of next.parties) {
    for (const guest of party.guests) {
      if (guest.plusOneOf === guestId) drop.add(guest.id)
    }
  }
  for (const party of next.parties) {
    party.guests = party.guests.filter((guest) => !drop.has(guest.id))
  }
  next.parties = next.parties.filter((party) =>
    party.guests.some((guest) => !guest.isPlusOne),
  )
  return next
}

export function moveGuest(
  wedding: RsvpWedding,
  guestId: string,
  partyId: string,
): { ok: true; wedding: RsvpWedding } | { ok: false; error: string } {
  const next = structuredClone(wedding)
  const source = next.parties.find((party) =>
    party.guests.some((guest) => guest.id === guestId),
  )
  const guest = source?.guests.find((item) => item.id === guestId)
  if (!source || !guest) {
    return { ok: false, error: 'That guest is not on the desk.' }
  }
  const target = next.parties.find((party) => party.id === partyId)
  if (!target) return { ok: false, error: 'That party is not on this RSVP.' }
  if (source.id === target.id) return { ok: true, wedding: next }
  const moving = new Set<string>([guest.id])
  if (!guest.isPlusOne) {
    for (const extra of source.guests) {
      if (extra.plusOneOf === guest.id) moving.add(extra.id)
    }
  }
  const taken = source.guests.filter((item) => moving.has(item.id))
  source.guests = source.guests.filter((item) => !moving.has(item.id))
  target.guests.push(...taken)
  next.parties = next.parties.filter((party) => party.guests.length > 0)
  return { ok: true, wedding: next }
}

export function toBotGuests(wedding: RsvpWedding): BotGuestRecord[] {
  const guests: BotGuestRecord[] = []
  for (const party of wedding.parties) {
    for (const guest of party.guests) {
      const outcome = guestOutcome(guest, party)
      guests.push({
        id: guest.id,
        name: fullName(guest),
        partyId: party.id,
        attending:
          outcome === 'attending'
            ? 'yes'
            : outcome === 'declined'
              ? 'no'
              : 'no reply',
        meal: guest.meal,
        dietaryNote: [...guest.dietary, guest.dietaryNote]
          .map((item) => item.trim())
          .filter((item) => item !== '')
          .join(', '),
        isPlusOne: guest.isPlusOne,
        plusOneOf: guest.plusOneOf || null,
      })
    }
  }
  return guests
}

export function rsvpTotals(wedding: RsvpWedding, now: number) {
  const stats = overviewStats(wedding, now)
  let plusOnes = 0
  for (const party of wedding.parties) {
    for (const guest of party.guests) {
      if (guest.isPlusOne) plusOnes += 1
    }
  }
  return {
    yes: stats.attending,
    no: stats.declined,
    noReply: stats.waitingGuests,
    plusOnes,
    meals: stats.meals,
  }
}
