"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth";
import {
  cancelQueued,
  requeue,
  sendQueued,
  updateDraft,
  verifyMailConnection,
} from "@/lib/mail";

export type OutboxState = { error?: string; ok?: string };

function refresh(): void {
  revalidatePath("/outbox");
  revalidatePath("/dashboard");
}

/** Sends one email, for real. The only place in Piper that does. */
export async function approveAndSend(
  _prev: OutboxState,
  formData: FormData,
): Promise<OutboxState> {
  const admin = await requireArea("outbox", "edit");
  const id = Number(formData.get("id"));

  const result = await sendQueued(id, admin.id);
  refresh();

  return result.ok
    ? { ok: "Sent." }
    : { error: result.error };
}

export async function saveDraft(_prev: OutboxState, formData: FormData): Promise<OutboxState> {
  await requireArea("outbox", "edit");

  const id = Number(formData.get("id"));
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!subject) return { error: "Give it a subject before saving." };
  if (!body) return { error: "The message is empty." };

  updateDraft(id, subject, body);
  refresh();
  return { ok: "Saved." };
}

export async function discard(formData: FormData): Promise<void> {
  await requireArea("outbox", "edit");
  cancelQueued(Number(formData.get("id")));
  refresh();
}

export async function restore(formData: FormData): Promise<void> {
  await requireArea("outbox", "edit");
  requeue(Number(formData.get("id")));
  refresh();
}

/** Checks the mail server accepts the credentials, without sending anything. */
export async function testConnection(
  _prev: OutboxState,
  _formData: FormData,
): Promise<OutboxState> {
  await requireArea("outbox", "edit");
  const result = await verifyMailConnection();
  return result.ok
    ? { ok: "The mail server accepted the connection. Sending should work." }
    : { error: result.error };
}
