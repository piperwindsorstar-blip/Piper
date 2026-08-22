/**
 * Banner shapes and labels, kept apart from `settings.ts` on purpose.
 *
 * `settings.ts` reaches the database, and better-sqlite3 is Node-only. The
 * banner editor is a Client Component that needs the tone list and the length
 * limit — importing those from `settings.ts` drags better-sqlite3 into the
 * browser bundle and the build fails on `Can't resolve 'fs'`. Exactly the same
 * split, and for exactly the same reason, as `mail-types.ts`.
 */

export const BANNER_TONES = ["info", "warning", "success"] as const;
export type BannerTone = (typeof BANNER_TONES)[number];

export const TONE_LABELS: Record<BannerTone, string> = {
  info: "Notice",
  warning: "Warning",
  success: "Good news",
};

export type LoginBanner = { on: boolean; tone: BannerTone; message: string };

export const NO_BANNER: LoginBanner = { on: false, tone: "info", message: "" };

/** Anything longer stops being a notice and starts being a page. */
export const BANNER_MAX = 400;

export function isTone(value: unknown): value is BannerTone {
  return typeof value === "string" && (BANNER_TONES as readonly string[]).includes(value);
}

/* --------------------------------------------------------- public board */

export type PublicBoard = { on: boolean; note: string };

export const NO_PUBLIC_BOARD: PublicBoard = { on: false, note: "" };

/** Long enough for "keys are in the lock box", short enough to read at a glance. */
export const BOARD_NOTE_MAX = 300;

/**
 * How far ahead the public board reaches: today and the nine days after it.
 *
 * A fixed window, applied in the query rather than in the markup, and reachable
 * by no parameter — there is no way to ask the public page for another date. A
 * board that could be walked forwards would be the whole schedule, published,
 * one click at a time.
 */
export const PUBLIC_DAYS = 10;
