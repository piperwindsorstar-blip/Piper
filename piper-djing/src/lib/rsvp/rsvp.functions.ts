import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { isDesk } from '../auth/session.server.ts'
import { PUBLIC_EMAIL } from '../crm/defaults.ts'
import { publicUrl } from '../crm/safe-origin.ts'
import { torontoToday } from '../piper/rules.ts'
import {
  catererCsv,
  priceLabel,
  applyCoupleReply,
  applyHousehold,
  applyPartyDraft,
  asksSong,
  calendarIcs,
  coupleReplyAddress,
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
  partiesWaiting,
  partyByToken,
  partyLine,
  rsvpPath,
  setSongStatus,
  shortMonthDay,
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
import { cleanMealList, confirmGuestList, setMealOptions } from './guest-list.ts'
import type { GuestListRow } from './guest-list.ts'
import {
  confirmationEmail,
  deadlineSummaryEmail,
  invitationEmail,
  piperQuestionEmail,
  reminderEmail,
  replyNoticeEmail,
  signInEmail,
  welcomeEmail,
} from './emails.ts'
import type { RsvpEmail } from './emails.ts'
import { listRsvpEmails, sendKey, sendRsvpEmail } from './mailer.server.ts'
import { parsePhotoUpload } from './photo.ts'
import { photoPath, parseTemplateId, parseTint } from './templates.ts'
import { inviteView } from './invite.ts'
import { parseWording } from './invite-words.ts'
import { notifyCouplePaid, notifyPiperSignup } from './notify.server.ts'
import { catererSheet } from './caterer.ts'
import {
  FLOOR_IMAGE_MAX,
  deleteFloorImage,
  listTimelines,
  readFloorImage,
  readSeating,
  readTimeline,
  writeFloorImage,
  writeSeating,
  writeTimeline,
} from './plans.server.ts'
import {
  parseSeating,
  pruneSeating,
  seatableGuests,
  seatingChartCsv,
  validateSeating,
} from './seating.ts'
import {
  guestMoments,
  orderedMoments,
  parseTimeline,
  timeLabel,
  timelineCsv,
  validateTimeline,
} from './timeline.ts'
import {
  coupleBookings,
  createRsvpWedding,
  deleteRsvp,
  ensureSampleRsvp,
  insertCoupleQuestion,
  listCoupleQuestions,
  listRsvps,
  newToken,
  quoteRsvpPrice,
  readRsvp,
  removeRsvpPhoto as dropRsvpPhoto,
  saveRsvpPhoto as storeRsvpPhoto,
  writeRsvp,
} from './store.server.ts'
import {
  gateOpen,
  rememberGate,
  rememberRsvpSlug,
  rsvpSlugFromCookie,
} from './session.server.ts'

import {
  cardStatus,
  quoteRsvpPurchase,
  startRsvpCheckout,
} from '../crm/stripe.server.ts'
import { openPurchasedSite } from './purchase.server.ts'

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

function guestRows(value: unknown): GuestListRow[] | null {
  if (!Array.isArray(value)) return null
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    return [
      {
        id: text(row.id, 40),
        name: text(row.name, 80),
        partyId: text(row.partyId, 40),
        plusOneAllowed: row.plusOneAllowed === true,
      },
    ]
  })
}

function plusOneDrafts(value: unknown) {
  if (!Array.isArray(value)) return null
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const plus = item as Record<string, unknown>
    const hostId = text(plus.hostId, 40)
    if (!hostId) return []
    return [
      {
        id: text(plus.id, 40) || newToken(),
        hostId,
        name: text(plus.name, 80),
        meal: text(plus.meal, 80),
        dietaryNote: text(plus.dietaryNote, 240),
      },
    ]
  })
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
        error: "Enter the couple's email.",
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.eventDate)) {
      return { ok: false as const, error: 'Choose the wedding date.' }
    }
    const wedding = await createRsvpWedding(data)
    rememberRsvpSlug(wedding.slug)
    await notifyPiperSignup(wedding)
    return {
      ok: true as const,
      slug: wedding.slug,
      cents: wedding.priceCents,
      kind: wedding.priceKind,
      path: rsvpPath(wedding.slug),
    }
  })

/** Whether the /rsvp page can sell by card right now. */
export const getRsvpSale = createServerFn({ method: 'GET' }).handler(
  async () => {
    const status = await cardStatus().catch(() => ({ enabled: false }))
    return { card: status.enabled }
  },
)

