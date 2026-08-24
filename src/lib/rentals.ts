import { db } from "./db";
import type { RentalState } from "./rentals-types";

/**
 * Gear hired in.
 *
 * The mirror image of the fleet: the board says what Pynx sends out, this says
 * what is coming the other way and whose it is. They are kept apart because the
 * standing thing is different in each. A vehicle keeps its row whether or not
 * it moves; a hired console is a line on somebody's quote that lives for eleven
 * days. So here the *supplier* is the row — the places Pynx phones, which do
 * not change much — and each hire is a bar across the days it is held for.
 *
 * Nothing here books a vehicle and nothing on the fleet appears here. Same
 * separation as the plan and the board, for the same reason: a hire from
 * System2Go is not a Pencar van and confusing the two loses a truck.
 */

export type Supplier = {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  notes: string | null;
  active: number;
  created_at: string;
};

export type Rental = {
  id: number;
  supplier_id: number;
  item: string;
  quantity: number;
  state: RentalState;
  starts_on: string;
  ends_on: string;
  job: string | null;
  reference: string | null;
  cost: string | null;
  notes: string | null;
  created_at: string;
};

/* -------------------------------------------------------------- suppliers */

export function listSuppliers(includeInactive = false): Supplier[] {
  return db()
    .prepare(
      `SELECT * FROM rental_suppliers ${includeInactive ? "" : "WHERE active = 1"}
        ORDER BY active DESC, name COLLATE NOCASE`,
    )
    .all() as Supplier[];
}

export function getSupplier(id: number): Supplier | null {
  return (
    (db().prepare("SELECT * FROM rental_suppliers WHERE id = ?").get(id) as Supplier | undefined) ??
    null
  );
}

export type SupplierInput = {
  name: string;
  contact: string | null;
  phone: string | null;
  notes: string | null;
};

export function createSupplier(input: SupplierInput): number {
  const result = db()
    .prepare("INSERT INTO rental_suppliers (name, contact, phone, notes) VALUES (?, ?, ?, ?)")
    .run(input.name, input.contact, input.phone, input.notes);
  return Number(result.lastInsertRowid);
}

export function updateSupplier(id: number, input: SupplierInput): void {
  db()
    .prepare("UPDATE rental_suppliers SET name = ?, contact = ?, phone = ?, notes = ? WHERE id = ?")
    .run(input.name, input.contact, input.phone, input.notes, id);
}

/**
 * Retired rather than deleted, for the same reason a sold van is: last year's
 * hires still have to say who they came from.
 */
