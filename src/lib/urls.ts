import { headers } from "next/headers";

/**
 * The address this Piper is reachable at, for links that have to work from
 * inside an email — the couple's planner, a DJ's availability answer.
 *
 * Taken from the request rather than hard-coded, so the same build works on
 * localhost during development and behind Caddy in production. PIPER_BASE_URL
 * overrides it for the cases with no request to read: a scheduled job, or a
 * script run from the command line.
 */
export async function baseUrl(): Promise<string> {
  const configured = process.env.PIPER_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const head = await headers();
  const host = head.get("host") ?? "localhost:3000";
  // Caddy terminates TLS and forwards the original scheme.
  const proto = head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function plannerUrl(token: string): Promise<string> {
  return `${await baseUrl()}/plan/${token}`;
}

export async function availabilityUrl(token: string, answer: "yes" | "no"): Promise<string> {
  return `${await baseUrl()}/available/${token}?answer=${answer}`;
}
