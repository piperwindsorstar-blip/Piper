/**
 * Creates an admin account against the live database — the way to bootstrap a
 * real workspace without the demo seed, and the way back in if you lock
 * yourself out.
 *
 *   npm run create-admin -- "you@example.com" "Your Name" "your-password"
 */
import { db } from "../src/lib/db";
import { createUser, getUserByEmail } from "../src/lib/team";

const [email, name, password] = process.argv.slice(2);

if (!email || !name || !password) {
  console.error('Usage: npm run create-admin -- "email" "Full Name" "password"');
  process.exit(1);
}

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

db(); // ensures the database file and schema exist

if (getUserByEmail(email)) {
  console.error(`${email} already has an account.`);
  process.exit(1);
}

createUser({ email: email.toLowerCase(), name, phone: null, role: "admin" }, password);
console.log(`Admin created: ${name} <${email}>. You can sign in now.`);