export function setSupplierActive(id: number, active: boolean): void {
  db().prepare("UPDATE rental_suppliers SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
}

/* ---------------------------------------------------------------- rentals */

/** Hires touching a window at all, not only those contained by it. */
export function rentalsBetween(from: string, to: string): Rental[] {
  return db()
    .prepare(
      `SELECT * FROM rentals WHERE starts_on <= ? AND ends_on >= ?
        ORDER BY starts_on, id`,
    )
    .all(to, from) as Rental[];
}

export function getRental(id: number): Rental | null {
  return (db().prepare("SELECT * FROM rentals WHERE id = ?").get(id) as Rental | undefined) ?? null;
}

export type RentalInput = {
  supplier_id: number;
  item: string;
  quantity: number;
  state: RentalState;
  starts_on: string;
  ends_on: string;
  job: string | null;
  reference: string | null;
  cost: string | null;
  notes: string | null;
};

export function createRental(input: RentalInput): number {
  const result = db()
    .prepare(
      `INSERT INTO rentals
         (supplier_id, item, quantity, state, starts_on, ends_on, job, reference, cost, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.supplier_id,
      input.item,
      input.quantity,
      input.state,
      input.starts_on,
      input.ends_on,
      input.job,
      input.reference,
      input.cost,
      input.notes,
    );
  return Number(result.lastInsertRowid);
}

export function updateRental(id: number, input: RentalInput): void {
  db()
    .prepare(
      `UPDATE rentals SET supplier_id = ?, item = ?, quantity = ?, state = ?, starts_on = ?,
         ends_on = ?, job = ?, reference = ?, cost = ?, notes = ? WHERE id = ?`,
    )
    .run(
      input.supplier_id,
      input.item,
      input.quantity,
      input.state,
      input.starts_on,
      input.ends_on,
      input.job,
      input.reference,
      input.cost,
      input.notes,
      id,
    );
}

export function deleteRental(id: number): void {
  db().prepare("DELETE FROM rentals WHERE id = ?").run(id);
}

/**
 * Hires that were due back before today and nobody has marked returned.
 *
 * The one thing on this page that is worth interrupting somebody about: gear
 * still on the books at a supplier is gear still being charged for, and a
 * console nobody has taken back is a console nobody can hire out again.
 */
export function overdueRentals(today: string): (Rental & { supplier_name: string })[] {
  return db()
    .prepare(
      `SELECT r.*, s.name AS supplier_name
         FROM rentals r JOIN rental_suppliers s ON s.id = r.supplier_id
        WHERE r.state != 'returned' AND r.ends_on < ?
        ORDER BY r.ends_on`,
    )
    .all(today) as (Rental & { supplier_name: string })[];
}

/* ----------------------------------------------------------------- layout */

/**
 * Where a bar sits on a grid of days.
 *
 * Deliberately generic over the thing being laid out. The board, the plan and
 * this chart all answer the same geometry question — which column does it start
 * in, how many days does it span, and does it run off the edge of the window —
 * and three copies of greedy lane packing would be three places for the same
 * off-by-one to hide.
 */
export type Span = { id: number; starts_on: string; ends_on: string };

export type SpanBar<T extends Span> = {
  item: T;
  column: number;
  span: number;
  lane: number;
  continuesLeft: boolean;
  continuesRight: boolean;
};

export function layoutSpans<T extends Span>(days: string[], items: T[]): SpanBar<T>[] {
  const first = days[0];
  const last = days[days.length - 1];
  const index = new Map(days.map((d, i) => [d, i]));

  const visible = items
    .filter((r) => r.starts_on <= last && r.ends_on >= first)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.id - b.id);

  // The last day occupied in each lane so far, so a bar takes the first lane it
  // does not collide with.
  const laneEnds: string[] = [];
  const bars: SpanBar<T>[] = [];

  for (const entry of visible) {
    const from = entry.starts_on < first ? first : entry.starts_on;
    const to = entry.ends_on > last ? last : entry.ends_on;
    const start = index.get(from);
    const end = index.get(to);
    if (start === undefined || end === undefined) continue;

    let lane = laneEnds.findIndex((busyUntil) => busyUntil < from);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(to);
    } else {
      laneEnds[lane] = to;
    }

    bars.push({
      item: entry,
      column: start + 1,
      span: end - start + 1,
      lane,
      continuesLeft: entry.starts_on < first,
      continuesRight: entry.ends_on > last,
    });
  }

  return bars;
}

/**
 * Every supplier, every lane, whether or not anything is hired from them.
 *
 * The supplier column is a fixture for the same reason the vehicle column is:
 * a list that grows and shrinks with the data is a list you cannot point at
 * across a room. Lanes inside a row do flex — two hires from the same place
 * over the same fortnight need two tracks — which is what the board already
 * does with a vehicle carrying overlapping runs.
 *
 * A row in use always ends with one empty lane. Without it there is no way to
 * start a second hire over days the first already covers: every square in the
 * only track belongs to the existing block, so clicking one edits that instead
 * of adding beside it. The spare track is where "and a second console that same
 * week" gets written.
 */
export type RentalTrack = { lane: number; bars: SpanBar<Rental>[] };
export type RentalRow = { supplier: Supplier; tracks: RentalTrack[] };

export function rentalRows(days: string[], suppliers: Supplier[]): RentalRow[] {
  const rentals = rentalsBetween(days[0], days[days.length - 1]);

  return suppliers.map((supplier) => {
    const bars = layoutSpans(
      days,
      rentals.filter((r) => r.supplier_id === supplier.id),
    );

    const used = bars.length === 0 ? 0 : Math.max(...bars.map((b) => b.lane)) + 1;
    const laneCount = Math.max(1, used + 1);

    const tracks: RentalTrack[] = [];
    for (let lane = 0; lane < laneCount; lane++) {
      tracks.push({ lane, bars: bars.filter((b) => b.lane === lane) });
    }
    return { supplier, tracks };
  });
}
