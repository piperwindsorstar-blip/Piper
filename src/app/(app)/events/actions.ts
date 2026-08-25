"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireArea, type User } from "@/lib/auth";
import {
  asActor,
  eventLabel,
  recordEventAction,
  recordEventUpdate,
} from "@/lib/audit";
import {
  createEvent,
  deleteEvent,
  getEvent,
  getEventRaw,
  regeneratePlanToken,
  updateEvent,
  type EventInput,
} from "@/lib/events";
import { djIntroduction, plannerInvite } from "@/lib/mail-templates";
import { cancelQueuedForEvent, queueOnce } from "@/lib/mail";
import { getUser } from "@/lib/team";
import { plannerUrl } from "@/lib/urls";
import { EVENT_STATUSES } from "@/lib/types";

/**
 * React resets an uncontrolled form once its action resolves, so a rejected
 * submit would otherwise wipe everything typed. The state carries the submitted
 * values back and `stamp` remounts the form with them as the new defaults.
 */
export type FormState = {
  error?: string;
  ok?: string;
  values?: Record<string, string>;
  stamp?: number;
};

function echoValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

/** Empty form inputs come through as "" — store them as NULL, not blank strings. */
const optionalText = z
  .string()
  .transform((v) => (v.trim() === "" ? null : v.trim()))
  .nullable();

const optionalId = z
  .string()
  .transform((v) => (v.trim() === "" ? null : Number(v)))
  .nullable()
  .refine((v) => v === null || Number.isInteger(v), { message: "Invalid selection" });

const eventSchema = z.object({
  status: z.enum(EVENT_STATUSES as [string, ...string[]]),
  partner_one_name: z.string().trim().min(1, "The first name on the booking is required"),
  partner_two_name: optionalText,
  contact_email: optionalText.refine(
    (v) => v === null || z.string().email().safeParse(v).success,
    { message: "Enter a valid contact email" },
  ),
  contact_phone: optionalText,
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a wedding date"),
  load_in_time: optionalText,
  ceremony_time: optionalText,
  cocktail_time: optionalText,
  reception_time: optionalText,
  end_time: optionalText,
  venue_id: optionalId,
  venue_room: optionalText,
  guest_count: z
    .string()
    .transform((v) => (v.trim() === "" ? null : Number(v)))
    .nullable()
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0), {
      message: "Guest count must be a whole number",
    }),
  package_name: optionalText,
  assigned_dj_id: optionalId,
  internal_notes: optionalText,
});

function readEventForm(formData: FormData) {
  return eventSchema.safeParse({
    status: formData.get("status") ?? "tentative",
    partner_one_name: formData.get("partner_one_name") ?? "",
    partner_two_name: formData.get("partner_two_name") ?? "",
    contact_email: formData.get("contact_email") ?? "",
    contact_phone: formData.get("contact_phone") ?? "",
    event_date: formData.get("event_date") ?? "",
    load_in_time: formData.get("load_in_time") ?? "",
    ceremony_time: formData.get("ceremony_time") ?? "",
    cocktail_time: formData.get("cocktail_time") ?? "",
    reception_time: formData.get("reception_time") ?? "",
    end_time: formData.get("end_time") ?? "",
    venue_id: formData.get("venue_id") ?? "",
    venue_room: formData.get("venue_room") ?? "",
    guest_count: formData.get("guest_count") ?? "",
    package_name: formData.get("package_name") ?? "",
    assigned_dj_id: formData.get("assigned_dj_id") ?? "",
    internal_notes: formData.get("internal_notes") ?? "",
  });
}

export async function saveEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireArea("weddings", "edit");

  const parsed = readEventForm(formData);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
      values: echoValues(formData),
      stamp: Date.now(),
    };
  }

  const idRaw = formData.get("id");
  const input = parsed.data as EventInput;

  let eventId: number;
  let djJustAssigned = false;
  if (idRaw) {
    eventId = Number(idRaw);
    // Read before writing: the history needs what each field used to say.
    const before = getEventRaw(eventId);
    updateEvent(eventId, input);
    if (before) {
      recordEventUpdate(eventId, eventLabel(input), asActor(admin), before, input);
      djJustAssigned =
        input.assigned_dj_id !== null && input.assigned_dj_id !== before.assigned_dj_id;
    }
  } else {
    eventId = createEvent(input);
    recordEventAction(eventId, eventLabel(input), asActor(admin), "created");
    djJustAssigned = input.assigned_dj_id !== null;
  }

  await draftEmailsFor(eventId, admin, { newBooking: !idRaw, djJustAssigned });

  revalidatePath("/events");
  revalidatePath("/activity");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect(`/events/${eventId}`);
}

export async function removeEvent(formData: FormData): Promise<void> {
  const admin = await requireArea("weddings", "edit");
  const id = Number(formData.get("id"));

  // Label it before it's gone — the audit row has to stand on its own. Unsent
  // mail is discarded first, while the rows can still be found by event id.
  const doomed = getEventRaw(id);
  cancelQueuedForEvent(id);
  deleteEvent(id);
  if (doomed) {
    recordEventAction(id, eventLabel(doomed), asActor(admin), "deleted");
  }

  revalidatePath("/events");
  revalidatePath("/calendar");
  revalidatePath("/activity");
  revalidatePath("/outbox");
  redirect("/events");
}

export async function rotatePlanLink(formData: FormData): Promise<void> {
  const admin = await requireArea("weddings", "edit");
  const id = Number(formData.get("id"));
  const event = getEventRaw(id);

  regeneratePlanToken(id);
  if (event) {
    recordEventAction(id, eventLabel(event), asActor(admin), "plan_link_rotated");
  }

  revalidatePath(`/events/${id}`);
  revalidatePath("/activity");
}

/**
 * Writes the emails a save has made appropriate, into the outbox. Nothing is
 * sent here — an admin approves each one on the Outbox page.
 *
 * `queueOnce` means saving an event repeatedly cannot stack up duplicate
 * invitations: one of each kind per event, ever.
 */
async function draftEmailsFor(
  eventId: number,
  admin: User,
  what: { newBooking: boolean; djJustAssigned: boolean },
): Promise<void> {
  const event = getEvent(admin, eventId);
  if (!event || !event.contact_email) return;

  if (what.newBooking) {
    const link = await plannerUrl(event.plan_token);
    const draft = plannerInvite(event, link);
    queueOnce({
      eventId,
      kind: "planner_invite",
      to: event.contact_email,
      subject: draft.subject,
      body: draft.body,
    });
  }

  if (what.djJustAssigned && event.assigned_dj_id) {
    const dj = getUser(event.assigned_dj_id);
    if (dj) {
      const draft = djIntroduction(event, dj.name);
      queueOnce({
        eventId,
        kind: "dj_intro",
        to: event.contact_email,
        cc: dj.email,
        subject: draft.subject,
        body: draft.body,
      });
    }
  }
}
