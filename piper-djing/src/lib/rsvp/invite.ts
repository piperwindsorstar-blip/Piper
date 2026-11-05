import { inviteDate, monogramLetters, shortTime, timeWords } from './invite-words.ts'
import type { InviteDate, InviteWording } from './invite-words.ts'
import type { RsvpTemplateId } from './templates.ts'

/** The couple's photo as a guest page shows it. */
export type InvitePhoto = { url: string; alt: string; width: number; height: number }

/** Everything the invitation card and its envelope need, and nothing private. */
export type InviteView = {
  template: RsvpTemplateId
  tint: number
  wording: InviteWording
  monogram: boolean
  envelope: boolean
  partnerOne: string
  partnerTwo: string
  letters: [string, string]
  date: InviteDate | null
  /** "four o'clock in the afternoon" */
  timeWords: string
  /** "4 pm" */
  timeShort: string
  venue: string
  /** The street address, when it adds something the venue line does not say. */
  address: string
  /** "May 8", or empty. */
  replyBy: string
  /** Who the envelope is addressed to; empty on the shared page. */
  addressee: string
  photo: InvitePhoto | null
}

type WeddingForInvite = {
  template: RsvpTemplateId
  tint: number
  wording: InviteWording
  monogram: boolean
  envelope: boolean
  partnerOne: string
  partnerTwo: string
  eventDate: string
  venue: string
  address: string
  deadline: string
  events: { enabled: boolean; time: string }[]
  schedule: { time: string }[]
}

/** The first time on the day: the first event that has one, else the schedule. */
export function startTime(wedding: Pick<WeddingForInvite, 'events' | 'schedule'>): string {
  const event = wedding.events.find((item) => item.enabled && item.time.trim() !== '')
  const raw = event?.time ?? wedding.schedule.find((item) => item.time.trim() !== '')?.time ?? ''
  // "6:30 PM – 1:00 AM" → "6:30 PM"
  return raw.split(/\s[–-]\s/)[0].trim()
}

function monthDay(iso: string): string {
  const date = inviteDate(iso)
  if (!date) return ''
  return date.plain.replace(/, \d{4}$/, '')
}

function sameWords(a: string, b: string): boolean {
  const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  return key(a) !== '' && key(a) === key(b)
}

export function inviteView(
  wedding: WeddingForInvite,
  extra: { addressee?: string; photo?: InvitePhoto | null } = {},
): InviteView {
  const time = startTime(wedding)
  const venue = wedding.venue.trim()
  const address = wedding.address.trim()
  return {
    template: wedding.template,
    tint: wedding.tint,
    wording: wedding.wording,
    monogram: wedding.monogram,
    envelope: wedding.envelope,
    partnerOne: wedding.partnerOne.trim(),
    partnerTwo: wedding.partnerTwo.trim(),
    letters: monogramLetters(wedding.partnerOne, wedding.partnerTwo),
    date: inviteDate(wedding.eventDate),
    timeWords: time ? timeWords(time) : '',
    timeShort: time ? shortTime(time) : '',
    venue,
    address: address && !sameWords(address, venue) && !venue.toLowerCase().includes(address.toLowerCase()) ? address : '',
    replyBy: monthDay(wedding.deadline),
    addressee: (extra.addressee ?? '').trim(),
    photo: extra.photo ?? null,
  }
}

/** A Google Maps search link for the venue, for the guest's "Map" button. */
export function mapLink(view: Pick<InviteView, 'venue' | 'address'>): string {
  const query = [view.venue, view.address].filter(Boolean).join(', ')
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : ''
}
