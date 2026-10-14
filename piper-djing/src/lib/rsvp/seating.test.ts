import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sampleWedding } from './demo.ts'
import {
  seatNamePlan,
  enlargeRoomToFit,
  layoutSeatNames,
  autoArrange,
  overlappingTables,
  seatNameSpot,
  tableLabelLayout,
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
    // Repaired, never refused: the second guest in a full table's only chair
    // goes back to Unassigned, and the save goes through.
    const repaired = validateSeating(crowded, sampleWedding())
    assert.ok(repaired.ok)
    if (repaired.ok) {
      assert.equal(repaired.repaired, 1)
      assert.deepEqual(Object.keys(repaired.plan.seats), ['liz'])
    }
    const doubled = threeTables()
    doubled.seats = {
      liz: { tableId: 'a', seat: 2 },
      david: { tableId: 'a', seat: 2 },
      chidi: { tableId: 'a', seat: 40 },
    }
    const moved = validateSeating(doubled, sampleWedding())
    assert.ok(moved.ok)
    if (moved.ok) {
      const spots = Object.values(moved.plan.seats).map((spot) => spot.seat)
      assert.equal(new Set(spots).size, 3, 'everyone ends up in their own chair')
    }
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

describe('table labels', () => {
  it('stacks the name and count without overlap, upright when turned', () => {
    const head = { shape: 'banquet' as const, w: 120, h: 30, rotation: 0, name: 'Head table' }
    const flat = tableLabelLayout(head, 12, 10)
    // Both lines fit inside a 30″ deep head table only when stacked tight.
    if (flat.showCount) {
      assert.ok(flat.titleY + flat.titleSize / 2 <= flat.countY - flat.countSize / 2 + 0.01)
      assert.ok(flat.titleSize + flat.countSize <= 30)
    }
    const turned = tableLabelLayout({ ...head, rotation: 90 }, 12, 10)
    if (turned.showCount) {
      assert.ok(turned.titleY + turned.titleSize / 2 <= turned.countY - turned.countSize / 2)
    }
    const round = tableLabelLayout(
      { shape: 'round', w: 72, h: 72, rotation: 0, name: '1' },
      12,
      10,
    )
    assert.equal(round.showCount, true)
    assert.ok(round.titleY + round.titleSize / 2 <= round.countY - round.countSize / 2 + 0.01)
  })

  it('never goes below the readable minimum', () => {
    const small = tableLabelLayout(
      { shape: 'rectangle', w: 72, h: 36, rotation: 0, name: '2' },
      30,
      22,
    )
    assert.ok(small.titleSize >= 30)
    assert.ok(small.countSize >= 22)
    assert.equal(small.showCount, false)
  })
})

describe('seat names', () => {
  it('sit just outside each seat, centred on the line from the table', () => {
    const centre = { x: 0, y: 0 }
    const below = seatNameSpot({ x: 0, y: 56 }, centre, ['Ada O.'], 9, 12)
    assert.equal(Math.round(below.x), 0)
    assert.ok(below.y > 56 + 12 && below.y < 56 + 12 + 12)
    const right = seatNameSpot({ x: 56, y: 0 }, centre, ['Ada O.'], 9, 12)
    // Centred, so it reaches out only half its width past the seat.
    assert.ok(right.x - 56 < 12 + 2 + 6 * 9 * 0.56)
  })
})

describe('placing tables in a full room (127 guests, 14 tables)', () => {
  function bigPlan(): SeatingPlan {
    let plan = emptySeating()
    plan.items.push({
      id: 'floor', kind: 'dance-floor', label: 'Dance floor',
      x: 504, y: 360, w: 192, h: 192, rotation: 0,
    })
    let n = 0
    plan = addTables(plan, 14, () => `t${(n += 1)}`)
    // Tables of 10, as a 125-guest wedding would set them.
    plan.tables = plan.tables.map((table) => ({ ...table, seats: 10, w: 72, h: 72 }))
    return plan
  }

  it('puts new tables only on clear floor', () => {
    let plan = emptySeating()
    plan.items.push({
      id: 'floor', kind: 'dance-floor', label: 'Dance floor',
      x: 504, y: 360, w: 192, h: 192, rotation: 0,
    })
    let n = 0
    plan = addTables(plan, 10, () => `n${(n += 1)}`)
    assert.deepEqual(overlappingTables(plan), [])
  })

  it('auto-arranges every table around the dance floor with no overlaps', () => {
    const scattered = bigPlan()
    // Pile them all on top of each other first.
    scattered.tables = scattered.tables.map((table) => ({ ...table, x: 500, y: 360, rotation: 30 }))
    assert.ok(overlappingTables(scattered).length > 0)
    const result = autoArrange(scattered)
    assert.equal(result.unplaced, 0)
    assert.deepEqual(overlappingTables(result.plan), [])
    assert.ok(result.plan.tables.every((table) => table.rotation === 0))
    // Table 1 is the closest to the dance floor.
    const distance = (id: string) => {
      const table = result.plan.tables.find((item) => item.id === id)!
      return Math.hypot(table.x - 504, table.y - 360)
    }
    const nearest = Math.min(...result.plan.tables.map((table) => distance(table.id)))
    assert.equal(distance('t1'), nearest)
  })

  it('says how many tables do not fit in a room that is too small', () => {
    const plan = resizeRoom(bigPlan(), 360, 360)
    const result = autoArrange(plan)
    assert.ok(result.unplaced > 0)
  })
})

describe('round 2 fixes', () => {
  it('fits 14 tables of 10, a head table, dance floor and DJ booth in 84 × 60 ft', () => {
    for (const w of [60, 72, 74]) {
      let plan = emptySeating()
      plan.items.push({
        id: 'floor', kind: 'dance-floor', label: 'Dance floor',
        x: 504, y: 360, w: 192, h: 192, rotation: 0,
      })
      let n = 0
      plan = addTables(plan, 14, () => `t${(n += 1)}`)
      plan.tables = plan.tables.map((table) => ({ ...table, seats: 10, w, h: w }))
      plan.tables.push({
        id: 'head', name: 'Head table', shape: 'banquet', seats: 4,
        x: 30, y: 30, w: 120, h: 30, rotation: 0,
      })
      const result = autoArrange(plan)
      assert.equal(result.unplaced, 0, `${w}″ tables`)
      assert.deepEqual(overlappingTables(result.plan), [])
    }
  })

  it('offers a bigger room when tables truly cannot fit', () => {
    let plan = resizeRoom(emptySeating(), 360, 300)
    let n = 0
    plan = addTables(plan, 14, () => `t${(n += 1)}`)
    assert.ok(autoArrange(plan).unplaced > 0)
    const grown = enlargeRoomToFit(plan)
    assert.equal(grown.unplaced, 0)
    assert.ok(grown.plan.room.width > 360)
    assert.deepEqual(overlappingTables(grown.plan), [])
  })

  it('shows the count on 60″ and 72″ tables at a desktop Fit zoom, and in print', () => {
    for (const w of [60, 72]) {
      const table = { shape: 'round' as const, w, h: w, rotation: 0, name: '13' }
      // About 1.5 floor inches per screen pixel at Fit on a laptop.
      assert.equal(tableLabelLayout(table, 1.5 * 12, 1.5 * 9).showCount, true)
      assert.equal(tableLabelLayout(table, 14, 0).showCount, true, 'print')
    }
  })

  it('never lets names around a 10-seat round table overlap', () => {
    const table = { id: 't', name: '7', shape: 'round' as const, seats: 10, x: 300, y: 300, w: 74, h: 74, rotation: 0 }
    const seats = placedSeats(table)
    const boxesOf = (labels: ReturnType<typeof layoutSeatNames>) =>
      labels.flatMap((label) => {
        if (!label) return []
        const longest = Math.max(...label.lines.map((line) => line.length))
        const halfW = (longest * 9 * 0.64) / 2
        return [{
          x0: label.x - halfW, x1: label.x + halfW,
          y0: label.y - label.lineHeight / 2,
          y1: label.y + (label.lines.length - 0.5) * label.lineHeight,
        }]
      })
    for (const names of [
      seats.map((_, index) => `Mock Guest ${String(21 + index).padStart(3, '0')}`),
      ['Elizabeth Miller', 'David Miller', 'Nora Miller', 'Chidi Okafor', 'Ada Okafor',
        'Rose Harrington', 'William Thompson', 'Jordan Lee', 'Sam Park', 'Kai Wong'],
    ]) {
      const plan = seatNamePlan(seats, { x: 300, y: 300 }, names, 9, 10)
      if (plan.mode === 'numbers') {
        // Numbers on the seats; every name listed once beside the table.
        assert.equal(plan.list.length, 10)
        assert.deepEqual(plan.list.map((row) => row.name), names)
        continue
      }
      const boxes = boxesOf(plan.labels)
      assert.equal(boxes.length, 10, 'every name shows in full')
      for (const label of plan.labels) {
        assert.ok(label && !label.lines.join(' ').match(/^Mock \d\.$/), 'never "Mock 0."')
      }
      for (const [i, a] of boxes.entries()) {
        for (const b of boxes.slice(i + 1)) {
          assert.equal(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1, false)
        }
      }
    }
  })

  it('arranges the saved Mark & Mya layout with no table left over', () => {
    const plan = emptySeating()
    plan.items.push({
      id: 'floor', kind: 'dance-floor', label: 'Dance floor',
      x: 504, y: 360, w: 192, h: 192, rotation: 0,
    })
    plan.tables.push({ id: 't1', name: '1', shape: 'round', seats: 8, x: 100, y: 100, w: 90, h: 90, rotation: 0 })
    plan.tables.push({ id: 't2', name: '2', shape: 'rectangle', seats: 6, x: 300, y: 100, w: 90, h: 36, rotation: 0 })
    for (let n = 3; n <= 13; n += 1) {
      plan.tables.push({ id: `t${n}`, name: String(n), shape: 'round', seats: 10, x: 500, y: 300, w: 74, h: 74, rotation: 0 })
    }
    plan.tables.push({ id: 'head', name: 'Head table', shape: 'banquet', seats: 4, x: 500, y: 150, w: 120, h: 30, rotation: 15 })
    const result = autoArrange(plan)
    assert.equal(result.unplaced, 0)
    assert.deepEqual(overlappingTables(result.plan), [])
    assert.ok(result.plan.tables.every((table) => table.rotation === 0))
  })
})
