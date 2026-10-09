import { randomBytes } from 'node:crypto'
import { query } from '../db.server.ts'
import {
  assertBookableDate,
  assertBookableNames,
  cancelBooking,
  countedCents,
  dateIsTaken,
  figuresFor,
  invoiceBalance,
  markInvoiceSent,
  CUSTOM_WEDDINGS,
  matchCustom,
  recordMoney,
  releaseBooking,
  SAVED_WEDDINGS,
  savedWeddingNote,
  voidInvoice,
  type BookingState,
  type InvoiceState,
} from './booking-rules.ts'
import { longDate } from './dates.ts'
import { isPackageId, packageName, type PackageId } from './defaults.ts'
import {
  parsePlanning,
  planningFromUnknown,
  type Planning,
  type PlanningSeed,
} from './planning.ts'
import { askLegacyDate } from '../legacy-book.server.ts'
import { holdLastDay, isBlockedDate } from '../piper/rules.ts'

export type BotRole = 'reader' | 'writer' | 'ceo'

export type InvoiceView = {
  id: number
  slug: string
  status: InvoiceState['status']
  totalCents: number
  depositCents: number
  receivedCents: number
  balanceCents: number
}

export type BookingView = {
  id: number
  slug: string
  partnerOne: string
  partnerTwo: string
  email: string
  phone: string
  eventDate: string
  stagDate: string | null
  packageId: PackageId
  packageName: string
  withStag: boolean
  uplights: number
  venueKm: number[]
  venueName: string
  venueStreet: string
  venueTwoName: string
  venueTwoStreet: string
  sample: boolean
  status: BookingState['status']
  totalCents: number
  depositCents: number
  holdStartedOn: string | null
  holdLastDay: string | null
  stagReleased: boolean
  notes: string
  invoice: InvoiceView | null
}

export type LeadView = {
  id: number
  partnerOne: string
  partnerTwo: string
  email: string
  phone: string
  eventDate: string | null
  packageId: string
  packageName: string
  message: string
}

export type PaymentView = {
  id: number
  invoiceId: number
  bookingId: number
  names: string
  cents: number
  note: string
}

type BookingRow = {
  id: number
  slug: string
  partner_one: string
  partner_two: string
  email: string
  phone: string
  event_date: string
  stag_date: string | null
  package_id: string
  with_stag: unknown
  uplights: unknown
  venue_km: unknown
  venue_name: string
  venue_street: string
  venue_two_name: string
  venue_two_street: string
  sample: unknown
  status: string
  total_cents: unknown
  deposit_cents: unknown
  hold_started_on: string | null
  stag_released: unknown
  notes: string
}

type InvoiceRow = {
  id: number
  slug: string
  booking_id: number
  status: string
  total_cents: unknown
  deposit_cents: unknown
  received_cents: unknown
}

const STATUSES = new Set(['open', 'hold', 'booked', 'cancelled', 'released'])
const INVOICE_STATUSES = new Set(['draft', 'sent', 'void'])

function text(value: string, max: number, label: string): string {
  const trimmed = value.trim().slice(0, max)
  if (!trimmed) throw new Error(`${label} is required.`)
  return trimmed
}

function optional(value: string, max: number): string {
  return value.trim().slice(0, max)
}

function flag(value: unknown): boolean {
  return value === true || value === 't' || value === 'true' || value === 1
}

function whole(value: unknown, label: string): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(number)) throw new Error(`${label} is a whole number.`)
  return number
}

function asPackage(value: string): PackageId {
  if (!isPackageId(value)) throw new Error('Choose a package.')
  return value
}

function asStatus(value: string): BookingState['status'] {
  if (!STATUSES.has(value)) throw new Error('That status is not on the book.')
  return value as BookingState['status']
}

function asInvoiceStatus(value: string): InvoiceState['status'] {
  if (!INVOICE_STATUSES.has(value))
    throw new Error('That invoice status is not on the book.')
  return value as InvoiceState['status']
}

export function parseKm(value: unknown): number[] {
  const parsed =
    typeof value === 'string' ? (JSON.parse(value) as unknown) : value
  if (!Array.isArray(parsed)) throw new Error('Travel is a list of kilometres.')
  if (parsed.length > 2) throw new Error('Two venues maximum.')
  return parsed.map((item) => {
    const km = typeof item === 'number' ? item : Number(item)
    if (!Number.isFinite(km) || km < 0)
      throw new Error('Distance is a number of kilometres.')
    return km
  })
}

function slug(): string {
  return randomBytes(9).toString('base64url')
}

function toState(row: BookingRow): BookingState {
  return {
    partnerOne: row.partner_one,
    partnerTwo: row.partner_two,
    eventDate: row.event_date,
    stagDate: row.stag_date,
    packageId: asPackage(row.package_id),
    withStag: flag(row.with_stag),
    uplights: whole(row.uplights, 'Uplight count'),
    venueKm: parseKm(row.venue_km),
    venueName: row.venue_name,
    venueStreet: row.venue_street,
    sample: flag(row.sample),
    status: asStatus(row.status),
    totalCents: whole(row.total_cents, 'Total'),
    depositCents: whole(row.deposit_cents, 'Deposit'),
    holdStartedOn: row.hold_started_on,
    stagReleased: flag(row.stag_released),
  }
}

