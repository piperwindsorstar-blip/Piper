/**
 * Dispatch vocabulary, kept apart from `dispatch.ts`.
 *
 * `dispatch.ts` reaches the database and better-sqlite3 is Node-only, so a
 * Client Component importing these lists from it drags the driver into the
 * browser bundle and the build fails. Same split as `mail-types.ts` and
 * `settings-types.ts`.
 *
 * The words here are the shop's, not invented: a vehicle is categorised by
 * whose it is rather than what shape it is, and a day on the board is a state
 * rather than merely occupied-or-not.
 */

/* ---------------------------------------------------------------- vehicles */

/**
 * What a vehicle is. This is the thing that gets booked — nobody phones a hire
 * company for "a vehicle", they phone for a cube van — so it is a field in its
 * own right rather than something buried in a name or a capacity note.
 */
export const VEHICLE_CLASSES = [
  "cargo_van",
  "cube_van",
  "truck_26",
  "passenger",
  "mini_van",
  "other",
] as const;
export type VehicleClass = (typeof VEHICLE_CLASSES)[number];

export const CLASS_LABELS: Record<VehicleClass, string> = {
  cargo_van: "Cargo van",
  cube_van: "Cube van",
  truck_26: "26 ft truck",
  passenger: "Passenger vehicle",
  mini_van: "Mini van",
  other: "Other",
};

/** Narrow enough for a board column, where the row already names the unit. */
export const CLASS_SHORT: Record<VehicleClass, string> = {
  cargo_van: "Cargo",
  cube_van: "Cube",
  truck_26: "26 ft",
  passenger: "Passenger",
  mini_van: "Mini van",
  other: "Other",
};

/**
 * Where a vehicle comes from, which is really who to phone about it.
 *
 * Pencar is the company Pynx hires from, so 'pencar' means a Pencar hire and
 * not a Pynx-owned unit. 'rental' is anywhere else, 'personal' is a crew
 * member's own vehicle.
 */
export const OWNERSHIPS = ["pencar", "rental", "personal", "other"] as const;
export type Ownership = (typeof OWNERSHIPS)[number];

export const OWNERSHIP_LABELS: Record<Ownership, string> = {
  pencar: "Pencar hire",
  rental: "Other hire",
  personal: "Crew's own",
  // Pynx's own vehicles. The stored value stays 'other' because widening a
  // CHECK constraint means rebuilding the table, and rebuilding this one takes
  // its runs and plans with it. The label is what people read.
  other: "Pynx owned",
};

/**
 * How many of a row can be out at once.
 *
 * A hired row is a class rather than a vehicle: "cube van" means whichever
 * three Pencar has free that Saturday. Everything else is one particular
 * vehicle with one particular plate — Pynx's own van, or a crew member's car
 * — so it gets one row and no more.
 */
export const DEFAULT_SLOTS = 3;
export const SINGLE_SLOT = 1;
export const MAX_SLOTS = 5;

export function defaultSlotsFor(ownership: Ownership): number {
  return HIRED.includes(ownership) ? DEFAULT_SLOTS : SINGLE_SLOT;
}

/** Anything hired has to go back, whoever it came from. */
export const HIRED: Ownership[] = ["pencar", "rental"];

export function isVehicleClass(value: unknown): value is VehicleClass {
  return typeof value === "string" && (VEHICLE_CLASSES as readonly string[]).includes(value);
}

/* -------------------------------------------------------------- day states */

export const RUN_STATUSES = ["booked", "needed", "idle", "own", "pynx", "shop"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const STATUS_LABELS: Record<RunStatus, string> = {
  booked: "Booked",
  needed: "Needed — not booked",
  idle: "Idle day",
  own: "Own car booked",
  pynx: "Pynx Cargo booked",
  shop: "Shop day",
};

/** The short form for a board cell, where there is room for two words at most. */
export const STATUS_SHORT: Record<RunStatus, string> = {
  booked: "Booked",
  needed: "Needed",
  idle: "Idle",
  own: "Own car",
  pynx: "Pynx Cargo",
  shop: "Shop",
};

/**
 * Statuses that mean a vehicle is actually committed. 'needed' deliberately is
 * not one: the whole point of it is that nothing has been arranged yet, so
 * counting it as coverage would hide the gap it exists to show.
 */
export const COMMITTED: RunStatus[] = ["booked", "own", "pynx"];

export function isRunStatus(value: unknown): value is RunStatus {
  return typeof value === "string" && (RUN_STATUSES as readonly string[]).includes(value);
}

export function isOwnership(value: unknown): value is Ownership {
  return typeof value === "string" && (OWNERSHIPS as readonly string[]).includes(value);
}
