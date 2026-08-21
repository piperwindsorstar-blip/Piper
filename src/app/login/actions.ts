"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, pruneSessions, verifyPassword } from "@/lib/auth";
import { getUserByEmail } from "@/lib/team";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const user = getUserByEmail(email);
  // Same message either way so the form never confirms which emails exist.
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    return { error: "Those credentials didn't match an active account." };
  }

  pruneSessions();
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
