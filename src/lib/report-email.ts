import { reportSchema, type ReportInput } from "./report-import";

/**
 * A forwarded crew report, turned into something Piper can file.
 *
 * The reports arrive from the website's form as a table of label/value pairs,
 * one cell per line. Forwarding wraps that in a header block and sometimes in
 * quote markers, so the first job is to find the report inside the forward and
 * the second is to read it without depending on the order of the rows.
 *
 * Labels are matched rather than counted. The form has been edited three times
 * this month — a manifest dropdown here, a venue field there — and a parser
 * that trusted "the value is two lines below the job number" would break every
 * time somebody adds a question.
 *
 * Nothing here writes. It returns what it read, so a person can look at it
 * before it is filed.
 */

export type ParsedReport = {
  report: ReportInput;
  /** What was recognised, to show back before anything is saved. */
  fields: { label: string; value: string }[];
  /** Said plainly rather than silently dropped. */
  warnings: string[];
};

export type ParseResult =
  | { ok: true; parsed: ParsedReport }
  | { ok: false; reason: string };

/* ------------------------------------------------------------- unwrapping */

/**
 * Strips the quote markers mail clients add when forwarding.
 *
 * Outlook and Gmail differ, and a phone differs again. A leading "> " on every
 * line is the one thing they agree on often enough to be worth undoing.
 */
function unquote(raw: string): string {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const quoted = lines.filter((l) => l.trim()).every((l) => /^\s*>+\s?/.test(l));
  return quoted ? lines.map((l) => l.replace(/^\s*>+\s?/, "")).join("\n") : lines.join("\n");
}

/**
 * When the report was sent — not when it was forwarded.
 *
 * This is the half of the dedupe key that stops a report filing twice, so it
 * comes from the forwarded headers rather than the clock. A forward with its
 * headers stripped is refused for that reason: filing it would mean filing it
 * again next time somebody forwards the same thing.
 */
export function findSentAt(raw: string): string | null {
  const header = raw.match(/^\s*(?:Date|Sent)\s*:\s*(.+)$/im);
  if (!header) return null;

  const value = header[1].trim();

  /*
   * Three shapes, because three clients write it three ways.
   *
   * A raw header is RFC 2822 — "Mon, 24 Aug 2026 16:20:54 +0000" — and Date
   * parses it. What a person actually forwards is Gmail's rendering, "Mon,
   * Aug 24, 2026 at 12:20 PM", and the " at " makes Date give up. Outlook
   * writes "Sent:" and its own order. So: try it as given, then try it with
   * the "at" removed.
   */
  const attempts = [value, value.replace(/\s+at\s+/i, " ")];
  for (const attempt of attempts) {
    const when = new Date(attempt);
    if (!Number.isNaN(when.getTime())) return `${when.toISOString().slice(0, 19)}Z`;
  }
  return null;
}

/* ---------------------------------------------------------------- reading */