function toInvoice(row: InvoiceRow): InvoiceState {
  return {
    status: asInvoiceStatus(row.status),
    totalCents: whole(row.total_cents, 'Total'),
    depositCents: whole(row.deposit_cents, 'Deposit'),
    receivedCents: whole(row.received_cents, 'Received'),
  }
}

function toInvoiceView(row: InvoiceRow): InvoiceView {
  const invoice = toInvoice(row)
  return {
    id: row.id,
    slug: row.slug,
    status: invoice.status,
    totalCents: invoice.totalCents,
    depositCents: invoice.depositCents,
    receivedCents: invoice.receivedCents,
    balanceCents: invoiceBalance(invoice),
  }
}

function toView(row: BookingRow, invoice: InvoiceRow | null): BookingView {
  const state = toState(row)
  return {
    id: row.id,
    slug: row.slug,
    partnerOne: state.partnerOne,
    partnerTwo: state.partnerTwo,
    email: row.email,
    phone: row.phone,
    eventDate: state.eventDate,
    stagDate: state.stagDate,
    packageId: state.packageId,
    packageName: packageName(state.packageId),
    withStag: state.withStag,
    uplights: state.uplights,
    venueKm: state.venueKm,
    venueName: state.venueName,
    venueStreet: state.venueStreet,
    venueTwoName: row.venue_two_name,
    venueTwoStreet: row.venue_two_street,
    sample: state.sample,
    status: state.status,
    totalCents: state.totalCents,
    depositCents: state.depositCents,
    holdStartedOn: state.holdStartedOn,
    holdLastDay: state.holdStartedOn ? holdLastDay(state.holdStartedOn) : null,
    stagReleased: state.stagReleased,
    notes: row.notes,
    invoice: invoice ? toInvoiceView(invoice) : null,
  }
}

async function ensurePlanningColumn(): Promise<void> {
  try {
    await query('SELECT planning FROM bookings LIMIT 0')
  } catch {
    await query(
      `ALTER TABLE bookings ADD COLUMN planning text NOT NULL DEFAULT ''`,
    )
  }
}

async function bookingRows(): Promise<BookingRow[]> {
  await ensurePlanningColumn()
  return query<BookingRow>('SELECT * FROM bookings ORDER BY id DESC')
}

async function invoiceFor(bookingId: number): Promise<InvoiceRow | null> {
  const rows = await query<InvoiceRow>(
    'SELECT * FROM invoices WHERE booking_id = $1',
    [bookingId],
  )
  return rows[0] ?? null
}

async function bookingRow(id: number): Promise<BookingRow> {
  const rows = await query<BookingRow>('SELECT * FROM bookings WHERE id = $1', [
    id,
  ])
  const row = rows[0]
  if (!row) throw new Error('That booking is not on the book.')
  return row
}

async function states(): Promise<BookingState[]> {
  const rows = await bookingRows()
  return rows.map(toState)
}

async function dateTakenByOthers(
  day: string,
  exceptId: number | null,
): Promise<boolean> {
  const rows = await bookingRows()
  const others = rows.filter((row) => row.id !== exceptId).map(toState)
  return dateIsTaken(others, day)
}

function guardIdentity(
  partnerOne: string,
  partnerTwo: string,
  eventDate: string,
  stagDate: string | null,
) {
  assertBookableNames(partnerOne, partnerTwo)
  assertBookableDate(eventDate, stagDate)
  if (matchCustom(partnerOne, partnerTwo, eventDate)) {
    throw new Error('That wedding is already on the book.')
  }
}

export type BookingInput = {
  partnerOne: string
  partnerTwo: string
  email: string
  phone: string
  eventDate: string
  stagDate: string | null
  packageId: string
  withStag: boolean
  uplights: number
  venueKm: number[]
  venueName: string
  venueStreet: string
  venueTwoName: string
  venueTwoStreet: string
  sample: boolean
  notes: string
}

function normalize(input: BookingInput) {
  const partnerOne = text(input.partnerOne, 80, 'The first name')
  const partnerTwo = text(input.partnerTwo, 80, 'The second name')
  const packageId = asPackage(input.packageId)
  const withStag = packageId === 'full' && input.withStag
  if (input.withStag && packageId !== 'full') {
    throw new Error('A stag is added to the full wedding day.')
  }
  const stagDate = withStag && input.stagDate ? input.stagDate : null
  if (withStag && !stagDate) throw new Error('A stag needs its own date.')
  const eventDate = input.eventDate
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate))
    throw new Error('Choose a wedding date.')
  if (stagDate && !/^\d{4}-\d{2}-\d{2}$/.test(stagDate))
    throw new Error('Choose a stag date.')
  const venueKm = parseKm(input.venueKm)
  const uplights = input.uplights
  if (!Number.isInteger(uplights) || uplights < 0)
    throw new Error('Uplight count is a whole number.')
  return {
    partnerOne,
    partnerTwo,
    email: optional(input.email, 120),
    phone: optional(input.phone, 40),
    eventDate,
    stagDate,
    packageId,
    withStag,
    uplights,
    venueKm,
    venueName: optional(input.venueName, 160),
    venueStreet: optional(input.venueStreet, 160),
    venueTwoName: optional(input.venueTwoName, 160),
    venueTwoStreet: optional(input.venueTwoStreet, 160),
    sample: input.sample,
    notes: optional(input.notes, 2000),
  }
}

