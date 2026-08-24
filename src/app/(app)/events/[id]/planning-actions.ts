"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getEvent, touchEvent } from "@/lib/events";
import {
  addSong,
  addTimelineItem,
  deleteSong,
  deleteTimelineItem,
  moveSong,
  moveTimelineItem,
  seedDefaultTimeline,
  setSingleSong,
  timelineForEvent,
  updateTimelineItem,
} from "@/lib/planning";
import { categoryFor } from "@/lib/types";

/**
 * Every planning mutation re-checks that the signed-in user can see the event,
 * so a DJ cannot edit another DJ's wedding by posting a different id.
 */
async function assertAccess(eventId: number): Promise<void> {
  const user = await requireUser();
  if (!getEvent(user, eventId)) throw new Error("Wedding not found");
}

function refresh(eventId: number): void {
  touchEvent(eventId);
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/music`);
  revalidatePath(`/events/${eventId}/timeline`);
}

/* ----------------------------------------------------------------- songs */

export async function addSongAction(formData: FormData): Promise<void> {
  const eventId = Number(formData.get("event_id"));
  await assertAccess(eventId);

  const category = String(formData.get("category") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title || !categoryFor(category)) return;

  const song = {
    event_id: eventId,
    category,
    title,
    artist: String(formData.get("artist") ?? "").trim() || null,
    cue: String(formData.get("cue") ?? "").trim() || null,
    link: String(formData.get("link") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    source: "team" as const,
  };

  if (categoryFor(category)?.single) setSingleSong(song);
  else addSong(song);

  refresh(eventId);
}

export async function deleteSongAction(formData: FormData): Promise<void> {
  const eventId = Number(formData.get("event_id"));
  await assertAccess(eventId);
  deleteSong(Number(formData.get("id")), eventId);
  refresh(eventId);
}

export async function moveSongAction(formData: FormData): Promise<void> {
  const eventId = Number(formData.get("event_id"));
  await assertAccess(eventId);
  const direction = formData.get("direction") === "up" ? -1 : 1;
  moveSong(Number(formData.get("id")), eventId, direction);
  refresh(eventId);
}

/* -------------------------------------------------------------- timeline */

export async function addTimelineAction(formData: FormData): Promise<void> {
  const eventId = Number(formData.get("event_id"));
  await assertAccess(eventId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  addTimelineItem({
    event_id: eventId,
    start_time: String(formData.get("start_time") ?? "").trim() || null,
    title,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  refresh(eventId);
}

export async function updateTimelineAction(formData: FormData): Promise<void> {
  const eventId = Number(formData.get("event_id"));
  await assertAccess(eventId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  updateTimelineItem(Number(formData.get("id")), eventId, {
    event_id: eventId,
    start_time: String(formData.get("start_time") ?? "").trim() || null,
    title,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  refresh(eventId);
}

export async function deleteTimelineAction(formData: FormData): Promise<void> {
  const eventId = Number(formData.get("event_id"));
  await assertAccess(eventId);
  deleteTimelineItem(Number(formData.get("id")), eventId);
  refresh(eventId);
}

export async function moveTimelineAction(formData: FormData): Promise<void> {
  const eventId = Number(formData.get("event_id"));
  await assertAccess(eventId);
  const direction = formData.get("direction") === "up" ? -1 : 1;
  moveTimelineItem(Number(formData.get("id")), eventId, direction);
  refresh(eventId);
}

export async function seedTimelineAction(formData: FormData): Promise<void> {
  const eventId = Number(formData.get("event_id"));
  await assertAccess(eventId);
  // Only ever seed an empty timeline, so a double-click can't duplicate it.
  if (timelineForEvent(eventId).length === 0) seedDefaultTimeline(eventId);
  refresh(eventId);
}
