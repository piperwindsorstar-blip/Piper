/**
 * Rented-in gear: the vocabulary, kept apart from `rentals.ts`.
 *
 * Same split as `dispatch-types.ts` — `rentals.ts` reaches the database and
 * better-sqlite3 is Node-only, so a Client Component importing these lists
 * from it would drag the driver into the browser bundle.
 *
 * This is gear coming *in*, from whoever has it that week. It is deliberately
 * not the fleet: a vehicle is a thing Pynx keeps a row for whether or not it
 * moves, and a hired console is a line on somebody's quote that exists for
 * eleven days and then does not.
 */

/**
 * Where a hire is up to.
 *
 * The same four steps the work actually goes through, and the same words and
 * colours the plan uses, so somebody reading both charts is not learning two
 * vocabularies: purple is a want, yellow is arranged, green is in the building,
 * blue is done with.
 */
export const RENTAL_STATES = ["needed", "booked", "out", "returned"] as const;
export type RentalState = (typeof RENTAL_STATES)[number];

export const RENTAL_LABELS: Record<RentalState, string> = {
  needed: "Needed — not arranged",
  booked: "Booked with them",
  out: "In our hands",
  returned: "Back with them",
};

/** Narrow enough for a tooltip, where the row already names the supplier. */
export const RENTAL_SHORT: Record<RentalState, string> = {
  needed: "Needed",
  booked: "Booked",
  out: "Out",
  returned: "Returned",
};

export function isRentalState(v: unknown): v is RentalState {
  return typeof v === "string" && (RENTAL_STATES as readonly string[]).includes(v);
}

/**
 * A hire nobody has said is back yet, after the day it was due.
 *
 * Derived rather than stored, because a stored "overdue" flag is only correct
 * until midnight and then needs somebody or something to go and change it.
 */
export function isOverdue(state: RentalState, endsOn: string, today: string): boolean {
  return state !== "returned" && endsOn < today;
}

export const ITEM_MAX = 120;
