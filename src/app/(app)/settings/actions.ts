"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { sendTest } from "@/lib/mail";
import { asActor } from "@/lib/audit";
import { recordChanges, settingsSubject } from "@/lib/activity";
import {
  clearMail,
  NO_MAIL,
  saveMail,
  storedMail,
  RULES_MAX,
  SHOP_LABELS,
  saveShopDetails,
  shopDetails,
  BOARD_NOTE_MAX,
  publicBoard,
  savePublicBoard,
  BANNER_MAX,
  BANNER_TONES,
  loginBanner,
  saveLoginBanner,
  TONE_LABELS,
  type BannerTone,
} from "@/lib/settings";

export type SettingsState = {
  error?: string;
  ok?: string;
  /** What was typed, handed back so a rejected save doesn't empty the form. */
  values?: Record<string, string>;
  /** Changes on every reply, so the form re-mounts and picks the values up. */
  stamp?: number;
};

/**
 * Echoes a rejected submission back to the form.
 *
 * Without this, React re-renders the form after the action and every
 * uncontrolled input falls back to its default — which is empty — so being
 * told "you forgot the password" also silently deletes the server name and the
 * address you just typed. `omit` keeps secrets out of the round trip.
 */
function echo(formData: FormData, omit: string[] = []): Pick<SettingsState, "values" | "stamp"> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !omit.includes(key)) values[key] = value;
  }
  return { values, stamp: Date.now() };
}

/**
 * Saves the notice shown above the sign-in form.
 *
 * Recorded in the audit trail like any other change, and for the same reason:
 * this is the one piece of text in Piper that everybody sees before they have
 * proved who they are, so who put it there is worth knowing.
 */
export async function saveBanner(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const admin = await requireAdmin();

  const message = String(formData.get("message") ?? "").trim();
  const toneRaw = String(formData.get("tone") ?? "info");
  const tone: BannerTone = (BANNER_TONES as readonly string[]).includes(toneRaw)
    ? (toneRaw as BannerTone)
    : "info";
  const on = formData.get("on") === "on";

  if (message.length > BANNER_MAX) {
    return { error: `Keep it under ${BANNER_MAX} characters — it sits above the sign-in box.` };
  }
  if (on && !message) {
    return { error: "Write the message you want people to see, or leave it switched off." };
  }

  const before = loginBanner();
  saveLoginBanner({ on, tone, message }, admin.id);

  recordChanges(settingsSubject, asActor(admin), [
    { field: "Login banner", from: before.on ? "Showing" : "Hidden", to: on ? "Showing" : "Hidden" },
    { field: "Banner tone", from: TONE_LABELS[before.tone], to: TONE_LABELS[tone] },
    { field: "Banner message", from: before.message || null, to: message || null },
  ]);

  revalidatePath("/settings");
  revalidatePath("/login");
  return { ok: on ? "Banner is showing on the sign-in page." : "Banner saved and switched off." };
}


/**
 * Publishes or unpublishes the crew board.
 *
 * Audited like the banner, and for a stronger version of the same reason: this
 * is the switch that decides whether a page of the company's movements is
 * readable by anybody with a link. Who flipped it, and when, is worth being
 * able to answer.
 */
export async function saveBoard(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const admin = await requireAdmin();

  const note = String(formData.get("note") ?? "").trim();
  const on = formData.get("on") === "on";

  if (note.length > BOARD_NOTE_MAX) {
    return { error: `Keep the note under ${BOARD_NOTE_MAX} characters.` };
  }

  const before = publicBoard();
  savePublicBoard({ on, note }, admin.id);

  recordChanges(settingsSubject, asActor(admin), [
    {
      field: "Public crew board",
      from: before.on ? "Published" : "Not published",
      to: on ? "Published" : "Not published",
    },
    { field: "Board note", from: before.note || null, to: note || null },
  ]);

  revalidatePath("/settings");
  revalidatePath("/board");
  return {
    ok: on
      ? "The board is live. Anyone with the address can read it."
      : "The board is no longer published.",
  };
}


/**
 * Saves the shop's details.
 *
 * The codes switch cannot be on while the board switch is off — a stored
 * "publish the gate code" that only waits for somebody to tick a different box
 * is a trap, so it is cleared rather than remembered.
 */