/** The price, HST and total for what the couple typed. Server-side only. */
export const quoteRsvpCard = createServerFn({ method: 'POST' })
  .validator((data: Record<string, unknown>) => data)
  .handler(async ({ data }) => {
    try {
      return await quoteRsvpPurchase(data)
    } catch {
      return { ok: false as const, error: 'The price could not be worked out. Try again.' }
    }
  })

/** Opens Stripe Checkout for the RSVP page. */
export const startRsvpCard = createServerFn({ method: 'POST' })
  .validator((data: Record<string, unknown>) => data)
  .handler(async ({ data }) => {
    try {
      return await startRsvpCheckout(data)
    } catch {
      return {
        ok: false as const,
        error: 'Card payment could not start. Please try again.',
      }
    }
  })

/** Back from Stripe: straight into the new dashboard once it is built. */
export const openRsvpPurchase = createServerFn({ method: 'POST' })
  .validator((data: { session?: string }) => ({ session: text(data.session, 200) }))
  .handler(async ({ data }) => {
    const result = await openPurchasedSite(data.session)
    if (result.state === 'ready') rememberRsvpSlug(result.slug)
    return { state: result.state }
  })

/**
 * The owner makes a couple's RSVP site by hand, free and already paid, and
 * can email them a sign-in link.
 */
export const createRsvpByHand = createServerFn({ method: 'POST' })
  .validator((data: Record<string, unknown>) => ({
    partnerOne: text(data.partnerOne, 40),
    partnerTwo: text(data.partnerTwo, 40),
    email: text(data.email, 120).toLowerCase(),
    eventDate: text(data.eventDate, 10),
    venue: text(data.venue, 120),
    sendLink: data.sendLink === true,
  }))
  .handler(async ({ data }) => {
    if (!(await isDesk())) return { ok: false as const, error: 'Sign in to the desk.' }
    if (!data.partnerOne || !data.partnerTwo) {
      return { ok: false as const, error: 'Enter both names.' }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return { ok: false as const, error: "Enter the couple's email." }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.eventDate)) {
      return { ok: false as const, error: 'Choose the wedding date.' }
    }
    const existing = (await listRsvps()).find(
      (item) => item.email.toLowerCase() === data.email,
    )
    if (existing) {
      return {
        ok: false as const,
        error: `That email already has an RSVP site: /rsvp/${existing.slug}.`,
      }
    }
    const wedding = await createRsvpWedding(data)
    wedding.paid = true
    wedding.priceCents = 0
    let mailed = false
    if (data.sendLink) {
      const token = newToken()
      wedding.signInToken = token
      wedding.signInExpires = new Date(Date.now() + 7 * 86_400_000).toISOString()
      await writeRsvp(wedding)
      const sent = await sendRsvpEmail({
        slug: wedding.slug,
        kind: 'welcome',
        to: wedding.email,
        email: welcomeEmail(wedding, {
          amountLabel: 'No charge',
          dashboardUrl: publicUrl(`/rsvp/open/${token}`),
          guestUrl: publicUrl(rsvpPath(wedding.slug)),
        }),
      })
      mailed = sent.delivered
    } else {
      await writeRsvp(wedding)
    }
    return { ok: true as const, slug: wedding.slug, mailed }
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
        theme: wedding.theme,
        template: wedding.template,
      tint: wedding.tint,
        photo: photoView(wedding),
        couple: coupleTitle(wedding),
        cents: wedding.priceCents,
        kind: wedding.priceKind,
      }
    }
    return {
      entry,
      theme: wedding.theme,
      template: wedding.template,
      tint: wedding.tint,
      photo: photoView(wedding),
      slug: wedding.slug,
      couple: coupleTitle(wedding),
      dateLabel: longWeddingDate(wedding.eventDate),
      venue: wedding.venue,
      deadline: shortMonthDay(wedding.deadline),
      daysLeft: daysUntil(wedding.deadline, torontoToday()),
      caterer: shortMonthDay(wedding.catererDeadline),
      // Shown when the couple has no timeline yet. It comes from their
      // events, which they can edit, so guests never see a made-up time.
      schedule: guestSchedule(wedding),
      day: guestMoments(await readTimeline(wedding.slug), wedding.venue),
      notes: wedding.notes,
      showContact: wedding.showContact,
      contactPhone: wedding.showContact ? wedding.contactPhone : '',
      contactName: wedding.partnerOne,
      invite: inviteView(wedding, { photo: photoView(wedding) }),
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

function guestSchedule(
  wedding: RsvpWedding,
): { name: string; time: string; place: string; note: string }[] {
  const weddingDay = longWeddingDate(wedding.eventDate)
  return wedding.events
    .filter((event) => event.enabled && !event.hidden)
    .map((event) => ({
      name: event.name,
      time: [event.dateLabel === weddingDay ? '' : event.dateLabel, event.time]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' · '),
      place: event.location,
      note: '',
    }))
}

