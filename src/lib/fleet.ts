import type Database from "better-sqlite3";
import type { Ownership, VehicleClass } from "./dispatch-types";

/**
 * The standing fleet.
 *
 * The vehicle column on the board and the Gantt is meant to read like a
 * printed sheet: the same rows, in the same order, every week, whether or not
 * anything is booked into them. That only holds if the rows exist before
 * anybody books anything — a list built from whatever happens to be in the
 * vehicles table drifts into a list of whatever was typed for the last show.
 *
 * So these six are established when the database is opened rather than by a
 * seed script somebody has to remember to run. Matching is by name, and the
 * insert is skipped when a vehicle of that name already exists, so this never
 * duplicates and never overwrites an edit — change the capacity of the cube
 * van and it stays changed.
 *
 * Retiring still works and still sticks: retiring sets `active = 0` and the
 * row remains, so it is not re-added. Nothing here deletes or reactivates.
 */
export type StandingVehicle = {
  name: string;
  class: VehicleClass;
  ownership: Ownership;
  slots: number;
  weight_capacity: string | null;
  passenger_capacity: number | null;
  capacity_note: string;
};

/**
 * In the order the shop says them, which is roughly by size — not
 * alphabetically, which would open the sheet with the 26 ft truck.
 *
 * Everything but the Pynx van is hired from Pencar, so a row is a class rather
 * than a particular unit: "cube van" means whichever three Pencar has free
 * that Saturday. Hence three slots each. There is one Pynx Cargo, so it gets
 * one.
 */
export const STANDING_FLEET: StandingVehicle[] = [
  {
    name: "Cargo van",
    class: "cargo_van",
    ownership: "pencar",
    slots: 3,
    weight_capacity: "3500 lb",
    passenger_capacity: 2,
    capacity_note: "Ceremony kit and speakers",
  },
  {
    name: "Cube van",
    class: "cube_van",
    ownership: "pencar",
    slots: 3,
    weight_capacity: "1 ton",
    passenger_capacity: 3,
    capacity_note: "Full rig plus booth",
  },
  {
    name: "26 ft truck",
    class: "truck_26",
    ownership: "pencar",
    slots: 3,
    weight_capacity: "5 ton",
    passenger_capacity: 3,
    capacity_note: "Big loads, busy weekends",
  },
  {
    name: "Passenger vehicle",
    class: "passenger",
    ownership: "pencar",
    slots: 3,
    weight_capacity: null,
    passenger_capacity: 5,
    capacity_note: "Crew only",
  },
  {
    name: "Mini van",
    class: "mini_van",
    ownership: "pencar",
    slots: 3,
    weight_capacity: null,
    passenger_capacity: 7,
    capacity_note: "Crew and small kit",
  },
  {
    name: "Pynx Cargo",
    class: "cargo_van",
    ownership: "other",
    slots: 1,
    weight_capacity: "3500 lb",
    passenger_capacity: 2,
    capacity_note: "Ours — always available",
  },
];

/**
 * Adds any standing vehicle that is missing. Idempotent, and cheap enough to
 * run on every open: six indexed lookups, once per process.
 *
 * Deliberately not a migration. A migration runs once at a version boundary,
 * which is the wrong shape for something that has to be true continuously —
 * a database restored from a backup taken before the fleet existed would come
 * back stamped at the current version and never get its rows.
 */
export function ensureStandingFleet(conn: Database.Database): void {
  const exists = conn.prepare("SELECT id FROM vehicles WHERE name = ? COLLATE NOCASE");
  const insert = conn.prepare(
    `INSERT INTO vehicles
       (name, class, ownership, home_base, weight_capacity, passenger_capacity,
        capacity_note, slots)
     VALUES (?, ?, ?, 'Shop', ?, ?, ?, ?)`,
  );

  const add = conn.transaction(() => {
    for (const v of STANDING_FLEET) {
      if (exists.get(v.name)) continue;
      insert.run(
        v.name,
        v.class,
        v.ownership,
        v.weight_capacity,
        v.passenger_capacity,
        v.capacity_note,
        v.slots,
      );
      console.log(`[piper] added standing vehicle: ${v.name}`);
    }
  });
  add();
}

/**
 * The order the fleet is read in, everywhere it is listed.
 *
 * A SQL fragment rather than a sort in JavaScript because the board, the
 * Gantt, the fleet page and every vehicle dropdown each run their own query,
 * and a permanent list that comes out in a different order on one of them is
 * not a permanent list. Hires first, in the order the shop says the classes,
 * then the vehicle Pynx owns — it reads as the list of things to phone Pencar
 * about, with the one that needs no phone call at the bottom. Name breaks
 * ties, so anything added by hand lands predictably among its own kind.
 */
export const FLEET_ORDER = `
  CASE ownership WHEN 'other' THEN 1 ELSE 0 END,
  CASE class
    WHEN 'cargo_van' THEN 1
    WHEN 'cube_van'  THEN 2
    WHEN 'truck_26'  THEN 3
    WHEN 'passenger' THEN 4
    WHEN 'mini_van'  THEN 5
    ELSE 6
  END,
  name COLLATE NOCASE`;
