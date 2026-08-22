"use server";

import { redirect } from "next/navigation";
import { completeReset, resetTarget } from "@/lib/password-reset";
import { recordAction, staffSubject } from "@/lib/activity";

export type ResetState = { error?: string };

/** Short enough that people will actually use it, long enough to be worth having. */
const MIN_LENGTH = 8;

/**
 * Sets a new password from a reset link.
 *
 * The token comes from the form rather than the URL because the action has no
 * route params of its own; it is re-checked here regardless, since the page
 * having rendered proves nothing about the moment the form is submitted.
 */
export async function setNewPassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_LENGTH) {
    return { error: `Your new password needs at least ${MIN_LENGTH} characters.` };
  }
  if (password !== confirm) {
    return { error: "Those two passwords don't match." };
  }

  // Read the target before spending the token, so the history row can name the
  // person — afterwards the token no longer resolves.
  const target = resetTarget(token);
  if (!target) {
    return {
      error:
        "That link has expired or has already been used. Ask for a new one and " +
        "use the most recent email.",
    };
  }

  if (!completeReset(token, password)) {
    return { error: "That link has just been used. Ask for a new one." };
  }

  // Recorded as the person's own action: nobody else authorised it, and the
  // password itself is never written anywhere.
  recordAction(
    staffSubject(target.user),
    { userId: target.user.id, label: target.user.name },
    "password_reset",
  );

  redirect("/login?reset=1");
}
