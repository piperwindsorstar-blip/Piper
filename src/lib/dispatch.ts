import { db } from "./db";
import { toIso, parseIso } from "./dates";
import { COMMITTED, type Ownership, type RunStatus } from "./dispatch-types";

/**
 * Which vehicle is where, and when.
 *
 * Weddings are logistics before they are music: a Saturday with three shows and
 * two vans is a scheduling problem, and the failure mode is discovering on the
 * Friday that both bookings were promised the same vehicle. So the board is
 * built around spans of days rather than single dates, and it can answer one
 * question honestly — is this vehicle already committed.
 *
 * A run is usually a booking, but not always. A service appointment or a
 * warehouse move occupies a van just as surely as a wedding does, so the event
 * link is optional and the label is what the board shows.
 *
 * Rentals are vehicles like any other. What makes them different is that they
 * go back, so they carry the dates they're held for and the board can say what
 * is due before it is late.
 */

export type { Ownership, RunStatus } from "./dispatch-types";
export {
  OWNERSHIPS,
  OWNERSHIP_LABELS,
  RUN_STATUSES,
  STATUS_LABELS,
  STATUS_SHORT,
  COMMITTED,
} from "./dispatch-types";

export type Vehicle = {
  id: number;
  name: string;
  ownership: Ownership;
  plate: string | null;
  home_base: string | null;
  weight_capacity: string | null;
  passenger_capacity: number | null;
  rental_from: string | null;
  rental_due: string | null;
  capacity_note: string | null;
  notes: string | null;
  active: number;
  created_at: string;
};

export type VehicleInput = {
  name: string;
  ownership: Ownership;
  plate: string | null;
  home_base: string | null;
  weight_capacity: string | null;
  passenger_capacity: number | null;
  rental_from: string | null;
  rental_due: string | null;
  capacity_note: string | null;
  notes: string | null;
};

export type Run = {
  id: number;
  vehicle_id: number;
  event_id: number | null;
  label: string;
  status: RunStatus;
  starts_on: string;
  ends_on: string;
  meet_time: string | null;
  crew: string | null;
  site: string | null;
  driver_id: number | null;
  keys_with: string | null;
  notes: string | null;
  created_at: string;
};

/** A run with the names the board needs, rather than the ids it stores. */
export type RunWithRefs = Run & {
  vehicle_name: string;
  vehicle_ownership: Ownership;
  driver_name: string | null;
  event_date: string | null;
};

const RUN_SELECT = `
  SELECT r.*, v.name AS vehicle_name, v.ownership AS vehicle_ownership,
         u.name AS driver_name, e.event_date AS event_date
    FROM dispatch_runs r
    JOIN vehicles v ON v.id = r.vehicle_id
    LEFT JOIN users u ON u.id = r.driver_id
    LEFT JOIN events e ON e.id = r.event_id
`;

/* ---------------------------------------------------------------- vehicles */

export function listVehicles(includeInactive = false): Vehicle[] {
  return db()
    .prepare(
      `SELECT * FROM vehicles ${includeInactive ? "" : "WHERE active = 1"}
       ORDER BY active DESC, name COLLATE NOCASE`,
    )
    .all() as Vehicle[];
}

export function getVehicle(id: number): Vehicle | null {
  return (db().prepare("SELECT * FROM vehicles WHERE id = ?").get(id) as Vehicle | undefined) ?? null;
}

