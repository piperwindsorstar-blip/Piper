import { db, nowIso } from "./db";
import {
  BANNER_MAX,
  BOARD_NOTE_MAX as BOARD_NOTE_MAX_VALUE,
  isTone,
  NO_BANNER,
  NO_PUBLIC_BOARD as NO_PUBLIC_BOARD_VALUE,
  type LoginBanner,
  type PublicBoard as PublicBoardShape,
} from "./settings-types";

/**
 * Settings an admin changes from inside the app.
 *
 * Deliberately not where secrets live. SMTP credentials and the import token
 * stay in /etc/piper.env, readable only by root, because anything in the
 * database is in every backup and on the screen of anyone who reaches an admin
 * page. What belongs here is the opposite: things that are meant to be seen.
 */

export type SettingKey = "login_banner" | "public_board";

export function getSetting(key: SettingKey): string | null {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: SettingKey, value: string, userId: number | null): void {
  db()
    .prepare(
      `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    )
    .run(key, value, nowIso(), userId);
}

/* ------------------------------------------------------------ login banner */

export type { BannerTone, LoginBanner } from "./settings-types";
export { BANNER_TONES, TONE_LABELS, NO_BANNER, BANNER_MAX } from "./settings-types";

/**
 * The banner as stored, or nothing.
 *
 * The login page renders this for people who are not signed in, so a bad
 * stored value must never be able to take that page down — the one page
 * everybody needs when something is wrong is the one they use to get in.
 * Anything unparseable is treated as no banner at all.
 */
export function loginBanner(): LoginBanner {
  const raw = getSetting("login_banner");
  if (!raw) return NO_BANNER;

  try {
    const parsed = JSON.parse(raw) as Partial<LoginBanner>;
    const message = typeof parsed.message === "string" ? parsed.message.slice(0, BANNER_MAX) : "";
    if (!message.trim()) return NO_BANNER;

    return {
      on: parsed.on === true,
      tone: isTone(parsed.tone) ? parsed.tone : "info",
      message,
    };
  } catch {
    return NO_BANNER;
  }
}

export function saveLoginBanner(banner: LoginBanner, userId: number | null): void {
  setSetting("login_banner", JSON.stringify(banner), userId);
}

/* --------------------------------------------------------- public board */

export type { PublicBoard } from "./settings-types";
export { NO_PUBLIC_BOARD, BOARD_NOTE_MAX, PUBLIC_DAYS } from "./settings-types";

/**
 * Whether the crew board is published, and the note that sits on top of it.
 *
 * Off unless somebody has turned it on. This is the one page in Piper that
 * anybody can read without an account, so it should exist because a person
 * decided it should, not because a deploy happened while they were asleep.
 * A stored value that will not parse is read as off, for the same reason.
 */
export function publicBoard(): PublicBoardShape {
  const raw = getSetting("public_board");
  if (!raw) return NO_PUBLIC_BOARD_VALUE;

  try {
    const parsed = JSON.parse(raw) as Partial<PublicBoardShape>;
    return {
      on: parsed.on === true,
      note: typeof parsed.note === "string" ? parsed.note.slice(0, BOARD_NOTE_MAX_VALUE) : "",
    };
  } catch {
    return NO_PUBLIC_BOARD_VALUE;
  }
}

export function savePublicBoard(board: PublicBoardShape, userId: number | null): void {
  setSetting("public_board", JSON.stringify(board), userId);
}
