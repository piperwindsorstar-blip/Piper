"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { asActor } from "@/lib/audit";
import { diffFields, recordAction, recordChanges, venueSubject } from "@/lib/activity";
import {
  createVenue,
  deleteVenue,
  getVenue,
  updateVenue,
  type VenueInput,
} from "@/lib/events";
import { addVenueAlias, relinkVenues, removeVenueAlias } from "@/lib/venue-reports";

const VENUE_FIELD_LABELS = {
  name: "Name",
  address: "Address",
  city: "City",
  contact_name: "Contact",
  contact_email: "Contact email",
  contact_phone: "Contact phone",
  load_in_notes: "Load-in notes",
} as const;

function readVenue(formData: FormData): VenueInput | null {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return null;

  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;
  return {
    name,
    address: text("address"),
    city: text("city"),
    contact_name: text("contact_name"),
    contact_email: text("contact_email"),
    contact_phone: text("contact_phone"),
    load_in_notes: text("load_in_notes"),
  };
}

export async function saveVenue(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const input = readVenue(formData);
  if (!input) return;

  const id = formData.get("id");
  if (id) {
    // Read before writing: the diff needs the old values, and after the update
    // they are gone.
    const before = getVenue(Number(id));
    updateVenue(Number(id), input);
    recordChanges(
      venueSubject(Number(id), input.name),
      asActor(admin),
      diffFields(VENUE_FIELD_LABELS, before ?? {}, input),
    );
  } else {
    const newId = createVenue(input);
    recordAction(venueSubject(newId, input.name), asActor(admin), "added");
  }

  revalidatePath("/venues");
  revalidatePath("/events");
}

export async function removeVenue(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = Number(formData.get("id"));
  const venue = getVenue(id);
  // Events keep their booking; venue_id is set to NULL by the FK rule.
  deleteVenue(id);
  // Recorded with the name, not the id: the row has to still make sense once
  // the venue it names no longer exists.
  if (venue) recordAction(venueSubject(id, venue.name), asActor(admin), "removed");

  revalidatePath("/venues");
  revalidatePath("/events");
}

/**
 * Tells Piper that a name crews type is a venue you already have, then
 * back-fills every past report that used it. Without the relink, mapping a
 * name would only help future reports — the history that prompted you to map
 * it would stay unmatched.
 */
export async function mapVenueName(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const alias = String(formData.get("alias") ?? "").trim();
  const venueId = Number(formData.get("venue_id"));
  if (!alias || !Number.isInteger(venueId)) return;

  addVenueAlias(alias, venueId);
  const linked = relinkVenues();
  const venue = getVenue(venueId);
  recordChanges(venueSubject(venueId, venue?.name ?? `Venue #${venueId}`), asActor(admin), [
    {
      field: "Name crews use",
      from: null,
      to: linked > 0 ? `${alias} (matched ${linked} past report${linked === 1 ? "" : "s"})` : alias,
    },
  ]);
  revalidatePath("/venues");
}

export async function unmapVenueName(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const alias = String(formData.get("alias") ?? "");
  const venueId = Number(formData.get("venue_id"));
  removeVenueAlias(alias);
  const venue = Number.isInteger(venueId) ? getVenue(venueId) : null;
  recordChanges(venueSubject(venue ? venueId : null, venue?.name ?? "A venue"), asActor(admin), [
    { field: "Name crews use", from: alias, to: null },
  ]);

  revalidatePath("/venues");
}