async function saveBooking(
  id: number,
  state: BookingState,
  invoice: InvoiceState | null,
) {
  await query(
    `UPDATE bookings SET
      status = $1, total_cents = $2, deposit_cents = $3, hold_started_on = $4, stag_released = $5
     WHERE id = $6`,
    [
      state.status,
      state.totalCents,
      state.depositCents,
      state.holdStartedOn,
      state.stagReleased,
      id,
    ],
  )
  if (!invoice) return
  await query(
    `UPDATE invoices SET status = $1, total_cents = $2, deposit_cents = $3, received_cents = $4
     WHERE booking_id = $5`,
    [
      invoice.status,
      invoice.totalCents,
      invoice.depositCents,
      invoice.receivedCents,
      id,
    ],
  )
}

async function ensureDateFree(
  eventDate: string,
  stagDate: string | null,
  stagReleased: boolean,
  exceptId: number | null,
) {
  if (await dateTakenByOthers(eventDate, exceptId))
    throw new Error('That wedding date is already held.')
  if (
    stagDate &&
    !stagReleased &&
    (await dateTakenByOthers(stagDate, exceptId))
  ) {
    throw new Error('That stag date is already held.')
  }
}

const SAVED_DEPOSIT_NOTE = 'Deposit cleared on the previous book.'

async function savedWeddingId(
  wedding: (typeof SAVED_WEDDINGS)[number],
): Promise<number | null> {
  const rows = await query<{ id: number }>(
    `SELECT id FROM bookings
     WHERE event_date = $1
       AND (
         (lower(partner_one) = lower($2) AND lower(partner_two) = lower($3))
         OR (lower(partner_one) = lower($3) AND lower(partner_two) = lower($2))
       )`,
    [wedding.date, wedding.partnerOne, wedding.partnerTwo],
  )
  const id = rows[0]?.id
  return id == null ? null : whole(id, 'Booking')
}

async function ensureSavedInvoice(
  bookingId: number,
  wedding: (typeof SAVED_WEDDINGS)[number],
): Promise<void> {
  const existing = await query<{ id: number }>(
    'SELECT id FROM invoices WHERE booking_id = $1',
    [bookingId],
  )
  let invoiceId = existing[0]?.id
  if (invoiceId == null) {
    const inserted = await query<{ id: number }>(
      `INSERT INTO invoices (slug, booking_id, status, total_cents, deposit_cents, received_cents)
       SELECT $1, $2, 'sent', $3, $4, $5
       WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE booking_id = $2)
       RETURNING id`,
      [
        slug(),
        bookingId,
        wedding.totalCents,
        wedding.depositClearedCents,
        wedding.depositClearedCents,
      ],
    )
    invoiceId = inserted[0]?.id
    if (invoiceId == null) {
      const again = await query<{ id: number }>(
        'SELECT id FROM invoices WHERE booking_id = $1',
        [bookingId],
      )
      invoiceId = again[0]?.id
    }
  }
  if (invoiceId == null) return
  await query(
    `INSERT INTO payments (invoice_id, cents, note)
     SELECT $1, $2, $3
     WHERE NOT EXISTS (
       SELECT 1 FROM payments WHERE invoice_id = $1 AND note = $3
     )`,
    [invoiceId, wedding.depositClearedCents, SAVED_DEPOSIT_NOTE],
  )
}

/** Copies the four booked weddings onto this book once. Later visits leave them as they are. */
export async function ensureSavedWeddings(): Promise<void> {
  for (const wedding of SAVED_WEDDINGS) {
    let id = await savedWeddingId(wedding)
    if (id == null) {
      const inserted = await query<{ id: number }>(
        `INSERT INTO bookings (
          slug, partner_one, partner_two, email, phone, event_date, stag_date, package_id, with_stag,
          uplights, venue_km, venue_name, venue_street, venue_two_name, venue_two_street, sample,
          status, total_cents, deposit_cents, hold_started_on, stag_released, notes
        )
        SELECT $1, $2, $3, '', '', $4, NULL, 'full', $9,
          0, '[]', $5, '', '', '', $10,
          'booked', $6, $7, NULL, $11, $8
        WHERE NOT EXISTS (
          SELECT 1 FROM bookings
          WHERE event_date = $4
            AND (
              (lower(partner_one) = lower($2) AND lower(partner_two) = lower($3))
              OR (lower(partner_one) = lower($3) AND lower(partner_two) = lower($2))
            )
        )
        RETURNING id`,
        [
          slug(),
          wedding.partnerOne,
          wedding.partnerTwo,
          wedding.date,
          wedding.venueName,
          wedding.totalCents,
          wedding.depositClearedCents,
          savedWeddingNote(wedding),
          false,
          false,
          false,
        ],
      )
      id = inserted[0]?.id ?? (await savedWeddingId(wedding))
    }
    if (id == null) continue
    await ensureSavedInvoice(id, wedding)
  }
}

