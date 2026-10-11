import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { isDesk } from '../auth/session.server.ts'
import { emailLetter } from '../crm/mail.server.ts'
import { publicUrl } from '../crm/safe-origin.ts'
import { torontoToday } from '../piper/rules.ts'
import {
  applyHousehold,
  applyPartyDraft,
  asksSong,
  calendarIcs,
  confirmationLetter,
  coupleNotice,
  coupleTitle,
  csvFor,
  daysUntil,
  deleteParty,
  dietaryOptions,
  codesMatch,
  findParty,
  guestEntry,
  greeting,
  invitedEvents,
  longWeddingDate,
  mealOptions,
  noteLookup,
  overviewStats,
  parseWedding,
  partiesToRemind,
  partyByToken,
  partyLine,
  reminderLetter,
  rsvpPath,
  setSongStatus,
  shortMonthDay,
  signInLetter,
  songRows,
} from './model.ts'
import type {
  AccessMode,
  CsvKind,
  HouseholdGuestPatch,
  PriceKind,
  RsvpStatus,
  RsvpWedding,
  SongStatus,
} from './model.ts'
import {
  createRsvpWedding,
  deleteRsvp,
  ensureSampleRsvp,
  listRsvps,
  newToken,
  quoteRsvpPrice,
  readRsvp,
  writeRsvp,
} from './store.server.ts'
import {
  gateOpen,
  rememberGate,
  rememberRsvpSlug,
  rsvpSlugFromCookie,
} from './session.server.ts'

const lookups = new Map<string, number[]>()

function clientIp(): string {
  const request = getRequest()
  const forwarded =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    ''
  return forwarded.split(',')[0]?.trim() || 'local'
}

function allowLookup(ip: string): boolean {
  const next = noteLookup(lookups.get(ip) ?? [], Date.now())
  lookups.set(ip, next.stamps)
  return next.ok
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function torontoHour(): number {
  const hour = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(new Date())
  const number = Number(hour)
  return Number.isFinite(number) ? number : 12
}

function editUrl(slug: string, token: string): string {
  return publicUrl(`${rsvpPath(slug)}/p/${token}`)
}

async function ownedWedding(): Promise<RsvpWedding | null> {
  const slug = rsvpSlugFromCookie()
  if (!slug) return null
  return readRsvp(slug)
}

export const quoteRsvpPage = createServerFn({ method: 'POST' })
  .validator((data: { email?: string }) => ({
    email: text(data.email, 120),
  }))
  .handler(async ({ data }) => quoteRsvpPrice(data.email))

export const startRsvp = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      partnerOne?: string
      partnerTwo?: string
      email?: string
      eventDate?: string
      venue?: string
    }) => ({
      partnerOne: text(data.partnerOne, 40),
      partnerTwo: text(data.partnerTwo, 40),
      email: text(data.email, 120),
      eventDate: text(data.eventDate, 10),
      venue: text(data.venue, 120),
    }),
  )
  .handler(async ({ data }) => {
    if (!data.partnerOne || !data.partnerTwo) {
      return { ok: false as const, error: 'Enter both names.' }
    }
    if (!data.email.includes('@')) {
      return {
        ok: false as const,
        error: 'Enter the email for the sign-in link.',
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.eventDate)) {
      return { ok: false as const, error: 'Choose the wedding date.' }
    }
    const wedding = await createRsvpWedding(data)
    rememberRsvpSlug(wedding.slug)
    return {
      ok: true as const,
      slug: wedding.slug,
      cents: wedding.priceCents,
      kind: wedding.priceKind,
      path: rsvpPath(wedding.slug),
    }
  })