function householdPayload(
  wedding: RsvpWedding,
  token: string,
  day: ReturnType<typeof guestMoments> = [],
) {
  const party = partyByToken(wedding, token)
  if (!party) return null
  return {
    slug: wedding.slug,
    theme: wedding.theme,
    template: wedding.template,
    tint: wedding.tint,
    photo: photoView(wedding),
    invite: inviteView(wedding, { addressee: party.name, photo: photoView(wedding) }),
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
        plusOneAllowed: guest.plusOneAllowed,
        plusOneOf: guest.plusOneOf,
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
      dateLabel: event.dateLabel,
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
    day,
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
    if (!partyByToken(wedding, data.token)) return null
    return householdPayload(
      wedding,
      data.token,
      guestMoments(await readTimeline(wedding.slug), wedding.venue),
    )
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
      plusOnes: plusOneDrafts(data.plusOnes),
    })
    if (!result.ok) return result
    await writeRsvp(result.wedding)
    if (data.final !== true) return { ok: true as const, mailed: true }
    if (!result.party.email.includes('@')) {
      return {
        ok: true as const,
        mailed: false,
        detail: 'Enter an email for the confirmation.',
      }
    }
    const url = editUrl(result.wedding.slug, result.party.token)
    const guest = await sendRsvpEmail({
      slug: result.wedding.slug,
      kind: 'confirmation',
      partyId: result.party.id,
      to: result.party.email,
      email: confirmationEmail(result.wedding, result.party, url),
    })
    const couple = coupleReplyAddress(result.wedding, await coupleBookings())
    if (couple.includes('@')) {
      await sendRsvpEmail({
        slug: result.wedding.slug,
        kind: 'reply-notice',
        partyId: result.party.id,
        to: couple,
        email: replyNoticeEmail(
          result.wedding,
          result.party,
          overviewStats(result.wedding, Date.now()),
          publicUrl('/rsvp/manage'),
        ),
      })
    }
    if (!guest.delivered) {
      return { ok: true as const, mailed: false, detail: guest.detail }
    }
    return { ok: true as const, mailed: true }
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
      const mailed = await sendRsvpEmail({
        slug: wedding.slug,
        kind: 'sign-in',
        to: email,
        email: signInEmail(publicUrl(`/rsvp/open/${token}`)),
      })
      if (!mailed.delivered) {
        return {
          ok: false as const,
          error:
            "We couldn't send the sign-in email. Text or email DJ Piper P and he'll send you a link.",
        }
      }
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

/**
 * The photo as the guest pages and the dashboard show it: the whole picture,
 * at its own proportions. There is one image per couple and nothing else, so a
 * record that once carried a crop is simply the photo the couple uploaded.
 */
function photoView(wedding: RsvpWedding) {
  const photo = wedding.photo
  if (!photo) return null
  return {
    url: publicUrl(photoPath(wedding.slug, photo)),
    alt: `${coupleTitle(wedding)} photo`,
    bytes: photo.bytes,
    version: photo.version,
    width: photo.width,
    height: photo.height,
  }
}

/** When each once-only email last went out, read from the desk's own log. */
function lastSends(emails: Awaited<ReturnType<typeof listRsvpEmails>>) {
  const invited: Record<string, string> = {}
  let testedAt = ''
  for (const row of emails) {
    if (!row.delivered) continue
    if (row.kind === 'invitation' && row.partyId && !invited[row.partyId]) {
      invited[row.partyId] = row.sentAt
    }
    if (row.kind === 'test' && !testedAt) testedAt = row.sentAt
  }
  return { invited, testedAt }
}

async function manageView(
  wedding: RsvpWedding,
  desk: boolean,
  replyTarget: string,
) {
  const copy = structuredClone(wedding)
  copy.signInToken = ''
  copy.signInExpires = ''
  const questions = await listCoupleQuestions(copy.slug)
  const emails = await listRsvpEmails(copy.slug)
  const sends = lastSends(emails)
  return {
    photo: photoView(copy),
    invited: sends.invited,
    /** Only "Email all invitations" sets this, never a single party's send. */
    invitedAt: copy.invitedAllAt,
    testedAt: sends.testedAt,
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
    replyTarget,
    reminderManual: {
      allowed: manualReminderAllowed(copy.remindedManualAt),
      lastAt: copy.remindedManualAt,
    },
    emails: emails.slice(0, 25),
    questions,
  }
}

