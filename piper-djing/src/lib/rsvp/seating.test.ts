import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sampleWedding } from './demo.ts'
import {
  addTables,
  crowdingWarning,
  findYourSeat,
  formatLength,
  placedSeats,
  resizeRoom,
  toInches,
  assignGuest,
  emptySeating,
  parseSeating,
  pruneSeating,
  removeTable,
  resizeTable,
  seatLabelLines,
  seatParty,
  seatPositions,
  seatableGuests,
  seatingChartCsv,
  validateSeating,
} from './seating.ts'
import type { SeatingPlan } from './seating.ts'

let counter = 0
const makeId = () => {
  counter += 1
  return `t${counter}`
}

function threeTables(): SeatingPlan {
  const base = emptySeating()
  return {
    ...base,
    tables: [
      { id: 'a', name: '1', shape: 'round', seats: 8, x: 200, y: 200, w: 72, h: 72, rotation: 0 },
      { id: 'b', name: '2', shape: 'rectangle', seats: 6, x: 500, y: 200, w: 96, h: 36, rotation: 0 },
      { id: 'c', name: 'Head table', shape: 'banquet', seats: 4, x: 500, y: 60, w: 120, h: 30, rotation: 0 },
    ],
  }
}

describe('seatable guests', () => {
  it('lists only guests confirmed attending', () => {
    const ids = seatableGuests(sampleWedding()).map((guest) => guest.id)
    assert.ok(ids.includes('liz'))
    assert.ok(ids.includes('chidi'))
    assert.ok(!ids.includes('nora'), 'declined guest is left out')
    assert.ok(!ids.includes('william'), 'waiting guest is left out')
  })
})

describe('assigning seats', () => {
  it('seats a guest at the first free seat and blocks a full table', () => {
    let plan = threeTables()
    plan.tables[2] = { ...plan.tables[2]!, seats: 1 }
    const first = assignGuest(plan, 'liz', 'c')
    assert.ok(first.ok)
    plan = first.ok ? first.plan : plan
    assert.deepEqual(plan.seats.liz, { tableId: 'c', seat: 0 })
    const second = assignGuest(plan, 'david', 'c')
    assert.equal(second.ok, false)
    assert.match(second.ok ? '' : second.error, /Head table is full \(1 of 1 seats\)/)
  })

  it('refuses a taken seat', () => {
    const one = assignGuest(threeTables(), 'liz', 'a', 3)
    assert.ok(one.ok)
    const two = assignGuest(one.ok ? one.plan : threeTables(), 'david', 'a', 3)
    assert.equal(two.ok, false)
  })

  it('seats a whole party or explains why not', () => {
    const plan = threeTables()
    plan.tables[2] = { ...plan.tables[2]!, seats: 1 }
    const refused = seatParty(plan, ['liz', 'david'], 'c')
    assert.equal(refused.ok, false)
    assert.match(refused.ok ? '' : refused.error, /1 free seat, and this party needs 2/)
    const seated = seatParty(plan, ['liz', 'david'], 'a')
    assert.ok(seated.ok)
    if (seated.ok) {
      assert.equal(seated.plan.seats.liz?.tableId, 'a')
      assert.equal(seated.plan.seats.david?.tableId, 'a')
      assert.notEqual(seated.plan.seats.liz?.seat, seated.plan.seats.david?.seat)
    }
  })

  it('sends guests back to Unassigned when their table is removed', () => {
    const seated = seatParty(threeTables(), ['liz', 'david'], 'a')
    assert.ok(seated.ok)
    const plan = removeTable(seated.ok ? seated.plan : threeTables(), 'a')
    assert.equal(plan.tables.length, 2)
    assert.equal(plan.seats.liz, undefined)
  })

  it('will not shrink a table below the guests sitting at it', () => {
    const seated = seatParty(threeTables(), ['liz', 'david', 'chidi'], 'a')
    assert.ok(seated.ok)
    const plan = seated.ok ? seated.plan : threeTables()
    assert.equal(resizeTable(plan, 'a', 2).ok, false)
    const ok = resizeTable(plan, 'a', 3)
    assert.ok(ok.ok)
  })
})

