"use server";

import { revalidatePath } from "next/cache";
import { getEventByToken } from "@/lib/events";
import {
  addSong,
  deleteSong,
  getQuestionnaire,
  markPlanSubmitted,
  saveQuestionnaire,
  setSingleSong,
  songsForEvent,
} from "@/lib/planning";
import { categoryFor } from "@/lib/types";

/**
 * The planner is authenticated by its token alone, so every action resolves the
 * event from the token — a couple can only ever touch their own wedding.
 */
function eventFor(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  return getEventByToken(token);
}

export async function clientAddSong(formData: FormData): Promise<void> {
  const event = eventFor(formData);
  if (!event) return;

  const category = String(formData.get("category") ?? "");
  const meta = categoryFor(category);
  const title = String(formData.get("title") ?? "").trim();
  if (!meta?.client || !title) return;

  const song = {
    event_id: event.id,
    category,
    title,
    artist: String(formData.get("artist") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    source: "client" as const,
  };

  if (meta.single) setSingleSong(song);
  else addSong(song);

  revalidatePath(`/plan/${event.plan_token}`);
}

export async function clientDeleteSong(formData: FormData): Promise<void> {
  const event = eventFor(formData);
  if (!event) return;

  // Couples can only pull songs they added themselves, never the DJ's entries.
  const id = Number(formData.get("id"));
  const song = songsForEvent(event.id).find((s) => s.id === id);
  if (!song || song.source !== "client") return;

  deleteSong(id, event.id);
  revalidatePath(`/plan/${event.plan_token}`);
}

export async function clientSaveQuestionnaire(formData: FormData): Promise<void> {
  const event = eventFor(formData);
  if (!event) return;

  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;

  saveQuestionnaire(event.id, {
    preferred_genres: text("preferred_genres"),
    avoid_genres: text("avoid_genres"),
    vibe_notes: text("vibe_notes"),
    announcements: text("announcements"),
    wedding_party: text("wedding_party"),
    mic_needs: text("mic_needs"),
    takes_requests: formData.get("takes_requests") ? 1 : 0,
    contact_on_day: text("contact_on_day"),
  });

  revalidatePath(`/plan/${event.plan_token}`);
}

export async function clientSubmitPlan(formData: FormData): Promise<void> {
  const event = eventFor(formData);
  if (!event) return;

  // Saving the details and submitting are one button for the couple.
  await clientSaveQuestionnaire(formData);
  if (!getQuestionnaire(event.id)) return;

  markPlanSubmitted(event.id);
  revalidatePath(`/plan/${event.plan_token}`);
  revalidatePath(`/events/${event.id}`);
}
