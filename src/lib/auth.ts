import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, nowIso } from "./db";
export { hashPassword, verifyPassword } from "./password";
import { USER_COLUMNS } from "./user-columns";
export { USER_COLUMNS };

export type Role = "admin" | "dj";

export type User = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  active: number;
  emergency_contact: string | null;
  start_date: string | null;
  gear: string | null;
  staff_notes: string | null;
  created_at: string;
};

const SESSION_COOKIE = "piper_session";
const SESSION_DAYS = 30;

/* ----------------------------------------------------------------- sessions */

export async function createSession(userId: number): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  db()
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, userId, expires.toISOString().replace("T", " ").slice(0, 19));

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = db()
    .prepare(
      `SELECT ${USER_COLUMNS.split(", ").map((c) => `u.${c}`).join(", ")} FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`,
    )
    .get(token, nowIso()) as User | undefined;

  return row ?? null;
}

/** Every page inside the app shell calls this; unauthenticated users go to /login. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

/** Purges expired rows; called opportunistically on login. */
export function pruneSessions(): void {
  db().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
}
