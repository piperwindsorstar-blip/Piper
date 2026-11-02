import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pairNames } from './names.ts'

test('one name has no trailing "and"', () => {
  assert.equal(pairNames('Jordan Biggs', ''), 'Jordan Biggs')
  assert.equal(pairNames('Jordan Biggs', '  '), 'Jordan Biggs')
  assert.equal(pairNames('Mark', 'Mya'), 'Mark and Mya')
  assert.equal(pairNames('Mark', 'Mya', '&'), 'Mark & Mya')
})
