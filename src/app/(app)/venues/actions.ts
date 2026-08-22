"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createVenue, deleteVenue, updateVenue, type VenueInput } from "@/lib/events";
import { addVenueAlias, relinkVenues, removeVenueAlias } from "@/lib/venue-reports";

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
  await requireAdmin();
  const input = readVenue(formData);
  if (!input) return;

  const id = formData.get("id");
  if (id) updateVenue(Number(id), input);
  else createVenue(input);

  revalidatePath("/venues");
  revalidatePath("/events");
}

export async function removeVenue(formData: FormData): Promise<void> {
  await requireAdmin();
  // Events keep their booking; venue_id is set to NULL by the FK rule.
  deleteVenue(Number(formData.get("id")));
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
  await requireAdmin();

  const alias = String(formData.get("alias") ?? "").trim();
  const venueId = Number(formData.get("venue_id"));
  if (!alias || !Number.isInteger(venueId)) return;

  addVenueAlias(alias, venueId);
  relinkVenues();
  revalidatePath("/venues");
}

export async function unmapVenueName(formData: FormData): Promise<void> {
  await requireAdmin();
  removeVenueAlias(String(formData.get("alias") ?? ""));
  revalidatePath("/venues");
}
