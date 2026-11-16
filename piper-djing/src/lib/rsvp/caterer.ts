/**
 * The caterer's report: who is coming, what each guest eats, every dietary
 * or allergy note, and who sits at which table, so servers know who gets
 * what. Pure, so the printout and its tests agree.
 */

import {
  coupleTitle,
  guestOutcome,
  longWeddingDate,
  mealOptions,
  shortMonthDay,
} from './model.ts'
import type { RsvpWedding } from './model.ts'
import { tableLabel } from './seating.ts'
import type { SeatingPlan } from './seating.ts'

export type CatererGuest = {
  id: string
  name: string
  party: string
  child: boolean
  meal: string
  /** "A", "B"… for the meal; "K" for a kids' meal with no choice; "–" for none yet. */
  code: string
  dietary: string
  table: string
  seat: number
}

export type CatererMeal = {
  code: string
  meal: string
  adults: number
  kids: number
  total: number
}

export type CatererSheet = {
  couple: string
  dateLabel: string
  venue: string
  address: string
  deadline: string
  attending: number
  adults: number
  kids: number
  meals: CatererMeal[]
  dietary: CatererGuest[]
  tables: { table: string; guests: CatererGuest[] }[]
  unseated: CatererGuest[]
}

export const KIDS_CODE = 'K'
export const NO_MEAL_CODE = '–'

/** One letter per meal, in the order the couple offers them. */
export function mealLetters(
  options: string[],
  chosen: string[],
): Map<string, string> {
  const letters = new Map<string, string>()
  const alphabet = 'ABCDEFGHIJLMNOPQRSTUVWXYZ' // K is the kids' meal
  for (const meal of [...options, ...chosen]) {
    const key = meal.trim()
    if (!key || letters.has(key)) continue
    letters.set(key, alphabet[letters.size] ?? '?')
  }
  return letters
}

function numberOf(name: string): number {
  return /^\d+$/.test(name.trim()) ? Number(name) : Number.POSITIVE_INFINITY
}

export function catererSheet(
  wedding: RsvpWedding,
  plan: SeatingPlan,
): CatererSheet {
  const tables = new Map(plan.tables.map((table) => [table.id, table]))
  const people: (Omit<CatererGuest, 'code'> & { tableId: string })[] = []
  for (const party of wedding.parties) {
    for (const guest of party.guests) {
      if (guestOutcome(guest, party) !== 'attending') continue
      const spot = plan.seats[guest.id]
      const table = spot ? tables.get(spot.tableId) : undefined
      people.push({
        id: guest.id,
        name: `${guest.firstName} ${guest.lastName}`.trim() || 'Guest',
        party: party.name,
        child: guest.isChild,
        meal: guest.meal.trim(),
        dietary: [...guest.dietary, guest.dietaryNote.trim()]
          .filter(Boolean)
          .join('; '),
        table: table ? tableLabel(table.name) : '',
        tableId: table ? table.id : '',
        seat: spot && table ? spot.seat + 1 : 0,
      })
    }
  }
  const letters = mealLetters(
    mealOptions(wedding),
    people.map((person) => person.meal),
  )
  const guests: (CatererGuest & { tableId: string })[] = people.map(
    (person) => ({
      ...person,
      code: person.meal
        ? (letters.get(person.meal) ?? '?')
        : person.child
          ? KIDS_CODE
          : NO_MEAL_CODE,
    }),
  )

  const meals: CatererMeal[] = []
  for (const [meal, code] of letters) {
    const eating = guests.filter((guest) => guest.meal === meal)
    const kids = eating.filter((guest) => guest.child).length
    meals.push({
      code,
      meal,
      adults: eating.length - kids,
      kids,
      total: eating.length,
    })
  }
  const kidsMeals = guests.filter((guest) => !guest.meal && guest.child).length
  if (kidsMeals > 0) {
    meals.push({
      code: KIDS_CODE,
      meal: "Kids' meal",
      adults: 0,
      kids: kidsMeals,
      total: kidsMeals,
    })
  }
  const notChosen = guests.filter((guest) => !guest.meal && !guest.child).length
  if (notChosen > 0) {
    meals.push({
      code: NO_MEAL_CODE,
      meal: 'Not chosen yet',
      adults: notChosen,
      kids: 0,
      total: notChosen,
    })
  }

  const byTable = (a: { table: string; tableId: string; seat: number; name: string }, b: typeof a) => {
    const at = plan.tables.findIndex((table) => table.id === a.tableId)
    const bt = plan.tables.findIndex((table) => table.id === b.tableId)
    if (!a.tableId !== !b.tableId) return a.tableId ? -1 : 1
    if (at !== bt) {
      const an = numberOf(plan.tables[at]?.name ?? '')
      const bn = numberOf(plan.tables[bt]?.name ?? '')
      if (an !== bn) return an - bn
      return a.table.localeCompare(b.table)
    }
    return a.seat - b.seat || a.name.localeCompare(b.name)
  }

  const tableGroups = plan.tables
    .slice()
    .sort(
      (a, b) =>
        numberOf(a.name) - numberOf(b.name) || a.name.localeCompare(b.name),
    )
    .map((table) => ({
      table: tableLabel(table.name),
      guests: guests
        .filter((guest) => guest.tableId === table.id)
        .sort((a, b) => a.seat - b.seat || a.name.localeCompare(b.name))
        .map(strip),
    }))
    .filter((group) => group.guests.length > 0)

  const kids = guests.filter((guest) => guest.child).length
  return {
    couple: coupleTitle(wedding),
    dateLabel: longWeddingDate(wedding.eventDate),
    venue: wedding.venue,
    address: wedding.address,
    deadline: shortMonthDay(wedding.deadline),
    attending: guests.length,
    adults: guests.length - kids,
    kids,
    meals,
    dietary: guests
      .filter((guest) => guest.dietary)
      .sort(byTable)
      .map(strip),
    tables: tableGroups,
    unseated: guests
      .filter((guest) => !guest.tableId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(strip),
  }
}

function strip<T extends { tableId: string }>(guest: T): Omit<T, 'tableId'> {
  const { tableId: _drop, ...rest } = guest
  void _drop
  return rest
}
