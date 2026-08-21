import { db } from "./db";
import { hashPassword } from "./password";
import type { Role, User } from "./auth";

export function listUsers(includeInactive = false): User[] {
  return db()
    .prepare(
      `SELECT * FROM users ${includeInactive ? "" : "WHERE active = 1"}
       ORDER BY role DESC, name COLLATE NOCASE`,
    )
    .all() as User[];
}

export function listDjs(): User[] {
  return db()
    .prepare("SELECT * FROM users WHERE active = 1 ORDER BY name COLLATE NOCASE")
    .all() as User[];
}

export function getUser(id: number): User | null {
  return (db().prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined) ?? null;
}

export function getUserByEmail(email: string): (User & { password_hash: string }) | null {
  return (
    (db().prepare("SELECT * FROM users WHERE email = ?").get(email) as
      | (User & { password_hash: string })
      | undefined) ?? null
  );
}

export type UserInput = {
  email: string;
  name: string;
  phone: string | null;
  role: Role;
};

export function createUser(input: UserInput, password: string): number {
  const result = db()
    .prepare(
      "INSERT INTO users (email, name, phone, role, password_hash) VALUES (?, ?, ?, ?, ?)",
    )
    .run(input.email, input.name, input.phone, input.role, hashPassword(password));
  return Number(result.lastInsertRowid);
}

export function updateUser(id: number, input: UserInput): void {
  db()
    .prepare("UPDATE users SET email = ?, name = ?, phone = ?, role = ? WHERE id = ?")
    .run(input.email, input.name, input.phone, input.role, id);
}

export function setPassword(id: number, password: string): void {
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), id);
}

/**
 * Deactivating rather than deleting keeps a departed DJ's name on past events.
 * Their sessions are dropped so access ends immediately.
 */
export function setActive(id: number, active: boolean): void {
  db().prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  if (!active) db().prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
}

export function countAdmins(): number {
  const row = db()
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1")
    .get() as { n: number };
  return row.n;
}