export const getRsvpHome = createServerFn({ method: 'GET' })
  .validator((data: { slug?: string }) => ({ slug: text(data.slug, 80) }))
  .handler(async ({ data }) => {
    const wedding = await readRsvp(data.slug)
    const entry = guestEntry(
      wedding ? { paid: wedding.paid, accessMode: wedding.accessMode } : null,
      wedding ? gateOpen(wedding.slug) : false,
    )
    if (!wedding || entry === 'missing') return { entry: 'missing' as const }
    if (entry === 'unpaid') {
      return {
        entry,
        couple: coupleTitle(wedding),
        cents: wedding.priceCents,
        kind: wedding.priceKind,
      }
    }
    return {
      entry,
      slug: wedding.slug,
      couple: coupleTitle(wedding),
      dateLabel: longWeddingDate(wedding.eventDate),
      venue: wedding.venue,
      deadline: shortMonthDay(wedding.deadline),
      daysLeft: daysUntil(wedding.deadline, torontoToday()),
      caterer: shortMonthDay(wedding.catererDeadline),
      schedule: wedding.schedule,
      notes: wedding.notes,
      showContact: wedding.showContact,
      contactPhone: wedding.showContact ? wedding.contactPhone : '',
      contactName: wedding.partnerOne,
    }
  })

export const unlockRsvpCode = createServerFn({ method: 'POST' })
  .validator((data: { slug?: string; code?: string }) => ({
    slug: text(data.slug, 80),
    code: text(data.code, 20),
  }))
  .handler(async ({ data }) => {
    const wedding = await readRsvp(data.slug)
    if (!wedding || !wedding.paid) return { ok: false as const }
    if (!codesMatch(data.code, wedding.inviteCode)) {
      return {
        ok: false as const,
        error: 'That code does not match the invitation.',
      }
    }
    rememberGate(wedding.slug)
    return { ok: true as const }
  })

export const findInvitation = createServerFn({ method: 'POST' })
  .validator((data: { slug?: string; first?: string; last?: string }) => ({
    slug: text(data.slug, 80),
    first: text(data.first, 40),
    last: text(data.last, 40),
  }))
  .handler(async ({ data }) => {
    if (!allowLookup(clientIp())) {
      return {
        ok: false as const,
        reason: 'limit' as const,
        error: 'Too many tries. Wait a few minutes and try again.',
      }
    }
    const wedding = await readRsvp(data.slug)
    if (!wedding || !wedding.paid) {
      return {
        ok: false as const,
        reason: 'none' as const,
        error: 'That RSVP is not open.',
      }
    }
    const found = findParty(wedding, data.first, data.last)
    if (!found.ok) {
      return {
        ok: false as const,
        reason: found.reason,
        error:
          found.reason === 'short'
            ? 'Enter the first and last name from the envelope.'
            : "We couldn't find that name.",
      }
    }
    if (wedding.accessMode === 'checkin') rememberGate(wedding.slug)
    return {
      ok: true as const,
      token: found.party.token,
      partyName: found.party.name,
      line: partyLine(found.party),
    }
  })

function householdPayload(wedding: RsvpWedding, token: string) {
  const party = partyByToken(wedding, token)
  if (!party) return null
  return {
    slug: wedding.slug,
    couple: coupleTitle(wedding),
    deadline: shortMonthDay(wedding.deadline),
    locked:
      wedding.lockAfterDeadline &&
      Boolean(wedding.deadline) &&
      torontoToday() > wedding.deadline,
    party: {
      name: party.name,
      email: party.email,
      note: party.note,
      token: party.token,
      plusOneAllowed: party.plusOneAllowed,
      eventIds: party.eventIds,
      guests: party.guests.map((guest) => ({
        id: guest.id,
        firstName: guest.firstName,
        lastName: guest.lastName,
        isChild: guest.isChild,
        isPlusOne: guest.isPlusOne,
        replies: guest.replies,
        meal: guest.meal,
        dietary: guest.dietary,
        dietaryNote: guest.dietaryNote,
        song: [guest.songTitle, guest.songArtist].filter(Boolean).join(' – '),
      })),
    },
    events: invitedEvents(wedding, party).map((event) => ({
      id: event.id,
      name: event.name,
      time: event.time,
      location: event.location,
      asksMeal: event.asksMeal,
    })),
    meals: mealOptions(wedding),
    dietary: dietaryOptions(wedding),
    song: asksSong(wedding),
    venue: wedding.venue,
    address: wedding.address,
    eventDate: wedding.eventDate,
    dateLabel: longWeddingDate(wedding.eventDate),
  }
}

