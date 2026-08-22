"use server";

import { revalidatePath } from "next/cache";
import { answer as recordAvailability, byToken } from "@/lib/availability";

export type AnswerState = { error?: string };

/**
 * Records a DJ's answer from the emailed link.
 *
 * Deliberately a POST rather than something the page does on load: mail
 * clients and corporate link scanners fetch URLs by themselves, and an answer
 * a spam filter can submit on a DJ's behalf is worse than no answer.
 */
export async function recordAnswer(
  _prev: AnswerState,
  formData: FormData,
): Promise<AnswerState> {
  const token = String(formData.get("token") ?? "");
  const choice = String(formData.get("answer") ?? "");
  const note = String(formData.get("note") ?? "");

  if (choice !== "available" && choice !== "unavailable") {
    return { error: "Pick one of the two answers." };
  }

  const request = byToken(token);
  if (!request) return { error: "This link is no longer valid. Ask Martin to send a new one." };

  recordAvailability(token, choice, note);

  revalidatePath(`/available/${token}`);
  revalidatePath(`/events/${request.event_id}`);
  revalidatePath("/dashboard");
  return {};
}
