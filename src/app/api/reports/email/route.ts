import { parseReportEmail } from "@/lib/report-email";
import { importReports } from "@/lib/report-import";

/**
 * Where a forwarded crew report lands.
 *
 * The sibling /api/reports/import takes reports already parsed into JSON. This
 * one takes the email itself, so anything that can post an inbound message —
 * a Cloudflare Email Worker, a Postmark inbound webhook, a Google Apps Script
 * on a watched mailbox — can point at Piper without knowing the form's shape.
 *
 * Same token as the import endpoint, and the same refusal to work without one:
 * an unset PIPER_IMPORT_TOKEN closes the door rather than opening it.
 */
export async function POST(request: Request) {
  const expected = process.env.PIPER_IMPORT_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "Import is disabled: PIPER_IMPORT_TOKEN is not set on the server." },
      { status: 503 },
    );
  }

  const offered = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!offered || offered !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Either the raw message as text/plain, or { "raw": "..." } as JSON —
  // inbound webhooks differ and neither shape is worth arguing with.
  const type = request.headers.get("content-type") ?? "";
  let raw: string;
  if (type.includes("application/json")) {
    try {
      const body = (await request.json()) as { raw?: unknown; text?: unknown };
      raw = String(body.raw ?? body.text ?? "");
    } catch {
      return Response.json({ error: "Body must be JSON with a raw field, or text/plain" }, { status: 400 });
    }
  } else {
    raw = await request.text();
  }

  const parsed = parseReportEmail(raw);
  if (!parsed.ok) {
    // 422 rather than 400: the request was fine, the email was not. A sender
    // retrying this forever would never succeed, and should not be told to.
    return Response.json({ error: parsed.reason, filed: 0 }, { status: 422 });
  }

  const result = importReports([parsed.parsed.report]);
  return Response.json({
    ...result,
    kind: parsed.parsed.report.kind,
    job: parsed.parsed.report.job,
    warnings: parsed.parsed.warnings,
  });
}