export const setRsvpTheme = createServerFn({ method: 'POST' })
  .validator((data: { theme?: string }) => ({
    theme: data.theme === 'light' ? ('light' as const) : ('dark' as const),
  }))
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    if (!wedding) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    wedding.theme = data.theme
    await writeRsvp(wedding)
    return { ok: true as const, theme: wedding.theme }
  })

/** The couple picks one of the five invitation templates. */
export const saveRsvpTemplate = createServerFn({ method: 'POST' })
  .validator((data: { template?: string }) => ({
    template: parseTemplateId(data.template),
  }))
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    wedding.template = data.template
    await writeRsvp(wedding)
    return { ok: true as const, template: wedding.template }
  })

/**
 * The couple's invitation choices from the studio: style, colourway, wording,
 * monogram and envelope. Each value is checked here; the browser is never
 * trusted for any of it.
 */
export const saveRsvpInvite = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      template?: unknown
      tint?: unknown
      wording?: unknown
      monogram?: unknown
      envelope?: unknown
    }) => ({
      template: parseTemplateId(data.template),
      tint: parseTint(data.tint),
      wording: parseWording(data.wording),
      monogram: data.monogram !== false,
      envelope: data.envelope !== false,
    }),
  )
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    wedding.template = data.template
    wedding.tint = data.tint
    wedding.wording = data.wording
    wedding.monogram = data.monogram
    wedding.envelope = data.envelope
    await writeRsvp(wedding)
    return { ok: true as const }
  })

/**
 * The JPEG the browser made from the couple's photo. It is the whole picture,
 * at its own proportions — the upload path never crops. It lands in the site's
 * own storage and is served from the site's own domain, so no third party ever
 * holds a guest's photo. A new upload replaces the old one and changes the
 * version, so the image guests fetch is never stale.
 */
export const saveRsvpPhoto = createServerFn({ method: 'POST' })
  .validator(
    (data: { dataUrl?: unknown; width?: unknown; height?: unknown }) => ({
      dataUrl: typeof data.dataUrl === 'string' ? data.dataUrl : '',
      width: data.width,
      height: data.height,
    }),
  )
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    const parsed = parsePhotoUpload(data.dataUrl, data.width, data.height)
    if (!parsed.ok) return { ok: false as const, error: parsed.error }
    const photo = await storeRsvpPhoto({
      slug: wedding.slug,
      mime: parsed.photo.mime,
      bytes: parsed.photo.bytes,
      width: parsed.photo.width,
      height: parsed.photo.height,
    })
    wedding.photo = photo
    await writeRsvp(wedding)
    return { ok: true as const, photo }
  })

/** "Remove photo" puts the invitation back to its template without one. */
export const clearRsvpPhoto = createServerFn({ method: 'POST' }).handler(
  async () => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    await dropRsvpPhoto(wedding.slug)
    wedding.photo = null
    await writeRsvp(wedding)
    return { ok: true as const }
  },
)

export const getRsvpManage = createServerFn({ method: 'GET' }).handler(
  async () => {
    const wedding = await ownedWedding()
    if (!wedding) return null
    const { deliverDueReminders } = await import('./reminders.server.ts')
    await deliverDueReminders(wedding)
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
    return manageView(
      wedding,
      desk,
      coupleReplyAddress(wedding, await coupleBookings()),
    )
  },
)

export const askRsvpQuestion = createServerFn({ method: 'POST' })
  .validator((data: { text?: string }) => ({ text: text(data.text, 2000) }))
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    if (!data.text) return { ok: false as const, error: 'Write your question.' }
    const question = await insertCoupleQuestion({
      slug: wedding.slug,
      couple: coupleTitle(wedding),
      text: data.text,
      askedAt: new Date().toISOString(),
    })
    const mailed = await sendRsvpEmail({
      slug: wedding.slug,
      kind: 'piper-question',
      to: PUBLIC_EMAIL,
      email: piperQuestionEmail(question),
    })
    return {
      ok: true as const,
      notice: mailed.delivered
        ? 'Sent. Piper has your question.'
        : 'Saved on your RSVP. The email to Piper did not send.',
    }
  })

export const saveRsvpGuestList = createServerFn({ method: 'POST' })
  .validator((data: { guests?: unknown; meals?: unknown }) => ({
    guests: guestRows(data.guests),
    // The meals have their own boxes and their own save now. A list that
    // still sends them (an older open tab) keeps working.
    meals:
      typeof data.meals === 'string'
        ? data.meals.split(',')
        : Array.isArray(data.meals)
          ? data.meals.filter(
              (item): item is string => typeof item === 'string',
            )
          : null,
  }))
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    if (!data.guests) {
      return { ok: false as const, error: 'Send the guest list.' }
    }
    const saved = confirmGuestList(wedding, data.guests, data.meals, newToken)
    if (!saved.ok) return saved
    await writeRsvp(saved.wedding)
    return { ok: true as const }
  })

