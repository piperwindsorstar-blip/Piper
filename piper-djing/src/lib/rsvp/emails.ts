/**
 * Guest-facing RSVP emails, built to read like a printed invitation: a cream
 * card, a thin border, a serif display face, small-caps labels and room to
 * breathe. Everything is inline CSS on tables, so Gmail, Outlook and Apple Mail
 * all show the same card and no web font has to load.
 *
 * These builders are pure: pass a wedding and a party, get a letter back.
 */

import type { LetterAttachment } from '../crm/mail-copy.ts'
import { coupleTitle, invitedEvents, replyFor, shortMonthDay } from './model.ts'
import type {
  OverviewStats,
  RsvpGuest,
  RsvpParty,
  RsvpWedding,
} from './model.ts'
import { emailPhotoBox, photoPath, templateFor } from './templates.ts'
import type { RsvpSkin } from './templates.ts'

export type RsvpEmailKind =
  | 'invitation'
  | 'confirmation'
  | 'reminder'
  | 'reply-notice'
  | 'welcome'
  | 'deadline-summary'
  | 'piper-question'
  | 'piper-signup'
  | 'piper-payment'
  | 'sign-in'
  | 'test'

export type RsvpEmail = {
  kind: RsvpEmailKind
  subject: string
  text: string
  html: string
  attachments?: LetterAttachment[]
}

export const SITE_HOST = 'piperpweddingdj.services'
const LOGO_URL = `https://${SITE_HOST}/brand/dj-piper-p.png`

/** The couple's template drives every colour, rule and face in the letter. */
function skinOf(wedding: RsvpWedding): RsvpSkin {
  return templateFor(wedding.template).skin
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

const ORDINALS = [
  'zeroth',
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
  'sixteenth',
  'seventeenth',
  'eighteenth',
  'nineteenth',
  'twentieth',
  'twenty-first',
  'twenty-second',
  'twenty-third',
  'twenty-fourth',
  'twenty-fifth',
  'twenty-sixth',
  'twenty-seventh',
  'twenty-eighth',
  'twenty-ninth',
  'thirtieth',
  'thirty-first',
]

/** Wednesday, the thirteenth of January, 2027 */
export function formalDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [year, month, day] = iso.split('-').map((part) => Number(part))
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekday = date.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  })
  const monthName = date.toLocaleDateString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  })
  const ordinal = ORDINALS[day] ?? String(day)
  return `${weekday}, the ${ordinal} of ${monthName}, ${year}`
}

/** January 13, 2027 */
export function shortDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  return `${shortMonthDay(iso)}, ${iso.slice(0, 4)}`
}

export function ceremonyTime(wedding: RsvpWedding): string {
  const event = wedding.events.find(
    (item) => item.enabled && item.time.trim() !== '',
  )
  if (event) return clean(event.time)
  const first = wedding.schedule.find((item) => item.time.trim() !== '')
  return first ? clean(first.time) : ''
}

export function venueParts(wedding: { venue: string; address: string }): {
  name: string
  town: string
} {
  const venue = clean(wedding.venue)
  if (venue.includes(',')) {
    const [name, ...rest] = venue.split(',')
    return { name: clean(name), town: clean(rest.join(',')) }
  }
  const address = clean(wedding.address)
  if (address.includes(',')) {
    const parts = address.split(',')
    return { name: venue, town: clean(parts[parts.length - 1]) }
  }
  return { name: venue, town: '' }
}

