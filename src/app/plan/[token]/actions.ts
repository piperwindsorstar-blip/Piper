"use server";

import { revalidatePath } from "next/cache";
import { eventLabel, recordEventAction, THE_COUPLE } from "@/lib/audit";
import { getEventByToken } from "@/lib/events";
import {
  addSong,
  replaceEntranceOrder,
  replaceSpeeches,
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
    cue: String(formData.get("cue") ?? "").trim() || null,
    link: String(formData.get("link") ?? "").trim() || null,
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
    request_policy: text("request_policy"),
    contact_on_day: text("contact_on_day"),
    dedications: text("dedications"),
    last_name_taken: text("last_name_taken"),
    arrival_time: text("arrival_time"),
    mc_name: text("mc_name"),
    bridesmaids: text("bridesmaids"),
    groomsmen: text("groomsmen"),
    venue_phone: text("venue_phone"),
    coordinator_email: text("coordinator_email"),
    table_reserved: text("table_reserved"),
    space_reserved: text("space_reserved"),
    power_each_space: text("power_each_space"),
    outdoor_portions: text("outdoor_portions"),
    uplight_colours: text("uplight_colours"),
    photobooth_hours: text("photobooth_hours"),
    playlist_pre_ceremony: text("playlist_pre_ceremony"),
    playlist_cocktail: text("playlist_cocktail"),
    playlist_dinner: text("playlist_dinner"),
    playlist_dance: text("playlist_dance"),
  });

  revalidatePath(`/plan/${event.plan_token}`);
}

/**
 * The entrance order and speech list post as parallel arrays. Rows the couple
 * left blank are dropped rather than saved as empty lines.
 */
function readRows(formData: FormData, names: string[]): string[][] {
  const columns = names.map((n) => formData.getAll(`${n}[]`).map((v) => String(v).trim()));
  const length = Math.max(0, ...columns.map((c) => c.length));
  const rows: string[][] = [];
  for (let i = 0; i < length; i++) {
    const row = columns.map((c) => c[i] ?? "");
    if (row.some((cell) => cell !== "")) rows.push(row);
  }
  return rows;
}

/** "Yours (Intl Mix) — Russell Dickerson" -> title and artist. */
function splitSong(value: string): { title: string | null; artist: string | null } {
  if (!value) return { title: null, artist: null };
  const parts = value.split(/\s+[—–-]\s+/);
  return { title: parts[0]?.trim() || null, artist: parts.slice(1).join(" - ").trim() || null };
}

export async function clientSubmitPlan(formData: FormData): Promise<void> {
  const event = eventFor(formData);
  if (!event) return;

  // Saving the details and submitting are one button for the couple.
  await clientSaveQuestionnaire(formData);

  replaceEntranceOrder(
    event.id,
    readRows(formData, ["entrance_role", "entrance_names"]).map(([role, names]) => ({
      role,
      names: names || null,
    })),
  );

  replaceSpeeches(
    event.id,
    readRows(formData, ["speech_who", "speech_when", "speech_song", "speech_cue"]).map(
      ([who, when, song, cue]) => {
        const { title, artist } = splitSong(song);
        return {
          who,
          when_text: when || null,
          song_title: title,
          song_artist: artist,
          song_cue: cue || null,
        };
      },
    ),
  );
  if (!getQuestionnaire(event.id)) return;

  // Only the first submit is news; later saves are the couple tweaking.
  const first = event.plan_submitted_at === null;
  markPlanSubmitted(event.id);
  if (first) {
    recordEventAction(event.id, eventLabel(event), THE_COUPLE, "plan_submitted");
  }

  revalidatePath(`/plan/${event.plan_token}`);
  revalidatePath(`/events/${event.id}`);
  revalidatePath("/activity");
}