export async function saveShop(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const admin = await requireAdmin();

  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const rules = text("rules");
  if (rules.length > RULES_MAX) {
    return {
      error: `Keep the standing rules under ${RULES_MAX} characters.`,
      ...echo(formData, ["gate", "lockBox"]),
    };
  }

  const showOnBoard = formData.get("showOnBoard") === "on";
  const details = {
    location: text("location"),
    city: text("city"),
    phone: text("phone"),
    emergency: text("emergency"),
    gate: text("gate"),
    lockBox: text("lockBox"),
    yard: text("yard"),
    rules,
    showOnBoard,
    showCodes: showOnBoard && formData.get("showCodes") === "on",
  };

  const before = shopDetails();
  saveShopDetails(details, admin.id);

  // The codes themselves are never written to the history — only whether they
  // are published, which is the part worth being able to answer for.
  recordChanges(settingsSubject, asActor(admin), [
    ...(Object.keys(SHOP_LABELS) as (keyof typeof SHOP_LABELS)[])
      .filter((k) => k !== "gate" && k !== "lockBox")
      .map((k) => ({ field: SHOP_LABELS[k], from: before[k] || null, to: details[k] || null })),
    {
      field: "Gate code set",
      from: before.gate ? "Yes" : "No",
      to: details.gate ? "Yes" : "No",
    },
    {
      field: "Lock box set",
      from: before.lockBox ? "Yes" : "No",
      to: details.lockBox ? "Yes" : "No",
    },
    {
      field: "Shop details on the crew board",
      from: before.showOnBoard ? "Shown" : "Hidden",
      to: details.showOnBoard ? "Shown" : "Hidden",
    },
    {
      field: "Access codes on the crew board",
      from: before.showCodes ? "Published" : "Withheld",
      to: details.showCodes ? "Published" : "Withheld",
    },
  ]);

  revalidatePath("/settings");
  revalidatePath("/board");
  return { ok: "Shop details saved." };
}


/* -------------------------------------------------------------------- mail */

/**
 * Reads SMTP settings out of the form.
 *
 * A blank password means "keep the one already stored", never "clear it".
 * Anything else and every save of an unrelated field — changing the reply-to
 * address, say — would quietly wipe the credential and stop the mail working
 * for reasons nobody would connect to what they just did.
 */
function readMail(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const port = Number(formData.get("port"));
  const typed = String(formData.get("pass") ?? "");
  const stored = storedMail();

  return {
    host: text("host"),
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 587,
    // 465 is implicit TLS; 587 and 25 start plain.
    secure: port === 465,
    user: text("user"),
    pass: typed || stored?.pass || "",
    from: text("from"),
    replyTo: text("replyTo"),
  };
}

export async function saveMailSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const admin = await requireAdmin();

  const settings = readMail(formData);
  // The password is never echoed back — it would then sit in the rendered page.
  const kept = echo(formData, ["pass"]);

  if (!settings.host) {
    return { error: "Which mail server should Piper send through?", ...kept };
  }
  if (!settings.from) return { error: "Set the address Piper should send as.", ...kept };
  if (!settings.pass) return { error: "Set the password for that mailbox.", ...kept };

  const before = storedMail() ?? NO_MAIL;
  saveMail(settings, admin.id);

  // The password is never written to the history, only the fact of it. The
  // history is a screen admins read and a table backups copy.
  recordChanges(settingsSubject, asActor(admin), [
    { field: "Mail server", from: before.host || null, to: settings.host },
    { field: "Mail port", from: before.port ? String(before.port) : null, to: String(settings.port) },
    { field: "Mail username", from: before.user || null, to: settings.user || null },
    { field: "Mail sends as", from: before.from || null, to: settings.from },
    { field: "Mail replies to", from: before.replyTo || null, to: settings.replyTo || null },
    {
      field: "Mail password set",
      from: before.pass ? "Yes" : "No",
      to: settings.pass ? "Yes" : "No",
    },
  ]);

  revalidatePath("/settings");
  revalidatePath("/outbox");
  return { ok: "Mail settings saved. Send yourself a test to be sure." };
}

/**
 * Sends one test message using what is currently in the form.
 *
 * Deliberately not the saved settings: the point is to prove a password before
 * it replaces one that already works, and testing only what is already saved
 * makes that impossible.
 */
export async function testMailSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();

  const to = String(formData.get("to") ?? "").trim();
  const kept = echo(formData, ["pass"]);
  if (!to) return { error: "Put an address in the test box first.", ...kept };

  const settings = readMail(formData);
  if (!settings.host || !settings.from || !settings.pass) {
    return {
      error: "Fill in the server, the address to send as, and the password first.",
      ...kept,
    };
  }

  const result = await sendTest(
    {
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      user: settings.user,
      pass: settings.pass,
      from: settings.from,
      replyTo: settings.replyTo || null,
    },
    to,
  );

  if (!result.ok) return { error: `The mail server refused it: ${result.error}`, ...kept };
  return { ok: `Sent. Check ${to} — if it is not there in a minute, look in junk.` };
}


/**
 * Stops Piper using the settings stored here.
 *
 * Needed because saving refuses a blank server — which is right, since a
 * half-filled mail config is worse than none — but that left no way back out
 * of a wrong one. An admin who mistyped a host could neither fix it by
 * emptying the field nor turn the thing off.
 *
 * The environment is untouched: if /etc/piper.env is supplying the settings,
 * this changes nothing, and the page says so.
 */
export async function clearMailSettings(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  const admin = await requireAdmin();

  const before = storedMail();
  clearMail(admin.id);

  recordChanges(settingsSubject, asActor(admin), [
    { field: "Mail server", from: before?.host ?? null, to: null },
    { field: "Mail password set", from: before?.pass ? "Yes" : "No", to: "No" },
  ]);

  revalidatePath("/settings");
  revalidatePath("/outbox");
  return { ok: "Cleared. Piper will not send email until it is set up again." };
}
