"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { asActor } from "@/lib/audit";
import { recordChanges, settingsSubject } from "@/lib/activity";
import {
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

export type SettingsState = { error?: string; ok?: string };

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
    return { error: `Keep the standing rules under ${RULES_MAX} characters.` };
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
