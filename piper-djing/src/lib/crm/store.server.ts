import { randomBytes } from 'node:crypto'
import { query, usesEdgeBook } from '../db.server.ts'
import {
  assertBookableDate,
  assertBookableNames,
  cancelBooking,
  countedCents,
  dateIsTaken,
  figuresFor,
  invoiceBalance,
  markInvoiceSent,
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
import { isPackageId, PACKAGE_BUTTON_COPY, packageName } from './defaults.ts'
import { asExternalKind } from './external-dates.ts'
import type { ExternalDate } from './external-dates.ts'
import type { SavedVenue } from './venues.ts'
import type { PackageId } from './defaults.ts'
import { DESK_OWNER_EMAIL } from './desk-owner.ts'
import { HOME_BASE } from './home-base.ts'
import type { PackageOffer } from './packages.ts'
import {
  parsePlanning,
  planningFromUnknown,
  type Planning,
  type PlanningSeed,
} from './planning.ts'
import { isReviewSource } from './reviews.ts'
import type {
  PublicReview,
  ReviewDraft,
  ReviewSource,
  ReviewView,
} from './reviews.ts'
import { askLegacyDate } from '../legacy-book.server.ts'
import { holdLastDay, isBlockedDate, PACKAGE_CENTS } from '../piper/rules.ts'

export type { ReviewView }

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
  withStag: boolean
  stagDate: string | null
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

function leadPackage(value: string): string {
  const label = value.trim()
  if (isPackageId(label)) return label
  if (!label || label.length > 80) throw new Error('Choose a package.')
  return label
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
  if (await externalDateActive(day, null)) return true
  const rows = await bookingRows()
  const others = rows.filter((row) => row.id !== exceptId).map(toState)
  return dateIsTaken(others, day)
}

async function guardIdentity(
  partnerOne: string,
  partnerTwo: string,
  eventDate: string,
  stagDate: string | null,
) {
  assertBookableNames(partnerOne, partnerTwo)
  assertBookableDate(eventDate, stagDate)
  const saved = savedWeddingFor(partnerOne, partnerTwo, eventDate)
  if (!saved) return
  if (await isSavedWeddingDismissed(saved)) return
  throw new Error('That wedding is already on the book.')
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

/** Copies the four booked weddings onto this book once. A deleted one stays deleted. */
export async function ensureSavedWeddings(): Promise<void> {
  for (const wedding of SAVED_WEDDINGS) {
    if (await isSavedWeddingDismissed(wedding)) continue
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
  const offers = await listPackageOffers()
  return rows.map((row) =>
    namedView(toView(row, byBooking.get(row.id) ?? null), offers),
  )
}

async function ensureVenues(): Promise<void> {
  const definition = usesEdgeBook()
    ? `id integer PRIMARY KEY AUTOINCREMENT,
      name text NOT NULL,
      street text NOT NULL DEFAULT ''`
    : `id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name text NOT NULL,
      street text NOT NULL DEFAULT ''`
  await query(`CREATE TABLE IF NOT EXISTS venues (${definition})`)
  await query(
    'CREATE UNIQUE INDEX IF NOT EXISTS venues_name_key ON venues (lower(name))',
  )
  await query(
    `CREATE TABLE IF NOT EXISTS hidden_venues (
      name text PRIMARY KEY
    )`,
  )
}

async function venueRow(name: string): Promise<SavedVenue | null> {
  await ensureVenues()
  const rows = await query<{ id: number; name: string; street: string }>(
    'SELECT id, name, street FROM venues WHERE lower(name) = lower($1)',
    [name.trim()],
  )
  const row = rows[0]
  if (!row) return null
  return { id: whole(row.id, 'Venue'), name: row.name, street: row.street }
}

async function venueHidden(name: string): Promise<boolean> {
  await ensureVenues()
  const rows = await query<{ name: string }>(
    'SELECT name FROM hidden_venues WHERE name = $1',
    [name.trim().toLowerCase()],
  )
  return rows.length > 0
}

async function showVenue(name: string): Promise<void> {
  await ensureVenues()
  await query('DELETE FROM hidden_venues WHERE name = $1', [
    name.trim().toLowerCase(),
  ])
}

async function seedVenue(name: string, street: string): Promise<void> {
  const cleanName = optional(name, 160)
  if (!cleanName || (await venueHidden(cleanName))) return
  const cleanStreet = optional(street, 160)
  const existing = await venueRow(cleanName)
  if (!existing) {
    await query('INSERT INTO venues (name, street) VALUES ($1, $2)', [
      cleanName,
      cleanStreet,
    ])
    return
  }
  if (!existing.street && cleanStreet) {
    await query('UPDATE venues SET street = $1 WHERE id = $2', [
      cleanStreet,
      existing.id,
    ])
  }
}

async function rememberVenue(name: string, street: string): Promise<void> {
  const cleanName = optional(name, 160)
  if (!cleanName) return
  const cleanStreet = optional(street, 160)
  await showVenue(cleanName)
  const existing = await venueRow(cleanName)
  if (!existing) {
    await query('INSERT INTO venues (name, street) VALUES ($1, $2)', [
      cleanName,
      cleanStreet,
    ])
    return
  }
  if (!cleanStreet || existing.street === cleanStreet) return
  await query('UPDATE venues SET name = $1, street = $2 WHERE id = $3', [
    cleanName,
    cleanStreet,
    existing.id,
  ])
}

async function seedKnownVenues(): Promise<void> {
  await ensureVenues()
  const bookings = await query<{
    venue_name: string
    venue_street: string
    venue_two_name: string
    venue_two_street: string
  }>(
    'SELECT venue_name, venue_street, venue_two_name, venue_two_street FROM bookings',
  )
  for (const row of bookings) {
    await seedVenue(row.venue_name, row.venue_street)
    await seedVenue(row.venue_two_name, row.venue_two_street)
  }
  await ensureExternalDates()
  const externals = await query<{
    venue_name: string
    venue_street: string
    venue_two_name: string
    venue_two_street: string
  }>(
    'SELECT venue_name, venue_street, venue_two_name, venue_two_street FROM external_dates',
  )
  for (const row of externals) {
    await seedVenue(row.venue_name, row.venue_street)
    await seedVenue(row.venue_two_name, row.venue_two_street)
  }
  for (const wedding of SAVED_WEDDINGS) {
    await seedVenue(wedding.venueName, '')
  }
}

export async function listVenues(): Promise<SavedVenue[]> {
  await seedKnownVenues()
  const rows = await query<{ id: number; name: string; street: string }>(
    'SELECT id, name, street FROM venues ORDER BY lower(name), id',
  )
  return rows.map((row) => ({
    id: whole(row.id, 'Venue'),
    name: row.name,
    street: row.street,
  }))
}

export async function saveVenue(
  name: string,
  street: string,
): Promise<SavedVenue> {
  const cleanName = text(name, 160, 'The venue name')
  const cleanStreet = optional(street, 160)
  await showVenue(cleanName)
  const existing = await venueRow(cleanName)
  if (existing) {
    await query('UPDATE venues SET name = $1, street = $2 WHERE id = $3', [
      cleanName,
      cleanStreet,
      existing.id,
    ])
    return { id: existing.id, name: cleanName, street: cleanStreet }
  }
  const inserted = await query<{ id: number }>(
    'INSERT INTO venues (name, street) VALUES ($1, $2) RETURNING id',
    [cleanName, cleanStreet],
  )
  const id = inserted[0]?.id
  if (id == null) throw new Error('That venue was not saved.')
  return { id: whole(id, 'Venue'), name: cleanName, street: cleanStreet }
}

export async function updateVenue(
  id: number,
  name: string,
  street: string,
): Promise<SavedVenue> {
  const venueId = positiveId(id, 'That venue is not saved.')
  const cleanName = text(name, 160, 'The venue name')
  const cleanStreet = optional(street, 160)
  await ensureVenues()
  const current = await query<{ id: number; name: string }>(
    'SELECT id, name FROM venues WHERE id = $1',
    [venueId],
  )
  const row = current[0]
  if (!row) throw new Error('That venue is not saved.')
  const other = await venueRow(cleanName)
  if (other && other.id !== venueId) {
    throw new Error('That venue is already saved.')
  }
  await showVenue(cleanName)
  if (row.name.trim().toLowerCase() !== cleanName.toLowerCase()) {
    await query(
      `INSERT INTO hidden_venues (name)
       SELECT $1
       WHERE NOT EXISTS (SELECT 1 FROM hidden_venues WHERE name = $1)`,
      [row.name.trim().toLowerCase()],
    )
  }
  await query('UPDATE venues SET name = $1, street = $2 WHERE id = $3', [
    cleanName,
    cleanStreet,
    venueId,
  ])
  return { id: venueId, name: cleanName, street: cleanStreet }
}

export async function removeVenue(id: number): Promise<void> {
  const venueId = positiveId(id, 'That venue is not saved.')
  await ensureVenues()
  const rows = await query<{ name: string }>(
    'DELETE FROM venues WHERE id = $1 RETURNING name',
    [venueId],
  )
  const name = rows[0]?.name
  if (!name) throw new Error('That venue is not saved.')
  await query(
    `INSERT INTO hidden_venues (name)
     SELECT $1
     WHERE NOT EXISTS (SELECT 1 FROM hidden_venues WHERE name = $1)`,
    [name.trim().toLowerCase()],
  )
}

export async function createBooking(input: BookingInput): Promise<BookingView> {
  const next = normalize(input)
  await guardIdentity(
    next.partnerOne,
    next.partnerTwo,
    next.eventDate,
    next.stagDate,
  )
  await ensureDateFree(next.eventDate, next.stagDate, false, null)
  const prices = await packagePriceMap()
  const figures = figuresFor(
    {
      ...next,
      venueName: next.venueName,
      venueStreet: next.venueStreet,
    },
    prices,
  )
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
  await rememberVenue(next.venueName, next.venueStreet)
  await rememberVenue(next.venueTwoName, next.venueTwoStreet)
  const row = await bookingRow(id)
  return present(toView(row, await invoiceFor(id)))
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

export async function createEventInquiry(input: {
  name: string
  email: string
  phone: string
  eventDate: string
  event: string
  message: string
}): Promise<{ ok: true; unavailable: boolean } | { ok: false; error: string }> {
  try {
    const email = text(input.email, 120, 'Email')
    if (!email.includes('@')) throw new Error('Enter an email address.')
    const name = text(input.name, 80, 'Your name')
    const event = text(input.event, 80, 'The event')
    const eventDate = input.eventDate.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      throw new Error('Choose a date.')
    }
    const message = optional(input.message, 2000)
    const unavailable = await dateTakenByOthers(eventDate, null)
    await ensureLeadColumns()
    await query(
      `INSERT INTO leads (partner_one, partner_two, email, phone, event_date, package_id, with_stag, stag_date, message)
       VALUES ($1,$2,$3,$4,$5,$6,0,NULL,$7)`,
      [name, '', email, optional(input.phone, 40), eventDate, event, message],
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

export async function createInquiry(
  input: InquiryInput,
): Promise<{ ok: true; unavailable: boolean } | { ok: false; error: string }> {
  try {
    const email = text(input.email, 120, 'Email')
    if (!email.includes('@')) throw new Error('Enter an email address.')
    const partnerOne = text(input.partnerOne, 80, 'The first name')
    const partnerTwo = text(input.partnerTwo, 80, 'The second name')
    await guardIdentity(
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
    await ensureLeadColumns()
    await query(
      `INSERT INTO leads (partner_one, partner_two, email, phone, event_date, package_id, with_stag, stag_date, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        partnerOne,
        partnerTwo,
        email,
        optional(input.phone, 40),
        input.eventDate,
        packageId,
        input.withStag ? 1 : 0,
        stagDate,
        message,
      ],
    )
    if (!unavailable) {
      try {
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
      } catch {
        // The lead is already saved. A booking problem must not hide the inquiry.
      }
    }
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
  for (const wedding of SAVED_WEDDINGS) {
    if (wedding.date !== day) continue
    if (!(await isSavedWeddingDismissed(wedding))) return false
  }
  if (await dateTakenByOthers(day, null)) return false
  const legacy = await askLegacyDate(day)
  return legacy !== 'taken'
}

function savedNames(partnerOne: string, partnerTwo: string): [string, string] {
  const names = [
    partnerOne.trim().toLowerCase(),
    partnerTwo.trim().toLowerCase(),
  ]
  names.sort()
  return [names[0] ?? '', names[1] ?? '']
}

function savedWeddingFor(
  partnerOne: string,
  partnerTwo: string,
  eventDate: string,
): (typeof SAVED_WEDDINGS)[number] | null {
  if (!matchCustom(partnerOne, partnerTwo, eventDate)) return null
  return SAVED_WEDDINGS.find((wedding) => wedding.date === eventDate) ?? null
}

async function ensureDismissedWeddings(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS dismissed_weddings (
      event_date text NOT NULL,
      partner_one text NOT NULL,
      partner_two text NOT NULL,
      PRIMARY KEY (event_date, partner_one, partner_two)
    )`,
  )
}

async function isSavedWeddingDismissed(
  wedding: (typeof SAVED_WEDDINGS)[number],
): Promise<boolean> {
  await ensureDismissedWeddings()
  const [one, two] = savedNames(wedding.partnerOne, wedding.partnerTwo)
  const rows = await query<{ event_date: string }>(
    `SELECT event_date FROM dismissed_weddings
     WHERE event_date = $1 AND partner_one = $2 AND partner_two = $3`,
    [wedding.date, one, two],
  )
  return rows.length > 0
}

async function dismissSavedWedding(
  wedding: (typeof SAVED_WEDDINGS)[number],
): Promise<void> {
  await ensureDismissedWeddings()
  const [one, two] = savedNames(wedding.partnerOne, wedding.partnerTwo)
  await query(
    `INSERT INTO dismissed_weddings (event_date, partner_one, partner_two)
     SELECT $1, $2, $3
     WHERE NOT EXISTS (
       SELECT 1 FROM dismissed_weddings
       WHERE event_date = $1 AND partner_one = $2 AND partner_two = $3
     )`,
    [wedding.date, one, two],
  )
}

type ExternalRow = {
  id: number
  event_date: string
  kind: string
  company: string
  label: string
  partner_one: string
  partner_two: string
  venue_name: string
  venue_street: string
  venue_two_name: string
  venue_two_street: string
  notes: string
  released: unknown
}

const EXTERNAL_COLUMNS = [
  'partner_one',
  'partner_two',
  'venue_name',
  'venue_street',
  'venue_two_name',
  'venue_two_street',
] as const

async function addExternalColumn(name: string): Promise<void> {
  try {
    await query(
      `ALTER TABLE external_dates ADD COLUMN ${name} text NOT NULL DEFAULT ''`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/duplicate column|already exists/i.test(message)) return
    throw error
  }
}

async function ensureExternalDates(): Promise<void> {
  const definition = usesEdgeBook()
    ? `id integer PRIMARY KEY AUTOINCREMENT,
      event_date text NOT NULL,
      kind text NOT NULL,
      company text NOT NULL,
      label text NOT NULL DEFAULT '',
      notes text NOT NULL DEFAULT '',
      released integer NOT NULL DEFAULT 0`
    : `id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      event_date text NOT NULL,
      kind text NOT NULL,
      company text NOT NULL,
      label text NOT NULL DEFAULT '',
      notes text NOT NULL DEFAULT '',
      released integer NOT NULL DEFAULT 0`
  await query(`CREATE TABLE IF NOT EXISTS external_dates (${definition})`)
  for (const name of EXTERNAL_COLUMNS) await addExternalColumn(name)
}

function toExternal(row: ExternalRow): ExternalDate {
  return {
    id: whole(row.id, 'External date'),
    eventDate: row.event_date,
    kind: asExternalKind(row.kind),
    company: row.company,
    label: row.label,
    partnerOne: row.partner_one,
    partnerTwo: row.partner_two,
    venueName: row.venue_name,
    venueStreet: row.venue_street,
    venueTwoName: row.venue_two_name,
    venueTwoStreet: row.venue_two_street,
    notes: row.notes,
    released: flag(row.released),
  }
}

async function externalDateActive(
  day: string,
  exceptId: number | null,
): Promise<boolean> {
  await ensureExternalDates()
  const rows = await query<{ id: number }>(
    'SELECT id FROM external_dates WHERE event_date = $1 AND released = 0',
    [day],
  )
  return rows.some((row) => row.id !== exceptId)
}

async function externalRow(id: number): Promise<ExternalDate> {
  await ensureExternalDates()
  const rows = await query<ExternalRow>(
    'SELECT * FROM external_dates WHERE id = $1',
    [id],
  )
  const row = rows[0]
  if (!row) throw new Error('That date is not on the book.')
  return toExternal(row)
}

export async function listExternalDates(): Promise<ExternalDate[]> {
  await ensureExternalDates()
  const rows = await query<ExternalRow>(
    'SELECT * FROM external_dates ORDER BY event_date, id',
  )
  return rows.map(toExternal)
}

export async function bookExternalDate(input: {
  eventDate: string
  kind: string
  company: string
  label: string
  notes: string
  partnerOne?: string
  partnerTwo?: string
  venueName?: string
  venueStreet?: string
  venueTwoName?: string
  venueTwoStreet?: string
}): Promise<ExternalDate> {
  const eventDate = input.eventDate.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    throw new Error('Choose a date.')
  }
  if (isBlockedDate(eventDate, null)) {
    throw new Error('20 February 2027 is not booked.')
  }
  const kind = asExternalKind(input.kind)
  const company = text(input.company, 80, 'The company')
  const label = optional(input.label, 80)
  const partnerOne = optional(input.partnerOne ?? '', 80)
  const partnerTwo = optional(input.partnerTwo ?? '', 80)
  const venueName = optional(input.venueName ?? '', 160)
  const venueStreet = optional(input.venueStreet ?? '', 160)
  const venueTwoName = optional(input.venueTwoName ?? '', 160)
  const venueTwoStreet = optional(input.venueTwoStreet ?? '', 160)
  const notes = optional(input.notes, 500)
  if (!(await dateOpen(eventDate))) {
    throw new Error('That date is already held.')
  }
  const inserted = await query<{ id: number }>(
    `INSERT INTO external_dates (
      event_date, kind, company, label, partner_one, partner_two,
      venue_name, venue_street, venue_two_name, venue_two_street, notes, released
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0) RETURNING id`,
    [
      eventDate,
      kind,
      company,
      label,
      partnerOne,
      partnerTwo,
      venueName,
      venueStreet,
      venueTwoName,
      venueTwoStreet,
      notes,
    ],
  )
  const id = inserted[0]?.id
  if (id == null) throw new Error('That date was not saved.')
  await rememberVenue(venueName, venueStreet)
  await rememberVenue(venueTwoName, venueTwoStreet)
  return externalRow(whole(id, 'External date'))
}

export async function releaseExternalDate(id: number): Promise<ExternalDate> {
  const current = await externalRow(id)
  if (current.released) return current
  await query('UPDATE external_dates SET released = 1 WHERE id = $1', [
    current.id,
  ])
  return { ...current, released: true }
}

export async function removeExternalDate(id: number): Promise<void> {
  const current = await externalRow(id)
  const removed = await query<{ id: number }>(
    'DELETE FROM external_dates WHERE id = $1 RETURNING id',
    [current.id],
  )
  if (!removed[0]) throw new Error('That date is not on the book.')
}

export async function removeBooking(id: number): Promise<void> {
  const row = await bookingRow(id)
  const state = toState(row)
  const saved = savedWeddingFor(
    state.partnerOne,
    state.partnerTwo,
    state.eventDate,
  )
  if (saved) await dismissSavedWedding(saved)
  const invoice = await invoiceFor(row.id)
  if (invoice) {
    await query('DELETE FROM payments WHERE invoice_id = $1', [invoice.id])
    await query('DELETE FROM invoices WHERE id = $1', [invoice.id])
  }
  try {
    await query('DELETE FROM emails WHERE booking_id = $1', [row.id])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/no such table|does not exist/i.test(message)) throw error
  }
  const removed = await query<{ id: number }>(
    'DELETE FROM bookings WHERE id = $1 RETURNING id',
    [row.id],
  )
  if (!removed[0]) throw new Error('That booking is not on the book.')
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
    await guardIdentity(
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
  const prices = await packagePriceMap()
  const figures = locked
    ? { totalCents: state.totalCents, depositCents: state.depositCents }
    : figuresFor(
        {
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
        },
        prices,
      )
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
    const transition = recordMoney(refreshed, updated, 0, prices.ceremony)
    await saveBooking(current.id, transition.booking, transition.invoice)
  }
  await rememberVenue(next.venueName, next.venueStreet)
  await rememberVenue(next.venueTwoName, next.venueTwoStreet)
  return present(
    toView(await bookingRow(current.id), await invoiceFor(current.id)),
  )
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
  return present(toView(await bookingRow(id), await invoiceFor(id)))
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
  const prices = await packagePriceMap()
  const transition = markInvoiceSent(
    state,
    toInvoice(invoiceRow),
    new Date(),
    prices.ceremony,
  )
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
    view: await present(
      toView(await bookingRow(bookingId), await invoiceFor(bookingId)),
    ),
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
  return present(
    toView(await bookingRow(bookingId), await invoiceFor(bookingId)),
  )
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
  const prices = await packagePriceMap()
  const transition = recordMoney(toState(row), before, cents, prices.ceremony)
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
    view: await present(
      toView(await bookingRow(bookingId), await invoiceFor(bookingId)),
    ),
    newlyBooked: transition.newlyBooked,
  }
}

async function ensureLeadColumns(): Promise<void> {
  await addLeadColumn('with_stag', 'integer NOT NULL DEFAULT 0')
  await addLeadColumn('stag_date', 'text')
}

async function addLeadColumn(name: string, definition: string): Promise<void> {
  try {
    await query(`ALTER TABLE leads ADD COLUMN ${name} ${definition}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/duplicate column|already exists/i.test(message)) return
    throw error
  }
}

export async function listLeads(): Promise<LeadView[]> {
  await ensureLeadColumns()
  const offers = await listPackageOffers()
  const rows = await query<{
    id: number
    partner_one: string
    partner_two: string
    email: string
    phone: string
    event_date: string | null
    package_id: string
    with_stag: unknown
    stag_date: string | null
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
    packageName: offerName(offers, row.package_id),
    withStag: flag(row.with_stag),
    stagDate: row.stag_date,
    message: row.message,
  }))
}

export type LeadPatch = {
  id: number
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

export async function updateLead(input: LeadPatch): Promise<LeadView> {
  const id = positiveId(input.id, 'That inquiry is not on the desk.')
  await ensureLeadColumns()
  const existing = (await listLeads()).find((lead) => lead.id === id)
  if (!existing) throw new Error('That inquiry is not on the desk.')
  const email = text(input.email, 120, 'Email')
  if (!email.includes('@')) throw new Error('Enter an email address.')
  const partnerOne = text(input.partnerOne, 80, 'The first name')
  const partnerTwo = optional(input.partnerTwo, 80)
  const packageId = leadPackage(input.packageId)
  if (input.withStag && packageId !== 'full') {
    throw new Error('A stag is added to the full wedding day.')
  }
  if (input.withStag && !input.stagDate) {
    throw new Error('A stag needs its own date.')
  }
  const eventDate = input.eventDate.trim()
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    throw new Error('Choose a date.')
  }
  const stagDate = input.withStag ? input.stagDate : null
  await query(
    `UPDATE leads SET
      partner_one = $1, partner_two = $2, email = $3, phone = $4, event_date = $5,
      package_id = $6, with_stag = $7, stag_date = $8, message = $9
     WHERE id = $10`,
    [
      partnerOne,
      partnerTwo,
      email,
      optional(input.phone, 40),
      eventDate || null,
      packageId,
      input.withStag ? 1 : 0,
      stagDate,
      optional(input.message, 2000),
      id,
    ],
  )
  const saved = (await listLeads()).find((lead) => lead.id === id)
  if (!saved) throw new Error('That inquiry is not on the desk.')
  return saved
}

export async function removeLead(id: number): Promise<void> {
  const leadId = positiveId(id, 'That inquiry is not on the desk.')
  await ensureLeadColumns()
  const rows = await query<{ id: number }>(
    'DELETE FROM leads WHERE id = $1 RETURNING id',
    [leadId],
  )
  if (!rows[0]) throw new Error('That inquiry is not on the desk.')
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

async function paymentRow(id: number): Promise<{
  id: number
  invoiceId: number
  bookingId: number
  cents: number
}> {
  const paymentId = positiveId(id, 'That payment is not on the book.')
  const rows = await query<{
    id: number
    invoice_id: number
    booking_id: number
    cents: unknown
  }>(
    `SELECT payments.id, payments.invoice_id, invoices.booking_id, payments.cents
     FROM payments
     JOIN invoices ON invoices.id = payments.invoice_id
     WHERE payments.id = $1`,
    [paymentId],
  )
  if (rows.length === 0) throw new Error('That payment is not on the book.')
  const row = rows[0]
  return {
    id: whole(row.id, 'Payment'),
    invoiceId: whole(row.invoice_id, 'Invoice'),
    bookingId: whole(row.booking_id, 'Booking'),
    cents: whole(row.cents, 'Payment'),
  }
}

/** A payment edit can book a date. It never unbooks one. */
async function syncPaymentLedger(bookingId: number): Promise<void> {
  const invoiceRow = await invoiceFor(bookingId)
  if (!invoiceRow) return
  const sums = await query<{ total: unknown }>(
    'SELECT COALESCE(SUM(cents), 0) AS total FROM payments WHERE invoice_id = $1',
    [invoiceRow.id],
  )
  const received = Math.max(0, whole(sums[0]?.total ?? 0, 'Payment'))
  const before = toInvoice(invoiceRow)
  const booking = toState(await bookingRow(bookingId))
  if (received >= before.receivedCents) {
    const prices = await packagePriceMap()
    const transition = recordMoney(
      booking,
      before,
      received - before.receivedCents,
      prices.ceremony,
    )
    await saveBooking(bookingId, transition.booking, transition.invoice)
    return
  }
  await query('UPDATE invoices SET received_cents = $1 WHERE id = $2', [
    received,
    invoiceRow.id,
  ])
}

export async function updatePayment(
  id: number,
  cents: number,
  note: string,
): Promise<PaymentView> {
  if (!Number.isInteger(cents) || cents === 0)
    throw new Error('Enter an amount.')
  const current = await paymentRow(id)
  await query('UPDATE payments SET cents = $1, note = $2 WHERE id = $3', [
    cents,
    optional(note, 200),
    current.id,
  ])
  await syncPaymentLedger(current.bookingId)
  const saved = (await listPayments()).find(
    (payment) => payment.id === current.id,
  )
  if (!saved) throw new Error('That payment is not on the book.')
  return saved
}

export async function removePayment(id: number): Promise<void> {
  const current = await paymentRow(id)
  await query('DELETE FROM payments WHERE id = $1', [current.id])
  await syncPaymentLedger(current.bookingId)
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

async function ensureProfileColumns(): Promise<void> {
  await ensureSite()
  await addSiteColumn('owner_email', 'text')
  await addSiteColumn('home_base', 'text')
}

async function addSiteColumn(name: string, definition: string): Promise<void> {
  try {
    await query(`ALTER TABLE site ADD COLUMN ${name} ${definition}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/duplicate column|already exists/i.test(message)) return
    throw error
  }
}

export async function deskProfile(): Promise<{
  email: string
  homeBase: string
}> {
  await ensureProfileColumns()
  const rows = await query<{
    owner_email: string | null
    home_base: string | null
  }>('SELECT owner_email, home_base FROM site WHERE id = 1')
  if (rows.length === 0) {
    return { email: DESK_OWNER_EMAIL, homeBase: HOME_BASE }
  }
  const row = rows[0]
  return {
    email: (row.owner_email ?? '').trim() || DESK_OWNER_EMAIL,
    homeBase: (row.home_base ?? '').trim() || HOME_BASE,
  }
}

export async function saveDeskProfile(input: {
  email: string
  homeBase: string
}): Promise<{ email: string; homeBase: string }> {
  await ensureProfileColumns()
  const email = text(input.email, 120, 'The desk email')
  if (!email.includes('@')) throw new Error('Enter an email address.')
  const homeBase = text(input.homeBase, 120, 'The home base')
  await query('UPDATE site SET owner_email = $1, home_base = $2 WHERE id = 1', [
    email,
    homeBase,
  ])
  return deskProfile()
}

async function addReviewColumn(
  name: string,
  definition: string,
): Promise<void> {
  try {
    await query(`ALTER TABLE reviews ADD COLUMN ${name} ${definition}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/duplicate column|already exists/i.test(message)) return
    throw error
  }
}

async function ensureReviews(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS reviews (
      id integer PRIMARY KEY,
      quote text NOT NULL,
      names text NOT NULL DEFAULT '',
      when_label text NOT NULL DEFAULT ''
    )`,
  )
  await addReviewColumn('event_type', `text NOT NULL DEFAULT ''`)
  await addReviewColumn('town', `text NOT NULL DEFAULT ''`)
  await addReviewColumn('reviewed_on', `text NOT NULL DEFAULT ''`)
  await addReviewColumn('source', `text NOT NULL DEFAULT 'other'`)
  await addReviewColumn('show_on_site', `integer NOT NULL DEFAULT 0`)
}

type ReviewRow = {
  id: number
  quote: string
  names: string
  event_type: string
  town: string
  reviewed_on: string
  source: string
  show_on_site: unknown
}

function toReview(row: ReviewRow): ReviewView {
  const source: ReviewSource = isReviewSource(row.source) ? row.source : 'other'
  return {
    id: whole(row.id, 'Review'),
    quote: row.quote,
    names: row.names,
    eventType: row.event_type,
    town: row.town,
    date: row.reviewed_on,
    source,
    show: flag(row.show_on_site),
  }
}

const REVIEW_COLUMNS =
  'id, quote, names, event_type, town, reviewed_on, source, show_on_site'

function reviewId(id: number): number {
  if (!Number.isInteger(id) || id < 1) {
    throw new Error('That review is not on the page.')
  }
  return id
}

function parseReview(input: ReviewDraft): Omit<ReviewView, 'id'> {
  const quote = input.quote.trim()
  const names = input.names.trim()
  const eventType = input.eventType.trim()
  const town = input.town.trim()
  const date = input.date.trim()
  if (!quote) throw new Error('The review is required.')
  if (quote.length > 800) throw new Error('That review is too long.')
  if (names.length > 80) throw new Error('That name is too long.')
  if (eventType.length > 80) throw new Error('That event type is too long.')
  if (town.length > 80) throw new Error('That town is too long.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error('The date is required.')
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('That date is not valid.')
  }
  if (!isReviewSource(input.source)) {
    throw new Error('Choose where the review came from.')
  }
  return {
    quote,
    names,
    eventType,
    town,
    date,
    source: input.source,
    show: input.show,
  }
}

export async function listReviews(): Promise<ReviewView[]> {
  await ensureReviews()
  const rows = await query<ReviewRow>(
    `SELECT ${REVIEW_COLUMNS} FROM reviews ORDER BY reviewed_on DESC, id DESC`,
  )
  return rows.map(toReview)
}

/** Public cards. Only reviews switched on, newest first. */
export async function homepageReviews(): Promise<PublicReview[]> {
  const reviews = await listReviews()
  return reviews
    .filter((review) => review.show)
    .map((review) => ({
      id: review.id,
      quote: review.quote,
      names: review.names,
      eventType: review.eventType,
      town: review.town,
      date: review.date,
      source: review.source,
    }))
}

export async function addReview(input: ReviewDraft): Promise<ReviewView> {
  await ensureReviews()
  const review = parseReview(input)
  const ids = await query<{ id: number }>(
    'SELECT COALESCE(MAX(id), 0) + 1 AS id FROM reviews',
  )
  const id = whole(ids[0]?.id, 'Review')
  await query(
    `INSERT INTO reviews (id, quote, names, when_label, event_type, town, reviewed_on, source, show_on_site)
     VALUES ($1, $2, $3, '', $4, $5, $6, $7, $8)`,
    [
      id,
      review.quote,
      review.names,
      review.eventType,
      review.town,
      review.date,
      review.source,
      review.show ? 1 : 0,
    ],
  )
  return { id, ...review }
}

export async function updateReview(
  id: number,
  input: ReviewDraft,
): Promise<ReviewView> {
  const reviewIdValue = reviewId(id)
  await ensureReviews()
  const review = parseReview(input)
  const rows = await query<ReviewRow>(
    `UPDATE reviews
     SET quote = $1, names = $2, event_type = $3, town = $4, reviewed_on = $5, source = $6, show_on_site = $7
     WHERE id = $8
     RETURNING ${REVIEW_COLUMNS}`,
    [
      review.quote,
      review.names,
      review.eventType,
      review.town,
      review.date,
      review.source,
      review.show ? 1 : 0,
      reviewIdValue,
    ],
  )
  const saved = rows[0]
  if (!saved) throw new Error('That review is not on the page.')
  return toReview(saved)
}

export async function setReviewShown(
  id: number,
  show: boolean,
): Promise<ReviewView> {
  const reviewIdValue = reviewId(id)
  await ensureReviews()
  const rows = await query<ReviewRow>(
    `UPDATE reviews SET show_on_site = $1 WHERE id = $2 RETURNING ${REVIEW_COLUMNS}`,
    [show ? 1 : 0, reviewIdValue],
  )
  const saved = rows[0]
  if (!saved) throw new Error('That review is not on the page.')
  return toReview(saved)
}

export async function removeReview(id: number): Promise<void> {
  const reviewIdValue = reviewId(id)
  await ensureReviews()
  await query('DELETE FROM reviews WHERE id = $1', [reviewIdValue])
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
  const rows = await query<{ sort: number }>(
    'SELECT COALESCE(MAX(sort), 0) + 1 AS sort FROM questions',
  )
  const sort = rows.length === 0 ? 1 : whole(rows[0].sort, 'Question')
  await query('INSERT INTO questions (prompt, sort) VALUES ($1, $2)', [
    next,
    sort,
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

export async function updateQuestion(
  id: number,
  prompt: string,
): Promise<{ id: number; prompt: string }> {
  const questionId = positiveId(id, 'That question is not on the desk.')
  const next = text(prompt, 500, 'The question')
  const rows = await query<{ id: number; prompt: string }>(
    'UPDATE questions SET prompt = $1 WHERE id = $2 RETURNING id, prompt',
    [next, questionId],
  )
  if (rows.length === 0) throw new Error('That question is not on the desk.')
  const saved = rows[0]
  return { id: whole(saved.id, 'Question'), prompt: saved.prompt }
}

export async function removeQuestion(id: number): Promise<void> {
  const questionId = positiveId(id, 'That question is not on the desk.')
  const rows = await query<{ id: number }>(
    'DELETE FROM questions WHERE id = $1 RETURNING id',
    [questionId],
  )
  if (!rows[0]) throw new Error('That question is not on the desk.')
}

export async function updateMedia(
  id: number,
  title: string,
  url: string,
): Promise<{ id: number; title: string; url: string }> {
  const mediaId = positiveId(id, 'That link is not on the desk.')
  const nextTitle = text(title, 120, 'A title')
  const nextUrl = text(url, 500, 'A link')
  const rows = await query<{ id: number; title: string; url: string }>(
    'UPDATE media SET title = $1, url = $2 WHERE id = $3 RETURNING id, title, url',
    [nextTitle, nextUrl, mediaId],
  )
  if (rows.length === 0) throw new Error('That link is not on the desk.')
  const saved = rows[0]
  return { id: whole(saved.id, 'Media'), title: saved.title, url: saved.url }
}

export async function removeMedia(id: number): Promise<void> {
  const mediaId = positiveId(id, 'That link is not on the desk.')
  const rows = await query<{ id: number }>(
    'DELETE FROM media WHERE id = $1 RETURNING id',
    [mediaId],
  )
  if (!rows[0]) throw new Error('That link is not on the desk.')
}

const PACKAGE_ORDER: PackageId[] = ['full', 'reception', 'stag', 'ceremony']

async function ensurePackageOffers(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS package_offers (
      id text PRIMARY KEY,
      name text NOT NULL,
      detail text NOT NULL,
      cents integer NOT NULL
    )`,
  )
  for (const item of PACKAGE_BUTTON_COPY) {
    await query(
      `INSERT INTO package_offers (id, name, detail, cents)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [item.id, item.name, item.detail, PACKAGE_CENTS[item.id]],
    )
  }
}

export async function listPackageOffers(): Promise<PackageOffer[]> {
  await ensurePackageOffers()
  const rows = await query<{
    id: string
    name: string
    detail: string
    cents: unknown
  }>('SELECT id, name, detail, cents FROM package_offers')
  const byId = new Map(rows.map((row) => [row.id, row]))
  return PACKAGE_ORDER.map((id) => {
    const row = byId.get(id)
    const copy = PACKAGE_BUTTON_COPY.find((item) => item.id === id)
    return {
      id,
      name: row?.name || copy?.name || id,
      detail: row?.detail || copy?.detail || '',
      cents: row ? whole(row.cents, 'Price') : PACKAGE_CENTS[id],
    }
  })
}

export async function packagePriceMap(): Promise<Record<PackageId, number>> {
  const offers = await listPackageOffers()
  const price = (id: PackageId) => {
    const offer = offers.find((item) => item.id === id)
    return offer ? offer.cents : PACKAGE_CENTS[id]
  }
  return {
    full: price('full'),
    reception: price('reception'),
    stag: price('stag'),
    ceremony: price('ceremony'),
  }
}

export async function updatePackageOffer(input: {
  id: string
  name: string
  detail: string
  cents: number
}): Promise<PackageOffer> {
  if (!isPackageId(input.id)) throw new Error('Choose a package.')
  const name = text(input.name, 80, 'The package name')
  const detail = text(input.detail, 2000, 'The package detail')
  if (
    !Number.isInteger(input.cents) ||
    input.cents < 0 ||
    input.cents > 10_000_000
  ) {
    throw new Error('Enter a price in cents.')
  }
  await ensurePackageOffers()
  const rows = await query<{ id: string }>(
    `UPDATE package_offers SET name = $1, detail = $2, cents = $3
     WHERE id = $4 RETURNING id`,
    [name, detail, input.cents, input.id],
  )
  if (!rows[0]) throw new Error('Choose a package.')
  const saved = (await listPackageOffers()).find((item) => item.id === input.id)
  if (!saved) throw new Error('Choose a package.')
  return saved
}

function offerName(offers: PackageOffer[], id: string): string {
  return (
    offers.find((item) => item.id === id)?.name ??
    (isPackageId(id) ? packageName(id) : id)
  )
}

function namedView(view: BookingView, offers: PackageOffer[]): BookingView {
  return { ...view, packageName: offerName(offers, view.packageId) }
}

async function present(view: BookingView): Promise<BookingView> {
  return namedView(view, await listPackageOffers())
}

function positiveId(id: number, missing: string): number {
  if (!Number.isInteger(id) || id < 1) throw new Error(missing)
  return id
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

export async function updatePartner(input: {
  id: number
  name: string
  href: string
  logo?: string
}): Promise<PartnerView> {
  const id = positiveId(input.id, 'That brand is not on the page.')
  await ensurePartners()
  const current = (await listPartners()).find((partner) => partner.id === id)
  if (!current) throw new Error('That brand is not on the page.')
  const name = text(input.name, 80, 'A brand name')
  const href = partnerWebsite(input.href)
  const replacement = input.logo?.trim() ? partnerLogoData(input.logo) : null
  if (replacement) {
    await query(
      'UPDATE partners SET name = $1, href = $2, mime = $3, logo = $4 WHERE id = $5',
      [name, href, replacement.mime, replacement.logo, id],
    )
  } else {
    await query('UPDATE partners SET name = $1, href = $2 WHERE id = $3', [
      name,
      href,
      id,
    ])
  }
  const saved = (await listPartners()).find((partner) => partner.id === id)
  if (!saved) throw new Error('That brand is not on the page.')
  return saved
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

export async function updateBot(
  id: number,
  name: string,
  role: string,
): Promise<{ id: number; name: string; role: BotRole }> {
  const botId = positiveId(id, 'That bot is not on the desk.')
  const nextName = text(name, 80, 'A name')
  const nextRole = asRole(role)
  const rows = await query<{ id: number }>(
    'UPDATE bots SET name = $1, role = $2 WHERE id = $3 RETURNING id',
    [nextName, nextRole, botId],
  )
  if (!rows[0]) throw new Error('That bot is not on the desk.')
  return { id: botId, name: nextName, role: nextRole }
}

export async function removeBot(id: number): Promise<void> {
  const botId = positiveId(id, 'That bot is not on the desk.')
  const rows = await query<{ id: number }>(
    'DELETE FROM bots WHERE id = $1 RETURNING id',
    [botId],
  )
  if (!rows[0]) throw new Error('That bot is not on the desk.')
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
  const view = await present(toView(row, await invoiceFor(row.id)))
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
