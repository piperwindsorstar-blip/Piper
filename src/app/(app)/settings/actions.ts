"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { asActor } from "@/lib/audit";
import { recordChanges, settingsSubject } from "@/lib/activity";
import {
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