export function createVehicle(input: VehicleInput): number {
  const result = db()
    .prepare(
      `INSERT INTO vehicles
         (name, ownership, plate, home_base, weight_capacity, passenger_capacity,
          rental_from, rental_due, capacity_note, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.ownership,
      input.plate,
      input.home_base,
      input.weight_capacity,
      input.passenger_capacity,
      input.rental_from,
      input.rental_due,
      input.capacity_note,
      input.notes,
    );
  return Number(result.lastInsertRowid);
}

export function updateVehicle(id: number, input: VehicleInput): void {
  db()
    .prepare(
      `UPDATE vehicles SET name = ?, ownership = ?, plate = ?, home_base = ?,
         weight_capacity = ?, passenger_capacity = ?, rental_from = ?, rental_due = ?,
         capacity_note = ?, notes = ? WHERE id = ?`,
    )
    .run(
      input.name,
      input.ownership,
      input.plate,
      input.home_base,
      input.weight_capacity,
      input.passenger_capacity,
      input.rental_from,
      input.rental_due,
      input.capacity_note,
      input.notes,
      id,
    );
}

/**
 * Retiring rather than deleting, for the same reason a departed DJ is
 * deactivated: a sold van still has to appear on last year's runs.
 */
export function setVehicleActive(id: number, active: boolean): void {
  db().prepare("UPDATE vehicles SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
}

/* -------------------------------------------------------------------- runs */

export type RunInput = {
  vehicle_id: number;
  event_id: number | null;
  label: string;
  status: RunStatus;
  starts_on: string;
  ends_on: string;
  meet_time: string | null;
  crew: string | null;
  site: string | null;
  driver_id: number | null;
  keys_with: string | null;
  notes: string | null;
};

export function getRun(id: number): Run | null {
  return (db().prepare("SELECT * FROM dispatch_runs WHERE id = ?").get(id) as Run | undefined) ?? null;
}

export function createRun(input: RunInput): number {
  const result = db()
    .prepare(
      `INSERT INTO dispatch_runs
         (vehicle_id, event_id, label, status, starts_on, ends_on, meet_time, crew,
          site, driver_id, keys_with, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.vehicle_id,
      input.event_id,
      input.label,
      input.status,
      input.starts_on,
      input.ends_on,
      input.meet_time,
      input.crew,
      input.site,
      input.driver_id,
      input.keys_with,
      input.notes,
    );
  return Number(result.lastInsertRowid);
}

export function updateRun(id: number, input: RunInput): void {
  db()
    .prepare(
      `UPDATE dispatch_runs SET vehicle_id = ?, event_id = ?, label = ?, status = ?,
         starts_on = ?, ends_on = ?, meet_time = ?, crew = ?, site = ?, driver_id = ?,
         keys_with = ?, notes = ? WHERE id = ?`,
    )
    .run(
      input.vehicle_id,
      input.event_id,
      input.label,
      input.status,
      input.starts_on,
      input.ends_on,
      input.meet_time,
      input.crew,
      input.site,
      input.driver_id,
      input.keys_with,
      input.notes,
      id,
    );
}

export function deleteRun(id: number): void {
  db().prepare("DELETE FROM dispatch_runs WHERE id = ?").run(id);
}

/**
 * Runs that touch a date range at all, not only those contained by it.
 *
 * A van out from Friday to Sunday belongs on the Saturday column too, so the
 * test is overlap — starts before the window ends, ends after it begins — and
 * not `BETWEEN`, which would quietly drop exactly the multi-day runs the board
 * exists to make visible.
 */
export function runsBetween(from: string, to: string): RunWithRefs[] {
  return db()
    .prepare(`${RUN_SELECT} WHERE r.starts_on <= ? AND r.ends_on >= ? ORDER BY r.starts_on, v.name`)
    .all(to, from) as RunWithRefs[];
}

export function runsOn(date: string): RunWithRefs[] {
  return runsBetween(date, date);
}

export function runsForEvent(eventId: number): RunWithRefs[] {
  return db()
    .prepare(`${RUN_SELECT} WHERE r.event_id = ? ORDER BY r.starts_on`)
    .all(eventId) as RunWithRefs[];
}

/**
 * Other runs on the same vehicle that overlap this span.
 *
 * `exceptId` lets an edit ignore the row being edited — without it, saving a
 * run unchanged would report it as clashing with itself.
 */
export function clashesFor(
  vehicleId: number,
  startsOn: string,
  endsOn: string,
  exceptId?: number,
): RunWithRefs[] {
  return db()
    .prepare(
      `${RUN_SELECT}
        WHERE r.vehicle_id = ? AND r.starts_on <= ? AND r.ends_on >= ?
          AND (? IS NULL OR r.id != ?)
        ORDER BY r.starts_on`,
    )
    .all(vehicleId, endsOn, startsOn, exceptId ?? null, exceptId ?? -1) as RunWithRefs[];
}

/* ---------------------------------------------------------- public board */

/**
 * What the world is allowed to see.
 *
 * Deliberately its own type and its own query, with every column named. The
 * tempting version reuses `RunWithRefs` and drops a field or two in the markup
 * — and then the next column added to the table is public the day it ships,
 * because nobody remembered there was a page that renders whatever it is
 * handed. Naming the columns means a new one is private until somebody decides
 * otherwise, which is the right way round.
 *
 * Left out on purpose: internal notes, the booking link, the plate, and where
 * a vehicle is kept. Kept: what a person standing in the yard needs.
 */
export type PublicRun = {
  id: number;
  vehicle_id: number;
  vehicle_name: string;
  label: string;
  status: RunStatus;
  starts_on: string;
  ends_on: string;
  meet_time: string | null;
  crew: string | null;
  site: string | null;
  keys_with: string | null;
  driver_first_name: string | null;
};

export type PublicVehicle = { id: number; name: string; ownership: Ownership };

export function publicVehicles(): PublicVehicle[] {
  return db()
    .prepare("SELECT id, name, ownership FROM vehicles WHERE active = 1 ORDER BY name COLLATE NOCASE")
    .all() as PublicVehicle[];
}

export function publicRuns(from: string, to: string): PublicRun[] {
  const rows = db()
    .prepare(
      `SELECT r.id, r.vehicle_id, v.name AS vehicle_name, r.label, r.status,
              r.starts_on, r.ends_on, r.meet_time, r.crew, r.site, r.keys_with,
              u.name AS driver_name
         FROM dispatch_runs r
         JOIN vehicles v ON v.id = r.vehicle_id
         LEFT JOIN users u ON u.id = r.driver_id
        WHERE v.active = 1 AND r.starts_on <= ? AND r.ends_on >= ?
        ORDER BY r.starts_on, v.name`,
    )
    .all(to, from) as (Omit<PublicRun, "driver_first_name"> & { driver_name: string | null })[];

  return rows.map(({ driver_name, ...run }) => ({
    ...run,
    // A first name is what a crew board needs — "Jordan has the big van". The
    // full staff roster is not a thing this page has any business publishing.
    driver_first_name: driver_name ? driver_name.trim().split(/\s+/)[0] : null,
  }));
}

/** The ten dates the public board covers: today, and the nine after it. */
export function publicDays(today: string, count: number): string[] {
  const start = parseIso(today);
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return toIso(day);
  });
}

