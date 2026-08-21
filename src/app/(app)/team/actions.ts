"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  countAdmins,
  createUser,
  getUser,
  getUserByEmail,
  setActive,
  setPassword,
  updateUser,
  type UserInput,
} from "@/lib/team";

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

export async function addMember(_prev: TeamState, formData: FormData): Promise<TeamState> {
  await requireAdmin();

  const input = readUser(formData);
  const password = String(formData.get("password") ?? "");

  if (!input) return reject("Name, email and role are all required.", formData);
  if (password.length < 8) return reject("Give them a password of at least 8 characters.", formData);
  if (getUserByEmail(input.email)) return reject("Someone already uses that email.", formData);

  createUser(input, password);
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

  const password = String(formData.get("password") ?? "");
  if (password) {
    if (password.length < 8) return reject("A new password needs at least 8 characters.", formData);
    setPassword(id, password);
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
  revalidatePath("/team");
}