export function partyNames(party: RsvpParty): string {
  const names = party.guests
    .map((guest) => `${guest.firstName} ${guest.lastName}`.trim())
    .filter((name) => name !== '')
  if (names.length === 0) return party.name
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

function guestFullName(guest: RsvpGuest): string {
  return `${guest.firstName} ${guest.lastName}`.trim() || 'Guest'
}

function replyWord(wedding: RsvpWedding, party: RsvpParty, guest: RsvpGuest) {
  const events = invitedEvents(wedding, party)
  const yes = events.filter(
    (event) => replyFor(guest, event.id) === 'attending',
  )
  const no = events.filter((event) => replyFor(guest, event.id) === 'declined')
  if (yes.length > 0 && no.length === 0) return 'Attending'
  if (yes.length > 0) return 'Attending part of the day'
  if (no.length > 0) return "Can't make it"
  return 'No reply yet'
}

function guestLine(
  wedding: RsvpWedding,
  party: RsvpParty,
  guest: RsvpGuest,
): string {
  const bits = [replyWord(wedding, party, guest)]
  if (guest.meal) bits.push(guest.meal)
  const dietary = [...guest.dietary, guest.dietaryNote]
    .map((item) => item.trim())
    .filter((item) => item !== '')
  if (dietary.length > 0) bits.push(dietary.join(', '))
  return bits.join(' · ')
}

type Block =
  | { t: 'eyebrow'; text: string }
  | { t: 'names'; text: string }
  | { t: 'line'; text: string }
  | { t: 'note'; text: string }
  | { t: 'divider' }
  | { t: 'button'; label: string; href: string }
  | { t: 'code'; text: string }
  | { t: 'guest'; name: string; detail: string }
  | { t: 'row'; label: string; value: string }
  | { t: 'space' }
  | { t: 'heading'; text: string }
  | {
      t: 'photo'
      url: string
      alt: string
      width: number
      height: number
    }

/**
 * The couple's photo sits at the top of the card when they have one. It is the
 * whole picture, scaled to the card at the proportions they uploaded, so it is
 * never stretched or trimmed — in any of the letters and every template.
 */
export function photoBlock(wedding: RsvpWedding): Block[] {
  const photo = wedding.photo
  if (!photo) return []
  const url = photoPath(wedding.slug, photo)
  if (!url) return []
  const box = emailPhotoBox(photo.width, photo.height)
  return [
    {
      t: 'photo',
      url: `https://${SITE_HOST}${url}`,
      alt: `${coupleTitle(wedding)} photo`,
      width: box.width,
      height: box.height,
    },
  ]
}

function dividerFor(skin: RsvpSkin): string {
  switch (skin.divider) {
    case 'hairline':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:30px 0;"><div style="border-top:1px solid ${skin.accent};font-size:0;line-height:0;">&nbsp;</div></td></tr></table>`
    case 'floral':
      return `<div style="margin:28px auto 26px;width:220px;font-size:15px;letter-spacing:0.42em;color:${skin.accent};">&#8212;&#10047;&#8212;</div>`
    case 'deckle':
      return `<div style="margin:30px 0 26px;border-top:2px dashed ${skin.hairline};font-size:0;line-height:0;">&nbsp;</div>`
    case 'gold-rule':
      return `<div style="margin:30px auto 10px;width:120px;border-top:1px solid ${skin.accent};font-size:0;line-height:0;">&nbsp;</div><div style="font-size:11px;line-height:1;color:${skin.accent};">&#9670;</div>`
    default:
      return `<div style="margin:28px auto 24px;width:64px;border-top:1px solid ${skin.hairline};"><div style="position:relative;top:-9px;font-size:12px;color:${skin.accent};">&#10022;</div></div>`
  }
}

function renderBlock(block: Block, skin: RsvpSkin): string {
  switch (block.t) {
    case 'eyebrow':
      return `<p style="margin:0 0 18px;font-family:${skin.displayFont};font-size:12px;letter-spacing:${skin.labelLetter};text-transform:${skin.labelTransform};font-style:${skin.labelStyle};color:${skin.accent};">${esc(block.text)}</p>`
    case 'heading':
      return `<p style="margin:0 0 14px;font-family:${skin.displayFont};font-weight:${skin.headingWeight};font-size:20px;color:${skin.ink};">${esc(block.text)}</p>`
    case 'names':
      return `<p style="margin:0;font-family:${skin.displayFont};font-weight:${skin.nameWeight};font-style:${skin.scriptNames ? 'italic' : 'normal'};font-size:${skin.nameSize};line-height:1.3;color:${skin.ink};">${esc(block.text)}</p>`
    case 'line':
      return `<p style="margin:14px 0 0;font-family:${skin.bodyFont};font-size:16px;line-height:1.7;color:${skin.body};">${block.text}</p>`
    case 'note':
      return `<p style="margin:18px 0 0;font-family:${skin.bodyFont};font-size:15px;font-style:italic;line-height:1.6;color:${skin.quiet};">${esc(block.text)}</p>`
    case 'divider':
      return dividerFor(skin)
    case 'button':
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto 0;"><tr><td bgcolor="${skin.button.bg}" style="border-radius:${skin.button.radius};border:${skin.button.border};"><a href="${esc(block.href)}" style="display:inline-block;padding:14px 40px;font-family:${skin.displayFont};font-size:16px;letter-spacing:0.04em;color:${skin.button.fg};text-decoration:none;border-radius:${skin.button.radius};">${esc(block.label)}</a></td></tr></table>`
    case 'code':
      return `<p style="margin:22px 0 0;font-family:'Courier New',Courier,monospace;font-size:13px;letter-spacing:0.14em;color:${skin.quiet};">${esc(block.text)}</p>`
    case 'guest':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;text-align:left;"><tr><td style="padding:13px 0;border-top:1px solid ${skin.hairline};"><p style="margin:0;font-family:${skin.displayFont};font-size:16px;color:${skin.ink};">${esc(block.name)}</p><p style="margin:4px 0 0;font-family:${skin.bodyFont};font-size:14px;line-height:1.6;color:${skin.quiet};">${esc(block.detail)}</p></td></tr></table>`
    case 'row':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="text-align:left;"><tr><td style="padding:9px 0;border-top:1px solid ${skin.hairline};font-family:${skin.bodyFont};font-size:15px;color:${skin.body};">${esc(block.label)}</td><td style="padding:9px 0;border-top:1px solid ${skin.hairline};font-family:${skin.bodyFont};font-size:15px;color:${skin.ink};text-align:right;">${esc(block.value)}</td></tr></table>`
    case 'space':
      return `<div style="height:14px;line-height:14px;">&nbsp;</div>`
    case 'photo':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 30px;"><tr><td align="center"><img src="${esc(block.url)}" alt="${esc(block.alt)}" width="${block.width}" height="${block.height}" style="display:block;width:${block.width}px;max-width:100%;height:auto;border:0;"><div style="height:30px;line-height:30px;">&nbsp;</div></td></tr></table>`
  }
}

function layout(input: {
  title: string
  preheader: string
  skin: RsvpSkin
  blocks: Block[]
  footerNote?: string
}): string {
  const skin = input.skin
  const body = input.blocks.map((block) => renderBlock(block, skin)).join('\n')
  const inner = skin.innerRule
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border:${skin.innerRule};border-radius:${skin.cardRadius};padding:34px 26px;">${body}</td></tr></table>`
    : body
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<title>${esc(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${skin.backdrop};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${skin.backdrop};">
<tr><td align="center" style="padding:30px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;">
<tr><td style="background:${skin.card};border:${skin.cardBorder};border-radius:${skin.cardRadius};padding:52px 44px 46px;font-family:${skin.bodyFont};text-align:center;${skin.texture}">
${inner}
</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;">
<tr><td align="center" style="padding:22px 12px 8px;">
<img src="${LOGO_URL}" width="72" alt="DJ Piper P" style="display:block;margin:0 auto 10px;width:72px;height:auto;border:0;">
<p style="margin:0;font-family:${skin.bodyFont};font-size:12px;letter-spacing:0.08em;color:${skin.footerInk};">${esc(input.footerNote ?? `RSVP by DJ Piper P · ${SITE_HOST}`)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function addressLines(wedding: RsvpWedding): string[] {
  const rows: string[] = []
  const date = formalDate(wedding.eventDate)
  if (date) rows.push(date)
  const time = ceremonyTime(wedding)
  if (time) rows.push(time)
  const { name, town } = venueParts(wedding)
  if (name || town) rows.push([name, town].filter(Boolean).join(', '))
  return rows
}

// --- the invitation card --------------------------------------------------

export function invitationEmail(
  wedding: RsvpWedding,
  party: RsvpParty,
  url: string,
): RsvpEmail {
  const skin = skinOf(wedding)
  const title = coupleTitle(wedding)
  const date = formalDate(wedding.eventDate)
  const time = ceremonyTime(wedding)
  const { name, town } = venueParts(wedding)
  const deadline = shortMonthDay(wedding.deadline)
  const forLine = partyNames(party)
  const blocks: Block[] = [
    ...photoBlock(wedding),
    { t: 'eyebrow', text: 'Together with their families' },
    { t: 'names', text: title },
    { t: 'line', text: 'request the pleasure of your company' },
  ]
  if (date) blocks.push({ t: 'line', text: esc(date) })
  if (time) blocks.push({ t: 'line', text: esc(time) })
  if (name || town)
    blocks.push({
      t: 'line',
      text: esc([name, town].filter(Boolean).join(', ')),
    })
  blocks.push({ t: 'divider' })
  if (deadline) blocks.push({ t: 'note', text: `Kindly reply by ${deadline}` })
  blocks.push({ t: 'button', label: 'RSVP', href: url })
  if (wedding.accessMode === 'code' && wedding.inviteCode)
    blocks.push({ t: 'code', text: `Invitation code ${wedding.inviteCode}` })
  blocks.push({ t: 'code', text: `For: ${forLine}` })
  return {
    kind: 'invitation',
    subject:
      `You're invited · ${title} · ${shortDate(wedding.eventDate)}`.trim(),
    text: invitationText(wedding, forLine, deadline, url),
    html: layout({
      title: `You're invited · ${title}`,
      preheader: `${title} · ${date}`,
      skin,
      blocks,
    }),
  }
}

function invitationText(
  wedding: RsvpWedding,
  forLine: string,
  deadline: string,
  url: string,
): string {
  const date = formalDate(wedding.eventDate)
  const time = ceremonyTime(wedding)
  const { name, town } = venueParts(wedding)
  return [
    'Together with their families',
    coupleTitle(wedding),
    'request the pleasure of your company',
    '',
    date,
    time,
    [name, town].filter(Boolean).join(', '),
    '',
    deadline ? `Kindly reply by ${deadline}.` : '',
    `RSVP: ${url}`,
    wedding.accessMode === 'code' && wedding.inviteCode
      ? `Invitation code ${wedding.inviteCode}`
      : '',
    `For: ${forLine}`,
    '',
    `RSVP by DJ Piper P · ${SITE_HOST}`,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

// --- confirmation ---------------------------------------------------------

export function confirmationEmail(
  wedding: RsvpWedding,
  party: RsvpParty,
  editUrl: string,
): RsvpEmail {
  const skin = skinOf(wedding)
  const title = coupleTitle(wedding)
  const lead = party.guests.find((guest) => !guest.isPlusOne) ?? party.guests[0]
  const guests = party.guests.map((guest) => ({
    name: guestFullName(guest),
    detail: guestLine(wedding, party, guest),
  }))
  const blocks: Block[] = [
    ...photoBlock(wedding),
    { t: 'eyebrow', text: 'Your RSVP' },
    { t: 'heading', text: `Thank you, ${lead.firstName || 'there'}!` },
    {
      t: 'line',
      text: `Here is what we have for <strong>${esc(title)}</strong>.`,
    },
    { t: 'space' },
    ...guests.map((guest): Block => ({ t: 'guest', ...guest })),
    { t: 'divider' },
    ...addressLines(wedding).map((text): Block => ({
      t: 'line',
      text: esc(text),
    })),
    {
      t: 'note',
      text: 'Changed your mind? Reply again with the button below.',
    },
    { t: 'button', label: 'Change your reply', href: editUrl },
  ]
  if (party.note) blocks.push({ t: 'note', text: `Your note: ${party.note}` })
  return {
    kind: 'confirmation',
    subject: `Your RSVP for ${title} is in`,
    text: confirmationText(wedding, party, lead.firstName, editUrl),
    html: layout({
      title: `Your RSVP for ${title} is in`,
      preheader: `Thank you, ${lead.firstName || 'there'}!`,
      skin,
      blocks,
    }),
  }
}

function confirmationText(
  wedding: RsvpWedding,
  party: RsvpParty,
  firstName: string,
  editUrl: string,
): string {
  const title = coupleTitle(wedding)
  const lines = party.guests.map((guest) => {
    const detail = guestLine(wedding, party, guest)
    return `${guestFullName(guest)} — ${detail}`
  })
  return [
    `Thank you, ${firstName || 'there'}!`,
    '',
    `Here is what we have for ${title}:`,
    ...lines,
    '',
    ...addressLines(wedding),
    party.note ? `Your note: ${party.note}` : '',
    '',
    `Change your reply: ${editUrl}`,
    `This private link works until ${shortMonthDay(wedding.deadline) || 'the deadline'}.`,
    '',
    `RSVP by DJ Piper P · ${SITE_HOST}`,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

// --- reminder -------------------------------------------------------------

export function reminderEmail(
  wedding: RsvpWedding,
  party: RsvpParty,
  url: string,
): RsvpEmail {
  const skin = skinOf(wedding)
  const title = coupleTitle(wedding)
  const deadline = shortMonthDay(wedding.deadline)
  const blocks: Block[] = [
    ...photoBlock(wedding),
    { t: 'eyebrow', text: 'A gentle reminder' },
    { t: 'names', text: title },
    { t: 'line', text: 'are still hoping to hear from you' },
    { t: 'divider' },
    ...addressLines(wedding).map((text): Block => ({
      t: 'line',
      text: esc(text),
    })),
    {
      t: 'note',
      text: deadline
        ? `Kindly reply by ${deadline}`
        : 'Kindly reply when you can',
    },
    { t: 'button', label: 'RSVP', href: url },
    { t: 'code', text: `For: ${partyNames(party)}` },
  ]
  return {
    kind: 'reminder',
    subject: `A gentle reminder · RSVP for ${title} by ${deadline || 'the deadline'}`,
    text: [
      `Dear ${party.name},`,
      '',
      `${title} are still hoping to hear from you.`,
      '',
      `Please reply by ${deadline || 'the deadline'}: ${url}`,
      '',
      ...addressLines(wedding),
      '',
      `RSVP by DJ Piper P · ${SITE_HOST}`,
    ].join('\n'),
    html: layout({
      title: `A gentle reminder · ${title}`,
      preheader: deadline ? `Kindly reply by ${deadline}` : 'Kindly reply',
      skin,
      blocks,
    }),
  }
}

// --- reply notice to the couple ------------------------------------------

export function replyNoticeEmail(
  wedding: RsvpWedding,
  party: RsvpParty,
  stats: OverviewStats,
  dashboardUrl: string,
): RsvpEmail {
  const skin = skinOf(wedding)
  const title = coupleTitle(wedding)
  const guests = party.guests.map((guest) => ({
    name: guestFullName(guest),
    detail: guestLine(wedding, party, guest),
  }))
  const meals = stats.meals
    .map((meal) => `${meal.label} × ${meal.count}`)
    .join(' · ')
  const blocks: Block[] = [
    { t: 'eyebrow', text: 'A reply came in' },
    { t: 'heading', text: `${party.name} replied` },
    { t: 'line', text: `for <strong>${esc(title)}</strong>` },
    { t: 'space' },
    ...guests.map((guest): Block => ({ t: 'guest', ...guest })),
  ]
  if (party.note) blocks.push({ t: 'note', text: `Their note: ${party.note}` })
  blocks.push(
    { t: 'divider' },
    { t: 'heading', text: 'Running totals' },
    { t: 'row', label: 'Attending', value: String(stats.attending) },
    { t: 'row', label: "Can't make it", value: String(stats.declined) },
    { t: 'row', label: 'Still waiting', value: String(stats.waitingGuests) },
  )
  if (meals) blocks.push({ t: 'row', label: 'Meals', value: meals })
  blocks.push({ t: 'button', label: 'Open the dashboard', href: dashboardUrl })
  return {
    kind: 'reply-notice',
    subject: `${party.name} replied · ${title}`,
    text: [
      `${party.name} replied for ${title}.`,
      '',
      ...guests.map((guest) => `${guest.name} — ${guest.detail}`),
      party.note ? `Their note: ${party.note}` : '',
      '',
      `Attending: ${stats.attending}`,
      `Can't make it: ${stats.declined}`,
      `Still waiting: ${stats.waitingGuests}`,
      meals ? `Meals: ${meals}` : '',
      '',
      `Dashboard: ${dashboardUrl}`,
      '',
      `RSVP by DJ Piper P · ${SITE_HOST}`,
    ]
      .filter((line) => line !== '')
      .join('\n'),
    html: layout({
      title: `${party.name} replied · ${title}`,
      preheader: `${stats.attending} attending · ${stats.declined} can't make it`,
      skin,
      blocks,
    }),
  }
}

// --- welcome / receipt ----------------------------------------------------

export function welcomeEmail(
  wedding: RsvpWedding,
  input: { amountLabel: string; dashboardUrl: string; guestUrl: string },
): RsvpEmail {
  const skin = skinOf(wedding)
  const title = coupleTitle(wedding)
  const { name, town } = venueParts(wedding)
  const blocks: Block[] = [
    ...photoBlock(wedding),
    { t: 'eyebrow', text: 'Your RSVP page is live' },
    { t: 'names', text: title },
    { t: 'line', text: 'Thank you — your RSVP page is open.' },
    { t: 'row', label: 'Paid', value: input.amountLabel },
    { t: 'space' },
    { t: 'heading', text: "What's next" },
    {
      t: 'line',
      text: 'Add your guest list, then share the link. Guests reply on their own page.',
    },
  ]
  if (name || town)
    blocks.push({
      t: 'line',
      text: esc([name, town].filter(Boolean).join(', ')),
    })
  blocks.push(
    { t: 'button', label: 'Open the dashboard', href: input.dashboardUrl },
    { t: 'code', text: `Guest link  ${input.guestUrl}` },
  )
  return {
    kind: 'welcome',
    subject: `Your RSVP page is live · ${title}`,
    text: [
      `Thank you — your RSVP page for ${title} is live.`,
      '',
      `Paid: ${input.amountLabel}`,
      '',
      "What's next:",
      'Add your guest list, then share the link. Guests reply on their own page.',
      '',
      `Dashboard: ${input.dashboardUrl}`,
      `Guest link: ${input.guestUrl}`,
      '',
      `RSVP by DJ Piper P · ${SITE_HOST}`,
    ].join('\n'),
    html: layout({
      title: `Your RSVP page is live · ${title}`,
      preheader: `Paid ${input.amountLabel}`,
      skin,
      blocks,
    }),
  }
}

// --- deadline summary to the couple ---------------------------------------

export function deadlineSummaryEmail(
  wedding: RsvpWedding,
  stats: OverviewStats,
  catererCsv: string,
): RsvpEmail {
  const skin = skinOf(wedding)
  const title = coupleTitle(wedding)
  const waiting = wedding.parties.filter(
    (party) => party.email.includes('@') && !party.lastRepliedAt,
  )
  const dietary: { name: string; note: string }[] = []
  for (const party of wedding.parties) {
    for (const guest of party.guests) {
      const parts = [...guest.dietary, guest.dietaryNote]
        .map((item) => item.trim())
        .filter((item) => item !== '')
      if (parts.length === 0) continue
      dietary.push({ name: guestFullName(guest), note: parts.join(', ') })
    }
  }
  const meals = stats.meals
    .map((meal) => `${meal.label} × ${meal.count}`)
    .join(' · ')
  const blocks: Block[] = [
    { t: 'eyebrow', text: 'RSVP deadline today' },
    { t: 'names', text: title },
    { t: 'heading', text: 'Final numbers' },
    { t: 'row', label: 'Attending', value: String(stats.attending) },
    { t: 'row', label: "Can't make it", value: String(stats.declined) },
    { t: 'row', label: 'Still waiting', value: String(stats.waitingGuests) },
  ]
  if (meals) blocks.push({ t: 'row', label: 'Meals', value: meals })
  blocks.push({ t: 'divider' }, { t: 'heading', text: 'Dietary notes' })
  if (dietary.length === 0) {
    blocks.push({ t: 'line', text: 'No dietary notes were left.' })
  } else {
    for (const note of dietary)
      blocks.push({ t: 'guest', name: note.name, detail: note.note })
  }
  blocks.push({ t: 'divider' }, { t: 'heading', text: 'Still waiting to hear' })
  if (waiting.length === 0) {
    blocks.push({ t: 'line', text: 'Everyone has replied.' })
  } else {
    for (const party of waiting)
      blocks.push({ t: 'guest', name: party.name, detail: party.email })
  }
  blocks.push({ t: 'note', text: 'The caterer report is attached as a CSV.' })
  return {
    kind: 'deadline-summary',
    subject: `RSVP deadline today · ${title}`,
    text: [
      `RSVP deadline today for ${title}.`,
      '',
      `Attending: ${stats.attending}`,
      `Can't make it: ${stats.declined}`,
      `Still waiting: ${stats.waitingGuests}`,
      meals ? `Meals: ${meals}` : '',
      '',
      'Dietary notes:',
      ...(dietary.length === 0
        ? ['  None left.']
        : dietary.map((note) => `  ${note.name}: ${note.note}`)),
      '',
      'Still waiting to hear:',
      ...(waiting.length === 0
        ? ['  Everyone has replied.']
        : waiting.map((party) => `  ${party.name} <${party.email}>`)),
      '',
      'The caterer report is attached as a CSV.',
      '',
      `RSVP by DJ Piper P · ${SITE_HOST}`,
    ]
      .filter((line) => line !== '')
      .join('\n'),
    html: layout({
      title: `RSVP deadline today · ${title}`,
      preheader: `${stats.attending} attending`,
      skin,
      blocks,
    }),
    attachments: [
      {
        filename: `caterer-report-${wedding.eventDate || 'rsvp'}.csv`,
        content: catererCsv,
        contentType: 'text/csv; charset=utf-8',
      },
    ],
  }
}

// --- notices to Piper -----------------------------------------------------

function piperFooter(): string {
  return `Sent by the RSVP desk · ${SITE_HOST}`
}

export function piperQuestionEmail(question: {
  rsvpId: string
  couple: string
  text: string
  askedAt: string
}): RsvpEmail {
  const skin = templateFor('ivory').skin
  return {
    kind: 'piper-question',
    subject: `Question from ${question.couple}`,
    text: [
      `${question.couple} asked a question on their RSVP.`,
      '',
      `RSVP: ${question.rsvpId}`,
      `Time: ${question.askedAt}`,
      `Reply from the desk: https://${SITE_HOST}/desk/questions`,
      '',
      question.text,
      '',
      piperFooter(),
    ].join('\n'),
    html: layout({
      title: `Question from ${question.couple}`,
      preheader: question.text.slice(0, 80),
      skin,
      footerNote: piperFooter(),
      blocks: [
        { t: 'eyebrow', text: 'RSVP question' },
        { t: 'names', text: question.couple },
        { t: 'line', text: esc(question.text) },
        { t: 'divider' },
        { t: 'row', label: 'RSVP', value: question.rsvpId },
        {
          t: 'row',
          label: 'Asked',
          value: question.askedAt.slice(0, 16).replace('T', ' '),
        },
        {
          t: 'button',
          label: 'Open the desk',
          href: `https://${SITE_HOST}/desk/questions`,
        },
      ],
    }),
  }
}

export function piperSignupEmail(wedding: RsvpWedding): RsvpEmail {
  const skin = skinOf(wedding)
  const title = coupleTitle(wedding)
  const price = wedding.priceKind === 'piper' ? '$20' : '$30'
  return {
    kind: 'piper-signup',
    subject: `New RSVP signup · ${title}`,
    text: [
      `${title} started an RSVP page.`,
      '',
      `RSVP: ${wedding.slug}`,
      `Email: ${wedding.email}`,
      `Date: ${wedding.eventDate}`,
      `Price: ${price}`,
      `Live: ${wedding.paid ? 'yes' : 'not yet'}`,
      '',
      `Desk: https://${SITE_HOST}/desk/rsvp`,
      '',
      piperFooter(),
    ].join('\n'),
    html: layout({
      title: `New RSVP signup · ${title}`,
      preheader: `${wedding.email} · ${wedding.eventDate}`,
      skin,
      footerNote: piperFooter(),
      blocks: [
        { t: 'eyebrow', text: 'New RSVP signup' },
        { t: 'names', text: title },
        { t: 'row', label: 'Email', value: wedding.email },
        { t: 'row', label: 'Date', value: wedding.eventDate },
        { t: 'row', label: 'Price', value: price },
        {
          t: 'button',
          label: 'Open the desk',
          href: `https://${SITE_HOST}/desk/rsvp`,
        },
      ],
    }),
  }
}

export function piperPaymentEmail(
  wedding: RsvpWedding,
  amountLabel: string,
): RsvpEmail {
  const skin = skinOf(wedding)
  const title = coupleTitle(wedding)
  return {
    kind: 'piper-payment',
    subject: `RSVP paid · ${title}`,
    text: [
      `${title} paid for their RSVP page.`,
      '',
      `RSVP: ${wedding.slug}`,
      `Amount: ${amountLabel}`,
      `Email: ${wedding.email}`,
      'The guest link is on.',
      '',
      `Desk: https://${SITE_HOST}/desk/rsvp`,
      '',
      piperFooter(),
    ].join('\n'),
    html: layout({
      title: `RSVP paid · ${title}`,
      preheader: `${amountLabel} received`,
      skin,
      footerNote: piperFooter(),
      blocks: [
        { t: 'eyebrow', text: 'RSVP payment' },
        { t: 'names', text: title },
        { t: 'row', label: 'Amount', value: amountLabel },
        { t: 'row', label: 'Email', value: wedding.email },
        { t: 'line', text: 'The guest link is on.' },
        {
          t: 'button',
          label: 'Open the desk',
          href: `https://${SITE_HOST}/desk/rsvp`,
        },
      ],
    }),
  }
}

// --- sign-in link ---------------------------------------------------------

export function signInEmail(url: string): RsvpEmail {
  const skin = templateFor('ivory').skin
  return {
    kind: 'sign-in',
    subject: 'Your Piper RSVP sign-in link',
    text: [
      'Here is your one-time sign-in link. It works for 24 hours.',
      '',
      url,
      '',
      'If you did not ask for this, you can ignore it.',
      '',
      `RSVP by DJ Piper P · ${SITE_HOST}`,
    ].join('\n'),
    html: layout({
      title: 'Your Piper RSVP sign-in link',
      preheader: 'Your one-time sign-in link',
      skin,
      blocks: [
        { t: 'eyebrow', text: 'Sign in' },
        { t: 'heading', text: 'Your sign-in link' },
        {
          t: 'line',
          text: 'This one-time link opens your RSVP dashboard. It works for 24 hours.',
        },
        { t: 'divider' },
        { t: 'button', label: 'Open my RSVP', href: url },
        { t: 'note', text: 'If you did not ask for this, you can ignore it.' },
      ],
    }),
  }
}