/**
 * The dinner choices guests pick from, one meal per box. This is the same list
 * the guest dinner dropdown reads, so guests see exactly these options.
 */
export const saveRsvpMeals = createServerFn({ method: 'POST' })
  .validator((data: { meals?: unknown }) => ({
    meals: Array.isArray(data.meals)
      ? data.meals
          .filter((item): item is string => typeof item === 'string')
          .slice(0, 60)
          .map((item) => item.slice(0, 200))
      : null,
  }))
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    if (!data.meals) return { ok: false as const, error: 'Send the meals.' }
    const cleaned = cleanMealList(data.meals)
    if (!cleaned.ok) return cleaned
    setMealOptions(wedding, cleaned.meals)
    await writeRsvp(wedding)
    return { ok: true as const, meals: mealOptions(wedding) }
  })

export const saveRsvpReplyEmail = createServerFn({ method: 'POST' })
  .validator((data: { email?: string }) => ({ email: text(data.email, 120) }))
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    if (data.email && !data.email.includes('@')) {
      return { ok: false as const, error: "Enter the couple's email." }
    }
    wedding.replyEmail = data.email
    await writeRsvp(wedding)
    return { ok: true as const }
  })

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
              plusOneAllowed: guest.plusOneAllowed === true,
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

/**
 * The couple marks a guest's reply themselves (phone or paper RSVP). Saved
 * straight to their list; no confirmation email goes to anyone.
 */
export const markRsvpReply = createServerFn({ method: 'POST' })
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
    const result = applyCoupleReply(
      wedding,
      text(data.partyId, 40),
      guests.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const guest = item as Record<string, unknown>
        const replies: Record<string, unknown> = {}
        if (guest.replies && typeof guest.replies === 'object') {
          for (const [key, value] of Object.entries(
            guest.replies as Record<string, unknown>,
          )) {
            replies[key.slice(0, 40)] = value
          }
        }
        return [{ id: text(guest.id, 40), replies, meal: text(guest.meal, 80) }]
      }),
      new Date().toISOString(),
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
    // Each page sends only its own fields; anything left out keeps its saved
    // value, so the events page can never reset the access setting.
    const accessMode: AccessMode =
      data.accessMode === undefined
        ? wedding.accessMode
        : data.accessMode === 'checkin' || data.accessMode === 'public'
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
    // An event the couple just added starts with everyone already invited;
    // they can untick it for a party in the guest list.
    const before = new Set(wedding.events.map((event) => event.id))
    const added = parsed.events
      .map((event) => event.id)
      .filter((id) => !before.has(id))
    for (const party of parsed.parties) {
      const kept = party.eventIds.filter((id) => ids.has(id))
      party.eventIds = [...kept, ...added.filter((id) => !kept.includes(id))]
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
      data.kind === 'seating' ||
      data.kind === 'timeline'
        ? data.kind
        : 'guests',
  }))
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    if (!wedding) return ''
    if (data.kind === 'seating') {
      const seating = await loadSeating(wedding)
      return seatingChartCsv(seating, wedding)
    }
    if (data.kind === 'timeline') {
      return timelineCsv(await readTimeline(wedding.slug), wedding.venue)
    }
    return csvFor(wedding, data.kind as CsvKind)
  })

export const sendRsvpReminders = createServerFn({ method: 'POST' })
  .validator((data: { now?: boolean } | undefined) => ({
    now: data?.now === true,
  }))
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return { ok: false as const, sent: 0, detail: 'This RSVP is not open.' }
    }
    if (!data.now) {
      return {
        ok: false as const,
        sent: 0,
        detail: 'That reminder is automatic.',
      }
    }
    if (!manualReminderAllowed(wedding.remindedManualAt)) {
      return {
        ok: false as const,
        sent: 0,
        detail: 'A manual reminder went out in the last 24 hours.',
      }
    }
    const parties = partiesWaiting(wedding)
    if (parties.length === 0) {
      return {
        ok: true as const,
        sent: 0,
        detail: 'Nobody is waiting on an email.',
      }
    }
    const { mailParties } = await import('./reminders.server.ts')
    const result = await mailParties(wedding, parties)
    if (result.sent > 0) {
      wedding.remindedManualAt = new Date().toISOString()
      await writeRsvp(wedding)
    }
    return {
      ok: result.sent > 0,
      sent: result.sent,
      detail: result.sent > 0 ? `Sent ${result.sent}.` : result.detail,
    }
  })

