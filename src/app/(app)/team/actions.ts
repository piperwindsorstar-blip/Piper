"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { asActor } from "@/lib/audit";
import {
  diffFields,
  recordAction,
  recordChanges,
  staffSubject,
} from "@/lib/activity";
import {
  countAdmins,
  createUser,
  getUser,
  getUserByEmail,
  setActive,
  setPassword,
  updateOwnDetails,
  updateStaffRecord,
  updateUser,
  type UserInput,
} from "@/lib/team";
import { requireUser } from "@/lib/auth";

/**
 * Mirrors the event form: a rejected submit hands back what was typed so React's
 * post-action form reset doesn't make the admin retype it.
 */
export type TeamState = {
  error?: string;
  ok?: string;
  values?: Record<string, string>;
  stamp?: number;
};

function echoValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    // Never echo the password back into the rendered HTML.
    if (typeof value === "string" && key !== "password") values[key] = value;
  }
  return values;
}

function reject(message: string, formData: FormData): TeamState {
  return { error: message, values: echoValues(formData), stamp: Date.now() };
}

function readUser(formData: FormData): UserInput | null {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "dj");

  if (!email || !name || (role !== "admin" && role !== "dj")) return null;

  return {
    email,
    name,
    phone: String(formData.get("phone") ?? "").trim() || null,
    role,
  };
}

/** What an edit to the sign-in details is called in the history. */
const LOGIN_FIELD_LABELS = {
  email: "Email",
  name: "Name",
  phone: "Phone",
  role: "Role",
} as const;

const STAFF_FIELD_LABELS = {
  emergency_contact: "Emergency contact",
  start_date: "Start date",
  gear: "Gear",
  staff_notes: "Staff notes",
} as const;

export async function addMember(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const admin = await requireAdmin();

  const input = readUser(formData);
  const password = String(formData.get("password") ?? "");

  if (!input) return reject("Name, email and role are all required.", formData);
  if (password.length < 8) return reject("Give them a password of at least 8 characters.", formData);
  if (getUserByEmail(input.email)) return reject("Someone already uses that email.", formData);

  const newId = createUser(input, password);
  recordAction(staffSubject({ id: newId, name: input.name }), asActor(admin), "added");
  revalidatePath("/team");
  return { ok: `${input.name} can now sign in.` };
}

export async function editMember(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const admin = await requireAdmin();

  const id = Number(formData.get("id"));
  const input = readUser(formData);
  if (!input) return reject("Name, email and role are all required.", formData);

  const existing = getUser(id);
  if (!existing) return reject("That person no longer exists.", formData);

  const clash = getUserByEmail(input.email);
  if (clash && clash.id !== id) return reject("Someone already uses that email.", formData);

  // Don't let the last admin (or yourself) demote away the only way back in.
  if (existing.role === "admin" && input.role !== "admin" && countAdmins() <= 1) {
    return reject("You need at least one admin. Promote someone else first.", formData);
  }
  if (existing.id === admin.id && input.role !== "admin") {
    return reject("You can't remove your own admin access.", formData);
  }

  updateUser(id, input);
  recordChanges(
    staffSubject({ id, name: input.name }),
    asActor(admin),
    diffFields(LOGIN_FIELD_LABELS, existing, input),
  );

  const password = String(formData.get("password") ?? "");
  if (password) {
    if (password.length < 8) return reject("A new password needs at least 8 characters.", formData);
    setPassword(id, password);
    // The password itself is never recorded — only that it was changed, by whom.
    recordAction(staffSubject({ id, name: input.name }), asActor(admin), "password_set");
  }

  revalidatePath("/team");
  return { ok: "Saved." };
}

export async function toggleMember(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = Number(formData.get("id"));
  const activate = formData.get("activate") === "1";
  const target = getUser(id);
  if (!target || target.id === admin.id) return;
  if (!activate && target.role === "admin" && countAdmins() <= 1) return;

  setActive(id, activate);
  recordAction(
    staffSubject(target),
    asActor(admin),
    activate ? "reactivated" : "deactivated",
  );
  revalidatePath("/team");
}

/* ------------------------------------------------------------ staff record */

export async function saveStaffRecord(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const admin = await requireAdmin();

  const id = Number(formData.get("id"));
  const existing = getUser(id);
  if (!existing) return reject("That person no longer exists.", formData);

  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;
  const startDate = text("start_date");
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return reject("Start date needs to be a real date.", formData);
  }

  const record = {
    emergency_contact: text("emergency_contact"),
    start_date: startDate,
    gear: text("gear"),
    staff_notes: text("staff_notes"),
  };
  updateStaffRecord(id, record);
  recordChanges(
    staffSubject(existing),
    asActor(admin),
    diffFields(STAFF_FIELD_LABELS, existing, record),
  );

  revalidatePath(`/team/${id}`);
  revalidatePath("/team");
  return { ok: "Staff record saved." };
}

/* --------------------------------------------------------- your own details */

export async function saveOwnDetails(_prev: TeamState, formData: FormData): Promise<TeamState> {
  // Deliberately not admin-gated, and deliberately ignores any id in the form:
  // this only ever edits the signed-in user.
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return reject("Your name can't be blank.", formData);

  const phone = String(formData.get("phone") ?? "").trim() || null;
  updateOwnDetails(user.id, name, phone);
  recordChanges(staffSubject({ id: user.id, name }), asActor(user), [
    { field: "Name", from: user.name, to: name },
    { field: "Phone", from: user.phone, to: phone },
  ]);

  revalidatePath("/me");
  revalidatePath("/team");
  return { ok: "Saved." };
}
