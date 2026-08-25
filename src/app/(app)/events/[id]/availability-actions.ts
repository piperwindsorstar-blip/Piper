"use server";

import { revalidatePath } from "next/cache";
import { requireArea, requireUser } from "@/lib/auth";
import { answerAsDj, askAvailability } from "@/lib/availability";
import { getEvent } from "@/lib/events";
import { queueEmail } from "@/lib/mail";
import { availabilityRequest } from "@/lib/mail-templates";
import { getUser } from "@/lib/team";
import { availabilityUrl } from "@/lib/urls";

export type AskState = { error?: string; ok?: string };

/**
 * Asks a DJ whether they can work an event, and drafts the email that asks
 * them. Like every other email in Piper it waits in the outbox — the question
 * is recorded immediately, but nothing reaches the DJ until it is approved.
 */
export async function askDj(_prev: AskState, formData: FormData): Promise<AskState> {
  const admin = await requireArea("weddings", "edit");

  const eventId = Number(formData.get("event_id"));
  const djId = Number(formData.get("dj_id"));
  if (!Number.isInteger(eventId) || !Number.isInteger(djId)) {
    return { error: "Pick a DJ to ask." };
  }

  const event = getEvent(admin, eventId);
  const dj = getUser(djId);
  if (!event || !dj) return { error: "That booking or DJ no longer exists." };

  const request = askAvailability(eventId, djId);
  const draft = availabilityRequest(
    event,
    dj.name,
    await availabilityUrl(request.token, "yes"),
    await availabilityUrl(request.token, "no"),
  );

  queueEmail({
    eventId,
    kind: "availability_request",
    to: dj.email,
    subject: draft.subject,
    body: draft.body,
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/outbox");
  return { ok: `Asked ${dj.name}. The email is in your outbox.` };
}

/** A signed-in DJ answering from their own dashboard rather than an email. */
export async function answerOwnRequest(formData: FormData): Promise<void> {
  const user = await requireUser();

  const requestId = Number(formData.get("request_id"));
  const choice = String(formData.get("answer") ?? "");
  if (choice !== "available" && choice !== "unavailable") return;

  answerAsDj(requestId, user.id, choice);

  revalidatePath("/dashboard");
  revalidatePath("/events");
}