/** When the daily reminder job last ran, for a line on the desk. */
export const getRsvpDailyStatus = createServerFn({ method: 'GET' }).handler(
  async () => {
    if (!(await isDesk())) return null
    const { lastJobRun } = await import('../job-runs.server.ts')
    return lastJobRun('rsvp:daily').catch(() => null)
  },
)

export const getRsvpDesk = createServerFn({ method: 'GET' }).handler(
  async () => {
    if (!(await isDesk())) return []
    const weddings = await listRsvps()
    const { deliverDueReminders } = await import('./reminders.server.ts')
    for (const wedding of weddings) await deliverDueReminders(wedding)
    const timelines = await listTimelines()
    return weddings.map((wedding) => ({
      timeline: orderedMoments(
        timelines.get(wedding.slug) ?? { moments: [], manualOrder: false },
      ).map((moment) => ({
        id: moment.id,
        time: timeLabel(moment.time),
        title: moment.title,
        location: moment.location || wedding.venue,
        note: moment.note,
        guests: moment.guests,
      })),
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
    const wasPaid = wedding.paid
    wedding.paid = data.paid
    await writeRsvp(wedding)
    if (wedding.paid && !wasPaid) await notifyCouplePaid(wedding)
    return { ok: true as const }
  })

const DAY_MS = 24 * 60 * 60 * 1000

function manualReminderAllowed(lastAt: string): boolean {
  const last = Date.parse(lastAt)
  if (Number.isNaN(last)) return true
  return Date.now() - last >= DAY_MS
}

function partyLink(wedding: RsvpWedding, party: { token: string }): string {
  return publicUrl(`${rsvpPath(wedding.slug)}/p/${party.token}`)
}

const TEST_KINDS = [
  'invitation',
  'confirmation',
  'reminder',
  'reply-notice',
  'welcome',
  'deadline-summary',
  'sign-in',
] as const

type TestKind = (typeof TEST_KINDS)[number]

function isTestKind(value: unknown): value is TestKind {
  return (
    typeof value === 'string' &&
    (TEST_KINDS as readonly string[]).includes(value)
  )
}

function buildTestEmail(
  kind: TestKind,
  wedding: RsvpWedding,
  party: RsvpWedding['parties'][number] | undefined,
  url: string,
  dashboardUrl: string,
): RsvpEmail | null {
  const stats = overviewStats(wedding, Date.now())
  if (kind === 'welcome') {
    return welcomeEmail(wedding, {
      amountLabel: priceLabel(wedding.priceCents),
      dashboardUrl,
      guestUrl: publicUrl(rsvpPath(wedding.slug)),
    })
  }
  if (kind === 'deadline-summary') {
    return deadlineSummaryEmail(wedding, stats, catererCsv(wedding))
  }
  if (kind === 'sign-in') return signInEmail(url)
  if (!party) return null
  if (kind === 'invitation') return invitationEmail(wedding, party, url)
  if (kind === 'confirmation') return confirmationEmail(wedding, party, url)
  if (kind === 'reminder') return reminderEmail(wedding, party, url)
  return replyNoticeEmail(wedding, party, stats, dashboardUrl)
}

/** Emails the invitation card to each party with an address. Never automatic. */
export const emailRsvpInvitations = createServerFn({ method: 'POST' })
  .validator((data: { partyId?: string; all?: boolean } | undefined) => ({
    partyId: text(data?.partyId, 40),
    all: data?.all === true,
  }))
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return {
        ok: false as const,
        sent: 0,
        sentAt: '',
        detail: 'This RSVP is not open.',
      }
    }
    const targets = wedding.parties.filter((party) => {
      if (!party.email.includes('@')) return false
      if (data.all) return true
      return data.partyId !== '' && party.id === data.partyId
    })
    if (targets.length === 0) {
      return {
        ok: false as const,
        sent: 0,
        sentAt: '',
        detail: data.all
          ? 'No party has an email address yet.'
          : 'Add an email for this party first.',
      }
    }
    let sent = 0
    let skipped = 0
    let detail = ''
    for (const party of targets) {
      const result = await sendRsvpEmail({
        slug: wedding.slug,
        kind: 'invitation',
        partyId: party.id,
        guard: sendKey(wedding.slug, 'invitation', party.id),
        to: party.email,
        email: invitationEmail(wedding, party, partyLink(wedding, party)),
      })
      if (result.delivered) sent += 1
      else if (result.duplicate) skipped += 1
      else detail = result.detail
    }
    const sentAt = sent > 0 ? new Date().toISOString() : ''
    if (data.all && sent > 0) {
      // Read again so a guest reply saved during the sends is kept.
      const fresh = (await readRsvp(wedding.slug)) ?? wedding
      fresh.invitedAllAt = sentAt
      await writeRsvp(fresh)
    }
    if (sent === 0) {
      return {
        ok: false as const,
        sent,
        sentAt,
        detail:
          skipped > 0 && !detail
            ? 'That invitation went out moments ago, so it was not sent twice.'
            : detail || 'The invitation was not sent.',
      }
    }
    const parts = [`Sent ${sent} invitation${sent === 1 ? '' : 's'}.`]
    if (skipped > 0) {
      parts.push(
        `${skipped} had just gone out and ${skipped === 1 ? 'was' : 'were'} not sent twice.`,
      )
    }
    if (detail) parts.push(`Some did not send: ${detail}`)
    return { ok: true as const, sent, sentAt, detail: parts.join(' ') }
  })

