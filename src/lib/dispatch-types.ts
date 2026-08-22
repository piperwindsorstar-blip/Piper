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

export const OWNERSHIPS = ["pencar", "rental", "personal", "other"] as const;
export type Ownership = (typeof OWNERSHIPS)[number];

export const OWNERSHIP_LABELS: Record<Ownership, string> = {
  pencar: "Pencar",
  rental: "Rental",
  personal: "Personal",
  other: "Other",
};

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
