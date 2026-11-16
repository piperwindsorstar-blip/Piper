import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contactToFill } from './planning.ts'

test('fills an empty booking email and phone from the portal', () => {
  assert.deepEqual(
    contactToFill({ email: '', phone: '' }, { email: ' roxana@example.com ', phone: '519-555-0101' }),
    { email: 'roxana@example.com', phone: '519-555-0101' },
  )
})

test('never replaces contact details the booking already has', () => {
  assert.deepEqual(
    contactToFill({ email: 'old@example.com', phone: '226 555 0000' }, { email: 'new@example.com', phone: '519-555-0101' }),
    {},
  )
})

test('skips answers that are not a real email or phone', () => {
  assert.deepEqual(contactToFill({ email: '', phone: '' }, { email: 'roxana at gmail', phone: 'call me' }), {})
})
