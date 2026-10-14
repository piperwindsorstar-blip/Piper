import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { quote } from '../piper/rules.ts'
import {
  HOME_ADDRESS,
  addressKey,
  distanceLabel,
  kmFromRoutes,
  roundKm,
  routesRequest,
  travelFromKm,
} from './travel.ts'

describe('travel tiers (unchanged from the terms)', () => {
  it('under 50 km is included', () => {
    assert.deepEqual(travelFromKm(4.2, 'full'), { km: 4.2, tier: 'included', feeCents: 0, hotel: false })
    assert.equal(travelFromKm(49.9, 'full').feeCents, 0)
  })
  it('50 km up to and including 100 km is $110', () => {
    assert.equal(travelFromKm(50, 'full').feeCents, 11000)
    assert.equal(travelFromKm(82.4, 'reception').tier, 'near')
    assert.equal(travelFromKm(100, 'full').feeCents, 11000)
  })
  it('over 100 up to and including 200 km is $250', () => {
    assert.equal(travelFromKm(100.1, 'full').feeCents, 25000)
    assert.equal(travelFromKm(200, 'full').hotel, false)
  })
  it('over 200 km is $250 plus a hotel', () => {
    assert.deepEqual(travelFromKm(452.7, 'full'), { km: 452.7, tier: 'hotel', feeCents: 25000, hotel: true })
  })
  it('The Aisle always includes travel, even far away', () => {
    assert.deepEqual(travelFromKm(452.7, 'ceremony'), { km: 452.7, tier: 'ceremony', feeCents: 0, hotel: false })
  })
})

describe('Routes API', () => {
  it('asks for one DRIVE route from home, distance only, key in a header', () => {
    const request = routesRequest('1 Main St, Hamilton, ON', 'test-key')
    assert.equal(request.url, 'https://routes.googleapis.com/directions/v2:computeRoutes')
    const headers = request.init.headers as Record<string, string>
    assert.equal(headers['x-goog-api-key'], 'test-key')
    assert.equal(headers['x-goog-fieldmask'], 'routes.distanceMeters')
    const body = JSON.parse(String(request.init.body))
    assert.equal(body.travelMode, 'DRIVE')
    assert.equal(body.origin.address, HOME_ADDRESS)
    assert.equal(body.destination.address, '1 Main St, Hamilton, ON')
    assert.equal(body.routeModifiers, undefined)
  })
  it('reads km to one decimal, or null with no route', () => {
    assert.equal(roundKm(82_449), 82.4)
    assert.equal(roundKm(82_450), 82.5)
    assert.equal(kmFromRoutes({ routes: [{ distanceMeters: 452_734 }] }), 452.7)
    assert.equal(kmFromRoutes({}), null)
    assert.equal(kmFromRoutes({ routes: [] }), null)
    assert.equal(kmFromRoutes(null), null)
  })
  it('one cache row per address however it is typed', () => {
    assert.equal(addressKey(' 12  Main St ,Paris ON '), addressKey('12 main st, paris on'))
  })
  it('desk labels', () => {
    assert.equal(distanceLabel(82.4, 'auto'), 'Distance: 82.4 km (auto)')
    assert.equal(distanceLabel(82, 'manual'), 'Distance: 82.0 km (manual)')
    assert.equal(distanceLabel(null, 'failed'), "Couldn't find distance, enter manually.")
  })
})

describe('the price with automatic travel', () => {
  const base = { packageId: 'full' as const, withStag: false, uplights: 0, venueKm: [] }
  it('adds the fee for the main venue only, plus $75 for a separate ceremony venue', () => {
    const near = quote({ ...base, travel: { cents: 11000, hotel: false }, secondVenue: true })
    assert.equal(near.totalCents, 165000 + 11000 + 7500)
    const unknown = quote({ ...base, travel: null, secondVenue: false })
    assert.equal(unknown.totalCents, 165000)
  })
  it('The Aisle stays $350 even with a far venue', () => {
    const aisle = quote({ ...base, packageId: 'ceremony', travel: { cents: 25000, hotel: true } })
    assert.equal(aisle.totalCents, 35000)
  })
  it('bookings without worked-out travel keep the older typed kilometres', () => {
    assert.equal(quote({ ...base, venueKm: [60] }).totalCents, 165000 + 11000)
  })
})