export async function listBookings(): Promise<BookingView[]> {
  await ensureSavedWeddings()
  const rows = await bookingRows()
  const invoices = await query<InvoiceRow>('SELECT * FROM invoices')
  const byBooking = new Map(invoices.map((row) => [row.booking_id, row]))
  return rows.map((row) => toView(row, byBooking.get(row.id) ?? null))
}

export async function createBooking(input: BookingInput): Promise<BookingView> {
  const next = normalize(input)
  guardIdentity(next.partnerOne, next.partnerTwo, next.eventDate, next.stagDate)
  await ensureDateFree(next.eventDate, next.stagDate, false, null)
  const figures = figuresFor({
    ...next,
    venueName: next.venueName,
    venueStreet: next.venueStreet,
  })
  const bookingSlug = slug()
  const invoiceSlug = slug()
  const inserted = await query<{ id: number }>(
    `INSERT INTO bookings (
      slug, partner_one, partner_two, email, phone, event_date, stag_date, package_id, with_stag,
      uplights, venue_km, venue_name, venue_street, venue_two_name, venue_two_street, sample,
      status, total_cents, deposit_cents, hold_started_on, stag_released, notes
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'open',$17,$18,NULL,false,$19
    ) RETURNING id`,
    [
      bookingSlug,
      next.partnerOne,
      next.partnerTwo,
      next.email,
      next.phone,
      next.eventDate,
      next.stagDate,
      next.packageId,
      next.withStag,
      next.uplights,
      JSON.stringify(next.venueKm),
      next.venueName,
      next.venueStreet,
      next.venueTwoName,
      next.venueTwoStreet,
      next.sample,
      figures.totalCents,
      figures.depositCents,
      next.notes,
    ],
  )
  const id = inserted[0]?.id
  if (!id) throw new Error('That booking was not saved.')
  await query(
    `INSERT INTO invoices (slug, booking_id, status, total_cents, deposit_cents, received_cents)
     VALUES ($1, $2, 'draft', $3, $4, 0)`,
    [invoiceSlug, id, figures.totalCents, figures.depositCents],
  )
  const row = await bookingRow(id)
  return toView(row, await invoiceFor(id))
}

export type InquiryInput = {
  partnerOne: string
  partnerTwo: string
  email: string
  phone: string
  eventDate: string
  packageId: string
  withStag: boolean
  stagDate: string | null
  message: string
}

