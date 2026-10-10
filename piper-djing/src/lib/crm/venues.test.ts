import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deskBotResponse } from '../bots/desk-rest.server.ts'
import { setLegacyDateReader } from '../legacy-book.server.ts'
import {
  bookExternalDate,
  createBooking,
  inviteBot,
  listVenues,
  removeVenue,
  saveVenue,
} from './store.server.ts'
import { matchingVenue } from './venues.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

const booking = {
  phone: '',
  stagDate: null,
  packageId: 'full',
  withStag: false,
  uplights: 0,
  venueKm: [] as number[],
  venueTwoName: '',
  venueTwoStreet: '',
  sample: true,
  notes: '',
}

describe('saved venues', { skip: liveBook }, () => {
  it('lists each wedding venue once, with the street left blank', async () => {
    const venues = await listVenues()
    const rivers = venues.filter((venue) => venue.name === 'Rivers Edge')
    const oakwood = venues.find((venue) => venue.name === 'Oakwood Resort')
    const lavender = venues.find((venue) => venue.name === 'The Lavender Farm')
    assert.equal(rivers.length, 1)
    assert.equal(rivers[0]?.street, '')
    assert.equal(oakwood?.street, '')
    assert.equal(lavender?.street, '')
  })

  it('updates the address for the same name', async () => {
    const first = await saveVenue('Harbour Hall', '1 Dock Street')
    const second = await saveVenue('harbour hall', '9 Dock Street')
    assert.equal(second.id, first.id)
    assert.equal(second.name, 'harbour hall')
    assert.equal(second.street, '9 Dock Street')
    const listed = (await listVenues()).find((venue) => venue.id === first.id)
    assert.equal(listed?.street, '9 Dock Street')
  })

  it('keeps a known street when a later save has a blank address', async () => {
    setLegacyDateReader(async () => 'open')
    await saveVenue('Kept Hall', '8 Kept Street')
    await createBooking({
      ...booking,
      partnerOne: 'Venue',
      partnerTwo: 'Keep',
      email: 'keep@example.com',
      eventDate: '2029-06-06',
      venueName: 'Kept Hall',
      venueStreet: '',
    })
    const kept = (await listVenues()).find(
      (venue) => venue.name === 'Kept Hall',
    )
    assert.equal(kept?.street, '8 Kept Street')
  })

  it('does not let an empty booking street overwrite a corrected address', async () => {
    setLegacyDateReader(async () => 'open')
    await createBooking({
      ...booking,
      partnerOne: 'Ada',
      partnerTwo: 'Bo',
      email: 'ada-venue@example.com',
      eventDate: '2029-06-07',
      venueName: 'Corrected Barn',
      venueStreet: '',
    })
    await saveVenue('Corrected Barn', '44 Right Road')
    const listed = (await listVenues()).find(
      (venue) => venue.name === 'Corrected Barn',
    )
    assert.equal(listed?.street, '44 Right Road')
  })

  it('remembers both venues from a booking and an external date', async () => {
    setLegacyDateReader(async () => 'open')
    await createBooking({
      ...booking,
      partnerOne: 'Cara',
      partnerTwo: 'Dee',
      email: 'cara@example.com',
      eventDate: '2029-06-08',
      venueName: 'First Hall',
      venueStreet: '1 First',
      venueTwoName: 'Second Hall',
      venueTwoStreet: '2 Second',
    })
    await bookExternalDate({
      eventDate: '2029-06-09',
      kind: 'event',
      company: 'Venue Co',
      label: '',
      notes: '',
      venueName: 'The Glass House',
      venueStreet: '10 Pane Road',
      venueTwoName: 'The Garden',
      venueTwoStreet: '11 Pane Road',
    })
    const venues = await listVenues()
    assert.equal(
      venues.find((venue) => venue.name === 'First Hall')?.street,
      '1 First',
    )
    assert.equal(
      venues.find((venue) => venue.name === 'Second Hall')?.street,
      '2 Second',
    )
    assert.equal(
      venues.find((venue) => venue.name === 'The Glass House')?.street,
      '10 Pane Road',
    )
    assert.equal(
      venues.find((venue) => venue.name === 'The Garden')?.street,
      '11 Pane Road',
    )
  })

  it('hides a deleted venue until that name is saved again', async () => {
    setLegacyDateReader(async () => 'open')
    await createBooking({
      ...booking,
      partnerOne: 'Eve',
      partnerTwo: 'Finn',
      email: 'eve@example.com',
      eventDate: '2029-06-10',
      venueName: 'Hidden Hall',
      venueStreet: '3 Quiet Lane',
    })
    const saved = (await listVenues()).find(
      (venue) => venue.name === 'Hidden Hall',
    )
    assert.ok(saved)
    await removeVenue(saved.id)
    assert.equal(
      (await listVenues()).some((venue) => venue.name === 'Hidden Hall'),
      false,
    )
    const back = await saveVenue('Hidden Hall', '3 Quiet Lane')
    assert.equal(
      (await listVenues()).some((venue) => venue.id === back.id),
      true,
    )
  })

  it('matches a venue name without caring about case', () => {
    const venues = [{ id: 1, name: 'Rivers Edge', street: '' }]
    assert.equal(matchingVenue(venues, '  rivers edge ')?.id, 1)
    assert.equal(matchingVenue(venues, ''), null)
    assert.equal(matchingVenue(venues, 'Other'), null)
  })

  it('lets a writer save and delete a venue', async () => {
    const writer = await inviteBot('Venue Writer', 'writer')
    const saved = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/venues', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${writer.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Bot Hall', address: '5 Bot Lane' }),
      }),
      async () => 'no',
    )
    assert.equal(saved.status, 200)
    const body = (await saved.json()) as {
      venue: { id: number; name: string; street: string }
    }
    assert.equal(body.venue.name, 'Bot Hall')
    assert.equal(body.venue.street, '5 Bot Lane')
    const removed = await deskBotResponse(
      new Request(`http://localhost/api/bots/v1/venues/${body.venue.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${writer.token}` },
      }),
      async () => 'no',
    )
    assert.equal(removed.status, 200)
    assert.equal(
      (await listVenues()).some((venue) => venue.name === 'Bot Hall'),
      false,
    )
  })
})