/** The cells of the form table, in the order they appear. */
function cells(body: string): string[] {
  const out: string[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;

    const inner = trimmed.slice(1, -1).trim();
    if (inner) out.push(inner);
  }
  return out;
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The labels worth reading, by the start of their text.
 *
 * Prefixes rather than whole strings: the job label carries an example in
 * brackets on one form and not the other, and the technical-issues label is a
 * sentence long. Matching the start of it survives both.
 */
const LABELS: { key: string; match: string; label: string }[] = [
  { key: "kind", match: "type of event", label: "Type of event" },
  { key: "job", match: "job", label: "Job number" },
  { key: "venue", match: "venue name", label: "Venue" },
  { key: "crew", match: "crew members", label: "Crew" },
  { key: "vdp", match: "was this a video dance party", label: "Video dance party" },
  { key: "client", match: "show rating client perspective", label: "Client rating" },
  { key: "crowd", match: "crowd vibe", label: "Crowd vibe" },
  { key: "staff", match: "show rating staff perspective", label: "Staff rating" },
  { key: "comment", match: "explain comment", label: "Comment" },
  { key: "technical", match: "technical issues", label: "Technical issues / venue notes" },
  { key: "quality", match: "quality of crew return", label: "Return quality" },
  { key: "manifest", match: "was the manifest signed", label: "Manifest signed" },
  { key: "missing", match: "list any missing items", label: "Missing items" },
  { key: "damaged", match: "list any damaged equipment", label: "Damaged / OOC" },
];

/** Cells that are furniture rather than an answer. */
const IGNORED = ["attach picture", "picture of set up", "view from booth", "coolest picture", "show picture"];

function labelFor(cell: string): (typeof LABELS)[number] | null {
  const n = norm(cell);
  if (IGNORED.some((i) => n.startsWith(i))) return null;
  return LABELS.find((l) => n.startsWith(l.match)) ?? null;
}

/**
 * Reads the form's answers.
 *
 * A value is every cell after a label up to the next one, joined — the long
 * free-text answers wrap onto several cells, and taking only the first would
 * lose most of what a crew wrote.
 */
function answers(body: string): Map<string, string> {
  const found = new Map<string, string[]>();
  let current: string | null = null;

  for (const cell of cells(body)) {
    // A picture question closes whatever field was open rather than being
    // appended to it — otherwise "Attach Picture" ends up inside the crew's
    // note about the damaged console.
    if (IGNORED.some((i) => norm(cell).startsWith(i))) {
      current = null;
      continue;
    }

    const label = labelFor(cell);
    if (label) {
      current = label.key;
      if (!found.has(current)) found.set(current, []);
      continue;
    }
    // Attachment rows: "* 20260824_1259.jpg[](https://pynx.ca/...gf-download...)".
    // Tested on the raw cell, not the normalised one — normalising strips the
    // asterisk that marks it, and the URL then lands in whatever free-text
    // answer came before it.
    if (cell.startsWith("*") || cell.includes("gf-download")) {
      current = null;
      continue;
    }
    if (current) found.get(current)!.push(cell);
  }

  const out = new Map<string, string>();
  for (const [key, parts] of found) {
    const value = parts.join(" ").trim();
    if (value) out.set(key, value);
  }
  return out;
}

/* ---------------------------------------------------------------- parsing */

export function parseReportEmail(raw: string): ParseResult {
  if (!raw || raw.trim().length < 20) {
    return { ok: false, reason: "There's nothing here to read. Paste the whole forwarded email." };
  }

  const body = unquote(raw);
  const found = answers(body);

  // The kind decides which half of the form matters, so it is read first and
  // from two places: the "Type of event" answer, or the subject line.
  const typeAnswer = norm(found.get("kind") ?? "");
  const subject = norm(body.match(/^\s*Subject\s*:\s*(.+)$/im)?.[1] ?? "");
  const haystack = `${typeAnswer} ${subject}`;

  // Event Production reports are deliberately not imported — Martin was asked
  // and said this one type only. Checked before the kind, so it is refused by
  // name rather than falling through as "not a crew report".
  if (haystack.includes("event production")) {
    return {
      ok: false,
      reason: "Event Production reports aren't imported. Only DJ/Photobooth and Warehouse are.",
    };
  }

  const kind: "dj" | "warehouse" | null = haystack.includes("warehouse")
    ? "warehouse"
    : haystack.includes("dj") || haystack.includes("photobooth")
      ? "dj"
      : null;

  if (!kind) {
    return {
      ok: false,
      reason:
        "This doesn't look like a crew report. Piper reads the DJ/Photobooth and Warehouse forms.",
    };
  }

  const job = found.get("job");
  if (!job) {
    return { ok: false, reason: "No job number in that email, so there's nothing to match it to." };
  }

  const sentAt = findSentAt(body);
  if (!sentAt) {
    return {
      ok: false,
      reason:
        "No date in the forwarded headers. Forward the email rather than copying the text, so the " +
        "original date comes with it — that's what stops the same report filing twice.",
    };
  }

  const warnings: string[] = [];
  const notes = [found.get("comment"), found.get("technical"), found.get("missing"), found.get("damaged")]
    .filter(Boolean)
    .join("\n\n");

  /*
   * Through the import schema rather than around it.
   *
   * What a form writes is "4 - Very Good" and "No"; what the table accepts is
   * 4 and 'no'. reportSchema is where that conversion lives, and an earlier
   * version of this file cast past it — which type-checked, inserted nothing,
   * and reported the loss as a duplicate. So the raw answers go in and a
   * validated report comes out, or the email is refused with a reason.
   */
  const candidate = reportSchema.safeParse({
    kind,
    reportType: found.get("kind") ?? null,
    job,
    crew: found.get("crew") ?? null,
    sentAt,
    vdp: found.get("vdp") ?? null,
    client: found.get("client") ?? null,
    crowd: found.get("crowd") ?? null,
    staff: found.get("staff") ?? null,
    quality: found.get("quality") ?? null,
    manifest: found.get("manifest") ?? null,
    notes: notes || null,
    venue: found.get("venue") ?? null,
    sourceId: null,
  });

  if (!candidate.success) {
    const first = candidate.error.issues[0];
    return {
      ok: false,
      reason: `Piper read the email but could not file it: ${first.path.join(".") || "report"} — ${first.message}.`,
    };
  }
  const report: ReportInput = candidate.data;

  if (kind === "dj" && !found.get("crew")) warnings.push("No crew names — the stats can't credit anybody.");
  if (kind === "dj" && !found.get("venue")) warnings.push("No venue, so it won't attach to a venue's notes.");
  if (kind === "warehouse" && !found.get("manifest")) warnings.push("The manifest question wasn't answered.");

  const fields = LABELS.filter((l) => found.has(l.key)).map((l) => ({
    label: l.label,
    value: found.get(l.key) as string,
  }));

  return { ok: true, parsed: { report, fields, warnings } };
}
