"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, pruneSessions, verifyPassword } from "@/lib/auth";
import { recordSignIn } from "@/lib/activity";
import { getUserByEmail } from "@/lib/team";

export type LoginState = { error?: string };

/**
 * Where the request came from, as far as the server can tell.
 *
 * Piper sits behind Caddy, so the socket address is always the proxy. The
 * first entry in X-Forwarded-For is the client Caddy accepted. That header is
 * client-supplied and forgeable in general — here Caddy sets it, so it is
 * trustworthy enough for a log an admin reads, and it is never used to decide
 * anything.
 */
async function requestOrigin(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  // Long enough to tell a phone from a laptop, short enough not to bloat rows.
  const userAgent = h.get("user-agent")?.slice(0, 200) ?? null;
  return { ip, userAgent };
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const user = getUserByEmail(email);
  const origin = await requestOrigin();

  // One message for every kind of failure, so the form never confirms which
  // emails have accounts. The log gets the real reason — that distinction is
  // for the admin reading it later, not for whoever is at the keyboard.
  const reason = !user
    ? "no_account"
    : !user.active
      ? "deactivated"
      : !verifyPassword(password, user.password_hash)
        ? "wrong_password"
        : null;

  if (reason || !user) {
    recordSignIn({
      userId: user?.id ?? null,
      emailTried: email,
      label: user?.name ?? email,
      outcome: "failed",
      reason,
      ...origin,
    });
    return { error: "Those credentials didn't match an active account." };
  }

  recordSignIn({
    userId: user.id,
    emailTried: email,
    label: user.name,
    outcome: "success",
    ...origin,
  });

  pruneSessions();
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