export async function createInquiry(
  input: InquiryInput,
): Promise<{ ok: true; unavailable: boolean } | { ok: false; error: string }> {
  try {
    const email = text(input.email, 120, 'Email')
    if (!email.includes('@')) throw new Error('Enter an email address.')
    const partnerOne = text(input.partnerOne, 80, 'The first name')
    const partnerTwo = text(input.partnerTwo, 80, 'The second name')
    guardIdentity(
      partnerOne,
      partnerTwo,
      input.eventDate,
      input.withStag ? input.stagDate : null,
    )
    const packageId = asPackage(input.packageId)
    if (input.withStag && packageId !== 'full') {
      throw new Error('A stag is added to the full wedding day.')
    }
    if (input.withStag && !input.stagDate)
      throw new Error('A stag needs its own date.')
    const message = optional(input.message, 2000)
    const stagDate = input.withStag ? input.stagDate : null
    const unavailable =
      (await dateTakenByOthers(input.eventDate, null)) ||
      (stagDate != null && (await dateTakenByOthers(stagDate, null)))
    if (!unavailable) {
      await createBooking({
        partnerOne,
        partnerTwo,
        email,
        phone: input.phone,
        eventDate: input.eventDate,
        stagDate,
        packageId,
        withStag: input.withStag,
        uplights: 0,
        venueKm: [],
        venueName: '',
        venueStreet: '',
        venueTwoName: '',
        venueTwoStreet: '',
        sample: false,
        notes: message,
      })
    }
    await query(
      `INSERT INTO leads (partner_one, partner_two, email, phone, event_date, package_id, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        partnerOne,
        partnerTwo,
        email,
        optional(input.phone, 40),
        input.eventDate,
        packageId,
        message,
      ],
    )
    return { ok: true, unavailable }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'That inquiry was not saved.',
    }
  }
}

export async function dateOpen(day: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Choose a date.')
  if (isBlockedDate(day, null)) return false
  if (CUSTOM_WEDDINGS.some((wedding) => wedding.date === day)) return false
  if (await dateTakenByOthers(day, null)) return false
  const legacy = await askLegacyDate(day)
  return legacy !== 'taken'
}

export type BookingPatch = {
  id: number
  partnerOne: string
  partnerTwo: string
  email: string
  phone: string
  eventDate: string
  stagDate: string | null
  packageId: string
  withStag: boolean
  uplights: number
  venueKm: number[]
  venueName: string
  venueStreet: string
  venueTwoName: string
  venueTwoStreet: string
  sample: boolean
  notes: string
}

export async function updateBooking(patch: BookingPatch): Promise<BookingView> {
  const current = await bookingRow(patch.id)
  const state = toState(current)
  const next = normalize(patch)
  const locked = matchCustom(
    state.partnerOne,
    state.partnerTwo,
    state.eventDate,
  )
  if (locked) {
    assertBookableNames(next.partnerOne, next.partnerTwo)
    assertBookableDate(next.eventDate, next.stagDate)
  } else {
    guardIdentity(
      next.partnerOne,
      next.partnerTwo,
      next.eventDate,
      next.stagDate,
    )
  }
  await ensureDateFree(
    next.eventDate,
    next.stagDate,
    state.stagReleased,
    current.id,
  )
  const figures = locked
    ? { totalCents: state.totalCents, depositCents: state.depositCents }
    : figuresFor({
        partnerOne: next.partnerOne,
        partnerTwo: next.partnerTwo,
        eventDate: next.eventDate,
        stagDate: next.stagDate,
        packageId: next.packageId,
        withStag: next.withStag,
        uplights: next.uplights,
        venueKm: next.venueKm,
        venueName: next.venueName,
        venueStreet: next.venueStreet,
        sample: next.sample,
      })
  await query(
    `UPDATE bookings SET
      partner_one = $1, partner_two = $2, email = $3, phone = $4, event_date = $5, stag_date = $6,
      package_id = $7, with_stag = $8, uplights = $9, venue_km = $10, venue_name = $11,
      venue_street = $12, venue_two_name = $13, venue_two_street = $14, sample = $15, notes = $16,
      total_cents = $17, deposit_cents = $18
     WHERE id = $19`,
    [
      next.partnerOne,
      next.partnerTwo,
      next.email,
      next.phone,
      next.eventDate,
      next.stagDate,
      next.packageId,
      next.withStag,
      next.uplights,
      JSON.stringify(next.venueKm),
      next.venueName,
      next.venueStreet,
      next.venueTwoName,
      next.venueTwoStreet,
      next.sample,
      next.notes,
      figures.totalCents,
      figures.depositCents,
      current.id,
    ],
  )
  const invoiceRow = await invoiceFor(current.id)
  if (invoiceRow && invoiceRow.status !== 'void') {
    const invoice = toInvoice(invoiceRow)
    const updated: InvoiceState = {
      ...invoice,
      totalCents: figures.totalCents,
      depositCents: figures.depositCents,
    }
    const refreshed = toState(await bookingRow(current.id))
    const transition = recordMoney(refreshed, updated, 0)
    await saveBooking(current.id, transition.booking, transition.invoice)
  }
  return toView(await bookingRow(current.id), await invoiceFor(current.id))
}

export async function setBookingStatus(
  id: number,
  action: 'release' | 'cancel' | 'release-stag',
): Promise<BookingView> {
  const row = await bookingRow(id)
  const state = toState(row)
  const invoiceRow = await invoiceFor(id)
  const invoice = invoiceRow ? toInvoice(invoiceRow) : emptyInvoice(state)
  if (action === 'release-stag') {
    await query('UPDATE bookings SET stag_released = true WHERE id = $1', [id])
  } else {
    const transition =
      action === 'release'
        ? releaseBooking(state, invoice)
        : cancelBooking(state, invoice)
    await saveBooking(
      id,
      transition.booking,
      invoiceRow ? transition.invoice : null,
    )
  }
  return toView(await bookingRow(id), await invoiceFor(id))
}

function emptyInvoice(state: BookingState): InvoiceState {
  return {
    status: 'draft',
    totalCents: state.totalCents,
    depositCents: state.depositCents,
    receivedCents: 0,
  }
}

export async function sendInvoice(
  bookingId: number,
): Promise<{ view: BookingView; newlyBooked: boolean }> {
  const row = await bookingRow(bookingId)
  const invoiceRow = await invoiceFor(bookingId)
  if (!invoiceRow) throw new Error('That booking has no invoice.')
  if (invoiceRow.status === 'void')
    throw new Error('A void invoice stays void.')
  const state = toState(row)
  const transition = markInvoiceSent(state, toInvoice(invoiceRow))
  const enteringHold =
    state.status === 'open' && transition.booking.status !== 'open'
  const enteringBooked = transition.newlyBooked
  if (enteringHold || enteringBooked) {
    await ensureDateFree(
      state.eventDate,
      state.stagDate,
      state.stagReleased,
      row.id,
    )
  }
  await saveBooking(bookingId, transition.booking, transition.invoice)
  return {
    view: toView(await bookingRow(bookingId), await invoiceFor(bookingId)),
    newlyBooked: transition.newlyBooked,
  }
}

export async function voidBookingInvoice(
  bookingId: number,
): Promise<BookingView> {
  const row = await bookingRow(bookingId)
  const invoiceRow = await invoiceFor(bookingId)
  if (!invoiceRow) throw new Error('That booking has no invoice.')
  const transition = voidInvoice(toState(row), toInvoice(invoiceRow))
  await saveBooking(bookingId, transition.booking, transition.invoice)
  return toView(await bookingRow(bookingId), await invoiceFor(bookingId))
}

export async function addPayment(
  bookingId: number,
  cents: number,
  note: string,
): Promise<{ view: BookingView; newlyBooked: boolean }> {
  if (!Number.isInteger(cents) || cents === 0)
    throw new Error('Enter an amount.')
  const row = await bookingRow(bookingId)
  const invoiceRow = await invoiceFor(bookingId)
  if (!invoiceRow) throw new Error('That booking has no invoice.')
  if (invoiceRow.status === 'void')
    throw new Error('A void invoice does not take a payment.')
  const before = toInvoice(invoiceRow)
  const transition = recordMoney(toState(row), before, cents)
  if (transition.newlyBooked) {
    const state = toState(row)
    await ensureDateFree(
      state.eventDate,
      state.stagDate,
      state.stagReleased,
      row.id,
    )
  }
  const applied = transition.invoice.receivedCents - before.receivedCents
  if (applied !== 0) {
    await query(
      'INSERT INTO payments (invoice_id, cents, note) VALUES ($1, $2, $3)',
      [invoiceRow.id, applied, optional(note, 200)],
    )
  }
  await saveBooking(bookingId, transition.booking, transition.invoice)
  return {
    view: toView(await bookingRow(bookingId), await invoiceFor(bookingId)),
    newlyBooked: transition.newlyBooked,
  }
}

export async function listLeads(): Promise<LeadView[]> {
  const rows = await query<{
    id: number
    partner_one: string
    partner_two: string
    email: string
    phone: string
    event_date: string | null
    package_id: string
    message: string
  }>('SELECT * FROM leads ORDER BY id DESC')
  return rows.map((row) => ({
    id: row.id,
    partnerOne: row.partner_one,
    partnerTwo: row.partner_two,
    email: row.email,
    phone: row.phone,
    eventDate: row.event_date,
    packageId: row.package_id,
    packageName: isPackageId(row.package_id)
      ? packageName(row.package_id)
      : row.package_id,
    message: row.message,
  }))
}

export async function listPayments(): Promise<PaymentView[]> {
  const rows = await query<{
    id: number
    invoice_id: number
    booking_id: number
    partner_one: string
    partner_two: string
    cents: unknown
    note: string
  }>(
    `SELECT payments.id, payments.invoice_id, invoices.booking_id, bookings.partner_one, bookings.partner_two,
            payments.cents, payments.note
     FROM payments
     JOIN invoices ON invoices.id = payments.invoice_id
     JOIN bookings ON bookings.id = invoices.booking_id
     ORDER BY payments.id DESC`,
  )
  return rows.map((row) => ({
    id: row.id,
    invoiceId: row.invoice_id,
    bookingId: row.booking_id,
    names: `${row.partner_one} and ${row.partner_two}`,
    cents: whole(row.cents, 'Payment'),
    note: row.note,
  }))
}

async function ensureSite(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS site (
      id integer PRIMARY KEY CHECK (id = 1),
      kind_words integer NOT NULL DEFAULT 0
    )`,
  )
  await query(
    'INSERT INTO site (id, kind_words) VALUES (1, 0) ON CONFLICT (id) DO NOTHING',
  )
}

/** The wedding page Kind Words section. Missing or unset means off. */
export async function kindWordsOn(): Promise<boolean> {
  await ensureSite()
  const rows = await query<{ kind_words: unknown }>(
    'SELECT kind_words FROM site WHERE id = 1',
  )
  return flag(rows[0]?.kind_words)
}

export async function setKindWords(on: boolean): Promise<boolean> {
  await ensureSite()
  await query('UPDATE site SET kind_words = $1 WHERE id = 1', [on ? 1 : 0])
  return kindWordsOn()
}

async function ensureReviews(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS reviews (
      id integer PRIMARY KEY,
      quote text NOT NULL,
      names text NOT NULL,
      when_label text NOT NULL DEFAULT ''
    )`,
  )
}

export type ReviewView = {
  id: number
  quote: string
  names: string
  when: string
}

function toReview(row: {
  id: number
  quote: string
  names: string
  when_label: string
}): ReviewView {
  return {
    id: whole(row.id, 'Review'),
    quote: row.quote,
    names: row.names,
    when: row.when_label,
  }
}

export async function listReviews(): Promise<ReviewView[]> {
  await ensureReviews()
  const rows = await query<{
    id: number
    quote: string
    names: string
    when_label: string
  }>('SELECT id, quote, names, when_label FROM reviews ORDER BY id')
  return rows.map(toReview)
}

/** Wedding page cards. Quotes stay off the public page while Kind Words is off. */
export async function homepageReviews(): Promise<ReviewView[]> {
  if (!(await kindWordsOn())) return []
  return listReviews()
}

export async function addReview(input: {
  quote: string
  names: string
  when: string
}): Promise<ReviewView> {
  await ensureReviews()
  const quote = input.quote.trim()
  const names = input.names.trim()
  const when = input.when.trim()
  if (!quote) throw new Error('The review is required.')
  if (!names) throw new Error('A name is required.')
  if (quote.length > 800) throw new Error('That review is too long.')
  if (names.length > 80) throw new Error('That name is too long.')
  if (when.length > 80) throw new Error('That line is too long.')
  const ids = await query<{ id: number }>(
    'SELECT COALESCE(MAX(id), 0) + 1 AS id FROM reviews',
  )
  const id = whole(ids[0]?.id, 'Review')
  await query(
    'INSERT INTO reviews (id, quote, names, when_label) VALUES ($1, $2, $3, $4)',
    [id, quote, names, when],
  )
  return { id, quote, names, when }
}

export async function removeReview(id: number): Promise<void> {
  if (!Number.isInteger(id) || id < 1)
    throw new Error('That review is not on the page.')
  await ensureReviews()
  await query('DELETE FROM reviews WHERE id = $1', [id])
}

export async function getTerms(): Promise<string> {
  const rows = await query<{ body: string }>(
    'SELECT body FROM terms WHERE id = 1',
  )
  const body = rows[0]?.body
  if (!body) throw new Error('The terms document is missing.')
  return body
}

export async function updateTerms(body: string): Promise<string> {
  const next = text(body, 20000, 'The terms')
  const rows = await query<{ body: string }>(
    'UPDATE terms SET body = $1 WHERE id = 1 RETURNING body',
    [next],
  )
  const saved = rows[0]?.body
  if (!saved) throw new Error('The terms document is missing.')
  return saved
}

export async function listQuestions(): Promise<
  { id: number; prompt: string }[]
> {
  return query<{ id: number; prompt: string }>(
    'SELECT id, prompt FROM questions ORDER BY sort, id',
  )
}

export async function addQuestion(prompt: string): Promise<void> {
  const next = text(prompt, 500, 'The question')
  await query('INSERT INTO questions (prompt, sort) VALUES ($1, $2)', [
    next,
    Date.now(),
  ])
}

export async function listMedia(): Promise<
  { id: number; title: string; url: string }[]
> {
  return query<{ id: number; title: string; url: string }>(
    'SELECT id, title, url FROM media ORDER BY id DESC',
  )
}

export async function addMedia(title: string, url: string): Promise<void> {
  const nextTitle = text(title, 120, 'A title')
  const nextUrl = text(url, 500, 'A link')
  await query('INSERT INTO media (title, url) VALUES ($1, $2)', [
    nextTitle,
    nextUrl,
  ])
}

const PARTNER_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp'])

async function ensurePartners(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS partners (
      id integer PRIMARY KEY,
      name text NOT NULL,
      href text NOT NULL,
      mime text NOT NULL,
      logo text NOT NULL
    )`,
  )
}