describe('validating a posted plan', () => {
  it('requires unique table numbers', () => {
    const plan = threeTables()
    plan.tables[1] = { ...plan.tables[1]!, name: ' 1 ' }
    const result = validateSeating(plan, sampleWedding())
    assert.equal(result.ok, false)
    assert.match(result.ok ? '' : result.error, /must be unique/)
  })

  it('drops declined guests and refuses overfull tables', () => {
    const plan = threeTables()
    plan.seats = {
      liz: { tableId: 'a', seat: 0 },
      nora: { tableId: 'a', seat: 1 },
    }
    const result = validateSeating(plan, sampleWedding())
    assert.ok(result.ok)
    if (result.ok) assert.deepEqual(Object.keys(result.plan.seats), ['liz'])
    const crowded = threeTables()
    crowded.tables[2] = { ...crowded.tables[2]!, seats: 1 }
    crowded.seats = {
      liz: { tableId: 'c', seat: 0 },
      david: { tableId: 'c', seat: 0 },
    }
    assert.equal(validateSeating(crowded, sampleWedding()).ok, false)
  })
})

describe('a guest who stops attending', () => {
  it('comes off their seat with a notice for the couple', () => {
    const wedding = sampleWedding()
    const plan = threeTables()
    plan.seats = {
      liz: { tableId: 'a', seat: 0 },
      david: { tableId: 'a', seat: 1 },
    }
    const david = wedding.parties
      .flatMap((party) => party.guests)
      .find((guest) => guest.id === 'david')
    assert.ok(david)
    david.replies = { ceremony: 'declined', brunch: 'declined' }
    const pruned = pruneSeating(plan, wedding, '2026-10-13T20:00:00Z', makeId)
    assert.equal(pruned.changed, true)
    assert.equal(pruned.plan.seats.david, undefined)
    assert.ok(pruned.plan.seats.liz)
    assert.match(
      pruned.plan.notices[0]?.text ?? '',
      /David Miller changed their RSVP to "Can't make it" and was taken off Table 1/,
    )
    const again = pruneSeating(pruned.plan, wedding, 'now', makeId)
    assert.equal(again.changed, false)
  })
})

describe('the seating chart CSV', () => {
  it('lists seats by table, then unassigned confirmed guests last', () => {
    const seated = seatParty(threeTables(), ['liz', 'david'], 'a')
    assert.ok(seated.ok)
    const csv = seatingChartCsv(seated.ok ? seated.plan : threeTables(), sampleWedding())
    const lines = csv.replace(/^﻿/, '').split('\r\n')
    assert.equal(lines[0], 'Table,Seat,Party,Guest,Child,Meal,Event')
    assert.match(lines[1] ?? '', /^1,1,The Miller Family,Elizabeth Miller,,Wild salmon,/)
    assert.match(lines[2] ?? '', /^1,2,The Miller Family,David Miller,,Prime rib,/)
    const rest = lines.slice(3)
    assert.ok(rest.length > 0)
    assert.ok(rest.every((line) => line.startsWith(',,')))
    assert.ok(!csv.includes('Nora'))
  })
})

describe('the floor plan', () => {
  it('draws one seat per place for every shape', () => {
    for (const shape of ['round', 'rectangle', 'square', 'banquet'] as const) {
      for (const seats of [1, 4, 6, 8, 13]) {
        assert.equal(seatPositions(shape, seats).length, seats, `${shape} ${seats}`)
      }
    }
  })

  it('creates numbered tables that do not stack on each other', () => {
    const plan = addTables(emptySeating(), 3, makeId)
    assert.deepEqual(
      plan.tables.map((table) => table.name),
      ['1', '2', '3'],
    )
    const spots = new Set(plan.tables.map((table) => `${table.x},${table.y}`))
    assert.equal(spots.size, 3)
  })

  it('reads back a stored plan and ignores junk', () => {
    const plan = parseSeating({
      tables: [{ id: 'a', name: '1', shape: 'oval', seats: 99, x: -5, y: 9000 }, null],
      seats: { liz: { tableId: 'a', seat: 0 }, bad: { seat: 1 } },
      notices: 'nope',
    })
    assert.equal(plan.tables[0]?.shape, 'round')
    assert.equal(plan.tables[0]?.seats, 30)
    assert.equal(plan.tables[0]?.x, 0)
    assert.equal(plan.tables[0]?.y, 720)
    assert.deepEqual(Object.keys(plan.seats), ['liz'])
    assert.deepEqual(plan.notices, [])
  })
})

