import { importReports, importSchema } from "@/lib/report-import";

/**
 * Import endpoint for the daily Gmail sync.
 *
 * Piper has no Google credentials of its own, so the scheduled Claude session
 * does the mailbox read and posts parsed reports here. Authenticated with a
 * bearer token from PIPER_IMPORT_TOKEN — if that isn't set the route refuses
 * every request rather than defaulting to open.
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload", issues: parsed.error.issues.slice(0, 10) },
      { status: 422 },
    );
  }

  return Response.json(importReports(parsed.data.reports));
}
