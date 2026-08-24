import { db, nowIso } from "./db";
import {
  NO_MAIL as NO_MAIL_VALUE,
  type MailSettings as MailShape,
  NO_SHOP as NO_SHOP_VALUE,
  RULES_MAX as RULES_MAX_VALUE,
  type ShopDetails as ShopShape,
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

export type SettingKey = "login_banner" | "public_board" | "shop_details" | "mail";

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

/* ----------------------------------------------------------- shop details */

export type { ShopDetails } from "./settings-types";
export { NO_SHOP, SHOP_LABELS, SHOP_SENSITIVE, RULES_MAX } from "./settings-types";

/**
 * Shop details, or nothing.
 *
 * Read defensively like the rest: this feeds a page that renders without an
 * account, and a stored value that will not parse must not be able to take it
 * down. Anything missing falls back to blank, and both switches default to
 * off, so a half-written record publishes nothing rather than something
 * unintended.
 */
export function shopDetails(): ShopShape {
  const raw = getSetting("shop_details");
  if (!raw) return NO_SHOP_VALUE;

  try {
    const parsed = JSON.parse(raw) as Partial<ShopShape>;
    const text = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
    return {
      location: text(parsed.location),
      city: text(parsed.city),
      phone: text(parsed.phone, 40),
      emergency: text(parsed.emergency, 40),
      gate: text(parsed.gate, 40),
      lockBox: text(parsed.lockBox, 40),
      yard: text(parsed.yard),
      rules: text(parsed.rules, RULES_MAX_VALUE),
      showOnBoard: parsed.showOnBoard === true,
      showCodes: parsed.showCodes === true,
    };
  } catch {
    return NO_SHOP_VALUE;
  }
}

export function saveShopDetails(details: ShopShape, userId: number | null): void {
  setSetting("shop_details", JSON.stringify(details), userId);
}

/**
 * What the public board is allowed to show — the codes stripped out unless
 * they were explicitly switched on. Done here rather than in the page so there
 * is one place that decides, and it is not the markup.
 */
export function publicShopDetails(): ShopShape | null {
  const shop = shopDetails();
  if (!shop.showOnBoard) return null;
  if (shop.showCodes) return shop;
  return { ...shop, gate: "", lockBox: "" };
}

/* -------------------------------------------------------------------- mail */

export type { MailSettings, MailSettingsView } from "./settings-types";
export { NO_MAIL, MAIL_PORTS } from "./settings-types";

/**
 * SMTP settings stored in the database, for installations where nobody wants
 * to edit a file over ssh to send an email.
 *
 * This is a real trade-off and worth naming. A password in the database is a
 * password in every backup, and the backups are plain files on the same disk.
 * The environment is still the better place and still wins where it is set —
 * but a mail server that nobody can configure is a mail server that never
 * sends anything, and an unsendable password reset helps no one at all.
 *
 * So: the environment takes precedence, this is the fallback, and the settings
 * page says which is in force.
 */
export function storedMail(): MailShape | null {
  const raw = getSetting("mail");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<MailShape>;
    const text = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
    const host = text(parsed.host);
    const from = text(parsed.from);
    if (!host || !from) return null;

    const port = Number(parsed.port);
    return {
      host,
      port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 587,
      secure: parsed.secure === true,
      user: text(parsed.user),
      pass: typeof parsed.pass === "string" ? parsed.pass : "",
      from,
      replyTo: text(parsed.replyTo),
    };
  } catch {
    return null;
  }
}

export function saveMail(settings: MailShape, userId: number | null): void {
  setSetting("mail", JSON.stringify(settings), userId);
}

export function clearMail(userId: number | null): void {
  setSetting("mail", JSON.stringify(NO_MAIL_VALUE), userId);
}
