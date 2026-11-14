import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { figuresFor } from './booking-rules.ts'
import { cleanLineItems, parseLineItems } from './line-items.ts'

const full = {
  partnerOne: 'Sam',
  partnerTwo: 'Alex',
  eventDate: '2027-08-14',
  stagDate: null,
  packageId: 'full' as const,
  withStag: false,
  uplights: 0,
  venueKm: [],
  venueName: '',
  venueStreet: '',
  sample: false,
  travel: { cents: 0, hotel: false },
}

describe('custom invoice lines', () => {
  it('Full wedding day $1,650 with a -$350 labelled line is $1,300, deposit $400', () => {
    const figures = figuresFor({
      ...full,
      lineItems: [{ label: 'MG Event Planning Preferred Discount', cents: -35000 }],
    })
    assert.equal(figures.totalCents, 130000)
    assert.equal(figures.depositCents, 40000)
    assert.equal(figures.discountCents, 0)
  })

  it('the same $350 in the Discount field still gives $1,300 and $400 (booking 27-05)', () => {
    const figures = figuresFor({ ...full, discountCents: 35000 })
    assert.equal(figures.totalCents, 130000)
    assert.equal(figures.depositCents, 40000)
  })

  it('lines and the Discount field together: total = package + lines - discount', () => {
    const figures = figuresFor({
      ...full,
      uplights: 2,
      discountCents: 10000,
      lineItems: [
        { label: 'Extra hour of ceremony music', cents: 15000 },
        { label: 'Loyalty credit', cents: -5000 },
      ],
    })
    assert.equal(figures.totalCents, 165000 + 3000 + 15000 - 5000 - 10000)
    assert.equal(figures.depositCents, 50000)
  })

  it('no lines leaves every figure exactly as before', () => {
    assert.deepEqual(figuresFor({ ...full, lineItems: [] }), figuresFor(full))
  })

  it('lines cannot take the total below zero', () => {
    assert.throws(() => figuresFor({ ...full, lineItems: [{ label: 'Too much', cents: -200000 }] }), /below zero/)
  })

  it('typed lines need a label and an amount; stored lines read safely', () => {
    assert.deepEqual(cleanLineItems([{ label: '  Late finish  ', cents: 2500 }]), [{ label: 'Late finish', cents: 2500 }])
    assert.throws(() => cleanLineItems([{ label: '', cents: 100 }]), /needs a label/)
    assert.throws(() => cleanLineItems([{ label: 'Zero', cents: 0 }]), /needs an amount/)
    assert.deepEqual(parseLineItems('not json'), [])
    assert.deepEqual(parseLineItems('[{"label":"A","cents":-500}]'), [{ label: 'A', cents: -500 }])
  })
})