/**
 * Sends any one email type to the couple's own address only. Test sends never
 * count against the daily reminder limit and never mark anything as sent; a
 * short guard per email type stops a double click from sending it twice.
 */
export const sendTestRsvpEmail = createServerFn({ method: 'POST' })
  .validator((data: { kind?: string } | undefined) => ({
    kind: isTestKind(data?.kind) ? data.kind : ('invitation' as TestKind),
  }))
  .handler(async ({ data }) => {
    const wedding = await ownedWedding()
    const desk = await isDesk()
    if (!wedding || (!wedding.paid && !desk)) {
      return {
        ok: false as const,
        detail: 'Open your RSVP from the sign-in link.',
      }
    }
    const to = (wedding.replyEmail || wedding.email).trim()
    if (!to.includes('@')) {
      return { ok: false as const, detail: "Add the couple's email first." }
    }
    const party =
      wedding.parties.find((item) => item.email.includes('@')) ??
      wedding.parties.at(0)
    const url = party
      ? partyLink(wedding, party)
      : publicUrl(rsvpPath(wedding.slug))
    const built = buildTestEmail(
      data.kind,
      wedding,
      party,
      url,
      publicUrl('/rsvp/manage'),
    )
    if (!built) {
      return {
        ok: false as const,
        detail: 'Add a party with a name before testing that email.',
      }
    }
    let result: Awaited<ReturnType<typeof sendRsvpEmail>>
    try {
      result = await sendRsvpEmail({
        slug: wedding.slug,
        kind: 'test',
        testOf: data.kind,
        guard: sendKey(wedding.slug, 'test', data.kind),
        to,
        email: built,
      })
    } catch (error) {
      return {
        ok: false as const,
        detail:
          error instanceof Error && error.message
            ? `The test did not send: ${error.message.slice(0, 200)}`
            : 'The test did not send.',
      }
    }
    if (result.duplicate) {
      return {
        ok: false as const,
        detail: 'That test went out moments ago, so it was not sent twice.',
      }
    }
    return {
      ok: result.delivered,
      detail: result.delivered
        ? `Test sent to ${to}.`
        : `The test did not send: ${result.detail}`,
    }
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

/**
 * A one-day sign-in link for a couple, made on the desk so Piper can text it.
 * Works when email is down, and replaces any link sent earlier.
 */
export const makeRsvpSignInLink = createServerFn({ method: 'POST' })
  .validator((data: { slug?: string }) => ({ slug: text(data.slug, 80) }))
  .handler(async ({ data }) => {
    if (!(await isDesk())) return { ok: false as const, url: '' }
    const wedding = await readRsvp(data.slug)
    if (!wedding) return { ok: false as const, url: '' }
    const token = newToken()
    wedding.signInToken = token
    wedding.signInExpires = new Date(Date.now() + 86_400_000).toISOString()
    await writeRsvp(wedding)
    return { ok: true as const, url: publicUrl(`/rsvp/open/${token}`) }
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

// --- seating chart ---------------------------------------------------------

/** The couple's own RSVP, open to them once paid (and always to the desk). */
async function openWedding(): Promise<RsvpWedding | null> {
  const wedding = await ownedWedding()
  if (!wedding) return null
  if (!wedding.paid && !(await isDesk())) return null
  return wedding
}

/**
 * The stored plan with anyone no longer attending taken off their seat. The
 * change is saved straight away, with a notice the couple sees on the tab.
 */
async function loadSeating(wedding: RsvpWedding) {
  const stored = await readSeating(wedding.slug)
  const pruned = pruneSeating(
    stored,
    wedding,
    new Date().toISOString(),
    newToken,
  )
  if (pruned.changed) {
    try {
      await writeSeating(wedding.slug, pruned.plan)
    } catch {
      // Shown pruned either way; the next load saves it.
    }
  }
  return pruned.plan
}

function seatingGuestView(wedding: RsvpWedding) {
  return seatableGuests(wedding)
}

export const getRsvpSeating = createServerFn({ method: 'GET' }).handler(
  async () => {
    const wedding = await openWedding()
    if (!wedding) return null
    return {
      plan: await loadSeating(wedding),
      image: await readFloorImage(wedding.slug).catch(() => ''),
      guests: seatingGuestView(wedding),
      couple: coupleTitle(wedding),
      dateLabel: longWeddingDate(wedding.eventDate),
      venue: wedding.venue,
    }
  },
)

export const saveRsvpSeating = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      tables?: unknown
      seats?: unknown
      room?: unknown
      items?: unknown
    }) => ({
      plan: parseSeating({
        tables: data.tables,
        seats: data.seats,
        room: data.room,
        items: Array.isArray(data.items) ? data.items : [],
      }),
    }),
  )
  .handler(async ({ data }) => {
    const wedding = await openWedding()
    if (!wedding) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    const stored = await readSeating(wedding.slug)
    const checked = validateSeating(
      { ...data.plan, notices: stored.notices },
      wedding,
    )
    if (!checked.ok) return checked
    const savedAt = await writeSeating(wedding.slug, checked.plan)
    return {
      ok: true as const,
      savedAt,
      plan: checked.plan,
      repaired: checked.repaired,
    }
  })

/** The couple's venue layout behind the floor plan, or "" to take it away. */
export const saveSeatingImage = createServerFn({ method: 'POST' })
  .validator((data: { image?: unknown }) => ({
    image: typeof data.image === 'string' ? data.image : '',
  }))
  .handler(async ({ data }) => {
    const wedding = await openWedding()
    if (!wedding) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    if (!data.image) {
      await deleteFloorImage(wedding.slug)
      return { ok: true as const }
    }
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data.image)) {
      return {
        ok: false as const,
        error: 'Upload a JPG, PNG or WebP picture of the floor plan.',
      }
    }
    if (data.image.length > FLOOR_IMAGE_MAX) {
      return {
        ok: false as const,
        error: 'That picture is too large. Try a smaller one.',
      }
    }
    await writeFloorImage(wedding.slug, data.image)
    return { ok: true as const }
  })