function partnerWebsite(value: string): string {
  const next = text(value, 300, 'A website')
  let url: URL
  try {
    url = new URL(next)
  } catch {
    throw new Error('Enter a full website address, starting with https://.')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Enter a full website address, starting with https://.')
  }
  return url.toString()
}

function partnerLogoData(value: string): { mime: string; logo: string } {
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(
      value.trim(),
    )
  if (!match) throw new Error('Use a PNG, JPEG, or WebP logo.')
  const mime = match[1] ?? ''
  const logo = (match[2] ?? '').replace(/\s/g, '')
  if (!PARTNER_MIMES.has(mime) || !logo) {
    throw new Error('Use a PNG, JPEG, or WebP logo.')
  }
  if (logo.length > 280_000)
    throw new Error('That logo is too large. Keep it under 200 KB.')
  return { mime, logo }
}

export type PartnerView = {
  id: number
  name: string
  href: string
  src: string
}

export async function listPartners(): Promise<PartnerView[]> {
  await ensurePartners()
  const rows = await query<{
    id: number
    name: string
    href: string
    mime: string
    logo: string
  }>('SELECT id, name, href, mime, logo FROM partners ORDER BY id')
  return rows.map((row) => ({
    id: whole(row.id, 'Partner'),
    name: row.name,
    href: row.href,
    src: `data:${row.mime};base64,${row.logo}`,
  }))
}