export const getHousehold = createServerFn({ method: 'GET' })
  .validator((data: { slug?: string; token?: string }) => ({
    slug: text(data.slug, 80),
    token: text(data.token, 80),
  }))
  .handler(async ({ data }) => {
    const wedding = await readRsvp(data.slug)
    if (!wedding || !wedding.paid) return null
    return householdPayload(wedding, data.token)
  })

export const saveHouseholdReply = createServerFn({ method: 'POST' })
  .validator((data: Record<string, unknown>) => data)
  .handler(async ({ data }) => {
    const slug = text(data.slug, 80)
    const token = text(data.token, 80)
    const wedding = await readRsvp(slug)
    if (!wedding || !wedding.paid) {
      return { ok: false as const, error: 'That RSVP is not open.' }
    }
    const guests = Array.isArray(data.guests) ? data.guests : []
    const patchGuests: HouseholdGuestPatch[] = guests.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const guest = item as Record<string, unknown>
      const replies: Record<string, RsvpStatus> = {}
      if (guest.replies && typeof guest.replies === 'object') {
        for (const [key, value] of Object.entries(
          guest.replies as Record<string, unknown>,
        )) {
          if (
            value === 'attending' ||
            value === 'declined' ||
            value === 'pending'
          ) {
            replies[key.slice(0, 40)] = value
          }
        }
      }
      return [
        {
          id: text(guest.id, 40),
          replies,
          meal: text(guest.meal, 80),
          dietary: Array.isArray(guest.dietary)
            ? guest.dietary.map((diet) => text(diet, 40)).filter(Boolean)
            : [],
          dietaryNote: text(guest.dietaryNote, 240),
          song: text(guest.song, 180),
          plusOneName: text(guest.plusOneName, 80),
        },
      ]
    })
    const add =
      data.addPlusOne && typeof data.addPlusOne === 'object'
        ? (data.addPlusOne as Record<string, unknown>)
        : null
    const result = applyHousehold(wedding, token, {
      email: text(data.email, 120),
      note: text(data.note, 400),
      final: data.final === true,
      today: torontoToday(),
      now: new Date().toISOString(),
      guests: patchGuests,
      removePlusOneIds: Array.isArray(data.removePlusOneIds)
        ? data.removePlusOneIds.map((id) => text(id, 40)).filter(Boolean)
        : [],
      addPlusOne: add ? { id: newToken(), name: text(add.name, 80) } : null,
    })
    if (!result.ok) return result
    await writeRsvp(result.wedding)
    if (data.final === true) {
      const url = editUrl(result.wedding.slug, result.party.token)
      if (result.party.email.includes('@')) {
        await emailLetter(
          result.party.email,
          confirmationLetter(result.wedding, result.party, url),
        )
      }
      if (result.wedding.email.includes('@')) {
        await emailLetter(
          result.wedding.email,
          coupleNotice(result.wedding, result.party),
        )
      }
    }
    return { ok: true as const }
  })

export const getRsvpCalendar = createServerFn({ method: 'GET' })
  .validator((data: { slug?: string; token?: string }) => ({
    slug: text(data.slug, 80),
    token: text(data.token, 80),
  }))
  .handler(async ({ data }) => {
    const wedding = await readRsvp(data.slug)
    if (!wedding || !partyByToken(wedding, data.token)) return ''
    return calendarIcs(wedding)
  })

export const requestRsvpSignIn = createServerFn({ method: 'POST' })
  .validator((data: { email?: string }) => ({ email: text(data.email, 120) }))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase()
    if (!email.includes('@')) {
      return { ok: false as const, error: 'Enter the email on the RSVP.' }
    }
    const weddings = (await listRsvps()).filter(
      (item) => item.email.toLowerCase() === email,
    )
    const paid = weddings.find((item) => item.paid)
    const wedding = paid ?? (weddings.length > 0 ? weddings[0] : null)
    if (wedding) {
      const token = newToken()
      wedding.signInToken = token
      wedding.signInExpires = new Date(Date.now() + 86_400_000).toISOString()
      await writeRsvp(wedding)
      await emailLetter(email, signInLetter(publicUrl(`/rsvp/open/${token}`)))
    }
    return { ok: true as const }
  })

