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

/* ----------------------------------------------------------- shop details */

/**
 * The things a crew standing in the yard at six in the morning needs, and
 * cannot get by ringing an office that is shut.
 *
 * Every field is optional; a blank one simply does not appear. They are split
 * into contact and access on purpose — see `SHOP_SENSITIVE`.
 */
export type ShopDetails = {
  location: string;
  city: string;
  phone: string;
  emergency: string;
  gate: string;
  lockBox: string;
  yard: string;
  rules: string;
  /** Whether any of this appears on the public crew board. */
  showOnBoard: boolean;
  /** Whether the access codes appear there too. Separate on purpose. */
  showCodes: boolean;
};

export const NO_SHOP: ShopDetails = {
  location: "",
  city: "",
  phone: "",
  emergency: "",
  gate: "",
  lockBox: "",
  yard: "",
  rules: "",
  showOnBoard: false,
  showCodes: false,
};

/**
 * The fields that are codes rather than contact details.
 *
 * A phone number on a public page is a phone number. A gate code on a public
 * page is a key, and it opens a yard full of equipment for anybody who finds
 * the link. So the two are switched separately, and the codes stay off unless
 * somebody deliberately turns them on.
 */
export const SHOP_SENSITIVE = ["gate", "lockBox"] as const;

export const SHOP_LABELS: Record<
  Exclude<keyof ShopDetails, "showOnBoard" | "showCodes">,
  string
> = {
  location: "Shop address",
  city: "Shop city",
  phone: "PYNX phone",
  emergency: "Emergency number",
  gate: "Gate code",
  lockBox: "Lock box",
  yard: "Yard",
  rules: "Standing rules",
};

export const RULES_MAX = 800;

/* -------------------------------------------------------------------- mail */

/**
 * SMTP settings as an admin edits them. The password is deliberately absent
 * from anything sent to the browser — see `MailSettingsView`.
 */
export type MailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo: string;
};

export const NO_MAIL: MailSettings = {
  host: "",
  port: 587,
  secure: false,
  user: "",
  pass: "",
  from: "",
  replyTo: "",
};

/**
 * What the settings form is allowed to know: everything except the password,
 * which is replaced by a flag saying whether one is stored. A password that
 * round-trips through a form is a password sitting in the page source of every
 * admin's browser, in their history, and in any screenshot they take of it.
 */
export type MailSettingsView = Omit<MailSettings, "pass"> & {
  hasPassword: boolean;
  /** True when /etc/piper.env is supplying the settings and the form cannot. */
  fromEnvironment: boolean;
};

/* ------------------------------------------------------- rental bookings */

/**
 * Who hears about a hire the moment somebody books one.
 *
 * A hire is arranged by whoever is standing in the warehouse, and the person
 * who has to pay for it and plan around it is usually somewhere else. This is
 * the note that closes that gap, and it goes straight out rather than through
 * the approval queue — an internal heads-up that waits for approval is a
 * heads-up that arrives after the van has left.
 */
export type RentalNotify = { on: boolean; to: string[] };

export const NO_RENTAL_NOTIFY: RentalNotify = { on: false, to: [] };

/** How many addresses one notice may go to, so a typo cannot become a mailshot. */
export const NOTIFY_MAX = 10;

/** Deliberately loose. A real check is whether the mail server accepts it. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Splits a typed list of addresses.
 *
 * Commas, semicolons, spaces and newlines all count, because people paste
 * addresses out of whatever they had them in and a list that only accepts one
 * separator silently keeps the first address and drops the rest.
 */
export function splitAddresses(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const address = part.trim();
    if (!address) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(address);
  }
  return out;
}

/** Common ports, so nobody has to remember which one implies TLS. */
export const MAIL_PORTS = [
  { port: 587, label: "587 — STARTTLS (most providers)" },
  { port: 465, label: "465 — TLS from the start" },
  { port: 25, label: "25 — unencrypted, rarely right" },
];