export async function partnerLogo(
  id: number,
): Promise<{ mime: string; logo: string } | null> {
  if (!Number.isInteger(id) || id < 1) return null
  await ensurePartners()
  const rows = await query<{ mime: string; logo: string }>(
    'SELECT mime, logo FROM partners WHERE id = $1',
    [id],
  )
  const row = rows[0]
  if (!row || !PARTNER_MIMES.has(row.mime)) return null
  return row
}

export async function addPartner(input: {
  name: string
  href: string
  logo: string
}): Promise<PartnerView> {
  await ensurePartners()
  const name = text(input.name, 80, 'A brand name')
  const href = partnerWebsite(input.href)
  const { mime, logo } = partnerLogoData(input.logo)
  const ids = await query<{ id: number }>(
    'SELECT COALESCE(MAX(id), 0) + 1 AS id FROM partners',
  )
  const id = whole(ids[0]?.id, 'Partner')
  await query(
    'INSERT INTO partners (id, name, href, mime, logo) VALUES ($1, $2, $3, $4, $5)',
    [id, name, href, mime, logo],
  )
  return { id, name, href, src: `data:${mime};base64,${logo}` }
}

export async function removePartner(id: number): Promise<void> {
  if (!Number.isInteger(id) || id < 1)
    throw new Error('That brand is not on the page.')
  await ensurePartners()
  await query('DELETE FROM partners WHERE id = $1', [id])
}

