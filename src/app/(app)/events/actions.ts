"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  createEvent,
  deleteEvent,
  regeneratePlanToken,
  updateEvent,
  type EventInput,
} from "@/lib/events";
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
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an event date"),
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
  await requireAdmin();

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
  if (idRaw) {
    eventId = Number(idRaw);
    updateEvent(eventId, input);
  } else {
    eventId = createEvent(input);
  }

  revalidatePath("/events");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect(`/events/${eventId}`);
}

export async function removeEvent(formData: FormData): Promise<void> {
  await requireAdmin();
  deleteEvent(Number(formData.get("id")));
  revalidatePath("/events");
  revalidatePath("/calendar");
  redirect("/events");
}

export async function rotatePlanLink(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  regeneratePlanToken(id);
  revalidatePath(`/events/${id}`);
}