/** Public runs arranged by vehicle and day, the same shape the board uses. */
export type PublicRow = { vehicle: PublicVehicle; byDay: Map<string, PublicRun[]> };

export function publicBoardRows(days: string[]): PublicRow[] {
  const runs = publicRuns(days[0], days[days.length - 1]);
  const vehicles = publicVehicles();

  return vehicles.map((vehicle) => {
    const byDay = new Map<string, PublicRun[]>(days.map((d) => [d, []]));
    for (const run of runs) {
      if (run.vehicle_id !== vehicle.id) continue;
      for (const day of days) {
        if (run.starts_on <= day && run.ends_on >= day) byDay.get(day)?.push(run);
      }
    }
    return { vehicle, byDay };
  });
}

/* ------------------------------------------------------------------ boards */

/** The seven dates of the week containing `iso`, Monday first. */
export function weekDays(iso: string): string[] {
  const date = parseIso(iso);
  // getDay() is Sunday-based; the shop's week starts on Monday.
  const shift = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - shift);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return toIso(day);
  });
}

/** Every date in the month containing `iso`. */
export function monthDays(iso: string): string[] {
  const date = parseIso(iso);
  const year = date.getFullYear();
  const month = date.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: last }, (_, i) => toIso(new Date(year, month, i + 1)));
}