describe('names beside a seat', () => {
  it('keeps the whole name, wrapping long ones so guests stay told apart', () => {
    assert.deepEqual(seatLabelLines('Test Guest One'), ['Test Guest One'])
    assert.deepEqual(seatLabelLines('Test Guest Two'), ['Test Guest Two'])
    assert.deepEqual(seatLabelLines('Elizabeth Miller'), ['Elizabeth M.'])
    assert.deepEqual(seatLabelLines('Ada Okafor'), ['Ada Okafor'])
    assert.deepEqual(seatLabelLines('Maximiliana Wolfeschlegelsteinhausen'), [
      'Maximiliana W.',
    ])
    assert.deepEqual(seatLabelLines('Bartholomew-James Okonkwo'), [
      'Bartholomew-J…',
      'Okonkwo',
    ])
    assert.deepEqual(seatLabelLines('Anna Maria Louisa de la Cruz Fernandez'), [
      'Anna F.',
    ])
  })
})

describe('the room', () => {
  it('starts with a DJ booth labelled DJ Piper P, also for older plans', () => {
    const fresh = emptySeating()
    assert.equal(fresh.items[0]?.kind, 'dj-booth')
    assert.equal(fresh.items[0]?.label, 'DJ Piper P')
    const older = parseSeating({ tables: [], seats: {} })
    assert.equal(older.items[0]?.label, 'DJ Piper P')
    const removed = parseSeating({ tables: [], seats: {}, items: [] })
    assert.equal(removed.items.length, 0, 'a booth the couple removed stays gone')
  })

  it('keeps sizes, rotation and room items through a save', () => {
    const plan = threeTables()
    plan.tables[0] = { ...plan.tables[0]!, w: 66, rotation: 370 }
    plan.items.push({
      id: 'floor', kind: 'dance-floor', label: 'Dance floor',
      x: 500, y: 360, w: 192, h: 192, rotation: 45,
    })
    const back = parseSeating(JSON.parse(JSON.stringify(plan)))
    assert.equal(back.tables[0]?.w, 66)
    assert.equal(back.tables[0]?.h, 66, 'a round table stays round')
    assert.equal(back.tables[0]?.rotation, 10)
    assert.equal(back.items[1]?.kind, 'dance-floor')
    assert.equal(back.items[1]?.rotation, 45)
  })

  it('keeps everything inside the walls when the room shrinks', () => {
    const plan = resizeRoom(threeTables(), 360, 240)
    assert.ok(plan.tables.every((table) => table.x <= 360 && table.y <= 240))
  })

  it('measures in feet or metres', () => {
    assert.equal(formatLength(60, 'ft', 'table'), '60″')
    assert.equal(formatLength(720, 'ft', 'room'), '60 ft')
    assert.equal(formatLength(60, 'm', 'table'), '152 cm')
    assert.equal(Math.round(toInches(20, 'm', 'room')), 787)
  })
})

describe('table sizes and seats', () => {
  it('turns seats with the table', () => {
    const plan = threeTables()
    const table = { ...plan.tables[2]!, rotation: 90 }
    const seats = placedSeats(table)
    assert.equal(seats.length, 4)
    // Along the back of an unturned banquet; turned 90°, along its right side.
    assert.ok(seats.every((seat) => seat.x > table.x))
  })

  it('warns, without blocking, when seats are crowded', () => {
    const plan = threeTables()
    assert.equal(crowdingWarning(plan.tables[0]!), '')
    const tight = { ...plan.tables[0]!, seats: 14, w: 36, h: 36 }
    assert.match(crowdingWarning(tight), /Table 1 looks tight/)
  })
})

describe('find your seat', () => {
  it('lists seated guests alphabetically by last name with their table', () => {
    const seated = seatParty(threeTables(), ['liz', 'chidi'], 'a')
    assert.ok(seated.ok)
    const list = findYourSeat(
      seated.ok ? seated.plan : threeTables(),
      seatableGuests(sampleWedding()),
    )
    assert.deepEqual(
      list.map((row) => `${row.name} → ${row.table}`),
      ['Elizabeth Miller → Table 1', 'Chidi Okafor → Table 1'],
    )
  })
})