/** The caterer's printout: meals, dietary notes and who sits where. */
export const getCatererSheet = createServerFn({ method: 'GET' }).handler(
  async () => {
    const wedding = await openWedding()
    if (!wedding) return null
    return catererSheet(wedding, await loadSeating(wedding))
  },
)

export const dismissSeatingNotices = createServerFn({ method: 'POST' }).handler(
  async () => {
    const wedding = await openWedding()
    if (!wedding) return { ok: false as const }
    const stored = await readSeating(wedding.slug)
    await writeSeating(wedding.slug, { ...stored, notices: [] })
    return { ok: true as const }
  },
)

// --- the day's timeline ----------------------------------------------------

export const getRsvpTimeline = createServerFn({ method: 'GET' }).handler(
  async () => {
    const wedding = await openWedding()
    if (!wedding) return null
    return {
      timeline: await readTimeline(wedding.slug),
      venue: wedding.venue,
      couple: coupleTitle(wedding),
      dateLabel: longWeddingDate(wedding.eventDate),
    }
  },
)

export const saveRsvpTimeline = createServerFn({ method: 'POST' })
  .validator((data: { moments?: unknown; manualOrder?: unknown }) => ({
    timeline: parseTimeline({
      moments: data.moments,
      manualOrder: data.manualOrder,
    }),
    sent: Array.isArray(data.moments) ? data.moments.length : 0,
  }))
  .handler(async ({ data }) => {
    const wedding = await openWedding()
    if (!wedding) {
      return {
        ok: false as const,
        error: 'Open your RSVP from the sign-in link.',
      }
    }
    if (data.timeline.moments.length < Math.min(data.sent, 40)) {
      return {
        ok: false as const,
        error: 'Every moment needs a time and a title before saving.',
      }
    }
    const checked = validateTimeline(data.timeline)
    if (!checked.ok) return checked
    const savedAt = await writeTimeline(wedding.slug, checked.timeline)
    return { ok: true as const, savedAt, timeline: checked.timeline }
  })
