import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { invoiceShownStatus } from './booking-rules.ts'

describe('invoice status shown', () => {
  it('reads paid once everything is in, and goes back if refunded', () => {
    assert.equal(invoiceShownStatus({ status: 'sent', totalCents: 165000, receivedCents: 165000 }), 'paid')
    assert.equal(invoiceShownStatus({ status: 'sent', totalCents: 165000, receivedCents: 170000 }), 'paid')
    assert.equal(invoiceShownStatus({ status: 'sent', totalCents: 165000, receivedCents: 50000 }), 'sent')
    assert.equal(invoiceShownStatus({ status: 'draft', totalCents: 165000, receivedCents: 0 }), 'draft')
    assert.equal(invoiceShownStatus({ status: 'void', totalCents: 165000, receivedCents: 165000 }), 'void')
    assert.equal(invoiceShownStatus({ status: 'sent', totalCents: 0, receivedCents: 0 }), 'sent')
  })
})
