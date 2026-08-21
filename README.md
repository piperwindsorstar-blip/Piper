# Piper

A CRM for wedding DJ companies. Built around the two things that actually take
the time: **keeping the calendar straight**, and **planning the music and the
run of the night** with each couple.

Everything runs locally against a SQLite file — no cloud account, no monthly
bill, no setup beyond `npm install`.

## What it does

**Events & calendar**
- Every wedding as a record: the couple, their contact details, venue and room,
  guest count, package, and the full run of day (load in → ceremony →
  cocktails → reception → music off).
- Month calendar showing every event, colour-coded by status.
- **Double-booking protection.** Two live events on one date get the day
  outlined on the calendar and a warning on the event itself. If the *same DJ*
  is on both, the warning escalates — that's a clash, not a busy day.
- Filter and search events by couple, venue, email, status or assigned DJ.
- Venue book: address, day-of contact, and the load-in notes you only want to
  work out once (parking, power, elevator, curfew).

**Music & timeline planning**
- Song slots in the order a wedding runs — prelude, processional, recessional,
  cocktail, dinner, grand entrance, first dance, parent dances, cake, bouquet,
  must-play, **do-not-play**, last dance.
- Single-song slots (first dance, last dance) hold one pick and replace it;
  list slots (must-play, cocktail) stack and reorder.
- Reception timeline you can build from a standard running order in one click,
  then reorder and time to the venue.

**The couple's planner**
- Every event gets a private link. The couple opens it with **no login**, picks
  their songs, and answers the questions you'd otherwise chase over email:
  the vibe, genres to avoid, wedding party names for introductions, tricky
  pronunciations, who needs a microphone, who to call on the day.
- Their picks land straight on your music page tagged *From couple*.
- They can't see or touch your internal notes, and can only remove songs they
  added themselves.
- Lost the link, or sent it to the wrong address? Revoke and regenerate — the
  old link dies immediately.

**Team & roles**
- **Admin** (you and your office manager): sees and edits everything.
- **DJ**: sees only the events they're assigned to — on the dashboard, the
  calendar, the event list, and by direct URL. Another DJ's wedding returns a
  404, not a permission error.
- Departing DJs get deactivated, not deleted: they're signed out immediately and
  lose access, but their name stays on the events they played.
- Guardrails stop you removing the last admin or your own admin access.

## Running it

```bash
npm install
npm run db:reset     # creates data/piper.db and seeds a demo season
npm run dev          # http://localhost:3000
```

The seed creates four sign-ins, all with password `piper1234`:

| Email | Name | Role |
| --- | --- | --- |
| `owner@piper.test` | Sam Rivera | Admin |
| `office@piper.test` | Dana Cole | Admin |
| `jordan@piper.test` | Jordan Blake | DJ |
| `mina@piper.test` | Mina Osei | DJ |

Sign in as Sam to see everything, then as Jordan to see how much less a DJ sees.
The seeded season includes a deliberate double-booking so you can see the
warnings work.

**Starting clean instead** — no demo data, just your own account:

```bash
rm -rf data/
npm run create-admin -- "you@example.com" "Your Name" "a-real-password"
npm run dev
```

Then add the rest of your team from the **Team** page. The same command gets you
back in if you ever lock yourself out.

### Production

```bash
npm run build
npm run start
```

Serve it behind HTTPS. Session cookies are marked `Secure` when
`NODE_ENV=production`, so a plain-HTTP deployment will not keep anyone signed
in (localhost is exempt, which is why `npm run start` works locally).

### Tests

```bash
npm run typecheck
npm run smoke        # needs a server running on the seeded demo data
npm run responsive   # same, checks layout at four screen widths
```

The smoke suite drives a real browser through 33 checks: sign-in, role scoping,
event creation and validation, music slots, timeline seeding, the couple's
planner, and token revocation. The responsive suite loads every screen at phone,
small-phone, tablet and desktop widths and asserts the layout adapts.

## How it's built

- **Next.js 16** (App Router, Server Components, Server Actions) + **React 19**
- **SQLite** via `better-sqlite3`, schema in `src/lib/schema.sql`
- **Sessions** in the database, cookie-based, scrypt-hashed passwords — no auth
  dependency
- **Zod** for form validation
- Plain CSS with light and dark themes, responsive down to 360px

```
src/
  lib/           db, auth, events, planning, team, dates, types
  app/
    (app)/       the signed-in application (dashboard, calendar, events, venues, team)
    login/       sign-in
    plan/[token] the couple's planner — public, token-only
scripts/
  seed.ts          demo season
  create-admin.ts  bootstrap a real admin account
  smoke.mjs        end-to-end checks
  responsive.mjs   layout checks across screen widths
```

## On a phone

The app is built for a desktop first — that's where you'll do your booking — but
it works on a phone, which is where your DJs and couples will actually open it:

- The sidebar collapses behind a menu button, so a page starts with its content.
- The calendar swaps its seven-column grid for an agenda list, because a name
  can't fit in a 50px column. Same events, actually readable.
- Event tables become stacked cards with each field labelled.
- The couple's planner is comfortable on a phone, which matters most — that's
  where couples will fill it in.

Data lives in `data/piper.db` and is gitignored — it's your business records, not
source code. Back it up by copying that file (all three `piper.db*` files if the
server is running).

## Notes on scope

This first version covers events, the calendar, and music/timeline planning.
Deliberately **not** included yet: the lead/inquiry pipeline, quotes, contracts,
and payment tracking. The event record has a `package_name` field as a
placeholder, but there's no money in the system — nothing tracks a deposit or
tells you what's owed.
