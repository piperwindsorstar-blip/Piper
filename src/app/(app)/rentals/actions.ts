"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { asActor } from "@/lib/audit";
import { recordAction, recordChanges, rentalSubject } from "@/lib/activity";
import { ITEM_MAX, isRentalState } from "@/lib/rentals-types";
import { rentalNotify } from "@/lib/settings";
import { rentalBooked } from "@/lib/mail-templates";
import { mailIsConfigured, sendDirect } from "@/lib/mail";
import { baseUrl } from "@/lib/urls";
import {
  createRental,
  createSupplier,
  deleteRental,
  getRental,
  getSupplier,
  setSupplierActive,
  updateRental,
  updateSupplier,
} from "@/lib/rentals";

export type RentalsState = { error?: string; ok?: string };

/**
 * Tells the office a hire has been arranged.
 *
 * Deliberately best-effort. The hire is already saved by the time this runs, so
 * a mail server that is down, misconfigured or simply not set up must not turn
 * a successful booking into an error — the person in the warehouse did their
 * job and the record is correct either way. Failures go to the log, where the
 * next person to wonder why the emails stopped will find them.
 *
 * Skipped when the person booking is the person being told. Being emailed about
 * something you did ten seconds ago trains people to ignore the emails.
 */
async function announceHire(
  rental: {
    item: string;
    quantity: number;
    starts_on: string;
    ends_on: string;
    job: string | null;
    reference: string | null;
    cost: string | null;
    notes: string | null;
  },
  supplier: { name: string; phone: string | null },
  bookedBy: { name: string; email: string },
): Promise<void> {
  const notify = rentalNotify();
  if (!notify.on || !mailIsConfigured()) return;

  // Never back to whoever booked it. Being emailed about something you did ten
  // seconds ago only teaches people to ignore the emails — but the others on
  // the list still hear about it, which is the whole point of a list.
  const mine = bookedBy.email.trim().toLowerCase();
  const to = notify.to.filter((address) => address.trim().toLowerCase() !== mine);
  if (to.length === 0) return;

  const origin = await baseUrl();
  const mail = rentalBooked({
    place: supplier.name,
    placePhone: supplier.phone,
    item: rental.item,
    quantity: rental.quantity,
    pickUp: rental.starts_on,
    dropOff: rental.ends_on,
    job: rental.job,
    reference: rental.reference,
    cost: rental.cost,
    notes: rental.notes,
    bookedBy: bookedBy.name,
    link: `${origin}/rentals`,
  });

  const result = await sendDirect({ to: to.join(", "), subject: mail.subject, body: mail.body });
  if (!result.ok) {
    console.error(`[piper] could not announce a hire: ${result.error}`);
  }
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim() || null;

/* -------------------------------------------------------------- suppliers */

export async function saveSupplier(
  _prev: RentalsState,
  formData: FormData,
): Promise<RentalsState> {
  const admin = await requireAdmin();

  const name = text(formData, "name");
  if (!name) return { error: "Give the place a name." };

  const input = {
    name,
    contact: text(formData, "contact"),
    phone: text(formData, "phone"),
    notes: text(formData, "notes"),
  };

  const idRaw = formData.get("id");
  if (idRaw) {
    const id = Number(idRaw);
    const before = getSupplier(id);
    if (!before) return { error: "That place has already gone." };
    updateSupplier(id, input);
    recordChanges(rentalSubject(id, name), asActor(admin), [
      { field: "Rental place — name", from: before.name, to: input.name },
      { field: "Rental place — contact", from: before.contact, to: input.contact },
      { field: "Rental place — phone", from: before.phone, to: input.phone },
    ]);
  } else {
    const id = createSupplier(input);
    recordAction(rentalSubject(id, name), asActor(admin), "created");
  }

  revalidatePath("/rentals");
  return { ok: `Saved ${name}.` };
}

export async function toggleSupplier(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const supplier = getSupplier(id);
  if (!supplier) return;

  const activate = formData.get("activate") === "1";
  setSupplierActive(id, activate);
  recordAction(
    rentalSubject(id, supplier.name),
    asActor(admin),
    activate ? "restored" : "retired",
  );
  revalidatePath("/rentals");
}

/* ---------------------------------------------------------------- rentals */

/**
 * One hire, added or edited from the chart.
 *
 * Overlaps are allowed, unlike the board. Two consoles from the same supplier
 * over the same fortnight is an ordinary week, not a double-booking — the
 * supplier is the row, and they have more than one of most things. A vehicle
 * is a single unit and that is why the board refuses.
 */
export async function saveRental(_prev: RentalsState, formData: FormData): Promise<RentalsState> {
  const admin = await requireAdmin();

  const supplierId = Number(formData.get("supplier_id"));
  const item = text(formData, "item");
  const state = formData.get("state");
  const startsOn = formData.get("starts_on");
  const endsOnRaw = formData.get("ends_on");
  const endsOn = isDate(endsOnRaw) ? endsOnRaw : startsOn;

  if (!Number.isInteger(supplierId)) return { error: "Which place is it from?" };
  if (!item) return { error: "Say what the item is." };
  if (item.length > ITEM_MAX) return { error: `Keep the item under ${ITEM_MAX} characters.` };
  if (!isRentalState(state)) return { error: "Pick where the hire is up to." };
  if (!isDate(startsOn) || !isDate(endsOn)) return { error: "Those dates aren't real dates." };
  if (endsOn < startsOn) return { error: "It can't go back before it arrives." };

  const supplier = getSupplier(supplierId);
  if (!supplier) return { error: "That place no longer exists." };

  const quantityRaw = Number(formData.get("quantity") ?? 1);
  const quantity = Number.isInteger(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;

  const input = {
    supplier_id: supplierId,
    item,
    quantity,
    state,
    starts_on: startsOn,
    ends_on: endsOn,
    job: text(formData, "job"),
    reference: text(formData, "reference"),
    cost: text(formData, "cost"),
    notes: text(formData, "notes"),
  };

  const idRaw = formData.get("id");
  if (idRaw) {
    const id = Number(idRaw);
    const before = getRental(id);
    if (!before) return { error: "That hire has already gone." };
    updateRental(id, input);
    recordChanges(rentalSubject(supplierId, supplier.name), asActor(admin), [
      { field: `Hire — ${item}`, from: before.state, to: state },
      { field: `Hire — ${item} from`, from: before.starts_on, to: startsOn },
      { field: `Hire — ${item} back`, from: before.ends_on, to: endsOn },
    ]);
  } else {
    createRental(input);
    recordAction(rentalSubject(supplierId, supplier.name), asActor(admin), "hired");

    // Only on a new hire. An edit that nudges a date by a day does not need to
    // reach somebody's phone, and a booking that mails on every save is a
    // booking nobody reads the mail about.
    await announceHire(input, supplier, { name: admin.name, email: admin.email });
  }

  revalidatePath("/rentals");
  return { ok: "Saved." };
}

export async function removeRental(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) deleteRental(id);
  revalidatePath("/rentals");
}

/**
 * Marks a hire back, from the overdue list.
 *
 * A one-click control because the alternative is opening a dialog to change a
 * single word, and a nag nobody can silence in one move is a nag people learn
 * to scroll past.
 */
export async function markReturned(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const rental = getRental(id);
  if (!rental) return;
  const supplier = getSupplier(rental.supplier_id);

  updateRental(id, { ...rental, state: "returned" });
  recordAction(
    rentalSubject(rental.supplier_id, supplier?.name ?? "Rental"),
    asActor(admin),
    "returned",
  );
  revalidatePath("/rentals");
}