export async function listBots(): Promise<
  { id: number; name: string; role: BotRole }[]
> {
  const rows = await query<{ id: number; name: string; role: string }>(
    'SELECT id, name, role FROM bots ORDER BY id',
  )
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: asRole(row.role),
  }))
}

function asRole(value: string): BotRole {
  if (value === 'reader' || value === 'writer' || value === 'ceo') return value
  throw new Error('That role is not on an invite.')
}

export async function inviteBot(
  name: string,
  role: string,
): Promise<{ token: string }> {
  const nextName = text(name, 80, 'A name')
  const nextRole = asRole(role)
  const token = randomBytes(24).toString('hex')
  await query('INSERT INTO bots (name, token, role) VALUES ($1, $2, $3)', [
    nextName,
    token,
    nextRole,
  ])
  return { token }
}

export async function botFromToken(
  token: string,
): Promise<{ id: number; name: string; role: BotRole } | null> {
  if (!token) return null
  const rows = await query<{ id: number; name: string; role: string }>(
    'SELECT id, name, role FROM bots WHERE token = $1',
    [token],
  )
  const row = rows[0]
  if (!row) return null
  return { id: row.id, name: row.name, role: asRole(row.role) }
}

function planningSeed(row: BookingRow): PlanningSeed {
  return {
    coupleNames: `${row.partner_one} and ${row.partner_two}`,
    email: row.email,
    phone: row.phone,
    weddingDate: longDate(row.event_date),
    venueName: row.venue_name,
  }
}

export async function coupleBySlug(slugValue: string) {
  await ensurePlanningColumn()
  const rows = await query<BookingRow & { planning?: string }>(
    'SELECT * FROM bookings WHERE slug = $1',
    [slugValue],
  )
  const row = rows[0]
  if (!row) return null
  const view = toView(row, await invoiceFor(row.id))
  const planning = parsePlanning(row.planning, planningSeed(row))
  return {
    partnerOne: view.partnerOne,
    partnerTwo: view.partnerTwo,
    eventDate: view.eventDate,
    stagDate: view.stagDate,
    stagReleased: view.stagReleased,
    packageName: view.packageName,
    withStag: view.withStag,
    status: view.status,
    sample: view.sample,
    venueName: view.venueName,
    venueTwoName: view.venueTwoName,
    holdStartedOn: view.holdStartedOn,
    holdLastDay: view.holdLastDay,
    totalCents: view.invoice?.totalCents ?? view.totalCents,
    depositCents: view.invoice?.depositCents ?? view.depositCents,
    receivedCents: view.invoice?.receivedCents ?? 0,
    balanceCents: view.invoice?.balanceCents ?? view.totalCents,
    invoiceStatus: view.invoice?.status ?? null,
    invoiceSlug: view.invoice?.slug ?? null,
    planning: planning.planning,
    planningSaved: planning.saved,
  }
}

export async function saveCouplePlanning(
  slugValue: string,
  value: unknown,
): Promise<Planning> {
  await ensurePlanningColumn()
  const rows = await query<BookingRow>(
    'SELECT * FROM bookings WHERE slug = $1',
    [slugValue],
  )
  const row = rows[0]
  if (!row) throw new Error('That page was not found.')
  const planning = planningFromUnknown(value, planningSeed(row))
  await query('UPDATE bookings SET planning = $1 WHERE id = $2', [
    JSON.stringify(planning),
    row.id,
  ])
  return planning
}

export async function invoiceBySlug(slugValue: string) {
  const invoices = await query<InvoiceRow>(
    'SELECT * FROM invoices WHERE slug = $1',
    [slugValue],
  )
  const invoice = invoices[0]
  if (!invoice) return null
  const row = await bookingRow(invoice.booking_id)
  const view = toView(row, invoice)
  return {
    partnerOne: view.partnerOne,
    partnerTwo: view.partnerTwo,
    eventDate: view.eventDate,
    bookingSlug: view.slug,
    sample: view.sample,
    status: view.invoice?.status ?? 'draft',
    totalCents: view.invoice?.totalCents ?? 0,
    depositCents: view.invoice?.depositCents ?? 0,
    receivedCents: view.invoice?.receivedCents ?? 0,
    balanceCents: view.invoice?.balanceCents ?? 0,
  }
}

export async function countedTotal(): Promise<number> {
  return countedCents(await states())
}
