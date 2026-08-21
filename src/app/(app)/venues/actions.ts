"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createVenue, deleteVenue, updateVenue, type VenueInput } from "@/lib/events";

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