export const openRsvpSignIn = createServerFn({ method: 'POST' })
  .validator((data: { token?: string }) => ({ token: text(data.token, 80) }))
  .handler(async ({ data }) => {
    if (!data.token) return { ok: false as const }
    const wedding = (await listRsvps()).find(
      (item) => item.signInToken === data.token,
    )
    if (!wedding) return { ok: false as const }
    if (Date.parse(wedding.signInExpires) < Date.now())
      return { ok: false as const }
    wedding.signInToken = ''
    wedding.signInExpires = ''
    await writeRsvp(wedding)
    rememberRsvpSlug(wedding.slug)
    return { ok: true as const, slug: wedding.slug }
  })

function manageView(wedding: RsvpWedding, desk: boolean) {
  const copy = structuredClone(wedding)
  copy.signInToken = ''
  copy.signInExpires = ''
  return {
    mode: 'ready' as const,
    desk,
    wedding: copy,
    stats: overviewStats(copy, Date.now()),
    songs: songRows(copy),
    greeting: greeting(copy.partnerOne, torontoHour()),
    daysLeft: daysUntil(copy.eventDate, torontoToday()),
    deadlineLabel: shortMonthDay(copy.deadline),
    catererLabel: shortMonthDay(copy.catererDeadline),
    path: rsvpPath(copy.slug),
    publicLink: publicUrl(rsvpPath(copy.slug)),
  }
}

export const getRsvpManage = createServerFn({ method: 'GET' }).handler(
  async () => {
    const wedding = await ownedWedding()
    if (!wedding) return null
    const desk = await isDesk()
    if (!wedding.paid && !desk) {
      return {
        mode: 'pay' as const,
        slug: wedding.slug,
        couple: coupleTitle(wedding),
        cents: wedding.priceCents,
        kind: wedding.priceKind satisfies PriceKind,
        path: rsvpPath(wedding.slug),
      }
    }
    return manageView(wedding, desk)
  },
)

export const saveRsvpParty = createServerFn({ method: 'POST' })
  .validator((data: Record<string, unknown>) => data)
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    const guests = Array.isArray(data.guests) ? data.guests : []
    const result = applyPartyDraft(
      wedding,
      {
        id: text(data.id, 40) || newToken(),
        name: text(data.name, 80),
        email: text(data.email, 120),
        plusOneAllowed: data.plusOneAllowed === true,
        eventIds: Array.isArray(data.eventIds)
          ? data.eventIds.map((id) => text(id, 40)).filter(Boolean)
          : [],
        guests: guests.flatMap((item) => {
          if (!item || typeof item !== 'object') return []
          const guest = item as Record<string, unknown>
          return [
            {
              id: text(guest.id, 40) || newToken(),
              firstName: text(guest.firstName, 40),
              lastName: text(guest.lastName, 40),
              altNames: text(guest.altNames, 200)
                .split(',')
                .map((name) => name.trim())
                .filter(Boolean),
              isChild: guest.isChild === true,
              isPlusOne: guest.isPlusOne === true,
            },
          ]
        }),
      },
      newToken(),
    )
    if (!result.ok) return result
    await writeRsvp(result.wedding)
    return { ok: true as const }
  })

export const removeRsvpParty = createServerFn({ method: 'POST' })
  .validator((data: { id?: string }) => ({ id: text(data.id, 40) }))
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) return { ok: false as const }
    await writeRsvp(deleteParty(wedding, data.id))
    return { ok: true as const }
  })

export const saveRsvpSetup = createServerFn({ method: 'POST' })
  .validator((data: Record<string, unknown>) => data)
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    const accessMode: AccessMode =
      data.accessMode === 'checkin' || data.accessMode === 'public'
        ? data.accessMode
        : 'code'
    const parsed = parseWedding(
      {
        ...wedding,
        ...data,
        accessMode,
        parties: wedding.parties,
        songStatus: wedding.songStatus,
        paid: wedding.paid,
        priceCents: wedding.priceCents,
        priceKind: wedding.priceKind,
        sample: wedding.sample,
        email: wedding.email,
        signInToken: '',
      },
      wedding.slug,
    )
    if (!parsed) {
      return { ok: false as const, error: 'Those settings could not be saved.' }
    }
    parsed.paid = wedding.paid
    parsed.priceCents = wedding.priceCents
    parsed.priceKind = wedding.priceKind
    parsed.sample = wedding.sample
    parsed.email = wedding.email
    parsed.partnerOne = wedding.partnerOne
    parsed.partnerTwo = wedding.partnerTwo
    parsed.eventDate = wedding.eventDate
    const ids = new Set(parsed.events.map((event) => event.id))
    for (const party of parsed.parties) {
      party.eventIds = party.eventIds.filter((id) => ids.has(id))
    }
    await writeRsvp(parsed)
    return { ok: true as const }
  })

