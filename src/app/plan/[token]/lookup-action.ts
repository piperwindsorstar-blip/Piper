"use server";

import { resolveTrack, type Resolved } from "@/lib/music-links";

/**
 * Looks up a pasted link and hands back the title and artist.
 *
 * Open to anybody holding a planner token, which is the point — the couple is
 * the one pasting links. It reads a handful of public metadata endpoints and
 * writes nothing, so the worst a caller can do with it is make Piper fetch a
 * song's name. The URL is never fetched as given; see `music-links.ts`.
 */
export async function lookupTrack(url: string): Promise<Resolved> {
  if (typeof url !== "string" || url.length > 2048) {
    return { ok: false, service: null, reason: "That link is too long to be a song." };
  }
  return resolveTrack(url);
}