export function shiftMonth(iso: string, months: number): string {
  const date = parseIso(iso);
  // Anchor on the first before shifting: stepping a month from the 31st lands
  // in the month after next whenever the next one is shorter.
  return toIso(new Date(date.getFullYear(), date.getMonth() + months, 1));
}

export function shiftWeek(iso: string, weeks: number): string {
  const date = parseIso(iso);
  date.setDate(date.getDate() + weeks * 7);
  return toIso(date);
}

/** One vehicle's row on the week board: its runs, indexed by day. */
export type BoardRow = { vehicle: Vehicle; byDay: Map<string, RunWithRefs[]> };

export function weekBoard(days: string[], vehicles: Vehicle[]): BoardRow[] {
  const runs = runsBetween(days[0], days[days.length - 1]);

  return vehicles.map((vehicle) => {
    const byDay = new Map<string, RunWithRefs[]>(days.map((d) => [d, []]));
    for (const run of runs) {
      if (run.vehicle_id !== vehicle.id) continue;
      // A run is placed on every day it spans, so a three-day hire reads as
      // three occupied cells rather than one and two suspicious blanks.
      for (const day of days) {
        if (run.starts_on <= day && run.ends_on >= day) byDay.get(day)?.push(run);
      }
    }
    return { vehicle, byDay };
  });
}

/**
 * Days somebody has flagged as needing a vehicle without one being booked.
 * The single most useful thing on the board, and the reason it looks a month
 * out rather than a week.
 */
export function needed(from: string, to: string): RunWithRefs[] {
  return db()
    .prepare(
      `${RUN_SELECT} WHERE r.status = 'needed' AND r.starts_on <= ? AND r.ends_on >= ?
        ORDER BY r.starts_on, v.name`,
    )
    .all(to, from) as RunWithRefs[];
}

/** Rentals due back within `days`, soonest first. */
export function rentalsDue(fromIso: string, days = 14): Vehicle[] {
  const until = parseIso(fromIso);
  until.setDate(until.getDate() + days);

  return db()
    .prepare(
      `SELECT * FROM vehicles
        WHERE active = 1 AND ownership = 'rental' AND rental_due IS NOT NULL
          AND rental_due <= ?
        ORDER BY rental_due`,
    )
    .all(toIso(until)) as Vehicle[];
}

/**
 * Bookings in a window with no vehicle committed to them.
 *
 * The board shows what is arranged; this shows what isn't, which is the half
 * that actually causes Friday-night phone calls. Cancelled bookings are not
 * gaps — nobody is driving to those.
 */
export type UncoveredEvent = {
  id: number;
  event_date: string;
  partner_one_name: string;
  partner_two_name: string | null;
  venue_name: string | null;
};

export function uncoveredEvents(from: string, to: string): UncoveredEvent[] {
  return db()
    .prepare(
      `SELECT e.id, e.event_date, e.partner_one_name, e.partner_two_name, v.name AS venue_name
         FROM events e
         LEFT JOIN venues v ON v.id = e.venue_id
        WHERE e.event_date BETWEEN ? AND ?
          AND e.status != 'cancelled'
          -- Only a real commitment counts as covered. A day marked 'needed' is
          -- precisely the absence of one, so treating it as coverage would hide
          -- the gap it was created to flag.
          AND NOT EXISTS (
            SELECT 1 FROM dispatch_runs r
             WHERE r.event_id = e.id
               AND r.status IN ('booked', 'own', 'pynx')
          )
        ORDER BY e.event_date`,
    )
    .all(from, to) as UncoveredEvent[];
}
