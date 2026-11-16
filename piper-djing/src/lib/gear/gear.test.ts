import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  STARTING_GEAR,
  gearDateLabel,
  gearDollars,
  gearPurchased,
  gearTotalCents,
  gearValueCents,
} from './gear.ts'
import { addGear, listGear, removeGear, updateGear } from './gear.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

describe('gear rules', () => {
  it('starts with 22 items worth $8,659, cables unpriced', () => {
    assert.equal(STARTING_GEAR.length, 22)
    assert.equal(gearTotalCents(STARTING_GEAR), 865_900)
    assert.equal(gearDollars(865_900), '$8,659')
    assert.equal(STARTING_GEAR.filter((g) => g.valueCents === null).length, 9)
    assert.equal(STARTING_GEAR.some((g) => /TROND/i.test(g.item)), false)
  })

  it('reads values and dates', () => {
    assert.equal(gearValueCents('$1,060'), 106_000)
    assert.equal(gearValueCents('1060.5'), 106_050)
    assert.equal(gearValueCents(''), null)
    assert.throws(() => gearValueCents('-5'), /dollars/)
    assert.equal(gearPurchased('2026-10'), '2026-10')
    assert.equal(gearPurchased(''), '')
    assert.throws(() => gearPurchased('Oct 2026'), /YYYY-MM/)
    assert.equal(gearDateLabel('2026-10'), 'Oct 2026')
    assert.equal(gearDateLabel('2026-10-27'), 'Oct 27, 2026')
  })

  it('is only used by the Desk', () => {
    const users: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.(ts|tsx)$/.test(name) && !path.includes(join('lib', 'gear'))) {
          if (/lib\/gear\//.test(readFileSync(path, 'utf8'))) users.push(path)
        }
      }
    }
    walk(new URL('../..', import.meta.url).pathname)
    assert.deepEqual(users.sort(), ['src/routes/desk/gear.tsx'].map((p) => new URL(`../../../${p}`, import.meta.url).pathname))
  })
})

describe('gear in the book', { skip: liveBook }, () => {
  it('seeds once, then adds, edits and deletes', async () => {
    let items = await listGear()
    assert.equal(items.length, 22)
    assert.equal(gearTotalCents(items), 865_900)
    await addGear({ item: 'Test speaker', serial: 'Unknown', purchased: '', value: '100', notes: '' })
    items = await listGear()
    const added = items.at(-1)
    assert.ok(added)
    assert.equal(added.item, 'Test speaker')
    assert.equal(gearTotalCents(items), 875_900)
    await updateGear(added.id, { item: 'Test speaker 2', serial: 'ABC', purchased: '2026-10-28', value: '', notes: 'Loaner' })
    const edited = (await listGear()).find((g) => g.id === added.id)
    assert.equal(edited?.item, 'Test speaker 2')
    assert.equal(edited?.valueCents, null)
    await removeGear(added.id)
    assert.equal((await listGear()).length, 22)
    await assert.rejects(() => addGear({ item: ' ', serial: '', purchased: '', value: '', notes: '' }), /required/)
  })
})
