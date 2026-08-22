"use server";

import { headers } from "next/headers";
import { getUserByEmail } from "@/lib/team";
import { createReset, pruneResets } from "@/lib/password-reset";
import { mailIsConfigured, sendDirect } from "@/lib/mail";
import { passwordReset } from "@/lib/mail-templates";
import { baseUrl } from "@/lib/urls";

export type ForgotState = { sent?: boolean; error?: string };

/** Matches the reset link's own lifetime; the email says the same number. */
const VALID_HOURS = 2;

/**
 * Asks for a reset link.
 *
 * The reply is identical whether or not the email has an account, whether the
 * account is deactivated, whether the person has already asked five times this
 * hour, and whether the mail server accepted the message. Any of those leaking
 * would turn this form into a way to test which addresses are real.
 *
 * Which is why the "no mail server" case is decided before the account is
 * looked up at all, and not after the send fails. Reporting it after the fact
 * only happens when there was something to send to — so the honest message
 * would have appeared for real addresses and the cheerful one for invented
 * ones, and the difference between them would have been the answer to "does
 * this person work here". Checked up front it says nothing about any account:
 * it is a fact about this installation, true for every address typed.
 */
export async function requestReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter the email address you sign in with." };

  // Before anything is looked up: this answer is the same for every address.
  if (!mailIsConfigured()) {
    return {
      error:
        "Piper can't send email yet, so it can't send a reset link. Ask Martin to " +
        "set your password for you.",
    };
  }

  const head = await headers();
  const ip = head.get("x-forwarded-for")?.split(",")[0]?.trim() ?? head.get("x-real-ip") ?? null;

  pruneResets();

  const user = getUserByEmail(email);
  if (user && user.active) {
    const token = createReset(user.id, ip);
    if (token) {
      const link = `${await baseUrl()}/reset/${token}`;
      const mail = passwordReset(user.name, link, VALID_HOURS);
      // A send failure is deliberately not reported — saying "delivery failed"
      // confirms there was somebody to deliver to. The link is still issued and
      // an admin can read it out from the person's staff page.
      await sendDirect({ to: user.email, subject: mail.subject, body: mail.body });
    }
  }

  return { sent: true };
}
