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
