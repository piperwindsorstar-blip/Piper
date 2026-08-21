/**
 * The user columns safe to hand around the app — everything except
 * password_hash. Never `SELECT *` for a user: anything passed to a Client
 * Component is serialised into the page's HTML, where the browser can read it.
 *
 * Lives in its own module, free of Next imports, so scripts (create-admin,
 * imports, backups) can use the data layer without pulling in `server-only`,
 * which throws outside a React Server Component.
 */
export const USER_COLUMNS =
  "id, email, name, phone, role, active, emergency_contact, start_date, gear, staff_notes, created_at";
