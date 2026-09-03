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

/* ------------------------------------------------------------------ calls */

/**
 * A run, reduced to what it takes to draw it as a call.
 *
 * Both boards map into this: the crew board from `PublicRun`, the office board
 * from `RunWithRefs`. Neither hands its own row shape to the grouper, so the
 * public board keeps deciding for itself which columns it is willing to
 * publish — the thing that would otherwise leak the moment a shared helper
 * started reading straight off the database row.
 */
export type CallRun = {
  runId: number;
  label: string;
  status: RunStatus;
  meet: string | null;
  site: string | null;
  crew: string | null;
  keys: string | null;
  endsOn: string;
  eventId: number | null;
  vehicleId: number;
  vehicleName: string;
  vehicleClass: VehicleClass;
  /** Where the vehicle is collected and returned, when it is not the yard. */
  pickupFrom: string | null;
  dropoffTo: string | null;
  pickupTime: string | null;
  /** Warned about on every board: the crew has one fewer stop to make. */
  keysAtShop: boolean;
  /** And where they have to be left at the end of it. */
  keysBackToShop: boolean;
  keysBackToPencar: boolean;
  driver: string | null;
  meetingOnSite: string | null;
  /** Whatever the office wrote on the run. */
  notes: string | null;
  /** So a crew can find the van in a lot, and knows where it lives. */
  plate: string | null;
  homeBase: string | null;
};

/** One job, and every vehicle going out on it. */
export type Call = {
  key: string;
  label: string;
  status: RunStatus;
  meet: string | null;
  site: string | null;
  crew: string | null;
  meetingOnSite: string | null;
  /**
   * When the call starts: the crew meeting time if there is one, else the
   * earliest vehicle pick-up. Filled in by `groupCalls`.
   */
  startsAt: string | null;
  /** True if any vehicle on the call has its keys waiting at the shop. */
  keysAtShop: boolean;
  keysBackToShop: boolean;
  keysBackToPencar: boolean;
  legs: CallRun[];
};

/**
 * Gather runs into calls, by the name of the job.
 *
 * A run is one vehicle for one job, so a show that takes the cargo van and the
 * cube van is two rows. Drawn separately they read as two calls to the same
 * place at the same time, which is how a crew ends up in the wrong van.
 *
 * An unnamed run stays its own call: grouping every blank label together would
 * file unrelated vehicles under one heading of nothing.
 */
export function groupCalls(runs: CallRun[]): Call[] {
  const calls = new Map<string, Call>();

  for (const run of runs) {
    const key = run.label.trim() ? `label:${run.label.trim().toLowerCase()}` : `run:${run.runId}`;
    const existing = calls.get(key);

    if (existing) {
      existing.legs.push(run);
      // Whichever leg carries the detail wins; a second van on the same job
      // usually carries none of it.
      existing.meet ??= run.meet;
      existing.site ??= run.site;
      existing.crew ??= run.crew;
      existing.meetingOnSite ??= run.meetingOnSite;
      // One van with its keys at the shop is enough to warn the whole call:
      // somebody is going to the shop either way.
      existing.keysAtShop ||= run.keysAtShop;
      existing.keysBackToShop ||= run.keysBackToShop;
      existing.keysBackToPencar ||= run.keysBackToPencar;
      continue;
    }

    calls.set(key, {
      key,
      label: run.label.trim() || run.vehicleName,
      status: run.status,
      meet: run.meet,
      site: run.site,
      crew: run.crew,
      meetingOnSite: run.meetingOnSite,
      keysAtShop: run.keysAtShop,
      keysBackToShop: run.keysBackToShop,
      keysBackToPencar: run.keysBackToPencar,
      startsAt: null,
      legs: [run],
    });
  }

  // The time a call actually starts: when the crew meets if that was recorded,
  // otherwise the earliest vehicle pick-up on it. Without this a board full of
  // runs that have a pick-up time and no meeting time reads as "All day".
  for (const call of calls.values()) {
    call.startsAt =
      call.meet ??
      call.legs
        .map((leg) => leg.pickupTime)
        .filter((t): t is string => Boolean(t))
        .sort()[0] ??
      null;
  }

  // Earliest first. Anything with no time at all is an all-day call and sits
  // under the calls that have a clock on them.
  return [...calls.values()].sort((a, b) =>
    (a.startsAt ?? "99:99").localeCompare(b.startsAt ?? "99:99"),
  );
}