export const saveSongStatus = createServerFn({ method: 'POST' })
  .validator((data: { title?: string; artist?: string; status?: string }) => ({
    title: text(data.title, 120),
    artist: text(data.artist, 120),
    status:
      data.status === 'must' || data.status === 'no' ? data.status : 'queued',
  }))
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) return { ok: false as const }
    await writeRsvp(
      setSongStatus(
        wedding,
        data.title,
        data.artist,
        data.status as SongStatus,
      ),
    )
    return { ok: true as const }
  })

export const downloadRsvpCsv = createServerFn({ method: 'GET' })
  .validator((data: { kind?: string }) => ({
    kind:
      data.kind === 'caterer' ||
      data.kind === 'songs' ||
      data.kind === 'seating'
        ? data.kind
        : 'guests',
  }))
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    if (!wedding) return ''
    return csvFor(wedding, data.kind as CsvKind)
  })

export const sendRsvpReminders = createServerFn({ method: 'POST' }).handler(
  async () => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return { ok: false as const, sent: 0 }
    }
    const today = torontoToday()
    const parties = partiesToRemind(wedding, today)
    for (const party of parties) {
      await emailLetter(
        party.email,
        reminderLetter(wedding, party, publicUrl(rsvpPath(wedding.slug))),
      )
    }
    if (parties.length > 0) {
      wedding.remindedOn = today
      await writeRsvp(wedding)
    }
    return { ok: true as const, sent: parties.length }
  },
)

export const getRsvpDesk = createServerFn({ method: 'GET' }).handler(
  async () => {
    if (!(await isDesk())) return []
    const weddings = await listRsvps()
    return weddings.map((wedding) => ({
      slug: wedding.slug,
      couple: coupleTitle(wedding),
      eventDate: wedding.eventDate,
      email: wedding.email,
      paid: wedding.paid,
      sample: wedding.sample,
      cents: wedding.priceCents,
      kind: wedding.priceKind,
      parties: wedding.parties.length,
      path: rsvpPath(wedding.slug),
    }))
  },
)

export const markRsvpPaid = createServerFn({ method: 'POST' })
  .validator((data: { slug?: string; paid?: boolean }) => ({
    slug: text(data.slug, 80),
    paid: data.paid !== false,
  }))
  .handler(async ({ data }) => {
    if (!(await isDesk())) return { ok: false as const }
    const wedding = await readRsvp(data.slug)
    if (!wedding) return { ok: false as const }
    wedding.paid = data.paid
    await writeRsvp(wedding)
    return { ok: true as const }
  })

export const openRsvpDesk = createServerFn({ method: 'POST' })
  .validator((data: { slug?: string }) => ({ slug: text(data.slug, 80) }))
  .handler(async ({ data }) => {
    if (!(await isDesk())) return { ok: false as const }
    const wedding = await readRsvp(data.slug)
    if (!wedding) return { ok: false as const }
    rememberRsvpSlug(wedding.slug)
    return { ok: true as const }
  })

export const createSampleRsvp = createServerFn({ method: 'POST' }).handler(
  async () => {
    if (!(await isDesk())) return { ok: false as const, slug: '' }
    const wedding = await ensureSampleRsvp()
    rememberRsvpSlug(wedding.slug)
    return { ok: true as const, slug: wedding.slug }
  },
)

export const removeRsvpDesk = createServerFn({ method: 'POST' })
  .validator((data: { slug?: string }) => ({ slug: text(data.slug, 80) }))
  .handler(async ({ data }) => {
    if (!(await isDesk())) return { ok: false as const }
    await deleteRsvp(data.slug)
    return { ok: true as const }
  })
