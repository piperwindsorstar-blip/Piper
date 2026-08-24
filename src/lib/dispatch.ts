import { db } from "./db";
import { toIso, parseIso } from "./dates";
import {
  COMMITTED,
  type Ownership,
  type RunStatus,
  type VehicleClass,
} from "./dispatch-types";
import { FLEET_ORDER } from "./fleet";

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

export type { Ownership, RunStatus, VehicleClass } from "./dispatch-types";
export {
  OWNERSHIPS,
  OWNERSHIP_LABELS,
  VEHICLE_CLASSES,
  CLASS_LABELS,
  CLASS_SHORT,
  HIRED,
  RUN_STATUSES,
  STATUS_LABELS,
  STATUS_SHORT,
  COMMITTED,
} from "./dispatch-types";

export type Vehicle = {
  id: number;
  name: string;
  class: VehicleClass;
  ownership: Ownership;
  plate: string | null;
  home_base: string | null;
  weight_capacity: string | null;
  passenger_capacity: number | null;
  rental_from: string | null;
  rental_due: string | null;
  capacity_note: string | null;
  notes: string | null;
  slots: number;
  active: number;
  created_at: string;
};

export type VehicleInput = {
  name: string;
  class: VehicleClass;
  ownership: Ownership;
  plate: string | null;
  home_base: string | null;
  weight_capacity: string | null;
  passenger_capacity: number | null;
  rental_from: string | null;
  rental_due: string | null;
  capacity_note: string | null;
  notes: string | null;
  slots: number;
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
  vehicle_class: VehicleClass;
  vehicle_ownership: Ownership;
  driver_name: string | null;
  event_date: string | null;
};

const RUN_SELECT = `
  SELECT r.*, v.name AS vehicle_name, v.class AS vehicle_class, v.ownership AS vehicle_ownership,
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
       ORDER BY active DESC, ${FLEET_ORDER}`,
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
         (name, class, ownership, plate, home_base, weight_capacity, passenger_capacity,
          rental_from, rental_due, capacity_note, notes, slots)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.class,
      input.ownership,
      input.plate,
      input.home_base,
      input.weight_capacity,
      input.passenger_capacity,
      input.rental_from,
      input.rental_due,
      input.capacity_note,
      input.notes,
      input.slots,
    );
  return Number(result.lastInsertRowid);
}

