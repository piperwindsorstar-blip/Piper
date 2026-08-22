# The daily crew-report sync

Crew reports arrive as emails. Piper has no Google credentials of its own, so a
scheduled Claude session reads the mailbox and posts what it finds to
`POST /api/reports/import`.

This file is the specification for that job. It lives here, in the repository,
because it used to live only inside a stored Routine prompt — unversioned,
unreviewable, and gone for good if the Routine were ever deleted. The Routine
now carries a copy for the sake of running standalone; **this file is the one
to change first**, and the rules below have been paid for in production bugs.

## Where it posts

Live at `https://crm.djpynxpro.com/api/reports/import`, authenticated with the
token from `/etc/piper.env` on the droplet:

```bash
sudo grep PIPER_IMPORT_TOKEN /etc/piper.env
```

Rotate it by changing that line and running `sudo systemctl restart piper`; the
Routine's prompt then needs the new value too.

The token authenticates the import and nothing else. If the endpoint's env var
is unset the route refuses every request rather than defaulting to open, so a
misconfigured server fails closed.

## 1. Read the mailbox

Search Gmail for:

```
(subject:"DJ/Photobooth Crew Manager Report" OR subject:"Warehouse Report Crew Manager Report") after:YYYY/MM/DD
```

Use `after:` = a few days before the last successful sync. Re-importing is
free — see *Dedupe* below — so overlap is safer than a gap.

For each matching thread call `get_thread` with `messageFormat: PLAIN_TEXT`.
Thread previews from `search_threads` only show the oldest few messages, so a
busy thread will silently lose reports if you read previews alone.

**Do not ingest "Event Production Crew Manager Report" emails.** Martin was
asked and said to sync this one type only. Job 26-0184 was folded in once by
hand as an exception; leave it, but do not add further Event Production reports
without asking again.

Extract per message:

- **Both kinds:** job number, crew name(s) as free text, sent timestamp, and the
  venue if the form asks for it.
- **DJ/Photobooth:** video dance party yes/no, client / crowd / staff ratings, notes.
- **Warehouse:** return quality 1–5, manifest signed yes/no/not-asked, notes.

## 2. Normalise the job number — the rule that matters most

DJ reports usually carry no dash (`260647`); warehouse reports usually do
(`26-0647`). They have to normalise to the same canonical `YY` + `NNNN` before
they can be matched.

- **With a dash:** digits before it are the year (pad or truncate to 2), digits
  after are the sequence (zero-pad to 4).
- **Without a dash:** strip non-digits, first 2 are the year, the rest zero-pad
  to 4.

The case this exists for: `26647` must normalise to the same value as
`26-0647`, because a dash-less number can be missing its leading zero. A naive
string comparison misses it and the two halves of the job never pair up.

The canonical implementation is `normalizeJob()` in `src/lib/reports.ts`, and
the import endpoint applies it server-side. **Send the raw job number as typed**
and let the server normalise — never hand-compute it into the payload.

## 3. Test entries

Reports with placeholder job numbers (`00-xxxx`) or obviously throwaway content
are test entries. They are kept, but quarantined out of matching, crew stats and
quality figures.

The server decides this from the job number. Only set `isTest` explicitly to
override it.

A caution from a real bug: do not classify on free text containing "test". A
genuine report whose notes read "Endpoint test" was wrongly quarantined that
way. Free text only counts when the *entire* value is a throwaway marker.

## 4. Timestamps

Gmail hands back UTC. Send UTC — `sentAt` is stored as given and converted for
display by the app, which uses `Intl` with `America/Toronto` so EDT and EST are
handled for the actual date.

Do not convert by hand. A manual transcription once shifted every time by four
hours.

## 5. Post it

```
POST {PIPER_URL}/api/reports/import
Authorization: Bearer {PIPER_IMPORT_TOKEN}
Content-Type: application/json

{
  "reports": [
    {
      "kind": "dj",                  // "dj" | "warehouse"
      "reportType": "DJ/Photobooth", // free text, optional
      "job": "260647",               // raw, as typed
      "crew": "Juice, Eric Tremblay",
      "sentAt": "2026-08-20T16:14:00Z",
      "vdp": "Yes",                  // DJ only
      "client": "5 - Amazing",       // ratings accept "5 - Amazing" or 5
      "crowd": 5,
      "staff": 5,
      "quality": null,               // warehouse only
      "manifest": "Yes",             // "Yes"|"No"|null -> yes/no/na
      "notes": "...",
      "venue": "The Grand Oak Barn",   // as the crew typed it, optional
      "sourceId": "<gmail message id>"
    }
  ]
}
```

Every field is coerced leniently on the way in: ratings are pulled out of
strings like `"5 - Amazing"`, blank values become null, and an unparseable
field becomes null rather than failing the batch. One malformed report should
never block a night's imports.

The response reports what happened:

```json
{
  "received": 6,
  "inserted": 4,
  "duplicates": 2,
  "tests": 0,
  "rejected": [{ "index": 5, "reason": "unparseable sentAt: yesterday" }]
}
```

`rejected` names the offending entry by its position in the array you sent, so
a bad row can be found and fixed without guessing. A non-empty `rejected` is
worth mentioning in the run's summary — the rest still imported.

### Dedupe

Reports are unique on `(kind, normalised job, sentAt)`. Re-posting the same
email is a no-op that lands in `duplicates`. This is deliberate: it means the
`after:` window can overlap freely, and a failed run can simply be re-run.

## Venues

Send `venue` exactly as the crew typed it. Piper matches it to a venue record
itself — case, punctuation and a leading "the" are all ignored — and keeps the
raw text either way, so a name it cannot place stays visible under
**Venues → Venue names from reports** where it can be pointed at the right one.
Mapping a name back-fills every past report that used it.

This only works once the report form asks the question. Add a **Venue** field
to the DJ/Photobooth and Warehouse forms; until then `venue` is simply absent
and nothing breaks.

## 6. Report back

Say how many reports were found and how many were new. If Gmail returns nothing
new, say so and stop — don't rebuild or resend anything.

## Checking it worked

```bash
# On the droplet
sudo -u piper env PIPER_DATA_DIR=/var/lib/piper \
  npx tsx -e "import{db}from'./src/lib/db';console.log(db().prepare('SELECT COUNT(*) n, MAX(sent_at) latest FROM crew_reports').get())"
```

Or just open **Crew Reports** in the app — the header shows the most recent
report's timestamp.
