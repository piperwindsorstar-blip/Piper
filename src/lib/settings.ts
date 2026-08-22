import { db, nowIso } from "./db";
import {
  BANNER_MAX,
  isTone,
  NO_BANNER,
  type LoginBanner,
} from "./settings-types";

/**
 * Settings an admin changes from inside the app.
 *
 * Deliberately not where secrets live. SMTP credentials and the import token
 * stay in /etc/piper.env, readable only by root, because anything in the
 * database is in every backup and on the screen of anyone who reaches an admin
 * page. What belongs here is the opposite: things that are meant to be seen.
 */

export type SettingKey = "login_banner";

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