export function updateVehicle(id: number, input: VehicleInput): void {
  db()
    .prepare(
      `UPDATE vehicles SET name = ?, class = ?, ownership = ?, plate = ?, home_base = ?,
         weight_capacity = ?, passenger_capacity = ?, rental_from = ?, rental_due = ?,
         capacity_note = ?, notes = ?, slots = ? WHERE id = ?`,
    )
    .run(
      input.name,
      input.class,
      input.ownership,
      input.plate,
      input.home_base,
      input.weight_capacity,
      input.passenger_capacity,
      input.rental_from,
      input.rental_due,
      input.capacity_note,
      input.notes,
      input.slots,
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

/* -------------------------------------------------------------- who drove */

/**
 * Which vehicle went where on a given day, and who took it.
 *
 * The question is asked backwards — something happened on a date and nobody
 * can remember who was driving — so the date is the input and everything else
 * is the answer. Idle and shop days are left out: nobody drove those.
 */
export function whoDrove(from: string, to: string): RunWithRefs[] {
  return db()
    .prepare(
      `${RUN_SELECT}
        WHERE r.starts_on <= ? AND r.ends_on >= ?
          AND r.status IN ('booked', 'own', 'pynx')
        ORDER BY r.starts_on, v.name`,
    )
    .all(to, from) as RunWithRefs[];
}

/**
 * Everyone who has driven or crewed, for the name filter. Drawn from what was
 * actually recorded rather than from the staff list, because the crew field is
 * free text and half the names in it never had a Piper account.
 */
export function peopleWhoDrove(): string[] {
  const rows = db()
    .prepare(
      `SELECT u.name AS driver, r.crew FROM dispatch_runs r
         LEFT JOIN users u ON u.id = r.driver_id
        WHERE r.driver_id IS NOT NULL OR (r.crew IS NOT NULL AND TRIM(r.crew) <> '')`,
    )
    .all() as { driver: string | null; crew: string | null }[];

  const names = new Set<string>();
  for (const row of rows) {
    if (row.driver) names.add(row.driver.trim());
    // Crews are written as "Jordan, Eric" — one field, several people.
    for (const part of (row.crew ?? "").split(/[,/]|\band\b/)) {
      const name = part.trim();
      if (name) names.add(name);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
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

export type PublicVehicle = {
  id: number;
  name: string;
  class: VehicleClass;
  ownership: Ownership;
};

export function publicVehicles(): PublicVehicle[] {
  return db()
    .prepare(
      `SELECT id, name, class, ownership FROM vehicles
        WHERE active = 1 ORDER BY ${FLEET_ORDER}`,
    )
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

/**
 * Where a run sits on a board of `days`, as one bar rather than a chip per day.
 *
 * A three-day hire is one thing that happened, and drawing it as three
 * identical boxes says otherwise — you cannot tell it from three separate
 * day-bookings without reading all three. So a run gets a start column and a
 * span, clipped to the window, and a flag on each end saying whether it runs
 * off the edge.
 *
 * Lanes come from the fact that a vehicle can have more than one thing on it
 * over a window — a morning collection and a weekend hire. Overlapping bars
 * are stacked greedily, first free lane wins, which keeps the common case (one
 * lane) tight and only grows the row when it has to.
 */
export type RunBar = {
  run: RunWithRefs;
  /** 1-based, for CSS grid. */
  column: number;
  span: number;
  lane: number;
  continuesLeft: boolean;
  continuesRight: boolean;
};

export function layoutRuns(days: string[], runs: RunWithRefs[]): RunBar[] {
  const first = days[0];
  const last = days[days.length - 1];
  const index = new Map(days.map((d, i) => [d, i]));

  const visible = runs
    .filter((r) => r.starts_on <= last && r.ends_on >= first)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.id - b.id);

  // The last day occupied in each lane so far, so a bar can take the first
  // lane it does not collide with.
  const laneEnds: string[] = [];
  const bars: RunBar[] = [];

  for (const run of visible) {
    const from = run.starts_on < first ? first : run.starts_on;
    const to = run.ends_on > last ? last : run.ends_on;
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
      run,
      column: start + 1,
      span: end - start + 1,
      lane,
      continuesLeft: run.starts_on < first,
      continuesRight: run.ends_on > last,
    });
  }

  return bars;
}

/** One vehicle's row on the board, with its runs already laid out. */
export type VehicleLane = { vehicle: Vehicle; bars: RunBar[]; lanes: number };

export function boardLanes(days: string[], vehicles: Vehicle[]): VehicleLane[] {
  const runs = runsBetween(days[0], days[days.length - 1]);

  return vehicles.map((vehicle) => {
    const bars = layoutRuns(
      days,
      runs.filter((r) => r.vehicle_id === vehicle.id),
    );
    return {
      vehicle,
      bars,
      lanes: bars.reduce((max, b) => Math.max(max, b.lane + 1), 1),
    };
  });
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

/**
 * How many vehicles are wanted and unbooked, today and across the week.
 *
 * The two numbers the shop's own board leads with. They answer different
 * questions — "is somebody about to be stuck this morning" and "how much
 * phoning is there to do" — so they are counted separately rather than one
 * being derived from the other.
 */
export type NeedCounts = { today: number; week: number };

export function neededCounts(today: string): NeedCounts {
  const week = weekDays(today);
  // From today rather than from Monday: a vehicle that was needed on Tuesday
  // and never booked is a thing that already went wrong, not a thing to plan.
  const rest = week.filter((d) => d >= today);
  const to = rest.length > 0 ? rest[rest.length - 1] : today;

  return {
    today: needed(today, today).length,
    week: needed(today, to).length,
  };
}

/** Rentals due back within `days`, soonest first. */
export function rentalsDue(fromIso: string, days = 14): Vehicle[] {
  const until = parseIso(fromIso);
  until.setDate(until.getDate() + days);

  return db()
    .prepare(
      `SELECT * FROM vehicles
        -- Every hire has to go back, whoever it came from. Checking only
        -- 'rental' would have quietly excluded Pencar, which is where most of
        -- them come from.
        WHERE active = 1 AND ownership IN ('pencar', 'rental') AND rental_due IS NOT NULL
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
